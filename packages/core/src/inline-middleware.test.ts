import { describe, expect, test } from 'bun:test';
import type { RouteModule, MiddlewareHandler } from './types';

// =================================================================
// RouteModule.middleware type tests
// =================================================================

describe('@ereo/core - RouteModule inline middleware', () => {
  test('RouteModule accepts middleware array', () => {
    const mw: MiddlewareHandler = async (req, ctx, next) => next();

    const module: RouteModule = {
      middleware: [mw],
    };

    expect(module.middleware).toHaveLength(1);
  });

  test('RouteModule middleware is optional', () => {
    const module: RouteModule = {};
    expect(module.middleware).toBeUndefined();
  });

  test('RouteModule accepts multiple middleware', () => {
    const auth: MiddlewareHandler = async (req, ctx, next) => {
      // Check auth
      return next();
    };

    const logging: MiddlewareHandler = async (req, ctx, next) => {
      const response = await next();
      return response;
    };

    const module: RouteModule = {
      middleware: [auth, logging],
      loader: async () => ({ data: 'test' }),
    };

    expect(module.middleware).toHaveLength(2);
    expect(module.loader).toBeDefined();
  });

  test('middleware handler returns Response or Promise<Response>', async () => {
    const mw: MiddlewareHandler = async (req, ctx, next) => {
      return new Response('blocked', { status: 403 });
    };

    const result = await mw(
      new Request('http://localhost/test'),
      {} as any,
      async () => new Response('ok')
    );

    expect(result.status).toBe(403);
  });

  test('middleware can call next() to continue chain', async () => {
    const mw: MiddlewareHandler = async (req, ctx, next) => {
      return next();
    };

    const result = await mw(
      new Request('http://localhost/test'),
      {} as any,
      async () => new Response('from handler', { status: 200 })
    );

    expect(result.status).toBe(200);
    expect(await result.text()).toBe('from handler');
  });

  test('middleware can modify response from next()', async () => {
    const mw: MiddlewareHandler = async (req, ctx, next) => {
      const response = await next();
      const newResponse = new Response(response.body, {
        status: response.status,
        headers: response.headers,
      });
      newResponse.headers.set('X-Modified', 'true');
      return newResponse;
    };

    const result = await mw(
      new Request('http://localhost/test'),
      {} as any,
      async () => new Response('ok')
    );

    expect(result.headers.get('X-Modified')).toBe('true');
  });
});

// =================================================================
// Export verification
// =================================================================

describe('@ereo/core - RouteModule middleware export', () => {
  test('RouteModule with middleware is importable from index', async () => {
    const exports = await import('./index');
    // RouteModule is a type-only export; verify createContext exists
    // to confirm the module is importable
    expect(exports.createContext).toBeDefined();
  });
});
