/**
 * Integration tests - full flow from client to server
 */

import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { createRouter, errors, RPCError } from '../router';
import { procedure } from '../procedure';
import { rpcPlugin } from '../plugin';
import type { BaseContext } from '../types';

describe('integration: full RPC flow', () => {
  // Create a realistic router with various procedure types
  const createTestApi = () => {
    // Auth middleware
    const authMiddleware = async ({ ctx, next }: { ctx: BaseContext; next: any }) => {
      const authHeader = ctx.request.headers.get('Authorization');
      if (authHeader === 'Bearer valid-token') {
        return next({ ...ctx, user: { id: '1', name: 'Test User', role: 'user' } });
      }
      if (authHeader === 'Bearer admin-token') {
        return next({ ...ctx, user: { id: '2', name: 'Admin User', role: 'admin' } });
      }
      return { ok: false as const, error: { code: 'UNAUTHORIZED', message: 'Invalid token' } };
    };

    const protectedProcedure = procedure.use(authMiddleware);

    const adminProcedure = protectedProcedure.use(async ({ ctx, next }: any) => {
      if (ctx.user.role !== 'admin') {
        return { ok: false as const, error: { code: 'FORBIDDEN', message: 'Admin only' } };
      }
      return next(ctx);
    });

    // In-memory database
    const db = {
      users: [
        { id: '1', name: 'Alice', email: 'alice@example.com' },
        { id: '2', name: 'Bob', email: 'bob@example.com' },
      ],
      posts: [
        { id: '1', title: 'First Post', authorId: '1' },
        { id: '2', title: 'Second Post', authorId: '2' },
      ],
    };

    const schema = {
      createPost: {
        parse: (d: unknown) => {
          const data = d as { title?: string };
          if (!data.title || data.title.length < 3) {
            throw new Error('Title must be at least 3 characters');
          }
          return data as { title: string };
        },
      },
      userId: {
        parse: (d: unknown) => {
          const data = d as { id?: string };
          if (!data.id) throw new Error('id required');
          return data as { id: string };
        },
      },
    };

    return createRouter({
      // Public endpoints
      health: procedure.query(() => ({
        status: 'healthy',
        timestamp: Date.now(),
      })),

      // Nested public endpoints
      public: {
        posts: {
          list: procedure.query(() => db.posts),
          count: procedure.query(() => db.posts.length),
        },
      },

      // Protected endpoints
      users: {
        me: protectedProcedure.query(({ user }: any) => user),

        getById: protectedProcedure.query(schema.userId, ({ input }) => {
          const user = db.users.find(u => u.id === input.id);
          if (!user) throw errors.notFound('User not found');
          return user;
        }),
      },

      posts: {
        create: protectedProcedure.mutation(schema.createPost, ({ input, user }: any) => {
          const newPost = {
            id: String(db.posts.length + 1),
            title: input.title,
            authorId: user.id,
          };
          db.posts.push(newPost);
          return newPost;
        }),

        delete: adminProcedure.mutation(schema.userId, ({ input }) => {
          const index = db.posts.findIndex(p => p.id === input.id);
          if (index === -1) throw errors.notFound('Post not found');
          const deleted = db.posts.splice(index, 1)[0];
          return { deleted: true, post: deleted };
        }),
      },

      // Admin endpoints
      admin: {
        stats: adminProcedure.query(() => ({
          userCount: db.users.length,
          postCount: db.posts.length,
        })),
      },
    });
  };

  describe('public endpoints', () => {
    test('health check', async () => {
      const api = createTestApi();
      const request = new Request('http://localhost/rpc?path=health');
      const response = await api.handler(request, {});
      const data = await response.json();

      expect(data.ok).toBe(true);
      expect(data.data.status).toBe('healthy');
      expect(data.data.timestamp).toBeGreaterThan(0);
    });

    test('nested public endpoint', async () => {
      const api = createTestApi();
      const request = new Request('http://localhost/rpc?path=public.posts.list');
      const response = await api.handler(request, {});
      const data = await response.json();

      expect(data.ok).toBe(true);
      expect(data.data).toHaveLength(2);
      expect(data.data[0].title).toBe('First Post');
    });
  });

  describe('protected endpoints', () => {
    test('rejects unauthenticated request', async () => {
      const api = createTestApi();
      const request = new Request('http://localhost/rpc?path=users.me');
      const response = await api.handler(request, {});
      const data = await response.json();

      expect(data.ok).toBe(false);
      expect(data.error.code).toBe('UNAUTHORIZED');
    });

    test('accepts authenticated request', async () => {
      const api = createTestApi();
      const request = new Request('http://localhost/rpc?path=users.me', {
        headers: { 'Authorization': 'Bearer valid-token' },
      });
      const response = await api.handler(request, {});
      const data = await response.json();

      expect(data.ok).toBe(true);
      expect(data.data.name).toBe('Test User');
    });

    test('query with input validation', async () => {
      const api = createTestApi();
      const input = JSON.stringify({ id: '1' });
      const request = new Request(`http://localhost/rpc?path=users.getById&input=${encodeURIComponent(input)}`, {
        headers: { 'Authorization': 'Bearer valid-token' },
      });
      const response = await api.handler(request, {});
      const data = await response.json();

      expect(data.ok).toBe(true);
      expect(data.data.name).toBe('Alice');
    });

    test('throws not found error', async () => {
      const api = createTestApi();
      const input = JSON.stringify({ id: '999' });
      const request = new Request(`http://localhost/rpc?path=users.getById&input=${encodeURIComponent(input)}`, {
        headers: { 'Authorization': 'Bearer valid-token' },
      });
      const response = await api.handler(request, {});
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.ok).toBe(false);
      expect(data.error.code).toBe('NOT_FOUND');
    });
  });

  describe('mutations', () => {
    test('creates post with valid input', async () => {
      const api = createTestApi();
      const request = new Request('http://localhost/rpc', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer valid-token',
        },
        body: JSON.stringify({
          path: ['posts', 'create'],
          type: 'mutation',
          input: { title: 'New Post' },
        }),
      });
      const response = await api.handler(request, {});
      const data = await response.json();

      expect(data.ok).toBe(true);
      expect(data.data.title).toBe('New Post');
      expect(data.data.authorId).toBe('1');
    });

    test('rejects mutation with invalid input', async () => {
      const api = createTestApi();
      const request = new Request('http://localhost/rpc', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer valid-token',
        },
        body: JSON.stringify({
          path: ['posts', 'create'],
          type: 'mutation',
          input: { title: 'AB' }, // Too short
        }),
      });
      const response = await api.handler(request, {});
      const data = await response.json();

      expect(data.ok).toBe(false);
      expect(data.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('admin endpoints', () => {
    test('rejects non-admin user', async () => {
      const api = createTestApi();
      const request = new Request('http://localhost/rpc?path=admin.stats', {
        headers: { 'Authorization': 'Bearer valid-token' }, // Regular user
      });
      const response = await api.handler(request, {});
      const data = await response.json();

      expect(data.ok).toBe(false);
      expect(data.error.code).toBe('FORBIDDEN');
    });

    test('accepts admin user', async () => {
      const api = createTestApi();
      const request = new Request('http://localhost/rpc?path=admin.stats', {
        headers: { 'Authorization': 'Bearer admin-token' },
      });
      const response = await api.handler(request, {});
      const data = await response.json();

      expect(data.ok).toBe(true);
      expect(data.data.userCount).toBe(2);
      expect(data.data.postCount).toBeGreaterThanOrEqual(2);
    });

    test('admin can delete posts', async () => {
      const api = createTestApi();
      const request = new Request('http://localhost/rpc', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer admin-token',
        },
        body: JSON.stringify({
          path: ['posts', 'delete'],
          type: 'mutation',
          input: { id: '1' },
        }),
      });
      const response = await api.handler(request, {});
      const data = await response.json();

      expect(data.ok).toBe(true);
      expect(data.data.deleted).toBe(true);
    });
  });

  describe('plugin integration', () => {
    test('plugin middleware routes to handler', async () => {
      const api = createTestApi();
      const plugin = rpcPlugin({ router: api, endpoint: '/api/rpc' });

      const middleware = plugin.runtimeMiddleware![0];
      const next = async () => new Response('fallthrough');

      // Request to RPC endpoint
      const request = new Request('http://localhost/api/rpc?path=health');
      const response = await middleware(request, {}, next);
      const data = await response.json();

      expect(data.ok).toBe(true);
      expect(data.data.status).toBe('healthy');
    });

    test('plugin passes through non-RPC requests', async () => {
      const api = createTestApi();
      const plugin = rpcPlugin({ router: api, endpoint: '/api/rpc' });

      const middleware = plugin.runtimeMiddleware![0];
      const next = async () => new Response('other route');

      const request = new Request('http://localhost/other/route');
      const response = await middleware(request, {}, next);
      const text = await response.text();

      expect(text).toBe('other route');
    });
  });
});

