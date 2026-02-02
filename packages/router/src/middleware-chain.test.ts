/**
 * @oreo/router - Middleware Chain Tests
 */

import { describe, it, expect, beforeEach } from 'bun:test';
import type { MiddlewareHandler, AppContext } from '@oreo/core';
import {
  registerMiddleware,
  getMiddleware,
  hasMiddleware,
  unregisterMiddleware,
  clearMiddlewareRegistry,
  resolveMiddleware,
  executeMiddlewareChain,
  createMiddlewareExecutor,
  composeMiddleware,
  when,
  method,
  path,
  createLoggerMiddleware,
  createCorsMiddleware,
  createRateLimitMiddleware,
} from './middleware-chain';

// Mock context helper
function createMockContext(): AppContext {
  return {
    cache: {
      set: () => {},
      get: () => undefined,
      getTags: () => [],
    },
    get: () => undefined,
    set: () => {},
    responseHeaders: new Headers(),
    url: new URL('http://localhost:3000/test'),
    env: {},
  };
}

describe('Middleware Registry', () => {
  beforeEach(() => {
    clearMiddlewareRegistry();
  });

  it('should register and retrieve middleware', () => {
    const handler: MiddlewareHandler = async (req, ctx, next) => next();
    registerMiddleware('test', handler);

    expect(hasMiddleware('test')).toBe(true);
    expect(getMiddleware('test')).toBe(handler);
  });

  it('should return undefined for unknown middleware', () => {
    expect(getMiddleware('unknown')).toBeUndefined();
    expect(hasMiddleware('unknown')).toBe(false);
  });

  it('should unregister middleware', () => {
    const handler: MiddlewareHandler = async (req, ctx, next) => next();
    registerMiddleware('test', handler);

    expect(unregisterMiddleware('test')).toBe(true);
    expect(hasMiddleware('test')).toBe(false);
  });

  it('should clear all middleware', () => {
    registerMiddleware('test1', async (req, ctx, next) => next());
    registerMiddleware('test2', async (req, ctx, next) => next());

    clearMiddlewareRegistry();

    expect(hasMiddleware('test1')).toBe(false);
    expect(hasMiddleware('test2')).toBe(false);
  });
});

describe('resolveMiddleware', () => {
  beforeEach(() => {
    clearMiddlewareRegistry();
  });

  it('should return function references directly', () => {
    const handler: MiddlewareHandler = async (req, ctx, next) => next();
    expect(resolveMiddleware(handler)).toBe(handler);
  });

  it('should resolve named middleware', () => {
    const handler: MiddlewareHandler = async (req, ctx, next) => next();
    registerMiddleware('named', handler);

    expect(resolveMiddleware('named')).toBe(handler);
  });

  it('should return undefined for unknown named middleware', () => {
    expect(resolveMiddleware('unknown')).toBeUndefined();
  });
});

