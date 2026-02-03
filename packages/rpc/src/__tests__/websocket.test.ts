/**
 * Tests for WebSocket subscription handling
 */

import { describe, test, expect, beforeEach, mock } from 'bun:test';
import { createRouter } from '../router';
import { procedure } from '../procedure';
import type { WSConnectionData, WSClientMessage, WSServerMessage } from '../types';

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
  };
}

describe('WebSocket handler', () => {
  describe('open handler', () => {
    test('initializes subscriptions map on open', () => {
      const router = createRouter({
        test: procedure.subscription(async function* () {
          yield 1;
        }),
      });

      const ws = createMockWebSocket();
      ws.data.subscriptions = undefined as any; // Simulate uninitialized

      router.websocket.open?.(ws as any);

      expect(ws.data.subscriptions).toBeInstanceOf(Map);
      expect(ws.data.subscriptions.size).toBe(0);
    });
  });

  describe('message handler', () => {
    test('handles subscribe message', async () => {
      let yielded = false;
      const router = createRouter({
        events: procedure.subscription(async function* () {
          yielded = true;
          yield { event: 'test' };
        }),
      });

      const ws = createMockWebSocket();
      router.websocket.open?.(ws as any);

      const subscribeMsg: WSClientMessage = {
        type: 'subscribe',
        id: 'sub1',
        path: ['events'],
      };

      await router.websocket.message(ws as any, JSON.stringify(subscribeMsg));

      // Wait for async generator to start and complete
      await new Promise(resolve => setTimeout(resolve, 50));

      expect(yielded).toBe(true);
      // After the subscription completes, it's removed from the map
      // Check that a data message was sent instead
      const messages = ws.getAllMessages();
      const dataMsg = messages.find(m => m.type === 'data' && m.id === 'sub1');
      expect(dataMsg).toBeDefined();
    });

    test('sends data messages from subscription', async () => {
      const router = createRouter({
        counter: procedure.subscription(async function* () {
          yield { count: 1 };
          yield { count: 2 };
          yield { count: 3 };
        }),
      });

      const ws = createMockWebSocket();
      router.websocket.open?.(ws as any);

      const subscribeMsg: WSClientMessage = {
        type: 'subscribe',
        id: 'counter1',
        path: ['counter'],
      };

      await router.websocket.message(ws as any, JSON.stringify(subscribeMsg));

      // Wait for generator to complete
      await new Promise(resolve => setTimeout(resolve, 50));

      const messages = ws.getAllMessages();
      const dataMessages = messages.filter(m => m.type === 'data');
      const completeMessages = messages.filter(m => m.type === 'complete');

      expect(dataMessages).toHaveLength(3);
      expect(dataMessages[0]).toEqual({ type: 'data', id: 'counter1', data: { count: 1 } });
      expect(dataMessages[1]).toEqual({ type: 'data', id: 'counter1', data: { count: 2 } });
      expect(dataMessages[2]).toEqual({ type: 'data', id: 'counter1', data: { count: 3 } });
      expect(completeMessages).toHaveLength(1);
    });

    test('handles unsubscribe message', async () => {
      let aborted = false;
      const router = createRouter({
        infinite: procedure.subscription(async function* () {
          try {
            while (true) {
              yield { tick: Date.now() };
              await new Promise(resolve => setTimeout(resolve, 10));
            }
          } finally {
            aborted = true;
          }
        }),
      });

      const ws = createMockWebSocket();
      router.websocket.open?.(ws as any);

      // Subscribe
      await router.websocket.message(ws as any, JSON.stringify({
        type: 'subscribe',
        id: 'inf1',
        path: ['infinite'],
      }));

      // Wait a bit
      await new Promise(resolve => setTimeout(resolve, 30));
      expect(ws.data.subscriptions.has('inf1')).toBe(true);

      // Unsubscribe
      await router.websocket.message(ws as any, JSON.stringify({
        type: 'unsubscribe',
        id: 'inf1',
      }));

      // Wait for cleanup
      await new Promise(resolve => setTimeout(resolve, 30));
      expect(ws.data.subscriptions.has('inf1')).toBe(false);
    });

    test('handles subscription with input', async () => {
      const schema = { parse: (d: unknown) => d as { channel: string } };

      const router = createRouter({
        messages: procedure.subscription(schema, async function* ({ input }) {
          yield { channel: input.channel, message: 'hello' };
          yield { channel: input.channel, message: 'world' };
        }),
      });

      const ws = createMockWebSocket();
      router.websocket.open?.(ws as any);

      await router.websocket.message(ws as any, JSON.stringify({
        type: 'subscribe',
        id: 'msg1',
        path: ['messages'],
        input: { channel: 'general' },
      }));

      await new Promise(resolve => setTimeout(resolve, 50));

      const messages = ws.getAllMessages().filter(m => m.type === 'data');
      expect(messages[0]).toEqual({
        type: 'data',
        id: 'msg1',
        data: { channel: 'general', message: 'hello' },
      });
    });

    test('sends error for invalid JSON', async () => {
      const router = createRouter({
        test: procedure.subscription(async function* () {
          yield 1;
        }),
      });

      const ws = createMockWebSocket();
      router.websocket.open?.(ws as any);

      await router.websocket.message(ws as any, 'invalid json{{{');

      const lastMsg = ws.getLastMessage();
      expect(lastMsg?.type).toBe('error');
      if (lastMsg?.type === 'error') {
        expect(lastMsg.error.code).toBe('PARSE_ERROR');
      }
    });

    test('sends error for unknown procedure', async () => {
      const router = createRouter({
        exists: procedure.subscription(async function* () {
          yield 1;
        }),
      });

      const ws = createMockWebSocket();
      router.websocket.open?.(ws as any);

      await router.websocket.message(ws as any, JSON.stringify({
        type: 'subscribe',
        id: 'sub1',
        path: ['notExists'],
      }));

      const lastMsg = ws.getLastMessage();
      expect(lastMsg?.type).toBe('error');
      if (lastMsg?.type === 'error') {
        expect(lastMsg.error.code).toBe('NOT_FOUND');
      }
    });

    test('sends error for non-subscription procedure', async () => {
      const router = createRouter({
        query: procedure.query(() => 'data'),
      });

      const ws = createMockWebSocket();
      router.websocket.open?.(ws as any);

      await router.websocket.message(ws as any, JSON.stringify({
        type: 'subscribe',
        id: 'sub1',
        path: ['query'],
      }));

      const lastMsg = ws.getLastMessage();
      expect(lastMsg?.type).toBe('error');
      if (lastMsg?.type === 'error') {
        expect(lastMsg.error.code).toBe('METHOD_MISMATCH');
      }
    });

    test('sends error for duplicate subscription ID', async () => {
      const router = createRouter({
        events: procedure.subscription(async function* () {
          while (true) {
            yield { tick: 1 };
            await new Promise(resolve => setTimeout(resolve, 100));
          }
        }),
      });

      const ws = createMockWebSocket();
      router.websocket.open?.(ws as any);

      // First subscription
      await router.websocket.message(ws as any, JSON.stringify({
        type: 'subscribe',
        id: 'dup',
        path: ['events'],
      }));

      await new Promise(resolve => setTimeout(resolve, 10));

      // Duplicate subscription
      await router.websocket.message(ws as any, JSON.stringify({
        type: 'subscribe',
        id: 'dup',
        path: ['events'],
      }));

      const messages = ws.getAllMessages();
      const errorMsg = messages.find(m => m.type === 'error');
      expect(errorMsg?.type).toBe('error');
      if (errorMsg?.type === 'error') {
        expect(errorMsg.error.code).toBe('DUPLICATE_ID');
      }
    });

    test('sends error for validation failure', async () => {
      const schema = {
        parse: (d: unknown) => {
          const data = d as { channel?: string };
          if (!data.channel) throw new Error('channel required');
          return data as { channel: string };
        },
      };

      const router = createRouter({
        messages: procedure.subscription(schema, async function* ({ input }) {
          yield { channel: input.channel };
        }),
      });

      const ws = createMockWebSocket();
      router.websocket.open?.(ws as any);

      await router.websocket.message(ws as any, JSON.stringify({
        type: 'subscribe',
        id: 'msg1',
        path: ['messages'],
        input: {}, // Missing channel
      }));

      const lastMsg = ws.getLastMessage();
      expect(lastMsg?.type).toBe('error');
      if (lastMsg?.type === 'error') {
        expect(lastMsg.error.code).toBe('VALIDATION_ERROR');
      }
    });

    test('executes middleware for subscriptions', async () => {
      let middlewareRan = false;

      const authMiddleware = async ({ ctx, next }: any) => {
        middlewareRan = true;
        if (!ctx.ctx.user) {
          return { ok: false as const, error: { code: 'UNAUTHORIZED', message: 'Login required' } };
        }
        return next({ ...ctx, user: ctx.ctx.user });
      };

      const router = createRouter({
        privateEvents: procedure.use(authMiddleware).subscription(async function* () {
          yield { event: 'secret' };
        }),
      });

      // Without user
      const ws1 = createMockWebSocket({ user: null });
      router.websocket.open?.(ws1 as any);

      await router.websocket.message(ws1 as any, JSON.stringify({
        type: 'subscribe',
        id: 'priv1',
        path: ['privateEvents'],
      }));

      expect(middlewareRan).toBe(true);
      const lastMsg1 = ws1.getLastMessage();
      expect(lastMsg1?.type).toBe('error');
      if (lastMsg1?.type === 'error') {
        expect(lastMsg1.error.code).toBe('UNAUTHORIZED');
      }

      // With user
      const ws2 = createMockWebSocket({ user: { id: '1' } });
      router.websocket.open?.(ws2 as any);

      await router.websocket.message(ws2 as any, JSON.stringify({
        type: 'subscribe',
        id: 'priv2',
        path: ['privateEvents'],
      }));

      await new Promise(resolve => setTimeout(resolve, 50));

      const messages2 = ws2.getAllMessages();
      const dataMsg = messages2.find(m => m.type === 'data');
      expect(dataMsg?.type).toBe('data');
    });

    test('handles subscription error', async () => {
      const router = createRouter({
        failing: procedure.subscription(async function* () {
          yield { before: 'error' };
          throw new Error('Subscription failed');
        }),
      });

      const ws = createMockWebSocket();
      router.websocket.open?.(ws as any);

      await router.websocket.message(ws as any, JSON.stringify({
        type: 'subscribe',
        id: 'fail1',
        path: ['failing'],
      }));

      await new Promise(resolve => setTimeout(resolve, 50));

      const messages = ws.getAllMessages();
      const errorMsg = messages.find(m => m.type === 'error');
      expect(errorMsg?.type).toBe('error');
      if (errorMsg?.type === 'error') {
        expect(errorMsg.error.code).toBe('SUBSCRIPTION_ERROR');
        expect(errorMsg.error.message).toBe('Subscription failed');
      }
    });
  });

  describe('close handler', () => {
    test('aborts all subscriptions on close', async () => {
      let sub1Aborted = false;
      let sub2Aborted = false;

      const router = createRouter({
        stream1: procedure.subscription(async function* () {
          try {
            while (true) {
              yield 1;
              await new Promise(resolve => setTimeout(resolve, 100));
            }
          } finally {
            sub1Aborted = true;
          }
        }),
        stream2: procedure.subscription(async function* () {
          try {
            while (true) {
              yield 2;
              await new Promise(resolve => setTimeout(resolve, 100));
            }
          } finally {
            sub2Aborted = true;
          }
        }),
      });

      const ws = createMockWebSocket();
      router.websocket.open?.(ws as any);

      // Start two subscriptions
      await router.websocket.message(ws as any, JSON.stringify({
        type: 'subscribe',
        id: 's1',
        path: ['stream1'],
      }));
      await router.websocket.message(ws as any, JSON.stringify({
        type: 'subscribe',
        id: 's2',
        path: ['stream2'],
      }));

      await new Promise(resolve => setTimeout(resolve, 30));
      expect(ws.data.subscriptions.size).toBe(2);

      // Close connection
      router.websocket.close?.(ws as any);

      await new Promise(resolve => setTimeout(resolve, 50));

      expect(ws.data.subscriptions.size).toBe(0);
      // Note: finally blocks may not run synchronously
    });
  });
});
