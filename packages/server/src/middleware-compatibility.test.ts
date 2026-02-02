/**
 * @areo/server - Middleware Compatibility Tests
 *
 * These tests verify that the server's MiddlewareChain works with middleware
 * defined using types from @areo/core and @areo/router.
 */

import { describe, expect, test, beforeEach } from 'bun:test';
import type {
  MiddlewareHandler,
  AppContext,
  NextFunction,
} from '@areo/core';
import { createContext, RequestContext } from '@areo/core';
import {
  MiddlewareChain,
  createMiddlewareChain,
} from './middleware';

// ============================================================================
// Test Helpers
// ============================================================================

function createMockAppContext(): AppContext {
  const store = new Map<string, unknown>();
  return {
    cache: {
      set: () => {},
      get: () => undefined,
      getTags: () => [],
    },
    get: <T>(key: string) => store.get(key) as T | undefined,
    set: <T>(key: string, value: T) => { store.set(key, value); },
    responseHeaders: new Headers(),
    url: new URL('http://localhost:3000/test'),
    env: {},
  };
}

// ============================================================================
// MiddlewareChain with Core Types
// ============================================================================

describe('MiddlewareChain with Core Types', () => {
  let chain: MiddlewareChain;

  beforeEach(() => {
    chain = createMiddlewareChain();
  });

  test('accepts MiddlewareHandler from @areo/core', async () => {
    // Define middleware using the core MiddlewareHandler type
    const middleware: MiddlewareHandler = async (request, context, next) => {
      context.set('handled', true);
      return next();
    };

    chain.use(middleware);

    const request = new Request('http://localhost:3000/');
    const context = createContext(request);

    const response = await chain.execute(request, context, async () => {
      return new Response('OK');
    });

    expect(response.status).toBe(200);
    expect(context.get('handled')).toBe(true);
  });

  test('accepts AppContext (which RequestContext implements)', async () => {
    const middleware: MiddlewareHandler = async (request, context, next) => {
      // Should be able to use AppContext methods
      context.set('value', 'test');
      context.responseHeaders.set('X-Test', 'header');
      return next();
    };

    chain.use(middleware);

    const request = new Request('http://localhost:3000/');

    // Use the abstract AppContext interface
    const appContext: AppContext = createContext(request);

    const response = await chain.execute(request, appContext, async () => {
      return new Response('OK');
    });

    expect(response.status).toBe(200);
    expect(appContext.get('value')).toBe('test');
    expect(appContext.responseHeaders.get('X-Test')).toBe('header');
  });

  test('works with RequestContext directly', async () => {
    const middleware: MiddlewareHandler = async (request, context, next) => {
      context.set('fromMiddleware', 'data');
      return next();
    };

    chain.use(middleware);

    const request = new Request('http://localhost:3000/');
    const context = createContext(request);

    // RequestContext implements AppContext, so it should work
    expect(context).toBeInstanceOf(RequestContext);

    const response = await chain.execute(request, context, async () => {
      return new Response('OK');
    });

    expect(response.status).toBe(200);
    expect(context.get('fromMiddleware')).toBe('data');
  });

  test('uses path-scoped middleware with MiddlewareHandler', async () => {
    let apiMiddlewareCalled = false;
    let globalMiddlewareCalled = false;

    const globalMiddleware: MiddlewareHandler = async (request, context, next) => {
      globalMiddlewareCalled = true;
      return next();
    };

    const apiMiddleware: MiddlewareHandler = async (request, context, next) => {
      apiMiddlewareCalled = true;
      return next();
    };

    chain.use(globalMiddleware);
    chain.use('/api/*', apiMiddleware);

    // Test with API path
    const apiRequest = new Request('http://localhost:3000/api/users');
    const apiContext = createContext(apiRequest);

    await chain.execute(apiRequest, apiContext, async () => new Response('OK'));

    expect(globalMiddlewareCalled).toBe(true);
    expect(apiMiddlewareCalled).toBe(true);

    // Reset flags
    globalMiddlewareCalled = false;
    apiMiddlewareCalled = false;

    // Test with non-API path
    const otherRequest = new Request('http://localhost:3000/other');
    const otherContext = createContext(otherRequest);

    await chain.execute(otherRequest, otherContext, async () => new Response('OK'));

    expect(globalMiddlewareCalled).toBe(true);
    expect(apiMiddlewareCalled).toBe(false);
  });
});

