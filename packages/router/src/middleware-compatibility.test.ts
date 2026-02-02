/**
 * @areo/router - Middleware Compatibility Tests
 *
 * These tests verify that middleware types are compatible across packages:
 * - @areo/core: MiddlewareHandler (base type)
 * - @areo/router: TypedMiddlewareHandler (typed extension)
 * - @areo/server: MiddlewareChain (execution)
 *
 * All three packages should work seamlessly together.
 */

import { describe, it, expect, beforeEach } from 'bun:test';
import type {
  MiddlewareHandler,
  AppContext,
  NextFunction,
  Middleware,
} from '@areo/core';
import { createContext, RequestContext } from '@areo/core';
import {
  createMiddleware,
  chainMiddleware,
  registerMiddleware,
  clearMiddlewareRegistry,
  executeMiddlewareChain,
  composeMiddleware,
  type TypedMiddlewareHandler,
  type TypedMiddleware,
} from './middleware-chain';

// ============================================================================
// Test Helpers
// ============================================================================

function createMockContext(): AppContext {
  return {
    cache: {
      set: () => {},
      get: () => undefined,
      getTags: () => [],
    },
    get: <T>() => undefined as T | undefined,
    set: () => {},
    responseHeaders: new Headers(),
    url: new URL('http://localhost:3000/test'),
    env: {},
  };
}

function createMockContextWithStore(): AppContext & { _store: Map<string, unknown> } {
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
    _store: store,
  };
}

// ============================================================================
// Type Compatibility Tests
// ============================================================================

describe('Middleware Type Compatibility', () => {
  describe('Core MiddlewareHandler with Server', () => {
    it('should accept core MiddlewareHandler in executeMiddlewareChain', async () => {
      // Define a plain MiddlewareHandler from @areo/core
      const coreMiddleware: MiddlewareHandler = async (request, context, next) => {
        context.set('fromCore', true);
        return next();
      };

      const request = new Request('http://localhost:3000/test');
      const context = createMockContextWithStore();

      const response = await executeMiddlewareChain([coreMiddleware], {
        request,
        context,
        finalHandler: async () => new Response('OK'),
      });

      expect(response.status).toBe(200);
      expect(context.get('fromCore')).toBe(true);
    });

    it('should use RequestContext (which implements AppContext) with core middleware', async () => {
      // RequestContext from @areo/core implements AppContext
      const request = new Request('http://localhost:3000/test');
      const context = createContext(request);

      // Verify RequestContext is assignable to AppContext
      const appContext: AppContext = context;

      const coreMiddleware: MiddlewareHandler = async (req, ctx, next) => {
        ctx.set('value', 'test');
        return next();
      };

      const response = await executeMiddlewareChain([coreMiddleware], {
        request,
        context: appContext,
        finalHandler: async () => new Response('OK'),
      });

      expect(response.status).toBe(200);
      expect(context.get('value')).toBe('test');
    });
  });

  describe('TypedMiddlewareHandler Compatibility', () => {
    beforeEach(() => {
      clearMiddlewareRegistry();
    });

    it('should allow TypedMiddlewareHandler to be used as MiddlewareHandler', async () => {
      // Create a typed middleware
      const typedMiddleware: TypedMiddlewareHandler<{ user: { id: string } }> = async (
        request,
        context,
        next
      ) => {
        context.set('user', { id: '123' });
        return next();
      };

      // TypedMiddlewareHandler should be assignable to MiddlewareHandler
      const coreHandler: MiddlewareHandler = typedMiddleware;

      const request = new Request('http://localhost:3000/test');
      const context = createMockContextWithStore();

      const response = await executeMiddlewareChain([coreHandler], {
        request,
        context,
        finalHandler: async () => new Response('OK'),
      });

      expect(response.status).toBe(200);
      expect(context.get<{ id: string }>('user')).toEqual({ id: '123' });
    });

    it('should allow TypedMiddleware.handler to be used with executeMiddlewareChain', async () => {
      const typedAuth = createMiddleware<{ user: { id: string; name: string } }>({
        name: 'auth',
        provides: ['user'],
        handler: async (request, context, next) => {
          context.set('user', { id: '123', name: 'Test User' });
          return next();
        },
      });

      const request = new Request('http://localhost:3000/test');
      const context = createMockContextWithStore();

      // Use the handler directly (it's a MiddlewareHandler)
      const response = await executeMiddlewareChain([typedAuth.handler], {
        request,
        context,
        finalHandler: async () => new Response('OK'),
      });

      expect(response.status).toBe(200);
      expect(context.get<{ id: string; name: string }>('user')?.name).toBe('Test User');
    });

    it('should allow mixing TypedMiddleware and regular MiddlewareHandler', async () => {
      const order: string[] = [];

      // Regular MiddlewareHandler
      const loggingMiddleware: MiddlewareHandler = async (request, context, next) => {
        order.push('logging');
        return next();
      };

      // TypedMiddleware
      const authMiddleware = createMiddleware<{ user: string }>({
        name: 'auth',
        provides: ['user'],
        handler: async (request, context, next) => {
          order.push('auth');
          context.set('user', 'authenticated-user');
          return next();
        },
      });

      // Another regular MiddlewareHandler
      const responseMiddleware: MiddlewareHandler = async (request, context, next) => {
        order.push('response');
        const response = await next();
        return new Response(response.body, {
          status: response.status,
          headers: { 'X-Custom': 'header' },
        });
      };

      const request = new Request('http://localhost:3000/test');
      const context = createMockContextWithStore();

      const response = await executeMiddlewareChain(
        [loggingMiddleware, authMiddleware.handler, responseMiddleware],
        {
          request,
          context,
          finalHandler: async () => {
            order.push('final');
            return new Response('OK');
          },
        }
      );

      expect(order).toEqual(['logging', 'auth', 'response', 'final']);
      expect(context.get('user')).toBe('authenticated-user');
      expect(response.headers.get('X-Custom')).toBe('header');
    });
  });

  describe('Middleware Interface Compatibility', () => {
    it('should allow Middleware interface to use MiddlewareHandler', () => {
      const handler: MiddlewareHandler = async (req, ctx, next) => next();

      // Middleware interface from @areo/core
      const middleware: Middleware = {
        name: 'test',
        handler,
        paths: ['/api/*'],
      };

      expect(middleware.name).toBe('test');
      expect(middleware.paths).toEqual(['/api/*']);
      expect(typeof middleware.handler).toBe('function');
    });

    it('should allow TypedMiddleware to be converted to Middleware', () => {
      const typedMiddleware = createMiddleware({
        name: 'typed',
        handler: async (req, ctx, next) => next(),
      });

      // Convert TypedMiddleware to core Middleware
      const coreMiddleware: Middleware = {
        name: typedMiddleware.name,
        handler: typedMiddleware.handler,
        paths: ['/api/*'],
      };

      expect(coreMiddleware.name).toBe('typed');
      expect(typeof coreMiddleware.handler).toBe('function');
    });
  });
});

