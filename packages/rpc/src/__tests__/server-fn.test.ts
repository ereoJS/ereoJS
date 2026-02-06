/**
 * Tests for server function core: createServerFn, registry, ServerFnError
 */

import { describe, test, expect, beforeEach } from 'bun:test';
import {
  createServerFn,
  ServerFnError,
  registerServerFn,
  getServerFn,
  getAllServerFns,
  unregisterServerFn,
  clearServerFnRegistry,
  SERVER_FN_BASE,
  type ServerFnContext,
  type ServerFnMiddleware,
} from '../server-fn';

// Clean registry between tests
beforeEach(() => {
  clearServerFnRegistry();
});

// =============================================================================
// Registry
// =============================================================================

describe('Server Function Registry', () => {
  test('registerServerFn adds function to registry', () => {
    registerServerFn({
      id: 'test-fn',
      handler: async () => 'result',
      middleware: [],
    });

    const fn = getServerFn('test-fn');
    expect(fn).toBeDefined();
    expect(fn!.id).toBe('test-fn');
  });

  test('registerServerFn throws on duplicate ID', () => {
    registerServerFn({
      id: 'dup-fn',
      handler: async () => 'first',
      middleware: [],
    });

    expect(() => {
      registerServerFn({
        id: 'dup-fn',
        handler: async () => 'second',
        middleware: [],
      });
    }).toThrow('Server function "dup-fn" is already registered');
  });

  test('getServerFn returns undefined for unknown ID', () => {
    expect(getServerFn('nonexistent')).toBeUndefined();
  });

  test('getAllServerFns returns all registered functions', () => {
    registerServerFn({ id: 'fn1', handler: async () => 1, middleware: [] });
    registerServerFn({ id: 'fn2', handler: async () => 2, middleware: [] });

    const all = getAllServerFns();
    expect(all.size).toBe(2);
    expect(all.has('fn1')).toBe(true);
    expect(all.has('fn2')).toBe(true);
  });

  test('unregisterServerFn removes function', () => {
    registerServerFn({ id: 'removable', handler: async () => 'bye', middleware: [] });
    expect(getServerFn('removable')).toBeDefined();

    const removed = unregisterServerFn('removable');
    expect(removed).toBe(true);
    expect(getServerFn('removable')).toBeUndefined();
  });

  test('unregisterServerFn returns false for unknown ID', () => {
    expect(unregisterServerFn('ghost')).toBe(false);
  });

  test('clearServerFnRegistry empties the registry', () => {
    registerServerFn({ id: 'a', handler: async () => 1, middleware: [] });
    registerServerFn({ id: 'b', handler: async () => 2, middleware: [] });

    clearServerFnRegistry();
    expect(getAllServerFns().size).toBe(0);
  });
});

// =============================================================================
// ServerFnError
// =============================================================================

describe('ServerFnError', () => {
  test('creates error with code and message', () => {
    const error = new ServerFnError('NOT_FOUND', 'User not found');
    expect(error.code).toBe('NOT_FOUND');
    expect(error.message).toBe('User not found');
    expect(error.statusCode).toBe(400); // default
    expect(error.name).toBe('ServerFnError');
    expect(error).toBeInstanceOf(Error);
  });

  test('creates error with custom status code', () => {
    const error = new ServerFnError('UNAUTHORIZED', 'Not logged in', { statusCode: 401 });
    expect(error.statusCode).toBe(401);
  });

  test('creates error with details', () => {
    const error = new ServerFnError('VALIDATION_ERROR', 'Invalid input', {
      details: { field: 'email', reason: 'invalid format' },
    });
    expect(error.details).toEqual({ field: 'email', reason: 'invalid format' });
  });
});

// =============================================================================
// createServerFn (Server-Side — runs in Bun, so isServer = true)
// =============================================================================