describe('integration: subscription flow', () => {
  test('subscription yields values', async () => {
    const api = createRouter({
      countdown: procedure.subscription(async function* () {
        for (let i = 3; i >= 1; i--) {
          yield { count: i };
        }
      }),
    });

    // Get the subscription procedure and call its handler directly
    const sub = api._def.countdown;
    const generator = sub.handler({ ctx: {}, request: new Request('http://localhost'), input: undefined });

    const values: number[] = [];
    for await (const value of generator) {
      values.push((value as { count: number }).count);
    }

    expect(values).toEqual([3, 2, 1]);
  });

  test('subscription with middleware', async () => {
    let middlewareCalled = false;

    const loggingMiddleware = async ({ ctx, next }: any) => {
      middlewareCalled = true;
      return next(ctx);
    };

    const api = createRouter({
      events: procedure.use(loggingMiddleware).subscription(async function* () {
        yield { event: 'start' };
        yield { event: 'end' };
      }),
    });

    // The middleware would be executed by the WebSocket handler
    // Here we just verify the procedure has middleware
    expect(api._def.events.middlewares).toHaveLength(1);
  });

  test('subscription with input', async () => {
    const schema = {
      parse: (d: unknown) => d as { channel: string },
    };

    const api = createRouter({
      messages: procedure.subscription(schema, async function* ({ input }) {
        yield { channel: input.channel, msg: 'hello' };
        yield { channel: input.channel, msg: 'world' };
      }),
    });

    const sub = api._def.messages;
    const generator = sub.handler({
      ctx: {},
      request: new Request('http://localhost'),
      input: { channel: 'general' },
    });

    const messages: string[] = [];
    for await (const value of generator) {
      const msg = value as { channel: string; msg: string };
      expect(msg.channel).toBe('general');
      messages.push(msg.msg);
    }

    expect(messages).toEqual(['hello', 'world']);
  });
});