// ============================================================================
// Cross-Package Middleware Composition Tests
// ============================================================================

describe('Cross-Package Middleware Composition', () => {
  beforeEach(() => {
    clearMiddlewareRegistry();
  });

  it('should compose typed middleware using composeMiddleware', async () => {
    const order: string[] = [];

    const middleware1 = createMiddleware<{ step1: boolean }>({
      name: 'step1',
      provides: ['step1'],
      handler: async (req, ctx, next) => {
        order.push('step1');
        ctx.set('step1', true);
        return next();
      },
    });

    const middleware2 = createMiddleware<{ step2: boolean }>({
      name: 'step2',
      provides: ['step2'],
      handler: async (req, ctx, next) => {
        order.push('step2');
        ctx.set('step2', true);
        return next();
      },
    });

    // composeMiddleware accepts MiddlewareHandler[], which TypedMiddlewareHandler satisfies
    const composed = composeMiddleware(middleware1.handler, middleware2.handler);

    const request = new Request('http://localhost:3000/test');
    const context = createMockContextWithStore();

    await composed(request, context, async () => {
      order.push('final');
      return new Response('OK');
    });

    expect(order).toEqual(['step1', 'step2', 'final']);
    expect(context.get('step1')).toBe(true);
    expect(context.get('step2')).toBe(true);
  });

  it('should use chainMiddleware for typed composition with metadata', async () => {
    const authMiddleware = createMiddleware<{ user: { id: string } }>({
      name: 'auth',
      provides: ['user'],
      handler: async (req, ctx, next) => {
        ctx.set('user', { id: 'user-123' });
        return next();
      },
    });

    const adminMiddleware = createMiddleware<
      { isAdmin: boolean },
      { user: { id: string } }
    >({
      name: 'admin',
      provides: ['isAdmin'],
      requires: ['user'],
      handler: async (req, ctx, next) => {
        const user = ctx.get<{ id: string }>('user');
        ctx.set('isAdmin', user?.id === 'user-123');
        return next();
      },
    });

    // chainMiddleware preserves type metadata
    const chained = chainMiddleware(authMiddleware, adminMiddleware);

    expect(chained.name).toBe('auth+admin');
    expect(chained.provides).toContain('user');
    expect(chained.provides).toContain('isAdmin');

    // The chained handler is still a valid MiddlewareHandler
    const handler: MiddlewareHandler = chained.handler;

    const request = new Request('http://localhost:3000/test');
    const context = createMockContextWithStore();

    await handler(request, context, async () => new Response('OK'));

    expect(context.get('user')).toEqual({ id: 'user-123' });
    expect(context.get('isAdmin')).toBe(true);
  });

  it('should register typed middleware and resolve as MiddlewareHandler', async () => {
    const typedMiddleware = createMiddleware<{ data: string }>({
      name: 'data-provider',
      provides: ['data'],
      handler: async (req, ctx, next) => {
        ctx.set('data', 'provided-data');
        return next();
      },
    });

    // Register using the typed middleware's register method
    typedMiddleware.register();

    // Execute using string reference (which resolves to MiddlewareHandler)
    const request = new Request('http://localhost:3000/test');
    const context = createMockContextWithStore();

    const response = await executeMiddlewareChain(['data-provider'], {
      request,
      context,
      finalHandler: async () => new Response('OK'),
    });

    expect(response.status).toBe(200);
    expect(context.get('data')).toBe('provided-data');
  });
});