// ============================================================================
// Middleware Signature Verification
// ============================================================================

describe('Middleware Signature Verification', () => {
  test('middleware receives Request as first argument', async () => {
    const chain = createMiddlewareChain();
    let receivedRequest: Request | null = null;

    const middleware: MiddlewareHandler = async (request, context, next) => {
      receivedRequest = request;
      return next();
    };

    chain.use(middleware);

    const originalRequest = new Request('http://localhost:3000/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    const context = createContext(originalRequest);

    await chain.execute(originalRequest, context, async () => new Response('OK'));

    expect(receivedRequest).toBe(originalRequest);
    expect(receivedRequest?.method).toBe('POST');
    expect(receivedRequest?.headers.get('Content-Type')).toBe('application/json');
  });

  test('middleware receives AppContext as second argument', async () => {
    const chain = createMiddlewareChain();
    let receivedContext: AppContext | null = null;

    const middleware: MiddlewareHandler = async (request, context, next) => {
      receivedContext = context;
      return next();
    };

    chain.use(middleware);

    const request = new Request('http://localhost:3000/test');
    const originalContext = createContext(request);

    await chain.execute(request, originalContext, async () => new Response('OK'));

    expect(receivedContext).toBe(originalContext);
    // Verify it has AppContext interface methods
    expect(typeof receivedContext?.get).toBe('function');
    expect(typeof receivedContext?.set).toBe('function');
    expect(receivedContext?.cache).toBeDefined();
    expect(receivedContext?.responseHeaders).toBeInstanceOf(Headers);
  });

  test('middleware receives NextFunction as third argument', async () => {
    const chain = createMiddlewareChain();
    let receivedNext: NextFunction | null = null;

    const middleware: MiddlewareHandler = async (request, context, next) => {
      receivedNext = next;
      return next();
    };

    chain.use(middleware);

    const request = new Request('http://localhost:3000/test');
    const context = createContext(request);

    await chain.execute(request, context, async () => new Response('OK'));

    expect(typeof receivedNext).toBe('function');
    // NextFunction should return Promise<Response>
  });

  test('middleware can return Response directly', async () => {
    const chain = createMiddlewareChain();

    const middleware: MiddlewareHandler = async (request, context, next) => {
      // Return response without calling next
      return new Response('Blocked', { status: 403 });
    };

    chain.use(middleware);

    const request = new Request('http://localhost:3000/test');
    const context = createContext(request);

    let finalCalled = false;
    const response = await chain.execute(request, context, async () => {
      finalCalled = true;
      return new Response('OK');
    });

    expect(response.status).toBe(403);
    expect(await response.text()).toBe('Blocked');
    expect(finalCalled).toBe(false);
  });

  test('middleware can return Promise<Response>', async () => {
    const chain = createMiddlewareChain();

    const middleware: MiddlewareHandler = async (request, context, next) => {
      // Simulate async operation
      await new Promise((resolve) => setTimeout(resolve, 10));
      return next();
    };

    chain.use(middleware);

    const request = new Request('http://localhost:3000/test');
    const context = createContext(request);

    const response = await chain.execute(request, context, async () => {
      return new Response('Async OK');
    });

    expect(response.status).toBe(200);
    expect(await response.text()).toBe('Async OK');
  });
});

// ============================================================================
// Context Data Passing Tests
// ============================================================================

describe('Context Data Passing', () => {
  test('middleware can set context values for subsequent middleware', async () => {
    const chain = createMiddlewareChain();

    const authMiddleware: MiddlewareHandler = async (request, context, next) => {
      context.set('user', { id: '123', name: 'Test User' });
      return next();
    };

    const logMiddleware: MiddlewareHandler = async (request, context, next) => {
      const user = context.get<{ id: string; name: string }>('user');
      context.set('loggedUser', user?.name);
      return next();
    };

    chain.use(authMiddleware);
    chain.use(logMiddleware);

    const request = new Request('http://localhost:3000/test');
    const context = createContext(request);

    await chain.execute(request, context, async () => new Response('OK'));

    expect(context.get('user')).toEqual({ id: '123', name: 'Test User' });
    expect(context.get('loggedUser')).toBe('Test User');
  });

  test('context values are isolated per request', async () => {
    const chain = createMiddlewareChain();

    const middleware: MiddlewareHandler = async (request, context, next) => {
      const url = new URL(request.url);
      context.set('requestPath', url.pathname);
      return next();
    };

    chain.use(middleware);

    // First request
    const request1 = new Request('http://localhost:3000/path1');
    const context1 = createContext(request1);
    await chain.execute(request1, context1, async () => new Response('OK'));

    // Second request
    const request2 = new Request('http://localhost:3000/path2');
    const context2 = createContext(request2);
    await chain.execute(request2, context2, async () => new Response('OK'));

    // Each context should have its own value
    expect(context1.get('requestPath')).toBe('/path1');
    expect(context2.get('requestPath')).toBe('/path2');
  });
});

// ============================================================================
// Built-in Middleware Type Compatibility
// ============================================================================

describe('Built-in Middleware Type Compatibility', () => {
  test('logger() returns MiddlewareHandler', async () => {
    const { logger } = await import('./middleware');
    const middleware = logger();

    // Should be assignable to MiddlewareHandler
    const handler: MiddlewareHandler = middleware;

    const chain = createMiddlewareChain();
    chain.use(handler);

    const request = new Request('http://localhost:3000/test');
    const context = createContext(request);

    const response = await chain.execute(request, context, async () => new Response('OK'));
    expect(response.status).toBe(200);
  });

  test('cors() returns MiddlewareHandler', async () => {
    const { cors } = await import('./middleware');
    const middleware = cors();

    // Should be assignable to MiddlewareHandler
    const handler: MiddlewareHandler = middleware;

    const chain = createMiddlewareChain();
    chain.use(handler);

    const request = new Request('http://localhost:3000/test');
    const context = createContext(request);

    const response = await chain.execute(request, context, async () => new Response('OK'));
    expect(response.status).toBe(200);
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
  });

  test('securityHeaders() returns MiddlewareHandler', async () => {
    const { securityHeaders } = await import('./middleware');
    const middleware = securityHeaders();

    // Should be assignable to MiddlewareHandler
    const handler: MiddlewareHandler = middleware;

    const chain = createMiddlewareChain();
    chain.use(handler);

    const request = new Request('http://localhost:3000/test');
    const context = createContext(request);

    const response = await chain.execute(request, context, async () => new Response('OK'));
    expect(response.status).toBe(200);
    expect(response.headers.get('X-Frame-Options')).toBe('SAMEORIGIN');
  });

  test('rateLimit() returns MiddlewareHandler', async () => {
    const { rateLimit } = await import('./middleware');
    const middleware = rateLimit({ max: 100 });

    // Should be assignable to MiddlewareHandler
    const handler: MiddlewareHandler = middleware;

    const chain = createMiddlewareChain();
    chain.use(handler);

    const request = new Request('http://localhost:3000/test', {
      headers: { 'X-Forwarded-For': 'rate-limit-test' },
    });
    const context = createContext(request);

    const response = await chain.execute(request, context, async () => new Response('OK'));
    expect(response.status).toBe(200);
    expect(response.headers.get('X-RateLimit-Limit')).toBe('100');
  });
});
