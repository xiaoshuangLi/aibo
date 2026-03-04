/**
 * 飞书长连接 Socket.IO 转发管理器
 *
 * 由于飞书长连接属于集群模式（同一应用部署多个客户端时只有随机一个收到消息），
 * 本模块在本地启动一个 Socket.IO 服务做消息转发，保证同机多进程都能收到消息。
 *
 * **端口发现流程**（从 WS_START_PORT 开始逐步探测）：
 * 1. 检测端口是否空闲 → 空闲则**成为主进程**：创建 Socket.IO 服务并启动
 *    飞书 wsClient 长连接，将收到的消息广播给所有已连接的从进程。
 * 2. 端口有服务 → **尝试连接**：发送 `boay` 握手事件，收到 `aibo` 回应则
 *    **成为从进程**，通过该服务接收转发的飞书消息。
 * 3. 连接失败（服务不是 aibo）→ 端口 +1，重复上述步骤。
 *
 * **服务中断恢复**：从进程检测到 `disconnect` 后重新从 WS_START_PORT
 * 开始探测，竞争成为新主进程并重启飞书长连接，其余进程连接到新主进程。
 *
 * @module ws-client
 */

import * as net from 'net';
import { createServer as createHttpServer } from 'http';
import * as lark from '@larksuiteoapi/node-sdk';
import { Server as SocketIOServer } from 'socket.io';
import type { Socket as ServerSocket } from 'socket.io';
import { io as connectIO } from 'socket.io-client';
import type { Socket as ClientSocket } from 'socket.io-client';

/** 端口发现起始端口 */
export const WS_START_PORT = 5211;

/** 握手请求事件（从进程 → 主进程） */
const VERIFY_EVENT = 'boay';

/** 握手应答事件（主进程 → 从进程） */
const VERIFY_ACK_EVENT = 'aibo';

/** 转发飞书消息的事件名 */
const LARK_EVENT = 'lark:event';

/** 服务中断后重新探测的延迟（毫秒） */
const RECONNECT_DELAY_MS = 1000;

/** 飞书消息处理回调 */
export type LarkMessageHandler = (data: any) => Promise<void>;

/**
 * 飞书长连接 Socket.IO 转发管理器
 */
export class LarkWsClientManager {
  private readonly wsClient: lark.WSClient;
  private readonly messageHandler: LarkMessageHandler;

  private role: 'none' | 'server' | 'client' = 'none';
  private ioServer: SocketIOServer | null = null;
  private clientSocket: ClientSocket | null = null;
  private readonly verifiedClients: Set<ServerSocket> = new Set();

  constructor(wsClient: lark.WSClient, messageHandler: LarkMessageHandler) {
    this.wsClient = wsClient;
    this.messageHandler = messageHandler;
  }

  /**
   * 启动端口发现流程，从 WS_START_PORT 开始。
   */
  async start(): Promise<void> {
    await this.discover(WS_START_PORT);
  }

  // ─── 端口发现 ────────────────────────────────────────────────────────────────

  /**
   * 端口发现：
   * - 端口空闲 → 成为主进程
   * - 端口被占用 → 尝试连接验证；通过则成为从进程，否则端口 +1 继续
   */
  private async discover(port: number): Promise<void> {
    const free = await this.isPortFree(port);
    if (free) {
      await this.becomeServer(port);
    } else {
      const verified = await this.tryConnect(port);
      if (verified) {
        this.role = 'client';
        console.log(`✅ 飞书消息转发服务连接成功（端口 ${port}）`);
      } else {
        await this.discover(port + 1);
      }
    }
  }

  /**
   * 检测端口是否空闲：在 127.0.0.1 上尝试监听，成功则端口空闲。
   */
  private isPortFree(port: number): Promise<boolean> {
    return new Promise(resolve => {
      const server = net.createServer();
      server.once('error', () => resolve(false));
      server.once('listening', () => server.close(() => resolve(true)));
      server.listen(port, '127.0.0.1');
    });
  }

  // ─── 从进程逻辑 ───────────────────────────────────────────────────────────────