describe('executeMiddlewareChain', () => {
  beforeEach(() => {
    clearMiddlewareRegistry();
  });

  it('should execute middleware in order', async () => {
    const order: string[] = [];

    const handler1: MiddlewareHandler = async (req, ctx, next) => {
      order.push('1');
      const response = await next();
      order.push('1-end');
      return response;
    };

    const handler2: MiddlewareHandler = async (req, ctx, next) => {
      order.push('2');
      return next();
    };

    const finalHandler = async () => {
      order.push('final');
      return new Response('OK');
    };

    const request = new Request('http://localhost:3000/test');
    const context = createMockContext();

    const response = await executeMiddlewareChain([handler1, handler2], {
      request,
      context,
      finalHandler,
    });

    expect(order).toEqual(['1', '2', 'final', '1-end']);
    expect(response.status).toBe(200);
  });

  it('should short-circuit on middleware response', async () => {
    const handler1: MiddlewareHandler = async (req, ctx, next) => {
      return new Response('Blocked', { status: 403 });
    };

    const handler2: MiddlewareHandler = async (req, ctx, next) => next();

    let finalCalled = false;
    const finalHandler = async () => {
      finalCalled = true;
      return new Response('OK');
    };

    const request = new Request('http://localhost:3000/test');
    const context = createMockContext();

    const response = await executeMiddlewareChain([handler1, handler2], {
      request,
      context,
      finalHandler,
    });

    expect(response.status).toBe(403);
    expect(finalCalled).toBe(false);
  });

  it('should support named middleware references', async () => {
    registerMiddleware('auth', async (req, ctx, next) => {
      ctx.set('authenticated', true);
      return next();
    });

    const finalHandler = async () => {
      return new Response('OK');
    };

    const request = new Request('http://localhost:3000/test');
    const context = createMockContext();

    const response = await executeMiddlewareChain(['auth'], {
      request,
      context,
      finalHandler,
    });

    expect(response.status).toBe(200);
  });

  it('should throw for unknown named middleware', async () => {
    const request = new Request('http://localhost:3000/test');
    const context = createMockContext();

    expect(
      executeMiddlewareChain(['unknown-middleware'], {
        request,
        context,
        finalHandler: async () => new Response('OK'),
      })
    ).rejects.toThrow('Named middleware not found');
  });

  it('should throw for invalid middleware reference', async () => {
    const request = new Request('http://localhost:3000/test');
    const context = createMockContext();

    expect(
      executeMiddlewareChain([123 as unknown as string], {
        request,
        context,
        finalHandler: async () => new Response('OK'),
      })
    ).rejects.toThrow('Invalid middleware reference');
  });

  it('should handle non-Error thrown values', async () => {
    const errorHandler = (error: Error) => new Response(`Error: ${error.message}`, { status: 500 });

    const handler: MiddlewareHandler = async () => {
      throw 'string error';
    };

    const request = new Request('http://localhost:3000/test');
    const context = createMockContext();

    const response = await executeMiddlewareChain([handler], {
      request,
      context,
      finalHandler: async () => new Response('OK'),
      onError: errorHandler,
    });

    expect(response.status).toBe(500);
    expect(await response.text()).toBe('Error: string error');
  });

  it('should rethrow errors when no error handler provided', async () => {
    const handler: MiddlewareHandler = async () => {
      throw new Error('Unhandled error');
    };

    const request = new Request('http://localhost:3000/test');
    const context = createMockContext();

    await expect(
      executeMiddlewareChain([handler], {
        request,
        context,
        finalHandler: async () => new Response('OK'),
      })
    ).rejects.toThrow('Unhandled error');
  });

  it('should handle errors with custom error handler', async () => {
    const errorHandler = (error: Error) => new Response('Error handled', { status: 500 });

    const handler: MiddlewareHandler = async () => {
      throw new Error('Test error');
    };

    const request = new Request('http://localhost:3000/test');
    const context = createMockContext();

    const response = await executeMiddlewareChain([handler], {
      request,
      context,
      finalHandler: async () => new Response('OK'),
      onError: errorHandler,
    });

    expect(response.status).toBe(500);
    expect(await response.text()).toBe('Error handled');
  });
});

describe('createMiddlewareExecutor', () => {
  beforeEach(() => {
    clearMiddlewareRegistry();
  });

  it('should create bound executor from config', async () => {
    registerMiddleware('test', async (req, ctx, next) => next());

    const executor = createMiddlewareExecutor({
      middleware: ['test'],
    });

    const request = new Request('http://localhost:3000/test');
    const context = createMockContext();

    const response = await executor({
      request,
      context,
      finalHandler: async () => new Response('OK'),
    });

    expect(response.status).toBe(200);
  });
});

describe('composeMiddleware', () => {
  it('should compose multiple handlers into one', async () => {
    const order: string[] = [];

    const handler1: MiddlewareHandler = async (req, ctx, next) => {
      order.push('1');
      return next();
    };

    const handler2: MiddlewareHandler = async (req, ctx, next) => {
      order.push('2');
      return next();
    };

    const composed = composeMiddleware(handler1, handler2);

    const request = new Request('http://localhost:3000/test');
    const context = createMockContext();

    await composed(request, context, async () => {
      order.push('final');
      return new Response('OK');
    });

    expect(order).toEqual(['1', '2', 'final']);
  });
});

describe('when', () => {
  it('should run middleware when predicate is true', async () => {
    let ran = false;
    const handler: MiddlewareHandler = async (req, ctx, next) => {
      ran = true;
      return next();
    };

    const conditional = when(() => true, handler);

    const request = new Request('http://localhost:3000/test');
    const context = createMockContext();

    await conditional(request, context, async () => new Response('OK'));

    expect(ran).toBe(true);
  });

  it('should skip middleware when predicate is false', async () => {
    let ran = false;
    const handler: MiddlewareHandler = async (req, ctx, next) => {
      ran = true;
      return next();
    };

    const conditional = when(() => false, handler);

    const request = new Request('http://localhost:3000/test');
    const context = createMockContext();

    await conditional(request, context, async () => new Response('OK'));

    expect(ran).toBe(false);
  });
});

