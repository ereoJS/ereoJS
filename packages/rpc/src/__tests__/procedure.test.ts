/**
 * Tests for procedure builder
 */

import { describe, test, expect } from 'bun:test';
import { procedure, query, mutation, subscription, executeMiddleware } from '../procedure';
import type { BaseContext, MiddlewareResult } from '../types';

describe('procedure builder', () => {
  const mockRequest = new Request('http://localhost/test');
  const mockContext: BaseContext = {
    ctx: { user: null },
    request: mockRequest,
  };

  describe('query', () => {
    test('creates query procedure without input', () => {
      const proc = procedure.query(() => ({ message: 'hello' }));

      expect(proc._type).toBe('query');
      expect(proc.middlewares).toEqual([]);
      expect(proc.inputSchema).toBeUndefined();
    });

    test('creates query procedure with schema', () => {
      const schema = {
        parse: (data: unknown) => data as { id: string },
      };

      const proc = procedure.query(schema, ({ input }) => ({
        id: input.id,
      }));

      expect(proc._type).toBe('query');
      expect(proc.inputSchema).toBe(schema);
    });

    test('handler receives context', async () => {
      const proc = procedure.query((ctx) => ({
        hasRequest: ctx.request instanceof Request,
        hasCtx: ctx.ctx !== undefined,
      }));

      const result = await proc.handler({ ...mockContext, input: undefined as void });
      expect(result).toEqual({ hasRequest: true, hasCtx: true });
    });
  });

  describe('mutation', () => {
    test('creates mutation procedure without input', () => {
      const proc = procedure.mutation(() => ({ success: true }));

      expect(proc._type).toBe('mutation');
      expect(proc.middlewares).toEqual([]);
    });

    test('creates mutation procedure with schema', () => {
      const schema = {
        parse: (data: unknown) => data as { title: string },
      };

      const proc = procedure.mutation(schema, ({ input }) => ({
        created: true,
        title: input.title,
      }));

      expect(proc._type).toBe('mutation');
      expect(proc.inputSchema).toBe(schema);
    });
  });

  describe('subscription', () => {
    test('creates subscription procedure', () => {
      const proc = procedure.subscription(async function* () {
        yield { count: 1 };
        yield { count: 2 };
      });

      expect(proc._type).toBe('subscription');
      expect(proc.middlewares).toEqual([]);
    });

    test('creates subscription procedure with schema', () => {
      const schema = {
        parse: (data: unknown) => data as { channel: string },
      };

      const proc = procedure.subscription(schema, async function* ({ input }) {
        yield { channel: input.channel, message: 'hello' };
      });

      expect(proc._type).toBe('subscription');
      expect(proc.inputSchema).toBe(schema);
    });

    test('handler returns async generator', async () => {
      const proc = procedure.subscription(async function* () {
        yield 1;
        yield 2;
        yield 3;
      });

      const generator = proc.handler({ ...mockContext, input: undefined as void });
      const results: number[] = [];

      for await (const value of generator) {
        results.push(value);
      }

      expect(results).toEqual([1, 2, 3]);
    });
  });

  describe('middleware chaining', () => {
    test('use() adds middleware to chain', () => {
      const middleware1 = async ({ ctx, next }: any) => next(ctx);
      const middleware2 = async ({ ctx, next }: any) => next(ctx);

      const proc = procedure
        .use(middleware1)
        .use(middleware2)
        .query(() => 'result');

      expect(proc.middlewares).toHaveLength(2);
    });

    test('middleware can extend context', async () => {
      type AuthContext = BaseContext & { user: { id: string; name: string } };

      const authMiddleware = async ({ ctx, next }: { ctx: BaseContext; next: any }) => {
        return next({ ...ctx, user: { id: '1', name: 'Test User' } });
      };

      const proc = procedure.use(authMiddleware).query(({ user }: AuthContext) => ({
        userId: user.id,
        userName: user.name,
      }));

      // Execute middleware chain
      const middlewareResult = await executeMiddleware<AuthContext>(
        proc.middlewares,
        mockContext
      );

      expect(middlewareResult.ok).toBe(true);
      if (middlewareResult.ok) {
        expect(middlewareResult.ctx.user).toEqual({ id: '1', name: 'Test User' });
      }
    });

    test('middleware can short-circuit with error', async () => {
      const authMiddleware = async ({ ctx, next }: { ctx: BaseContext; next: any }) => {
        if (!ctx.ctx.user) {
          return { ok: false as const, error: { code: 'UNAUTHORIZED', message: 'Not logged in' } };
        }
        return next(ctx);
      };

      const proc = procedure.use(authMiddleware).query(() => 'secret data');

      const middlewareResult = await executeMiddleware(proc.middlewares, mockContext);

      expect(middlewareResult.ok).toBe(false);
      if (!middlewareResult.ok) {
        expect(middlewareResult.error.code).toBe('UNAUTHORIZED');
      }
    });

    test('middleware chain executes in order', async () => {
      const order: number[] = [];

      const middleware1 = async ({ ctx, next }: any) => {
        order.push(1);
        const result = next({ ...ctx, step1: true });
        order.push(2);
        return result;
      };

      const middleware2 = async ({ ctx, next }: any) => {
        order.push(3);
        const result = next({ ...ctx, step2: true });
        order.push(4);
        return result;
      };

      const proc = procedure.use(middleware1).use(middleware2).query(() => 'done');

      await executeMiddleware(proc.middlewares, mockContext);

      // Middleware executes in forward order: 1, 2 (from middleware1), then 3, 4 (from middleware2)
      expect(order).toEqual([1, 2, 3, 4]);
    });

    test('chained procedures inherit middleware', () => {
      const baseMiddleware = async ({ ctx, next }: any) => next(ctx);
      const extraMiddleware = async ({ ctx, next }: any) => next(ctx);

      const baseProcedure = procedure.use(baseMiddleware);
      const extendedProcedure = baseProcedure.use(extraMiddleware);

      const baseQuery = baseProcedure.query(() => 'base');
      const extendedQuery = extendedProcedure.query(() => 'extended');

      expect(baseQuery.middlewares).toHaveLength(1);
      expect(extendedQuery.middlewares).toHaveLength(2);
    });
  });

  describe('legacy API', () => {
    test('standalone query function works', () => {
      const proc = query(() => 'hello');
      expect(proc._type).toBe('query');
    });

    test('standalone mutation function works', () => {
      const proc = mutation(() => ({ success: true }));
      expect(proc._type).toBe('mutation');
    });

    test('standalone subscription function works', () => {
      const proc = subscription(async function* () {
        yield 1;
      });
      expect(proc._type).toBe('subscription');
    });
  });
});

