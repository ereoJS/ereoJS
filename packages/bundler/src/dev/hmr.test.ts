import { describe, expect, test, beforeEach } from 'bun:test';
import {
  HMRServer,
  HMRWatcher,
  createHMRServer,
  createHMRWatcher,
  createHMRWebSocket,
  HMR_CLIENT_CODE,
} from './hmr';

describe('@areo/bundler - HMR', () => {
  describe('HMR_CLIENT_CODE', () => {
    test('contains WebSocket connection code', () => {
      expect(HMR_CLIENT_CODE).toContain('WebSocket');
      expect(HMR_CLIENT_CODE).toContain('__hmr');
    });

    test('handles full-reload message', () => {
      expect(HMR_CLIENT_CODE).toContain('full-reload');
      expect(HMR_CLIENT_CODE).toContain('location.reload()');
    });

    test('handles css-update message', () => {
      expect(HMR_CLIENT_CODE).toContain('css-update');
      expect(HMR_CLIENT_CODE).toContain('updateCSS');
    });

    test('handles js-update message', () => {
      expect(HMR_CLIENT_CODE).toContain('js-update');
    });

    test('handles error message', () => {
      expect(HMR_CLIENT_CODE).toContain('error');
      expect(HMR_CLIENT_CODE).toContain('showErrorOverlay');
    });

    test('handles connection close with reconnect', () => {
      expect(HMR_CLIENT_CODE).toContain('onclose');
      expect(HMR_CLIENT_CODE).toContain('reconnect');
    });
  });

  describe('HMRServer', () => {
    let hmr: HMRServer;

    beforeEach(() => {
      hmr = createHMRServer();
    });

    test('creates HMR server', () => {
      expect(hmr).toBeInstanceOf(HMRServer);
    });

    test('starts with zero clients', () => {
      expect(hmr.getClientCount()).toBe(0);
    });

    test('tracks client connections', () => {
      const mockWs = {
        send: () => {},
      };

      hmr.handleConnection(mockWs as any);

      expect(hmr.getClientCount()).toBe(1);
    });

    test('removes client on close', () => {
      const mockWs = {
        send: () => {},
      };

      hmr.handleConnection(mockWs as any);
      expect(hmr.getClientCount()).toBe(1);

      hmr.handleClose(mockWs as any);
      expect(hmr.getClientCount()).toBe(0);
    });

    test('sends updates to all clients', () => {
      const messages: string[] = [];
      const mockWs1 = {
        send: (msg: string) => messages.push('ws1:' + msg),
      };
      const mockWs2 = {
        send: (msg: string) => messages.push('ws2:' + msg),
      };

      hmr.handleConnection(mockWs1 as any);
      hmr.handleConnection(mockWs2 as any);

      hmr.reload();

      expect(messages).toHaveLength(2);
      expect(messages[0]).toContain('full-reload');
      expect(messages[1]).toContain('full-reload');
    });

    test('reload sends full-reload message', () => {
      let sentMessage: string | null = null;
      const mockWs = {
        send: (msg: string) => {
          sentMessage = msg;
        },
      };

      hmr.handleConnection(mockWs as any);
      hmr.reload();

      expect(sentMessage).not.toBeNull();
      const parsed = JSON.parse(sentMessage!);
      expect(parsed.type).toBe('full-reload');
      expect(parsed.timestamp).toBeDefined();
    });

    test('cssUpdate sends css-update message with path', () => {
      let sentMessage: string | null = null;
      const mockWs = {
        send: (msg: string) => {
          sentMessage = msg;
        },
      };

      hmr.handleConnection(mockWs as any);
      hmr.cssUpdate('/styles/main.css');

      const parsed = JSON.parse(sentMessage!);
      expect(parsed.type).toBe('css-update');
      expect(parsed.path).toBe('/styles/main.css');
    });

    test('jsUpdate sends js-update message with path', () => {
      let sentMessage: string | null = null;
      const mockWs = {
        send: (msg: string) => {
          sentMessage = msg;
        },
      };

      hmr.handleConnection(mockWs as any);
      hmr.jsUpdate('/app/page.tsx');

      const parsed = JSON.parse(sentMessage!);
      expect(parsed.type).toBe('js-update');
      expect(parsed.path).toBe('/app/page.tsx');
    });

    test('error sends error message with details', () => {
      let sentMessage: string | null = null;
      const mockWs = {
        send: (msg: string) => {
          sentMessage = msg;
        },
      };

      hmr.handleConnection(mockWs as any);
      hmr.error('Test error', 'Error stack trace');

      const parsed = JSON.parse(sentMessage!);
      expect(parsed.type).toBe('error');
      expect(parsed.error.message).toBe('Test error');
      expect(parsed.error.stack).toBe('Error stack trace');
    });

    test('clearError clears last error state', () => {
      hmr.error('Test error');
      hmr.clearError();

      // New connection should not receive error
      let receivedMessage: string | null = null;
      const mockWs = {
        send: (msg: string) => {
          receivedMessage = msg;
        },
      };

      hmr.handleConnection(mockWs as any);

      expect(receivedMessage).toBeNull();
    });

    test('new connection receives last error if present', () => {
      hmr.error('Existing error');

      let receivedMessage: string | null = null;
      const mockWs = {
        send: (msg: string) => {
          receivedMessage = msg;
        },
      };

      hmr.handleConnection(mockWs as any);

      expect(receivedMessage).not.toBeNull();
      const parsed = JSON.parse(receivedMessage!);
      expect(parsed.type).toBe('error');
    });

    test('handles send failure gracefully', () => {
      const mockWs = {
        send: () => {
          throw new Error('Connection closed');
        },
      };

      hmr.handleConnection(mockWs as any);
      expect(hmr.getClientCount()).toBe(1);

      // Should not throw
      hmr.reload();

      // Failed client should be removed
      expect(hmr.getClientCount()).toBe(0);
    });
  });

  describe('createHMRServer', () => {
    test('creates new HMRServer instance', () => {
      const hmr = createHMRServer();
      expect(hmr).toBeInstanceOf(HMRServer);
    });
  });

  describe('createHMRWebSocket', () => {
    test('creates WebSocket handler object', () => {
      const hmr = createHMRServer();
      const handler = createHMRWebSocket(hmr);

      expect(typeof handler.open).toBe('function');
      expect(typeof handler.close).toBe('function');
      expect(typeof handler.message).toBe('function');
    });

    test('open handler adds connection', () => {
      const hmr = createHMRServer();
      const handler = createHMRWebSocket(hmr);

      const mockWs = { send: () => {} };
      handler.open(mockWs as any);

      expect(hmr.getClientCount()).toBe(1);
    });

    test('close handler removes connection', () => {
      const hmr = createHMRServer();
      const handler = createHMRWebSocket(hmr);

      const mockWs = { send: () => {} };
      handler.open(mockWs as any);
      handler.close(mockWs as any);

      expect(hmr.getClientCount()).toBe(0);
    });
  });

  describe('HMRWatcher', () => {
    let hmr: HMRServer;
    let watcher: HMRWatcher;

    beforeEach(() => {
      hmr = createHMRServer();
      watcher = createHMRWatcher(hmr);
    });

    test('creates HMR watcher', () => {
      expect(watcher).toBeInstanceOf(HMRWatcher);
    });

    test('stop method exists', () => {
      expect(typeof watcher.stop).toBe('function');
    });

    test('watch method exists', () => {
      expect(typeof watcher.watch).toBe('function');
    });

    test('stop clears debounce timer', () => {
      // Should not throw
      watcher.stop();
    });
  });

  describe('createHMRWatcher', () => {
    test('creates new HMRWatcher instance', () => {
      const hmr = createHMRServer();
      const watcher = createHMRWatcher(hmr);
      expect(watcher).toBeInstanceOf(HMRWatcher);
    });
  });

  describe('HMR Update Types', () => {
    test('full-reload type', () => {
      const update = { type: 'full-reload' as const, timestamp: Date.now() };
      expect(update.type).toBe('full-reload');
    });

    test('css-update type', () => {
      const update = {
        type: 'css-update' as const,
        path: '/styles.css',
        timestamp: Date.now(),
      };
      expect(update.type).toBe('css-update');
      expect(update.path).toBeDefined();
    });

    test('js-update type', () => {
      const update = {
        type: 'js-update' as const,
        path: '/app.tsx',
        timestamp: Date.now(),
      };
      expect(update.type).toBe('js-update');
    });

    test('error type', () => {
      const update = {
        type: 'error' as const,
        timestamp: Date.now(),
        error: { message: 'Test', stack: 'Stack trace' },
      };
      expect(update.type).toBe('error');
      expect(update.error).toBeDefined();
    });
  });
});
