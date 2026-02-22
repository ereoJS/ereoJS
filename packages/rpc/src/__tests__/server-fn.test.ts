/**
 * Tests for server function core: createServerFn, registry, ServerFnError
 */

import { describe, test, expect, beforeEach, afterEach, mock } from 'bun:test';
import {
  createServerFn,
  ServerFnError,
  registerServerFn,
  getServerFn,
  getAllServerFns,
  unregisterServerFn,
  clearServerFnRegistry,
  setServerFnMiddleware,
  _clearServerFnMiddleware,
  SERVER_FN_BASE,
  _createClientProxy,
  type ServerFnContext,
  type ServerFnMiddleware,
} from '../server-fn';

// Clean registry between tests
beforeEach(() => {
  clearServerFnRegistry();
  _clearServerFnMiddleware();
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

// =============================================================================
// ServerFn properties
// =============================================================================

describe('ServerFn properties', () => {
  test('_id is readonly', () => {
    const fn = createServerFn('readonlyId', async () => 'ok');
    expect(fn._id).toBe('readonlyId');
    // Cannot reassign — the property descriptor has writable: false
    expect(() => { (fn as any)._id = 'changed'; }).toThrow();
  });

  test('_url is readonly', () => {
    const fn = createServerFn('readonlyUrl', async () => 'ok');
    expect(fn._url).toBe(`${SERVER_FN_BASE}/readonlyUrl`);
    expect(() => { (fn as any)._url = '/changed'; }).toThrow();
  });

  test('allowPublic is passed to registry', () => {
    createServerFn({
      id: 'publicFn',
      allowPublic: true,
      handler: async () => 'public',
    });

    const registered = getServerFn('publicFn');
    expect(registered).toBeDefined();
    expect(registered!.allowPublic).toBe(true);
  });
});

// =============================================================================
// Server-side direct execution edge cases
// =============================================================================

describe('server-side direct execution', () => {
  test('executes without middleware or schema', async () => {
    const fn = createServerFn('directSimple', async (x: number) => x * 3);
    const result = await fn(7);
    expect(result).toBe(21);
  });

  test('validates input on direct server call', async () => {
    const schema = {
      parse(data: unknown) {
        if (typeof data !== 'number') throw new Error('must be number');
        return data as number;
      },
    };

    const fn = createServerFn({
      id: 'validateDirect',
      input: schema,
      handler: async (n: number) => n + 1,
    });

    // Valid
    expect(await fn(5)).toBe(6);

    // Invalid
    await expect(fn('not a number' as any)).rejects.toThrow('must be number');
  });

  test('runs middleware chain on direct server call', async () => {
    const order: string[] = [];

    const mw: ServerFnMiddleware = async (_ctx, next) => {
      order.push('mw');
      return next();
    };

    const fn = createServerFn({
      id: 'mwDirect',
      middleware: [mw],
      handler: async () => {
        order.push('handler');
        return 'done';
      },
    });

    await fn(undefined as void);
    expect(order).toEqual(['mw', 'handler']);
  });

  test('provides minimal context on direct call', async () => {
    let receivedCtx: ServerFnContext | null = null;

    const fn = createServerFn('ctxDirect', async (_input: void, ctx) => {
      receivedCtx = ctx;
      return 'ok';
    });

    await fn(undefined as void);

    expect(receivedCtx).not.toBeNull();
    expect(receivedCtx!.request).toBeInstanceOf(Request);
    expect(receivedCtx!.request.url).toContain('_server-fn/ctxDirect');
    expect(receivedCtx!.responseHeaders).toBeInstanceOf(Headers);
    expect(receivedCtx!.appContext).toEqual({});
  });
});

// =============================================================================
// Client Proxy (_createClientProxy) — tests the browser-side code path
// =============================================================================

describe('_createClientProxy', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  test('has correct _id and _url properties', () => {
    const fn = _createClientProxy('myFunc');
    expect(fn._id).toBe('myFunc');
    expect(fn._url).toBe(`${SERVER_FN_BASE}/myFunc`);
  });

  test('_id and _url are readonly', () => {
    const fn = _createClientProxy('readonlyProxy');
    expect(() => { (fn as any)._id = 'changed'; }).toThrow();
    expect(() => { (fn as any)._url = '/changed'; }).toThrow();
  });

  test('encodes special characters in URL', () => {
    const fn = _createClientProxy('my/special fn');
    expect(fn._url).toBe(`${SERVER_FN_BASE}/${encodeURIComponent('my/special fn')}`);
  });

  test('POSTs input to server and returns data on success', async () => {
    globalThis.fetch = mock(async (url: any, init: any) => {
      expect(url).toBe(`${SERVER_FN_BASE}/fetchTest`);
      expect(init.method).toBe('POST');
      expect(init.headers['Content-Type']).toBe('application/json');
      expect(init.headers['X-Ereo-RPC']).toBe('1');

      const body = JSON.parse(init.body);
      expect(body.input).toEqual({ name: 'Alice' });

      return new Response(JSON.stringify({ ok: true, data: { greeting: 'Hello, Alice!' } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }) as any;

    const fn = _createClientProxy<{ name: string }, { greeting: string }>('fetchTest');
    const result = await fn({ name: 'Alice' });
    expect(result).toEqual({ greeting: 'Hello, Alice!' });
  });

  test('throws ServerFnError on error response', async () => {
    globalThis.fetch = mock(async () => {
      return new Response(
        JSON.stringify({
          ok: false,
          error: { code: 'NOT_FOUND', message: 'User not found', details: { id: '999' } },
        }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }) as any;

    const fn = _createClientProxy<string, unknown>('errorTest');

    try {
      await fn('999');
      expect.unreachable('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(ServerFnError);
      const sfErr = err as ServerFnError;
      expect(sfErr.code).toBe('NOT_FOUND');
      expect(sfErr.message).toBe('User not found');
      expect(sfErr.statusCode).toBe(404);
      expect(sfErr.details).toEqual({ id: '999' });
    }
  });

  test('sends void input as undefined', async () => {
    let receivedBody: any;

    globalThis.fetch = mock(async (_url: any, init: any) => {
      receivedBody = JSON.parse(init.body);
      return new Response(JSON.stringify({ ok: true, data: 42 }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }) as any;

    const fn = _createClientProxy<void, number>('voidInput');
    await fn(undefined as void);
    expect(receivedBody.input).toBeUndefined();
  });
});

// =============================================================================
// ServerFnCallOptions (direct calls with context)
// =============================================================================

describe('ServerFnCallOptions', () => {
  test('direct call without options runs only fn-level middleware', async () => {
    const calls: string[] = [];

    const fnMiddleware: ServerFnMiddleware = async (ctx, next) => {
      calls.push('fn-mw');
      return next();
    };

    // Set global middleware
    const globalMw: ServerFnMiddleware = async (ctx, next) => {
      calls.push('global-mw');
      return next();
    };
    setServerFnMiddleware([globalMw], []);

    const fn = createServerFn({
      id: 'ctx-test-1',
      handler: async () => 'ok',
      middleware: [fnMiddleware],
    });

    await fn('anything');

    // Only fn middleware should run (backwards compatible)
    expect(calls).toEqual(['fn-mw']);
  });

  test('direct call with { request } runs full middleware chain', async () => {
    const calls: string[] = [];

    const globalMw: ServerFnMiddleware = async (ctx, next) => {
      calls.push('global');
      return next();
    };
    const defaultMw: ServerFnMiddleware = async (ctx, next) => {
      calls.push('default');
      return next();
    };
    const fnMw: ServerFnMiddleware = async (ctx, next) => {
      calls.push('fn');
      return next();
    };

    setServerFnMiddleware([globalMw], [defaultMw]);

    const fn = createServerFn({
      id: 'ctx-test-2',
      handler: async () => 'ok',
      middleware: [fnMw],
    });

    const request = new Request('http://localhost/test', { method: 'POST' });
    await fn('anything', { request });

    // Full chain: global + default + fn
    expect(calls).toEqual(['global', 'default', 'fn']);
  });

  test('allowPublic skips default middleware even with explicit context', async () => {
    const calls: string[] = [];

    const defaultMw: ServerFnMiddleware = async (ctx, next) => {
      calls.push('default');
      return next();
    };
    const globalMw: ServerFnMiddleware = async (ctx, next) => {
      calls.push('global');
      return next();
    };

    setServerFnMiddleware([globalMw], [defaultMw]);

    const fn = createServerFn({
      id: 'ctx-test-3',
      handler: async () => 'public',
      middleware: [],
      allowPublic: true,
    });

    const request = new Request('http://localhost/test');
    await fn('anything', { request });

    // Global runs, default skipped for allowPublic
    expect(calls).toEqual(['global']);
  });

  test('passes real request to middleware context', async () => {
    let capturedAuth: string | null = null;

    const authMw: ServerFnMiddleware = async (ctx, next) => {
      capturedAuth = ctx.request.headers.get('Authorization');
      return next();
    };

    setServerFnMiddleware([authMw], []);

    const fn = createServerFn({
      id: 'ctx-test-4',
      handler: async () => 'ok',
    });

    const request = new Request('http://localhost/test', {
      headers: { Authorization: 'Bearer token123' },
    });
    await fn('anything', { request });

    expect(capturedAuth).toBe('Bearer token123');
  });

  test('uses createContext when request is provided', async () => {
    setServerFnMiddleware([], [], async (request) => {
      const token = request.headers.get('Authorization');
      return { userId: token === 'Bearer valid' ? '42' : null };
    });

    let capturedAppCtx: unknown;
    const fn = createServerFn({
      id: 'ctx-test-5',
      handler: async (input, ctx) => {
        capturedAppCtx = ctx.appContext;
        return 'ok';
      },
    });

    const request = new Request('http://localhost/test', {
      headers: { Authorization: 'Bearer valid' },
    });
    await fn('anything', { request });

    expect(capturedAppCtx).toEqual({ userId: '42' });
  });

  test('appContext override takes precedence over createContext', async () => {
    setServerFnMiddleware([], [], async () => ({ fromCreateContext: true }));

    let capturedAppCtx: unknown;
    const fn = createServerFn({
      id: 'ctx-test-6',
      handler: async (input, ctx) => {
        capturedAppCtx = ctx.appContext;
        return 'ok';
      },
    });

    const request = new Request('http://localhost/test');
    await fn('anything', { request, appContext: { manual: true } });

    expect(capturedAppCtx).toEqual({ manual: true });
  });
});
