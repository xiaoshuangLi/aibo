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
 * **服务中断恢复**：从进程检测到 `disconnect` 后通过 scheduleReconnect() 重新发现。
 * 各进程的重连延迟带有随机抖动（jitter），避免多进程同时断线时争抢同一端口
 * 造成"惊群"（thundering herd）。只有唯一一个进程能绑定端口，其余的进入从进程逻辑。
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

/**
 * isPortFree 和 tryConnect 的安全超时（毫秒）。
 * 端口探测和握手应在局域网内极快完成，5 秒视为超时并返回失败。
 */
const SAFETY_TIMEOUT_MS = 5000;

/**
 * EADDRINUSE 竞争失败后等待的时长（毫秒），让竞争赢家完成初始化再尝试连接。
 */
const POST_CONFLICT_DELAY_MS = 100;

/**
 * 断线重连的基础延迟（毫秒）。
 * 实际延迟 = RECONNECT_BASE_MS + [0, RECONNECT_JITTER_MS) 随机抖动。
 */
const RECONNECT_BASE_MS = 500;

/**
 * 断线重连随机抖动上限（毫秒）。
 * 多进程同时断线时，抖动分散探测时机，降低同时抢占同一端口的概率。
 */
const RECONNECT_JITTER_MS = 500;

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

  /**
   * 待执行的重连定时器。非 null 时表示已有重连在排队，防止重复调度。
   */
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

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
   * 超过 SAFETY_TIMEOUT_MS 仍无响应，视为不可用并返回 false。
   */
  private isPortFree(port: number): Promise<boolean> {
    return new Promise(resolve => {
      const server = net.createServer();
      let settled = false;

      const settle = (result: boolean) => {
        if (settled) return;
        settled = true;
        resolve(result);
      };

      const timer = setTimeout(() => {
        server.close();
        settle(false);
      }, SAFETY_TIMEOUT_MS);

      server.once('error', () => {
        clearTimeout(timer);
        settle(false);
      });

      server.once('listening', () => {
        clearTimeout(timer);
        server.close(() => settle(true));
      });

      server.listen(port, '127.0.0.1');
    });
  }

  // ─── 从进程逻辑 ───────────────────────────────────────────────────────────────

  /**
   * 尝试连接指定端口的 Socket.IO 服务并完成 boay/aibo 握手。
   * 连接失败、断开或 SAFETY_TIMEOUT_MS 内未收到 aibo 应答时返回 false。
   */
  private tryConnect(port: number): Promise<boolean> {
    return new Promise(resolve => {
      let settled = false;
      let timer: ReturnType<typeof setTimeout>;

      const settle = (result: boolean) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        if (!result) socket.disconnect();
        resolve(result);
      };

      const socket = connectIO(`http://127.0.0.1:${port}`, {
        transports: ['websocket'],
        reconnection: false,
        timeout: SAFETY_TIMEOUT_MS,
      });

      // 安全超时：连接或握手若在 SAFETY_TIMEOUT_MS 内未完成，放弃此端口。
      timer = setTimeout(() => settle(false), SAFETY_TIMEOUT_MS);

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
   * - 连接断开后调用 scheduleReconnect() 重新发现主进程
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
      this.scheduleReconnect();
    });
  }

  /**
   * 调度一次重新发现，幂等：已有定时器排队时直接返回，不会叠加多个。
   * 延迟 = RECONNECT_BASE_MS + [0, RECONNECT_JITTER_MS) 随机抖动，
   * 多进程同时断线时可分散探测时机，避免惊群。
   */
  private scheduleReconnect(): void {
    if (this.reconnectTimer !== null) return;

    const jitter = Math.floor(Math.random() * RECONNECT_JITTER_MS);
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.discover(WS_START_PORT).catch(err =>
        console.error('❌ 重新发现失败:', err)
      );
    }, RECONNECT_BASE_MS + jitter);
  }

  // ─── 主进程逻辑 ───────────────────────────────────────────────────────────────

  /**
   * 成为主进程：
   * 1. 在指定端口创建 Socket.IO 服务（仅监听 127.0.0.1）
   * 2. 处理从进程的握手验证
   * 3. 启动飞书 wsClient 长连接
   *
   * 若端口竞争失败（EADDRINUSE），等待 POST_CONFLICT_DELAY_MS 让赢家完成初始化，
   * 再以从进程身份连接，避免赢家尚未就绪时立即连接失败。
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
          // 等待竞争赢家完成初始化，再以从进程身份接入。
          setTimeout(() => {
            this.tryConnect(port).then(verified => {
              if (verified) {
                this.role = 'client';
                console.log(`✅ 飞书消息转发服务连接成功（端口 ${port}）`);
                resolve();
              } else {
                this.discover(port + 1).then(resolve, reject);
              }
            }, reject);
          }, POST_CONFLICT_DELAY_MS);
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