describe('method', () => {
  it('should run middleware for matching method', async () => {
    let ran = false;
    const handler: MiddlewareHandler = async (req, ctx, next) => {
      ran = true;
      return next();
    };

    const conditional = method('POST', handler);

    const request = new Request('http://localhost:3000/test', { method: 'POST' });
    const context = createMockContext();

    await conditional(request, context, async () => new Response('OK'));

    expect(ran).toBe(true);
  });

  it('should skip middleware for non-matching method', async () => {
    let ran = false;
    const handler: MiddlewareHandler = async (req, ctx, next) => {
      ran = true;
      return next();
    };

    const conditional = method('GET', handler);

    const request = new Request('http://localhost:3000/test', { method: 'POST' });
    const context = createMockContext();

    await conditional(request, context, async () => new Response('OK'));

    expect(ran).toBe(false);
  });
});

describe('path', () => {
  it('should run middleware for matching path', async () => {
    let ran = false;
    const handler: MiddlewareHandler = async (req, ctx, next) => {
      ran = true;
      return next();
    };

    const conditional = path('/api/*', handler);

    const request = new Request('http://localhost:3000/api/users');
    const context = createMockContext();

    await conditional(request, context, async () => new Response('OK'));

    expect(ran).toBe(true);
  });

  it('should run middleware for regex pattern', async () => {
    let ran = false;
    const handler: MiddlewareHandler = async (req, ctx, next) => {
      ran = true;
      return next();
    };

    const conditional = path(/^\/api\/.*/, handler);

    const request = new Request('http://localhost:3000/api/users');
    const context = createMockContext();

    await conditional(request, context, async () => new Response('OK'));

    expect(ran).toBe(true);
  });

  it('should run middleware for exact path match', async () => {
    let ran = false;
    const handler: MiddlewareHandler = async (req, ctx, next) => {
      ran = true;
      return next();
    };

    const conditional = path('/about', handler);

    const request = new Request('http://localhost:3000/about');
    const context = createMockContext();

    await conditional(request, context, async () => new Response('OK'));

    expect(ran).toBe(true);
  });

  it('should skip middleware for non-matching path', async () => {
    let ran = false;
    const handler: MiddlewareHandler = async (req, ctx, next) => {
      ran = true;
      return next();
    };

    const conditional = path('/api/*', handler);

    const request = new Request('http://localhost:3000/other/route');
    const context = createMockContext();

    await conditional(request, context, async () => new Response('OK'));

    expect(ran).toBe(false);
  });

  it('should support array of patterns', async () => {
    let ran = false;
    const handler: MiddlewareHandler = async (req, ctx, next) => {
      ran = true;
      return next();
    };

    const conditional = path(['/api/*', '/v2/*'], handler);

    const request = new Request('http://localhost:3000/v2/users');
    const context = createMockContext();

    await conditional(request, context, async () => new Response('OK'));

    expect(ran).toBe(true);
  });

  it('should match prefix patterns without wildcard', async () => {
    let ran = false;
    const handler: MiddlewareHandler = async (req, ctx, next) => {
      ran = true;
      return next();
    };

    const conditional = path('/api', handler);

    const request = new Request('http://localhost:3000/api/users/123');
    const context = createMockContext();

    await conditional(request, context, async () => new Response('OK'));

    expect(ran).toBe(true);
  });
});

describe('createLoggerMiddleware', () => {
  it('should log requests with duration', async () => {
    const logger = createLoggerMiddleware();

    const request = new Request('http://localhost:3000/test');
    const context = createMockContext();

    const response = await logger(request, context, async () => new Response('OK'));

    expect(response.status).toBe(200);
  });

  it('should include specified headers in logs', async () => {
    const logger = createLoggerMiddleware({
      includeHeaders: ['Content-Type', 'Authorization'],
    });

    const request = new Request('http://localhost:3000/test', {
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer token' },
    });
    const context = createMockContext();

    const response = await logger(request, context, async () => new Response('OK'));

    expect(response.status).toBe(200);
  });

  it('should log errors and rethrow', async () => {
    const logger = createLoggerMiddleware();

    const request = new Request('http://localhost:3000/test');
    const context = createMockContext();

    await expect(
      logger(request, context, async () => {
        throw new Error('Test error');
      })
    ).rejects.toThrow('Test error');
  });

  it('should handle non-Error thrown values in error path', async () => {
    const logger = createLoggerMiddleware();

    const request = new Request('http://localhost:3000/test');
    const context = createMockContext();

    await expect(
      logger(request, context, async () => {
        throw 'string error';
      })
    ).rejects.toBe('string error');
  });
});

