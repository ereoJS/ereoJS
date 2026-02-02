/**
 * @oreo/testing - Test Context
 *
 * Create mock contexts for testing loaders, actions, and middleware.
 */

import type { AppContext, CacheControl, CacheOptions } from '@oreo/core';

/**
 * Options for creating a test context.
 */
export interface TestContextOptions {
  /** Initial context store values */
  store?: Record<string, unknown>;
  /** Initial environment variables */
  env?: Record<string, string>;
  /** Request URL */
  url?: string | URL;
  /** Initial cache tags */
  cacheTags?: string[];
  /** Initial response headers */
  responseHeaders?: Record<string, string>;
}

/**
 * Extended test context with inspection utilities.
 */
export interface TestContext extends AppContext {
  /** Get all values set in the context store */
  getStore(): Record<string, unknown>;
  /** Get all cache operations performed */
  getCacheOperations(): CacheOperation[];
  /** Reset the context to initial state */
  reset(): void;
}

/**
 * Cache operation record for inspection.
 */
export interface CacheOperation {
  type: 'set' | 'get';
  options?: CacheOptions;
  timestamp: number;
}

/**
 * Create a test context for testing loaders, actions, and middleware.
 *
 * @example
 * const ctx = createTestContext({
 *   store: { user: { id: 1, name: 'Test' } },
 *   env: { DATABASE_URL: 'test://db' },
 * });
 *
 * const result = await loader({ request, params, context: ctx });
 */
export function createTestContext(options: TestContextOptions = {}): TestContext {
  const store = new Map<string, unknown>(
    Object.entries(options.store || {})
  );
  const env = { ...options.env };
  const responseHeaders = new Headers(options.responseHeaders);
  const url = typeof options.url === 'string'
    ? new URL(options.url)
    : options.url || new URL('http://localhost:3000/');

  let cacheOptions: CacheOptions | undefined;
  const cacheTags = new Set<string>(options.cacheTags || []);
  const cacheOperations: CacheOperation[] = [];

  const cache: CacheControl = {
    set(opts: CacheOptions) {
      cacheOptions = opts;
      if (opts.tags) {
        opts.tags.forEach((tag) => cacheTags.add(tag));
      }
      cacheOperations.push({
        type: 'set',
        options: { ...opts },
        timestamp: Date.now(),
      });
    },
    get() {
      cacheOperations.push({
        type: 'get',
        timestamp: Date.now(),
      });
      return cacheOptions;
    },
    getTags() {
      return Array.from(cacheTags);
    },
  };

  const context: TestContext = {
    cache,
    get<T>(key: string): T | undefined {
      return store.get(key) as T | undefined;
    },
    set<T>(key: string, value: T): void {
      store.set(key, value);
    },
    responseHeaders,
    url,
    env,
    getStore() {
      return Object.fromEntries(store);
    },
    getCacheOperations() {
      return [...cacheOperations];
    },
    reset() {
      store.clear();
      Object.entries(options.store || {}).forEach(([k, v]) => store.set(k, v));
      cacheOptions = undefined;
      cacheTags.clear();
      (options.cacheTags || []).forEach((tag) => cacheTags.add(tag));
      cacheOperations.length = 0;
      responseHeaders.forEach((_, key) => responseHeaders.delete(key));
      Object.entries(options.responseHeaders || {}).forEach(([k, v]) =>
        responseHeaders.set(k, v)
      );
    },
  };

  return context;
}

/**
 * Create a context factory for repeated test setup.
 *
 * @example
 * const contextFactory = createContextFactory({
 *   store: { user: testUser },
 * });
 *
 * test('loader test 1', async () => {
 *   const ctx = contextFactory();
 *   // ...
 * });
 *
 * test('loader test 2', async () => {
 *   const ctx = contextFactory({ store: { user: differentUser } });
 *   // ...
 * });
 */
export function createContextFactory(
  baseOptions: TestContextOptions = {}
): (overrides?: Partial<TestContextOptions>) => TestContext {
  return (overrides = {}) =>
    createTestContext({
      ...baseOptions,
      ...overrides,
      store: { ...baseOptions.store, ...overrides.store },
      env: { ...baseOptions.env, ...overrides.env },
      responseHeaders: {
        ...baseOptions.responseHeaders,
        ...overrides.responseHeaders,
      },
      cacheTags: [
        ...(baseOptions.cacheTags || []),
        ...(overrides.cacheTags || []),
      ],
    });
}
