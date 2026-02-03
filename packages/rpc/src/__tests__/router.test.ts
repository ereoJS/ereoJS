/**
 * Tests for router and HTTP handler
 */

import { describe, test, expect, beforeEach } from 'bun:test';
import { createRouter, RPCError, errors } from '../router';
import { procedure } from '../procedure';
import type { BaseContext } from '../types';

describe('createRouter', () => {
  describe('basic structure', () => {
    test('creates router with procedures', () => {
      const router = createRouter({
        health: procedure.query(() => ({ status: 'ok' })),
      });

      expect(router._def).toBeDefined();
      expect(router._def.health).toBeDefined();
      expect(router.handler).toBeInstanceOf(Function);
      expect(router.websocket).toBeDefined();
    });

    test('supports nested routers', () => {
      const router = createRouter({
        users: {
          list: procedure.query(() => []),
          get: procedure.query(() => null),
        },
        posts: {
          list: procedure.query(() => []),
        },
      });

      expect(router._def.users.list).toBeDefined();
      expect(router._def.users.get).toBeDefined();
      expect(router._def.posts.list).toBeDefined();
    });
  });

  describe('HTTP handler', () => {
    const mockCtx = { user: null };

    test('handles GET query request', async () => {
      const router = createRouter({
        greet: procedure.query(() => ({ message: 'hello' })),
      });

      const request = new Request('http://localhost/rpc?path=greet');
      const response = await router.handler(request, mockCtx);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.ok).toBe(true);
      expect(data.data).toEqual({ message: 'hello' });
    });

    test('handles GET query with input', async () => {
      const schema = { parse: (d: unknown) => d as { name: string } };

      const router = createRouter({
        greet: procedure.query(schema, ({ input }) => ({
          message: `hello ${input.name}`,
        })),
      });

      const input = JSON.stringify({ name: 'world' });
      const request = new Request(`http://localhost/rpc?path=greet&input=${encodeURIComponent(input)}`);
      const response = await router.handler(request, mockCtx);
      const data = await response.json();

      expect(data.ok).toBe(true);
      expect(data.data).toEqual({ message: 'hello world' });
    });

    test('handles POST mutation request', async () => {
      const schema = { parse: (d: unknown) => d as { title: string } };

      const router = createRouter({
        createPost: procedure.mutation(schema, ({ input }) => ({
          id: '1',
          title: input.title,
        })),
      });

      const request = new Request('http://localhost/rpc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          path: ['createPost'],
          type: 'mutation',
          input: { title: 'Test Post' },
        }),
      });

      const response = await router.handler(request, mockCtx);
      const data = await response.json();

      expect(data.ok).toBe(true);
      expect(data.data).toEqual({ id: '1', title: 'Test Post' });
    });

    test('handles nested path', async () => {
      const router = createRouter({
        users: {
          profile: {
            get: procedure.query(() => ({ name: 'John' })),
          },
        },
      });

      const request = new Request('http://localhost/rpc?path=users.profile.get');
      const response = await router.handler(request, mockCtx);
      const data = await response.json();

      expect(data.ok).toBe(true);
      expect(data.data).toEqual({ name: 'John' });
    });

    test('returns 404 for unknown procedure', async () => {
      const router = createRouter({
        exists: procedure.query(() => 'yes'),
      });

      const request = new Request('http://localhost/rpc?path=notFound');
      const response = await router.handler(request, mockCtx);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.ok).toBe(false);
      expect(data.error.code).toBe('NOT_FOUND');
    });

    test('returns error for type mismatch', async () => {
      const router = createRouter({
        getData: procedure.query(() => 'data'),
      });

      const request = new Request('http://localhost/rpc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          path: ['getData'],
          type: 'mutation', // Wrong type
          input: {},
        }),
      });

      const response = await router.handler(request, mockCtx);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.ok).toBe(false);
      expect(data.error.code).toBe('METHOD_MISMATCH');
    });

    test('returns error for subscription via HTTP', async () => {
      const router = createRouter({
        events: procedure.subscription(async function* () {
          yield 1;
        }),
      });

      const request = new Request('http://localhost/rpc?path=events');
      const response = await router.handler(request, mockCtx);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.ok).toBe(false);
      expect(data.error.code).toBe('METHOD_NOT_ALLOWED');
    });

    test('validates input with schema', async () => {
      const schema = {
        parse: (d: unknown) => {
          const data = d as { email?: string };
          if (!data.email) throw new Error('Email required');
          return data as { email: string };
        },
      };

      const router = createRouter({
        register: procedure.mutation(schema, ({ input }) => ({
          email: input.email,
        })),
      });

      const request = new Request('http://localhost/rpc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          path: ['register'],
          type: 'mutation',
          input: {}, // Missing email
        }),
      });

      const response = await router.handler(request, mockCtx);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.ok).toBe(false);
      expect(data.error.code).toBe('VALIDATION_ERROR');
    });

    test('handles parse error', async () => {
      const router = createRouter({
        test: procedure.query(() => 'test'),
      });

      const request = new Request('http://localhost/rpc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'invalid json{{{',
      });

      const response = await router.handler(request, mockCtx);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.ok).toBe(false);
      expect(data.error.code).toBe('PARSE_ERROR');
    });
  });

  describe('middleware execution', () => {
    test('executes middleware before handler', async () => {
      const executionOrder: string[] = [];

      const loggingMiddleware = async ({ ctx, next }: any) => {
        executionOrder.push('middleware');
        return next(ctx);
      };

      const router = createRouter({
        test: procedure.use(loggingMiddleware).query(() => {
          executionOrder.push('handler');
          return 'result';
        }),
      });

      const request = new Request('http://localhost/rpc?path=test');
      await router.handler(request, {});

      expect(executionOrder).toEqual(['middleware', 'handler']);
    });

    test('middleware can short-circuit request', async () => {
      const authMiddleware = async ({ ctx, next }: { ctx: BaseContext; next: any }) => {
        if (!ctx.ctx.user) {
          return { ok: false as const, error: { code: 'UNAUTHORIZED', message: 'Login required' } };
        }
        return next(ctx);
      };

      const router = createRouter({
        secret: procedure.use(authMiddleware).query(() => 'secret data'),
      });

      // Without user
      const request1 = new Request('http://localhost/rpc?path=secret');
      const response1 = await router.handler(request1, { user: null });
      const data1 = await response1.json();

      expect(data1.ok).toBe(false);
      expect(data1.error.code).toBe('UNAUTHORIZED');

      // With user
      const request2 = new Request('http://localhost/rpc?path=secret');
      const response2 = await router.handler(request2, { user: { id: '1' } });
      const data2 = await response2.json();

      expect(data2.ok).toBe(true);
      expect(data2.data).toBe('secret data');
    });

    test('middleware context is passed to handler', async () => {
      const addUserMiddleware = async ({ ctx, next }: any) => {
        return next({ ...ctx, user: { id: '123', role: 'admin' } });
      };

      const router = createRouter({
        whoami: procedure.use(addUserMiddleware).query(({ user }: any) => ({
          userId: user.id,
          role: user.role,
        })),
      });

      const request = new Request('http://localhost/rpc?path=whoami');
      const response = await router.handler(request, {});
      const data = await response.json();

      expect(data.ok).toBe(true);
      expect(data.data).toEqual({ userId: '123', role: 'admin' });
    });
  });

  describe('error handling', () => {
    test('handles RPCError with custom status', async () => {
      const router = createRouter({
        forbidden: procedure.query(() => {
          throw new RPCError('FORBIDDEN', 'Access denied', 403);
        }),
      });

      const request = new Request('http://localhost/rpc?path=forbidden');
      const response = await router.handler(request, {});
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.ok).toBe(false);
      expect(data.error.code).toBe('FORBIDDEN');
      expect(data.error.message).toBe('Access denied');
    });

    test('handles unexpected errors', async () => {
      const router = createRouter({
        crash: procedure.query(() => {
          throw new Error('Something went wrong');
        }),
      });

      const request = new Request('http://localhost/rpc?path=crash');
      const response = await router.handler(request, {});
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.ok).toBe(false);
      expect(data.error.code).toBe('INTERNAL_ERROR');
    });
  });
});

