/**
 * Tests for LarkWsClientManager (ws-client.ts)
 *
 * All I/O (net, http, socket.io, socket.io-client, lark SDK) is mocked so no
 * real network operations occur.  The mocks are designed to fire events
 * synchronously, making the async discover() chain deterministic.
 */

import { LarkWsClientManager, WS_START_PORT, VERIFY_ACK_EVENT } from '@/presentation/lark/ws-client';

// ─── net mock — drives isPortFree() ──────────────────────────────────────────

const mockNetServer = {
  once: jest.fn(),
  listen: jest.fn(),
  close: jest.fn(),
};
jest.mock('net', () => ({ createServer: jest.fn(() => mockNetServer) }));

// ─── http mock — drives becomeServer() ───────────────────────────────────────

const mockHttpServer = {
  once: jest.fn(),
  on: jest.fn(),
  listen: jest.fn(),
  close: jest.fn(),
};
jest.mock('http', () => ({ createServer: jest.fn(() => mockHttpServer) }));

// ─── socket.io Server mock ────────────────────────────────────────────────────

const mockIOServer = {
  on: jest.fn(),
  close: jest.fn(),
};
jest.mock('socket.io', () => ({ Server: jest.fn(() => mockIOServer) }));

// ─── socket.io-client mock ────────────────────────────────────────────────────

const mockClientSocket = {
  on: jest.fn(),
  once: jest.fn(),
  emit: jest.fn(),
  disconnect: jest.fn(),
};
jest.mock('socket.io-client', () => ({ io: jest.fn(() => mockClientSocket) }));

// ─── lark SDK mock ────────────────────────────────────────────────────────────

const mockLarkHandlers: Record<string, Function> = {};
const mockWsClientStart = jest.fn();
jest.mock('@larksuiteoapi/node-sdk', () => ({
  EventDispatcher: jest.fn().mockImplementation(() => ({
    register: jest.fn().mockImplementation((h: Record<string, Function>) => {
      Object.assign(mockLarkHandlers, h);
      return {};
    }),
  })),
}));

// ─── Helper utilities ─────────────────────────────────────────────────────────

/** Port appears free: net server fires 'listening' then close() calls back. */
function simulateFreePort() {
  mockNetServer.once.mockImplementation((event: string, fn: Function) => {
    if (event === 'listening') fn();
    return mockNetServer;
  });
  mockNetServer.close.mockImplementation((cb?: Function) => cb?.());
}

/** Port appears occupied: net server fires 'error'. */
function simulateOccupiedPort() {
  mockNetServer.once.mockImplementation((event: string, fn: Function) => {
    if (event === 'error') fn(new Error('EADDRINUSE'));
    return mockNetServer;
  });
}

/** Return the LAST handler registered via mockHttpServer.once for an event. */
function getHttpOnceHandler(event: string): Function | undefined {
  let result: Function | undefined;
  for (const [ev, fn] of mockHttpServer.once.mock.calls) {
    if (ev === event) result = fn as Function;
  }
  return result;
}

/** Return the handler for 'connection' registered on mockIOServer.on. */
function getIOConnectionHandler(): Function | undefined {
  for (const [ev, fn] of mockIOServer.on.mock.calls) {
    if (ev === 'connection') return fn as Function;
  }
  return undefined;
}

/** Return the LAST handler registered via mockClientSocket.on/.once for an event. */
function getClientHandler(method: 'on' | 'once', event: string): Function | undefined {
  const mock = method === 'on' ? mockClientSocket.on : mockClientSocket.once;
  let result: Function | undefined;
  for (const [ev, fn] of mock.mock.calls) {
    if (ev === event) result = fn as Function;
  }
  return result;
}