describe('createServerFn', () => {
  describe('simple form (id + handler)', () => {
    test('creates a callable function', async () => {
      const greet = createServerFn('greet', async (name: string) => {
        return `Hello, ${name}!`;
      });

      const result = await greet('World');
      expect(result).toBe('Hello, World!');
    });

    test('function has metadata properties', () => {
      const fn = createServerFn('myFn', async () => 42);

      expect(fn._id).toBe('myFn');
      expect(fn._url).toBe(`${SERVER_FN_BASE}/myFn`);
    });

    test('registers function in the registry', () => {
      createServerFn('registered', async () => 'yes');
      expect(getServerFn('registered')).toBeDefined();
    });

    test('handles void input', async () => {
      const getTime = createServerFn('getTime', async () => {
        return Date.now();
      });

      const result = await getTime(undefined as void);
      expect(typeof result).toBe('number');
    });

    test('handles complex return types', async () => {
      const getUser = createServerFn('getUser', async (id: string) => {
        return { id, name: 'Test User', roles: ['admin'] };
      });

      const user = await getUser('123');
      expect(user).toEqual({ id: '123', name: 'Test User', roles: ['admin'] });
    });

    test('propagates handler errors', async () => {
      const failing = createServerFn('failing', async () => {
        throw new ServerFnError('BROKEN', 'Something broke');
      });

      await expect(failing(undefined as void)).rejects.toThrow('Something broke');
    });
  });

  describe('options form (full config)', () => {
    test('creates function with options', async () => {
      const add = createServerFn({
        id: 'add',
        handler: async (input: { a: number; b: number }) => {
          return input.a + input.b;
        },
      });

      const result = await add({ a: 3, b: 4 });
      expect(result).toBe(7);
    });

    test('validates input with schema', async () => {
      const schema = {
        parse(data: unknown) {
          const d = data as { name?: string };
          if (!d.name || typeof d.name !== 'string') {
            throw new Error('name is required');
          }
          return d as { name: string };
        },
      };

      const greet = createServerFn({
        id: 'greetValidated',
        input: schema,
        handler: async (input: { name: string }) => `Hi ${input.name}`,
      });

      // Valid input
      const result = await greet({ name: 'Alice' });
      expect(result).toBe('Hi Alice');

      // Invalid input
      await expect(greet({} as any)).rejects.toThrow('name is required');
    });

    test('runs middleware before handler', async () => {
      const order: string[] = [];

      const mw1: ServerFnMiddleware = async (_ctx, next) => {
        order.push('mw1-before');
        const result = await next();
        order.push('mw1-after');
        return result;
      };

      const mw2: ServerFnMiddleware = async (_ctx, next) => {
        order.push('mw2-before');
        const result = await next();
        order.push('mw2-after');
        return result;
      };

      const fn = createServerFn({
        id: 'withMiddleware',
        middleware: [mw1, mw2],
        handler: async () => {
          order.push('handler');
          return 'done';
        },
      });

      await fn(undefined as void);

      expect(order).toEqual([
        'mw1-before',
        'mw2-before',
        'handler',
        'mw2-after',
        'mw1-after',
      ]);
    });

    test('middleware can short-circuit by not calling next', async () => {
      const blocker: ServerFnMiddleware = async (_ctx, _next) => {
        throw new ServerFnError('BLOCKED', 'Access denied', { statusCode: 403 });
      };

      const fn = createServerFn({
        id: 'blocked',
        middleware: [blocker],
        handler: async () => 'should not reach',
      });

      await expect(fn(undefined as void)).rejects.toThrow('Access denied');
    });

    test('middleware receives context', async () => {
      let receivedCtx: ServerFnContext | null = null;

      const inspector: ServerFnMiddleware = async (ctx, next) => {
        receivedCtx = ctx;
        return next();
      };

      const fn = createServerFn({
        id: 'inspected',
        middleware: [inspector],
        handler: async () => 'ok',
      });

      await fn(undefined as void);

      expect(receivedCtx).not.toBeNull();
      expect(receivedCtx!.request).toBeInstanceOf(Request);
      expect(receivedCtx!.responseHeaders).toBeInstanceOf(Headers);
    });
  });

  describe('URL encoding', () => {
    test('encodes special characters in function ID', () => {
      const fn = createServerFn('my/special fn', async () => 'ok');
      expect(fn._url).toBe(`${SERVER_FN_BASE}/${encodeURIComponent('my/special fn')}`);
    });
  });
});

// =============================================================================
// SERVER_FN_BASE
// =============================================================================

describe('SERVER_FN_BASE', () => {
  test('has expected value', () => {
    expect(SERVER_FN_BASE).toBe('/_server-fn');
  });
});
