/**
 * @oreo/testing - Middleware Testing
 *
 * Utilities for testing middleware functions.
 */

import type { MiddlewareHandler, NextFunction, AppContext } from '@oreo/core';
import { createTestContext, type TestContextOptions, type TestContext } from './context';
import { createMockRequest, type MockRequestOptions } from './request';

/**
 * Options for testing middleware.
 */
export interface MiddlewareTestOptions {
  /** Request options */
  request?: MockRequestOptions;
  /** Context options */
  context?: TestContextOptions;
  /** Custom next function (defaults to returning 200 OK) */
  next?: NextFunction;
  /** Expected response from next (for pass-through testing) */
  nextResponse?: Response;
}

/**
 * Result of testing middleware.
 */
export interface MiddlewareTestResult {
  /** The response returned by middleware */
  response: Response;
  /** The test context (for inspection) */
  context: TestContext;
  /** The request used */
  request: Request;
  /** Whether next() was called */
  nextCalled: boolean;
  /** How many times next() was called */
  nextCallCount: number;
  /** Execution time in milliseconds */
  duration: number;
}

/**
 * Test a middleware function directly.
 *
 * @example
 * import { testMiddleware } from '@oreo/testing';
 * import { authMiddleware } from './middleware/auth';
 *
 * test('blocks unauthenticated requests', async () => {
 *   const result = await testMiddleware(authMiddleware, {
 *     request: { url: '/admin' },
 *   });
 *
 *   expect(result.response.status).toBe(401);
 *   expect(result.nextCalled).toBe(false);
 * });
 *
 * test('allows authenticated requests', async () => {
 *   const result = await testMiddleware(authMiddleware, {
 *     request: {
 *       url: '/admin',
 *       headers: { Authorization: 'Bearer valid-token' },
 *     },
 *   });
 *
 *   expect(result.nextCalled).toBe(true);
 *   expect(result.response.status).toBe(200);
 * });
 */
export async function testMiddleware(
  middleware: MiddlewareHandler,
  options: MiddlewareTestOptions = {}
): Promise<MiddlewareTestResult> {
  const request = createMockRequest(options.request);
  const context = createTestContext(options.context);

  let nextCalled = false;
  let nextCallCount = 0;

  const next: NextFunction = options.next || (async () => {
    nextCalled = true;
    nextCallCount++;
    return options.nextResponse || new Response('OK', { status: 200 });
  });

  // Wrap next to track calls
  const wrappedNext: NextFunction = async () => {
    nextCalled = true;
    nextCallCount++;
    return next();
  };

  const startTime = performance.now();
  const response = await middleware(request, context, wrappedNext);
  const duration = performance.now() - startTime;

  return {
    response,
    context,
    request,
    nextCalled,
    nextCallCount,
    duration,
  };
}

/**
 * Create a reusable middleware tester with preset options.
 *
 * @example
 * const testAuth = createMiddlewareTester(authMiddleware, {
 *   context: { env: { AUTH_SECRET: 'test-secret' } },
 * });
 *
 * test('allows valid tokens', async () => {
 *   const result = await testAuth({
 *     request: { headers: { Authorization: 'Bearer valid' } },
 *   });
 *   expect(result.nextCalled).toBe(true);
 * });
 */
export function createMiddlewareTester(
  middleware: MiddlewareHandler,
  baseOptions: MiddlewareTestOptions = {}
) {
  return async (overrides: Partial<MiddlewareTestOptions> = {}): Promise<MiddlewareTestResult> => {
    return testMiddleware(middleware, {
      ...baseOptions,
      ...overrides,
      request: { ...baseOptions.request, ...overrides.request },
      context: {
        ...baseOptions.context,
        ...overrides.context,
        store: { ...baseOptions.context?.store, ...overrides.context?.store },
        env: { ...baseOptions.context?.env, ...overrides.context?.env },
      },
    });
  };
}

/**
 * Test a chain of middleware functions.
 *
 * @example
 * const result = await testMiddlewareChain([
 *   loggingMiddleware,
 *   authMiddleware,
 *   rateLimitMiddleware,
 * ], {
 *   request: { url: '/api/data' },
 * });
 *
 * expect(result.response.status).toBe(200);
 * expect(result.middlewareResults[0].nextCalled).toBe(true);
 */