/** Create a minimal mock of a server-side Socket.IO socket. */
function createMockServerSocket() {
  const onceHandlers: Record<string, Function> = {};
  const onHandlers: Record<string, Function[]> = {};
  return {
    emit: jest.fn(),
    disconnect: jest.fn(),
    once: jest.fn((event: string, fn: Function) => { onceHandlers[event] = fn; }),
    on: jest.fn((event: string, fn: Function) => {
      (onHandlers[event] = onHandlers[event] || []).push(fn);
    }),
    fireOnce: (event: string, ...args: any[]) => onceHandlers[event]?.(...args),
    fireOn: (event: string, ...args: any[]) =>
      (onHandlers[event] || []).forEach(fn => fn(...args)),
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('LarkWsClientManager', () => {
  let mockWsClient: any;
  let messageHandler: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    Object.keys(mockLarkHandlers).forEach(k => delete mockLarkHandlers[k]);
    mockWsClient = { start: mockWsClientStart };
    messageHandler = jest.fn().mockResolvedValue(undefined);
  });

  it('exports WS_START_PORT as 5211', () => {
    expect(WS_START_PORT).toBe(5211);
  });

  it('VERIFY_ACK_EVENT falls back to "aibo" when config.lark.appId is not set', async () => {
    // Test the fallback behavior by isolating the module with no appId configured
    let isolatedVerifyAckEvent: string | undefined;
    await jest.isolateModulesAsync(async () => {
      jest.doMock('@/core/config', () => ({
        config: { lark: {} },
      }));
      const mod = await import('@/presentation/lark/ws-client');
      isolatedVerifyAckEvent = mod.VERIFY_ACK_EVENT;
    });
    expect(isolatedVerifyAckEvent).toBe('aibo');
  });

  it('VERIFY_ACK_EVENT uses config.lark.appId when set', async () => {
    // Reload the module in isolation with a mocked config that has appId set.
    let isolatedVerifyAckEvent: string | undefined;
    await jest.isolateModulesAsync(async () => {
      jest.doMock('@/core/config', () => ({
        config: { lark: { appId: 'my-test-app-id' } },
      }));
      // Re-import after the mock is registered
      const mod = await import('@/presentation/lark/ws-client');
      isolatedVerifyAckEvent = mod.VERIFY_ACK_EVENT;
    });
    expect(isolatedVerifyAckEvent).toBe('my-test-app-id');
  });

  // ─── Primary role (port is free) ─────────────────────────────────────────

  describe('primary role — port is free', () => {
    /**
     * Starts as primary.
     * One Promise.resolve() lets discover() proceed past `await isPortFree()`,
     * then we manually fire the httpServer 'listening' event to complete becomeServer().
     */
    async function startAsPrimary() {
      simulateFreePort();
      const manager = new LarkWsClientManager(mockWsClient, messageHandler);
      const p = manager.start();
      await Promise.resolve(); // let discover() reach becomeServer() and register handlers
      getHttpOnceHandler('listening')?.();
      await p;
      return manager;
    }

    it('creates a Socket.IO server bound to 127.0.0.1', async () => {
      await startAsPrimary();
      const { Server } = require('socket.io');
      expect(Server).toHaveBeenCalledWith(mockHttpServer, { transports: ['websocket'] });
      expect(mockHttpServer.listen).toHaveBeenCalledWith(WS_START_PORT, '127.0.0.1');
    });

    it('starts the Lark long connection', async () => {
      await startAsPrimary();
      expect(mockWsClientStart).toHaveBeenCalled();
    });

    it('logs the startup success message', async () => {
      const spy = jest.spyOn(console, 'log').mockImplementation(() => {});
      await startAsPrimary();
      expect(spy).toHaveBeenCalledWith('✅ 飞书长连接已启动，等待用户消息...');
      spy.mockRestore();
    });

    it('rejects if wsClient.start throws', async () => {
      simulateFreePort();
      mockWsClientStart.mockImplementationOnce(() => { throw new Error('lark error'); });
      jest.spyOn(console, 'error').mockImplementation(() => {});
      const manager = new LarkWsClientManager(mockWsClient, messageHandler);
      const p = manager.start();
      await Promise.resolve();
      getHttpOnceHandler('listening')?.();
      await expect(p).rejects.toThrow('lark error');
      jest.restoreAllMocks();
    });

    it('registers im.message.receive_v1 with the event dispatcher', async () => {
      await startAsPrimary();
      expect(mockLarkHandlers['im.message.receive_v1']).toBeDefined();
    });

    it('calls messageHandler and returns success when im.message.receive_v1 fires', async () => {
      await startAsPrimary();
      const data = { message: { content: 'hello' } };
      const result = await mockLarkHandlers['im.message.receive_v1'](data);
      expect(messageHandler).toHaveBeenCalledWith(data);
      expect(result).toEqual({ code: 0, msg: 'success' });
    });

    it('sends VERIFY_ACK_EVENT ack when a secondary sends the boay handshake', async () => {
      await startAsPrimary();
      const client = createMockServerSocket();
      getIOConnectionHandler()?.(client);
      client.fireOnce('boay');
      expect(client.emit).toHaveBeenCalledWith(VERIFY_ACK_EVENT);
    });

    it('broadcasts lark:event to verified clients on Lark message', async () => {
      await startAsPrimary();
      const client = createMockServerSocket();
      getIOConnectionHandler()?.(client);
      client.fireOnce('boay'); // verify handshake

      const data = { message: { content: 'broadcast' } };
      await mockLarkHandlers['im.message.receive_v1'](data);

      expect(client.emit).toHaveBeenCalledWith('lark:event', data);
    });

    it('removes client from broadcast list on disconnect', async () => {
      await startAsPrimary();
      const client = createMockServerSocket();
      getIOConnectionHandler()?.(client);
      client.fireOnce('boay');
      client.fireOn('disconnect'); // client disconnects

      client.emit.mockClear();
      const data = { message: { content: 'after disconnect' } };
      await mockLarkHandlers['im.message.receive_v1'](data);

      expect(client.emit).not.toHaveBeenCalledWith('lark:event', data);
    });
  });

  // ─── Secondary role (port occupied, handshake succeeds) ─────────────────

  describe('secondary role — port occupied, handshake succeeds', () => {
    /**
     * Starts as secondary.
     * One Promise.resolve() lets discover() reach tryConnect() and register
     * socket handlers, then we fire connect→aibo to complete the handshake.
     */
    async function startAsSecondary() {
      simulateOccupiedPort();
      const manager = new LarkWsClientManager(mockWsClient, messageHandler);
      const p = manager.start();
      await Promise.resolve(); // let discover() reach tryConnect() and register handlers
      getClientHandler('on', 'connect')?.();              // fires connect → socket.emit('boay')
      getClientHandler('once', VERIFY_ACK_EVENT)?.();    // fires ack    → settle(true)
      await p;
      return manager;
    }

    it('connects to the existing server via socket.io-client', async () => {
      await startAsSecondary();
      const { io } = require('socket.io-client');
      expect(io).toHaveBeenCalledWith(
        `http://127.0.0.1:${WS_START_PORT}`,
        expect.objectContaining({ transports: ['websocket'], reconnection: false }),
      );
    });

    it('emits boay after connect', async () => {
      jest.useFakeTimers();
      simulateOccupiedPort();
      const manager = new LarkWsClientManager(mockWsClient, messageHandler);
      manager.start();
      await Promise.resolve();
      getClientHandler('on', 'connect')?.();
      expect(mockClientSocket.emit).toHaveBeenCalledWith('boay');
      jest.useRealTimers();
    });

    it('does NOT start the Lark long connection', async () => {
      await startAsSecondary();
      expect(mockWsClientStart).not.toHaveBeenCalled();
    });

    it('logs a connection success message', async () => {
      const spy = jest.spyOn(console, 'log').mockImplementation(() => {});
      await startAsSecondary();
      expect(spy).toHaveBeenCalledWith(expect.stringContaining('飞书消息转发服务连接成功'));
      spy.mockRestore();
    });

    it('forwards lark:event messages to messageHandler', async () => {
      await startAsSecondary();
      const payload = { message: { content: 'forwarded' } };
      getClientHandler('on', 'lark:event')?.(payload);
      await Promise.resolve();
      expect(messageHandler).toHaveBeenCalledWith(payload);
    });

    it('warns and schedules re-discovery on disconnect', async () => {
      const spy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      const manager = await startAsSecondary();
      getClientHandler('on', 'disconnect')?.();
      expect(spy).toHaveBeenCalledWith(expect.stringContaining('飞书消息转发服务连接断开'));
      spy.mockRestore();
      // Cancel the reconnect timer so it doesn't keep Jest alive after tests
      manager.stop();
    });
  });

  // ─── Handshake failure → try next port ───────────────────────────────────

  describe('handshake failure — tries next port', () => {
    it('tries port+1 after connect_error on the first port', async () => {
      const spy = jest.spyOn(console, 'log').mockImplementation(() => {});

      // Port 5211 occupied; port 5212 free
      let netCallCount = 0;
      mockNetServer.once.mockImplementation((event: string, fn: Function) => {
        netCallCount++;
        if (netCallCount <= 2) {
          if (event === 'error') fn(new Error('EADDRINUSE'));
        } else {
          if (event === 'listening') fn();
          mockNetServer.close.mockImplementation((cb?: Function) => cb?.());
        }
        return mockNetServer;
      });

      const manager = new LarkWsClientManager(mockWsClient, messageHandler);
      const p = manager.start();

      // discover(5211): let tryConnect run and register handlers
      await Promise.resolve();
      getClientHandler('on', 'connect_error')?.(); // handshake fails

      // discover(5212): let becomeServer run and register handlers
      await Promise.resolve();
      await Promise.resolve();
      getHttpOnceHandler('listening')?.(); // port 5212 server starts

      await p;

      expect(mockHttpServer.listen).toHaveBeenCalledWith(WS_START_PORT + 1, '127.0.0.1');
      spy.mockRestore();
    });
  });

  // ─── EADDRINUSE race in becomeServer → fall back to secondary ─────────────

  describe('EADDRINUSE race in becomeServer', () => {
    it('connects as secondary when http bind fails with EADDRINUSE', async () => {
      jest.useFakeTimers();
      simulateFreePort();
      const manager = new LarkWsClientManager(mockWsClient, messageHandler);
      const p = manager.start();

      // Let becomeServer() register httpServer handlers (isPortFree resolves in microtask)
      await Promise.resolve();

      // Another process won the race — fire EADDRINUSE on the http server
      const err = Object.assign(new Error('EADDRINUSE'), { code: 'EADDRINUSE' });
      getHttpOnceHandler('error')?.(err);

      // Advance past POST_CONFLICT_DELAY_MS (100ms) so tryConnect() starts
      jest.advanceTimersByTime(101);

      // tryConnect() is now running; complete the handshake
      getClientHandler('on', 'connect')?.();
      getClientHandler('once', VERIFY_ACK_EVENT)?.();

      jest.useRealTimers();
      await p;

      expect(mockWsClientStart).not.toHaveBeenCalled(); // secondary — no long connection
    });
  });

  // ─── Safety timeouts and reconnect guard ─────────────────────────────────

  describe('safety timeouts and reconnect guard', () => {
    afterEach(() => {
      jest.useRealTimers();
    });

    it('isPortFree resolves false when the probe server hangs past 5s', async () => {
      jest.useFakeTimers();
      // Don't fire 'error' or 'listening' — simulate a hung probe
      mockNetServer.once.mockImplementation(() => mockNetServer);
      mockNetServer.close.mockImplementation(() => {});

      const manager = new LarkWsClientManager(mockWsClient, messageHandler);
      const p = (manager as any).isPortFree(5211);

      jest.advanceTimersByTime(5001);

      await expect(p).resolves.toBe(false);
    });

    it('tryConnect resolves false when no VERIFY_ACK_EVENT arrives within 5s', async () => {
      jest.useFakeTimers();
      // Mock: socket handlers registered but never fired automatically
      mockClientSocket.on.mockImplementation(() => mockClientSocket);
      mockClientSocket.once.mockImplementation(() => mockClientSocket);

      const manager = new LarkWsClientManager(mockWsClient, messageHandler);
      const p = (manager as any).tryConnect(5211);

      jest.advanceTimersByTime(5001);

      await expect(p).resolves.toBe(false);
    });

    it('scheduleReconnect is idempotent — multiple calls queue only one timer', () => {
      jest.useFakeTimers();
      const manager = new LarkWsClientManager(mockWsClient, messageHandler);

      (manager as any).scheduleReconnect();
      const firstTimer = (manager as any).reconnectTimer;
      (manager as any).scheduleReconnect(); // no-op
      (manager as any).scheduleReconnect(); // no-op

      expect(firstTimer).not.toBeNull();
      expect((manager as any).reconnectTimer).toBe(firstTimer);
    });
  });
});