describe('createCorsMiddleware', () => {
  it('should add CORS headers to response', async () => {
    const cors = createCorsMiddleware({
      origin: '*',
      methods: ['GET', 'POST'],
    });

    const request = new Request('http://localhost:3000/test');
    const context = createMockContext();

    const response = await cors(request, context, async () => new Response('OK'));

    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
    expect(response.headers.get('Access-Control-Allow-Methods')).toBe('GET, POST');
  });

  it('should handle preflight requests', async () => {
    const cors = createCorsMiddleware();

    const request = new Request('http://localhost:3000/test', { method: 'OPTIONS' });
    const context = createMockContext();

    const response = await cors(request, context, async () => new Response('OK'));

    expect(response.status).toBe(204);
  });

  it('should handle array of allowed origins', async () => {
    const cors = createCorsMiddleware({
      origin: ['http://localhost:3000', 'http://example.com'],
    });

    const request = new Request('http://localhost:3000/test', {
      headers: { Origin: 'http://example.com' },
    });
    const context = createMockContext();

    const response = await cors(request, context, async () => new Response('OK'));

    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('http://example.com');
  });

  it('should not set origin header for disallowed origins in array', async () => {
    const cors = createCorsMiddleware({
      origin: ['http://localhost:3000'],
    });

    const request = new Request('http://localhost:3000/test', {
      headers: { Origin: 'http://evil.com' },
    });
    const context = createMockContext();

    const response = await cors(request, context, async () => new Response('OK'));

    expect(response.headers.get('Access-Control-Allow-Origin')).toBeNull();
  });

  it('should handle function origin validator', async () => {
    const cors = createCorsMiddleware({
      origin: (origin) => origin.endsWith('.example.com'),
    });

    const request = new Request('http://localhost:3000/test', {
      headers: { Origin: 'http://app.example.com' },
    });
    const context = createMockContext();

    const response = await cors(request, context, async () => new Response('OK'));

    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('http://app.example.com');
  });

  it('should not set origin header for denied function origins', async () => {
    const cors = createCorsMiddleware({
      origin: () => false,
    });

    const request = new Request('http://localhost:3000/test', {
      headers: { Origin: 'http://example.com' },
    });
    const context = createMockContext();

    const response = await cors(request, context, async () => new Response('OK'));

    expect(response.headers.get('Access-Control-Allow-Origin')).toBeNull();
  });

  it('should add custom headers', async () => {
    const cors = createCorsMiddleware({
      headers: ['X-Custom-Header', 'Authorization'],
    });

    const request = new Request('http://localhost:3000/test');
    const context = createMockContext();

    const response = await cors(request, context, async () => new Response('OK'));

    expect(response.headers.get('Access-Control-Allow-Headers')).toBe('X-Custom-Header, Authorization');
  });

  it('should add credentials header when enabled', async () => {
    const cors = createCorsMiddleware({
      credentials: true,
    });

    const request = new Request('http://localhost:3000/test');
    const context = createMockContext();

    const response = await cors(request, context, async () => new Response('OK'));

    expect(response.headers.get('Access-Control-Allow-Credentials')).toBe('true');
  });
});

describe('createRateLimitMiddleware', () => {
  it('should allow requests within limit', async () => {
    const rateLimit = createRateLimitMiddleware({
      windowMs: 60000,
      maxRequests: 5,
    });

    const request = new Request('http://localhost:3000/test');
    const context = createMockContext();

    for (let i = 0; i < 5; i++) {
      const response = await rateLimit(request, context, async () => new Response('OK'));
      expect(response.status).toBe(200);
    }
  });

  it('should block requests over limit', async () => {
    const rateLimit = createRateLimitMiddleware({
      windowMs: 60000,
      maxRequests: 2,
    });

    const request = new Request('http://localhost:3000/test');
    const context = createMockContext();

    // First 2 requests should pass
    await rateLimit(request, context, async () => new Response('OK'));
    await rateLimit(request, context, async () => new Response('OK'));

    // Third should be blocked
    const response = await rateLimit(request, context, async () => new Response('OK'));
    expect(response.status).toBe(429);
  });

  it('should add rate limit headers', async () => {
    const rateLimit = createRateLimitMiddleware({
      maxRequests: 10,
    });

    const request = new Request('http://localhost:3000/test');
    const context = createMockContext();

    const response = await rateLimit(request, context, async () => new Response('OK'));

    expect(response.headers.get('X-RateLimit-Limit')).toBe('10');
    expect(response.headers.has('X-RateLimit-Remaining')).toBe(true);
    expect(response.headers.has('X-RateLimit-Reset')).toBe(true);
  });
});
