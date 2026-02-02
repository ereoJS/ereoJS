/**
 * @oreo/testing - Loader Testing
 *
 * Utilities for testing route loaders.
 */

import type { LoaderFunction, RouteParams } from '@oreo/core';
import { createTestContext, type TestContextOptions, type TestContext } from './context';
import { createMockRequest, type MockRequestOptions } from './request';

/**
 * Options for testing a loader.
 */
export interface LoaderTestOptions<P = RouteParams> {
  /** Route parameters */
  params?: P;
  /** Request options */
  request?: MockRequestOptions;
  /** Context options */
  context?: TestContextOptions;
}

/**
 * Result of testing a loader.
 */
export interface LoaderTestResult<T = unknown> {
  /** The loader's return value */
  data: T;
  /** The test context (for inspection) */
  context: TestContext;
  /** The request used */
  request: Request;
  /** Execution time in milliseconds */
  duration: number;
}

/**
 * Test a loader function directly.
 *
 * @example
 * import { testLoader } from '@oreo/testing';
 * import { loader } from './routes/blog/[slug]';
 *
 * test('loads blog post', async () => {
 *   const result = await testLoader(loader, {
 *     params: { slug: 'my-post' },
 *   });
 *
 *   expect(result.data.title).toBe('My Post');
 *   expect(result.context.getCacheOperations()).toHaveLength(1);
 * });
 */
export async function testLoader<T = unknown, P = RouteParams>(
  loader: LoaderFunction<T, P>,
  options: LoaderTestOptions<P> = {}
): Promise<LoaderTestResult<T>> {
  const request = createMockRequest(options.request);
  const context = createTestContext(options.context);
  const params = (options.params || {}) as P;

  const startTime = performance.now();
  const data = await loader({ request, params, context });
  const duration = performance.now() - startTime;

  return {
    data,
    context,
    request,
    duration,
  };
}

/**
 * Create a reusable loader tester with preset options.
 *
 * @example
 * const testPostLoader = createLoaderTester(loader, {
 *   context: { store: { user: testUser } },
 * });
 *
 * test('loads post with user context', async () => {
 *   const result = await testPostLoader({ params: { slug: 'test' } });
 *   expect(result.data).toBeDefined();
 * });
 */
export function createLoaderTester<T = unknown, P = RouteParams>(
  loader: LoaderFunction<T, P>,
  baseOptions: LoaderTestOptions<P> = {}
) {
  return async (overrides: Partial<LoaderTestOptions<P>> = {}): Promise<LoaderTestResult<T>> => {
    return testLoader(loader, {
      ...baseOptions,
      ...overrides,
      params: { ...baseOptions.params, ...overrides.params } as P,
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
 * Test multiple loaders in parallel (for testing combined loaders).
 *
 * @example
 * const results = await testLoadersParallel([
 *   { loader: userLoader, params: { id: '1' } },
 *   { loader: postsLoader, params: {} },
 * ]);
 */
export async function testLoadersParallel<T extends unknown[] = unknown[]>(
  loaders: Array<{
    loader: LoaderFunction<T[number]>;
    params?: RouteParams;
    request?: MockRequestOptions;
    context?: TestContextOptions;
  }>
): Promise<LoaderTestResult<T[number]>[]> {
  return Promise.all(
    loaders.map(({ loader, params, request, context }) =>
      testLoader(loader, { params, request, context })
    )
  );
}

/**
 * Test loader with multiple param combinations.
 *
 * @example
 * const results = await testLoaderMatrix(loader, {
 *   params: [
 *     { slug: 'post-1' },
 *     { slug: 'post-2' },
 *     { slug: 'non-existent' },
 *   ],
 * });
 *
 * expect(results[0].data).toBeDefined();
 * expect(results[2].data).toBeNull();
 */
export async function testLoaderMatrix<T = unknown, P = RouteParams>(
  loader: LoaderFunction<T, P>,
  options: {
    params: P[];
    request?: MockRequestOptions;
    context?: TestContextOptions;
  }
): Promise<LoaderTestResult<T>[]> {
  return Promise.all(
    options.params.map((params) =>
      testLoader(loader, {
        params,
        request: options.request,
        context: options.context,
      })
    )
  );
}

/**
 * Test loader error handling.
 *
 * @example
 * test('handles missing post', async () => {
 *   const result = await testLoaderError(loader, {
 *     params: { slug: 'non-existent' },
 *   });
 *
 *   expect(result.error).toBeInstanceOf(NotFoundError);
 * });
 */
export async function testLoaderError<P = RouteParams>(
  loader: LoaderFunction<unknown, P>,
  options: LoaderTestOptions<P> = {}
): Promise<{
  error: Error | null;
  context: TestContext;
  request: Request;
}> {
  const request = createMockRequest(options.request);
  const context = createTestContext(options.context);
  const params = (options.params || {}) as P;

  try {
    await loader({ request, params, context });
    return { error: null, context, request };
  } catch (error) {
    return {
      error: error instanceof Error ? error : new Error(String(error)),
      context,
      request,
    };
  }
}