describe('error scenarios', () => {
  test('handles procedure that throws Error', async () => {
    const api = createRouter({
      failing: procedure.query(() => {
        throw new Error('Something went wrong');
      }),
    });

    const request = new Request('http://localhost/rpc?path=failing');
    const response = await api.handler(request, {});
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.ok).toBe(false);
    expect(data.error.code).toBe('INTERNAL_ERROR');
  });

  test('handles procedure that throws RPCError', async () => {
    const api = createRouter({
      custom: procedure.query(() => {
        throw new RPCError('CUSTOM_ERROR', 'Custom message', 422);
      }),
    });

    const request = new Request('http://localhost/rpc?path=custom');
    const response = await api.handler(request, {});
    const data = await response.json();

    expect(response.status).toBe(422);
    expect(data.ok).toBe(false);
    expect(data.error.code).toBe('CUSTOM_ERROR');
    expect(data.error.message).toBe('Custom message');
  });

  test('handles deeply nested procedures', async () => {
    const api = createRouter({
      level1: {
        level2: {
          level3: {
            level4: {
              deep: procedure.query(() => 'found'),
            },
          },
        },
      },
    });

    const request = new Request('http://localhost/rpc?path=level1.level2.level3.level4.deep');
    const response = await api.handler(request, {});
    const data = await response.json();

    expect(data.ok).toBe(true);
    expect(data.data).toBe('found');
  });

  test('returns 404 for partial path', async () => {
    const api = createRouter({
      users: {
        list: procedure.query(() => []),
      },
    });

    // 'users' alone is not a procedure
    const request = new Request('http://localhost/rpc?path=users');
    const response = await api.handler(request, {});
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.ok).toBe(false);
  });
});