// ============================================================================
// Server MiddlewareChain Integration Tests
// ============================================================================

describe('Server MiddlewareChain Integration', () => {
  it('should work with RequestContext from core', async () => {
    const request = new Request('http://localhost:3000/api/test');
    const context = createContext(request);

    const middleware: MiddlewareHandler = async (req, ctx, next) => {
      ctx.set('processed', true);
      ctx.responseHeaders.set('X-Processed', 'true');
      return next();
    };

    const response = await executeMiddlewareChain([middleware], {
      request,
      context,
      finalHandler: async () => new Response('OK'),
    });

    expect(response.status).toBe(200);
    expect(context.get('processed')).toBe(true);
    expect(context.responseHeaders.get('X-Processed')).toBe('true');
  });

  it('should work with typed middleware and RequestContext', async () => {
    interface SessionData {
      sessionId: string;
      userId: string;
    }

    const sessionMiddleware = createMiddleware<{ session: SessionData }>({
      name: 'session',
      provides: ['session'],
      handler: async (req, ctx, next) => {
        ctx.set('session', {
          sessionId: 'sess-123',
          userId: 'user-456',
        });
        return next();
      },
    });

    const request = new Request('http://localhost:3000/test');
    const context = createContext(request);

    const response = await executeMiddlewareChain([sessionMiddleware.handler], {
      request,
      context,
      finalHandler: async () => {
        const session = context.get<SessionData>('session');
        return new Response(JSON.stringify(session), {
          headers: { 'Content-Type': 'application/json' },
        });
      },
    });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({
      sessionId: 'sess-123',
      userId: 'user-456',
    });
  });

  it('should handle middleware short-circuit consistently', async () => {
    const authMiddleware: MiddlewareHandler = async (req, ctx, next) => {
      const authHeader = req.headers.get('Authorization');
      if (!authHeader) {
        return new Response('Unauthorized', { status: 401 });
      }
      return next();
    };

    const request = new Request('http://localhost:3000/protected');
    const context = createContext(request);

    let finalCalled = false;
    const response = await executeMiddlewareChain([authMiddleware], {
      request,
      context,
      finalHandler: async () => {
        finalCalled = true;
        return new Response('OK');
      },
    });

    expect(response.status).toBe(401);
    expect(finalCalled).toBe(false);

    // Now with auth header
    const authorizedRequest = new Request('http://localhost:3000/protected', {
      headers: { Authorization: 'Bearer token' },
    });
    const authorizedContext = createContext(authorizedRequest);

    let authorizedFinalCalled = false;
    const authorizedResponse = await executeMiddlewareChain([authMiddleware], {
      request: authorizedRequest,
      context: authorizedContext,
      finalHandler: async () => {
        authorizedFinalCalled = true;
        return new Response('OK');
      },
    });

    expect(authorizedResponse.status).toBe(200);
    expect(authorizedFinalCalled).toBe(true);
  });
});

// ============================================================================
// Error Handling Compatibility Tests
// ============================================================================

describe('Error Handling Compatibility', () => {
  it('should handle errors from typed middleware', async () => {
    const errorMiddleware = createMiddleware({
      name: 'error-thrower',
      handler: async () => {
        throw new Error('Typed middleware error');
      },
    });

    const request = new Request('http://localhost:3000/test');
    const context = createMockContext();

    let errorHandled = false;
    const response = await executeMiddlewareChain([errorMiddleware.handler], {
      request,
      context,
      finalHandler: async () => new Response('OK'),
      onError: (error) => {
        errorHandled = true;
        return new Response(`Error: ${error.message}`, { status: 500 });
      },
    });

    expect(errorHandled).toBe(true);
    expect(response.status).toBe(500);
    expect(await response.text()).toBe('Error: Typed middleware error');
  });

  it('should propagate errors when no error handler is provided', async () => {
    const errorMiddleware: MiddlewareHandler = async () => {
      throw new Error('Unhandled error');
    };

    const request = new Request('http://localhost:3000/test');
    const context = createMockContext();

    await expect(
      executeMiddlewareChain([errorMiddleware], {
        request,
        context,
        finalHandler: async () => new Response('OK'),
      })
    ).rejects.toThrow('Unhandled error');
  });
});