describe('RPCError', () => {
  test('creates error with code and message', () => {
    const error = new RPCError('TEST_ERROR', 'Test message');

    expect(error.code).toBe('TEST_ERROR');
    expect(error.message).toBe('Test message');
    expect(error.status).toBe(400); // Default
    expect(error.name).toBe('RPCError');
  });

  test('creates error with custom status', () => {
    const error = new RPCError('NOT_FOUND', 'Resource not found', 404);

    expect(error.status).toBe(404);
  });
});

describe('error factories', () => {
  test('unauthorized', () => {
    const error = errors.unauthorized();
    expect(error.code).toBe('UNAUTHORIZED');
    expect(error.status).toBe(401);
  });

  test('unauthorized with custom message', () => {
    const error = errors.unauthorized('Please log in');
    expect(error.message).toBe('Please log in');
  });

  test('forbidden', () => {
    const error = errors.forbidden();
    expect(error.code).toBe('FORBIDDEN');
    expect(error.status).toBe(403);
  });

  test('notFound', () => {
    const error = errors.notFound();
    expect(error.code).toBe('NOT_FOUND');
    expect(error.status).toBe(404);
  });

  test('badRequest', () => {
    const error = errors.badRequest('Invalid input');
    expect(error.code).toBe('BAD_REQUEST');
    expect(error.message).toBe('Invalid input');
    expect(error.status).toBe(400);
  });
});