describe('executeMiddleware', () => {
  const mockContext: BaseContext = {
    ctx: {},
    request: new Request('http://localhost'),
  };

  test('returns context when no middleware', async () => {
    const result = await executeMiddleware([], mockContext);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.ctx).toEqual(mockContext);
    }
  });

  test('chains multiple middleware', async () => {
    const middlewares = [
      { fn: async ({ ctx, next }: any) => next({ ...ctx, a: 1 }) },
      { fn: async ({ ctx, next }: any) => next({ ...ctx, b: 2 }) },
      { fn: async ({ ctx, next }: any) => next({ ...ctx, c: 3 }) },
    ];

    const result = await executeMiddleware<BaseContext & { a: number; b: number; c: number }>(
      middlewares,
      mockContext
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.ctx.a).toBe(1);
      expect(result.ctx.b).toBe(2);
      expect(result.ctx.c).toBe(3);
    }
  });

  test('stops on first error', async () => {
    const middlewares = [
      { fn: async ({ ctx, next }: any) => next({ ...ctx, a: 1 }) },
      {
        fn: async () => ({
          ok: false as const,
          error: { code: 'ERROR', message: 'Stop here' },
        }),
      },
      { fn: async ({ ctx, next }: any) => next({ ...ctx, c: 3 }) }, // Should not run
    ];

    const result = await executeMiddleware(middlewares, mockContext);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('ERROR');
    }
  });
});