  /**
   * 尝试连接指定端口的 Socket.IO 服务并完成握手：
   * - 连接成功后发送 VERIFY_EVENT，收到 VERIFY_ACK_EVENT 则验证通过
   * - 连接失败（connect_error）或断开则返回 false
   */
  private tryConnect(port: number): Promise<boolean> {
    return new Promise(resolve => {
      let settled = false;

      const settle = (result: boolean) => {
        if (settled) return;
        settled = true;
        if (!result) socket.disconnect();
        resolve(result);
      };

      const socket = connectIO(`http://127.0.0.1:${port}`, {
        transports: ['websocket'],
        reconnection: false,
      });

      socket.on('connect', () => socket.emit(VERIFY_EVENT));

      socket.once(VERIFY_ACK_EVENT, () => {
        this.clientSocket = socket;
        this.setupClientSocket(socket);
        settle(true);
      });

      socket.on('connect_error', () => settle(false));
      socket.on('disconnect', () => settle(false));
    });
  }

  /**
   * 配置已验证的从进程连接：
   * - 监听并分发主进程广播的飞书消息
   * - 连接断开后重新探测，竞争成为新主进程
   */
  private setupClientSocket(socket: ClientSocket): void {
    socket.on(LARK_EVENT, (data: any) => {
      this.messageHandler(data).catch(err =>
        console.error('❌ 处理转发消息失败:', err)
      );
    });

    socket.on('disconnect', () => {
      this.clientSocket = null;
      this.role = 'none';
      console.warn('⚠️ 飞书消息转发服务连接断开，正在重新发现...');
      setTimeout(() => this.discover(WS_START_PORT), RECONNECT_DELAY_MS);
    });
  }

  // ─── 主进程逻辑 ───────────────────────────────────────────────────────────────

  /**
   * 成为主进程：
   * 1. 在指定端口创建 Socket.IO 服务（仅监听 127.0.0.1）
   * 2. 处理从进程的握手验证
   * 3. 启动飞书 wsClient 长连接
   *
   * 若端口竞争失败（EADDRINUSE），则以从进程身份重新连接胜出的主进程。
   */
  private becomeServer(port: number): Promise<void> {
    return new Promise((resolve, reject) => {
      const httpServer = createHttpServer();
      const ioServer = new SocketIOServer(httpServer, {
        transports: ['websocket'],
      });

      ioServer.on('connection', socket => this.handleClientSocket(socket));

      httpServer.once('listening', () => {
        this.ioServer = ioServer;
        this.role = 'server';

        try {
          this.startLongConnection();
          console.log('✅ 飞书长连接已启动，等待用户消息...');
          resolve();
        } catch (error) {
          console.error('❌ 启动飞书长连接失败:', error);
          httpServer.close();
          ioServer.close();
          reject(error);
        }
      });

      httpServer.once('error', (err: NodeJS.ErrnoException) => {
        if (err.code === 'EADDRINUSE') {
          // 端口竞争失败：连接胜出的主进程
          this.tryConnect(port).then(verified => {
            if (verified) {
              this.role = 'client';
              console.log(`✅ 飞书消息转发服务连接成功（端口 ${port}）`);
              resolve();
            } else {
              this.discover(port + 1).then(resolve, reject);
            }
          }, reject);
        } else {
          reject(err);
        }
      });

      httpServer.listen(port, '127.0.0.1');
    });
  }

  /**
   * 处理从进程连接：收到 VERIFY_EVENT 则回应 VERIFY_ACK_EVENT 并加入广播列表。
   */
  private handleClientSocket(socket: ServerSocket): void {
    socket.once(VERIFY_EVENT, () => {
      socket.emit(VERIFY_ACK_EVENT);
      this.verifiedClients.add(socket);
      socket.on('disconnect', () => this.verifiedClients.delete(socket));
    });
  }

  /**
   * 启动飞书 wsClient 长连接，收到消息后本地分发并广播给所有从进程。
   */
  private startLongConnection(): void {
    this.wsClient.start({
      eventDispatcher: new lark.EventDispatcher({}).register({
        'im.message.receive_v1': async data => {
          await this.messageHandler(data);
          this.broadcast(data);
          return { code: 0, msg: 'success' };
        },
      }),
    });
  }

  /**
   * 向所有已验证的从进程广播飞书消息。
   */
  private broadcast(data: any): void {
    for (const socket of this.verifiedClients) {
      socket.emit(LARK_EVENT, data);
    }
  }
}