export async function testMiddlewareChain(
  middlewares: MiddlewareHandler[],
  options: MiddlewareTestOptions = {}
): Promise<{
  response: Response;
  context: TestContext;
  request: Request;
  middlewareResults: Array<{
    index: number;
    nextCalled: boolean;
    duration: number;
  }>;
}> {
  const request = createMockRequest(options.request);
  const context = createTestContext(options.context);

  const middlewareResults: Array<{
    index: number;
    nextCalled: boolean;
    duration: number;
  }> = [];

  // Build the chain
  let index = 0;

  const buildNext = (currentIndex: number): NextFunction => {
    return async () => {
      middlewareResults[currentIndex].nextCalled = true;

      if (currentIndex + 1 >= middlewares.length) {
        return options.nextResponse || new Response('OK', { status: 200 });
      }

      const startTime = performance.now();
      middlewareResults.push({
        index: currentIndex + 1,
        nextCalled: false,
        duration: 0,
      });

      const response = await middlewares[currentIndex + 1](
        request,
        context,
        buildNext(currentIndex + 1)
      );

      middlewareResults[currentIndex + 1].duration = performance.now() - startTime;
      return response;
    };
  };

  middlewareResults.push({ index: 0, nextCalled: false, duration: 0 });

  const startTime = performance.now();
  const response = await middlewares[0](request, context, buildNext(0));
  middlewareResults[0].duration = performance.now() - startTime;

  return {
    response,
    context,
    request,
    middlewareResults,
  };
}

/**
 * Test middleware with multiple request scenarios.
 *
 * @example
 * const results = await testMiddlewareMatrix(authMiddleware, {
 *   requests: [
 *     { url: '/public' },
 *     { url: '/admin', headers: { Authorization: 'Bearer valid' } },
 *     { url: '/admin' }, // No auth
 *   ],
 * });
 *
 * expect(results[0].response.status).toBe(200);
 * expect(results[1].response.status).toBe(200);
 * expect(results[2].response.status).toBe(401);
 */
export async function testMiddlewareMatrix(
  middleware: MiddlewareHandler,
  options: {
    requests: MockRequestOptions[];
    context?: TestContextOptions;
  }
): Promise<MiddlewareTestResult[]> {
  return Promise.all(
    options.requests.map((request) =>
      testMiddleware(middleware, {
        request,
        context: options.context,
      })
    )
  );
}

/**
 * Test middleware error handling.
 *
 * @example
 * test('handles errors gracefully', async () => {
 *   const result = await testMiddlewareError(errorMiddleware, {
 *     next: async () => {
 *       throw new Error('Downstream error');
 *     },
 *   });
 *
 *   expect(result.response.status).toBe(500);
 *   expect(result.error).toBeNull(); // Middleware caught the error
 * });
 */
export async function testMiddlewareError(
  middleware: MiddlewareHandler,
  options: MiddlewareTestOptions & {
    next: NextFunction;
  }
): Promise<{
  response: Response | null;
  error: Error | null;
  context: TestContext;
}> {
  const request = createMockRequest(options.request);
  const context = createTestContext(options.context);

  try {
    const response = await middleware(request, context, options.next);
    return { response, error: null, context };
  } catch (error) {
    return {
      response: null,
      error: error instanceof Error ? error : new Error(String(error)),
      context,
    };
  }
}

/**
 * Test that middleware modifies context correctly.
 *
 * @example
 * test('sets user in context', async () => {
 *   const result = await testMiddlewareContext(authMiddleware, {
 *     request: { headers: { Authorization: 'Bearer valid' } },
 *     expectContextValues: {
 *       user: { id: expect.any(String), role: 'user' },
 *     },
 *   });
 *
 *   expect(result.contextMatches).toBe(true);
 * });
 */
export async function testMiddlewareContext(
  middleware: MiddlewareHandler,
  options: MiddlewareTestOptions & {
    expectContextValues: Record<string, unknown>;
  }
): Promise<{
  response: Response;
  context: TestContext;
  contextMatches: boolean;
  contextDiff: Record<string, { expected: unknown; actual: unknown }>;
}> {
  const result = await testMiddleware(middleware, options);

  const contextDiff: Record<string, { expected: unknown; actual: unknown }> = {};
  let contextMatches = true;

  for (const [key, expected] of Object.entries(options.expectContextValues)) {
    const actual = result.context.get(key);

    // Deep equality check
    const matches = JSON.stringify(actual) === JSON.stringify(expected);
    if (!matches) {
      contextMatches = false;
      contextDiff[key] = { expected, actual };
    }
  }

  return {
    response: result.response,
    context: result.context,
    contextMatches,
    contextDiff,
  };
}
