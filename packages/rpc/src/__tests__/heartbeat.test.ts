/**
 * Tests for WebSocket heartbeat functionality
 */

import { describe, test, expect, beforeEach, mock } from 'bun:test';
import { createRouter } from '../router';
import { procedure } from '../procedure';
import type { WSConnectionData, WSClientMessage, WSServerMessage } from '../types';
import { clearRateLimitStore } from '../middleware';

// Mock WebSocket for testing
function createMockWebSocket(ctx: any = {}) {
  const sentMessages: string[] = [];
  const data: WSConnectionData = {
    subscriptions: new Map(),
    ctx,
  };

  return {
    data,
    send: (message: string) => {
      sentMessages.push(message);
      return message.length;
    },
    close: mock(() => {}),
    subscribe: mock(() => {}),
    unsubscribe: mock(() => {}),
    publish: mock(() => {}),
    isSubscribed: () => false,
    readyState: 1,
    remoteAddress: '127.0.0.1',
    // Test helpers
    getSentMessages: () => sentMessages,
    getLastMessage: () => {
      const last = sentMessages[sentMessages.length - 1];
      return last ? JSON.parse(last) as WSServerMessage : null;
    },
    getAllMessages: () => sentMessages.map(m => JSON.parse(m) as WSServerMessage),
    clearMessages: () => { sentMessages.length = 0; },
  };
}

describe('WebSocket Heartbeat', () => {
  beforeEach(() => {
    clearRateLimitStore();
  });

  describe('ping/pong handling', () => {
    test('responds to ping with pong', async () => {
      const router = createRouter({
        test: procedure.subscription(async function* () {
          yield 1;
        }),
      });

      const ws = createMockWebSocket();
      router.websocket.open?.(ws as any);

      // Send ping
      await router.websocket.message(ws as any, JSON.stringify({ type: 'ping' }));

      const messages = ws.getAllMessages();
      const pongMsg = messages.find(m => m.type === 'pong');
      expect(pongMsg).toBeDefined();
      expect(pongMsg?.type).toBe('pong');
    });

    test('ping does not interfere with subscriptions', async () => {
      const router = createRouter({
        events: procedure.subscription(async function* () {
          yield { event: 'test' };
        }),
      });

      const ws = createMockWebSocket();
      router.websocket.open?.(ws as any);

      // Subscribe
      await router.websocket.message(ws as any, JSON.stringify({
        type: 'subscribe',
        id: 'sub1',
        path: ['events'],
      }));

      // Wait for subscription data
      await new Promise(resolve => setTimeout(resolve, 50));

      // Clear messages
      ws.clearMessages();

      // Send ping
      await router.websocket.message(ws as any, JSON.stringify({ type: 'ping' }));

      const messages = ws.getAllMessages();
      expect(messages).toHaveLength(1);
      expect(messages[0].type).toBe('pong');
    });

    test('multiple pings receive multiple pongs', async () => {
      const router = createRouter({
        test: procedure.query(() => 'test'),
      });

      const ws = createMockWebSocket();
      router.websocket.open?.(ws as any);

      // Send multiple pings
      await router.websocket.message(ws as any, JSON.stringify({ type: 'ping' }));
      await router.websocket.message(ws as any, JSON.stringify({ type: 'ping' }));
      await router.websocket.message(ws as any, JSON.stringify({ type: 'ping' }));

      const messages = ws.getAllMessages();
      expect(messages).toHaveLength(3);
      expect(messages.every(m => m.type === 'pong')).toBe(true);
    });
  });

  describe('original request preservation', () => {
    test('uses original request from WebSocket data', async () => {
      let capturedRequest: Request | null = null;

      const authMiddleware = async ({ ctx, next }: any) => {
        capturedRequest = ctx.request;
        return next(ctx);
      };

      const router = createRouter({
        events: procedure.use(authMiddleware).subscription(async function* () {
          yield { event: 'test' };
        }),
      });

      const originalRequest = new Request('http://localhost/api/rpc', {
        headers: {
          'Cookie': 'session=abc123',
          'User-Agent': 'TestAgent/1.0',
        },
      });

      const ws = createMockWebSocket();
      ws.data.originalRequest = originalRequest;
      router.websocket.open?.(ws as any);

      await router.websocket.message(ws as any, JSON.stringify({
        type: 'subscribe',
        id: 'sub1',
        path: ['events'],
      }));

      await new Promise(resolve => setTimeout(resolve, 50));

      expect(capturedRequest).toBeDefined();
      const req = capturedRequest as unknown as Request;
      expect(req.headers.get('Cookie')).toBe('session=abc123');
      expect(req.headers.get('User-Agent')).toBe('TestAgent/1.0');
    });

    test('falls back to synthetic request when originalRequest not provided', async () => {
      let capturedRequest: Request | null = null;

      const captureMiddleware = async ({ ctx, next }: any) => {
        capturedRequest = ctx.request;
        return next(ctx);
      };

      const router = createRouter({
        events: procedure.use(captureMiddleware).subscription(async function* () {
          yield { event: 'test' };
        }),
      });

      const ws = createMockWebSocket();
      // No originalRequest set
      router.websocket.open?.(ws as any);

      await router.websocket.message(ws as any, JSON.stringify({
        type: 'subscribe',
        id: 'sub1',
        path: ['events'],
      }));

      await new Promise(resolve => setTimeout(resolve, 50));

      expect(capturedRequest).toBeDefined();
      const req = capturedRequest as unknown as Request;
      expect(req.url).toBe('ws://localhost/');
    });
  });
});
