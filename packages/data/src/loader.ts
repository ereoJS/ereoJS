/**
 * @areo/data - Unified Data Loading
 *
 * A single, simple pattern for server-side data fetching.
 * No confusion about which loading method to use.
 */

import type {
  LoaderArgs,
  LoaderFunction,
  AppContext,
  RouteParams,
  CacheOptions,
} from '@areo/core';

/**
 * Options for creating a loader.
 */
export interface LoaderOptions<T, P extends RouteParams = RouteParams> {
  /** The data fetching function */
  load: (args: LoaderArgs<P>) => T | Promise<T>;
  /** Default cache options */
  cache?: CacheOptions;
  /** Transform the loaded data before returning */
  transform?: (data: Awaited<T>, args: LoaderArgs<P>) => Awaited<T> | Promise<Awaited<T>>;
  /** Handle errors */
  onError?: (error: Error, args: LoaderArgs<P>) => T | Response | Promise<T | Response>;
}

/**
 * Create a type-safe loader function.
 *
 * @example
 * export const loader = createLoader({
 *   load: async ({ params }) => {
 *     return db.post.findUnique({ where: { slug: params.slug } });
 *   },
 *   cache: { maxAge: 60, tags: ['posts'] },
 * });
 */
export function createLoader<T, P extends RouteParams = RouteParams>(
  options: LoaderOptions<T, P>
): LoaderFunction<T, P> {
  return async (args: LoaderArgs<P>): Promise<T> => {
    const { context } = args;

    // Apply default cache options
    if (options.cache) {
      context.cache.set(options.cache);
    }

    try {
      // Load data
      let data = await options.load(args);

      // Transform if needed
      if (options.transform) {
        data = await options.transform(data as Awaited<T>, args) as T;
      }

      return data;
    } catch (error) {
      if (options.onError && error instanceof Error) {
        const result = await options.onError(error, args);
        if (result instanceof Response) {
          throw result;
        }
        return result;
      }
      throw error;
    }
  };
}

/**
 * Defer data loading until render time.
 * Useful for non-critical data that shouldn't block the page.
 */
export interface DeferredData<T> {
  promise: Promise<T>;
  status: 'pending' | 'resolved' | 'rejected';
  value?: T;
  error?: Error;
}

/**
 * Create deferred data that resolves during streaming.
 */
export function defer<T>(promise: Promise<T>): DeferredData<T> {
  const deferred: DeferredData<T> = {
    promise,
    status: 'pending',
  };

  promise
    .then((value) => {
      deferred.status = 'resolved';
      deferred.value = value;
    })
    .catch((error) => {
      deferred.status = 'rejected';
      deferred.error = error;
    });

  return deferred;
}

/**
 * Check if a value is deferred data.
 */
export function isDeferred<T>(value: unknown): value is DeferredData<T> {
  return (
    typeof value === 'object' &&
    value !== null &&
    'promise' in value &&
    'status' in value
  );
}

/**
 * Wait for deferred data to resolve.
 */
export async function resolveDeferred<T>(deferred: DeferredData<T>): Promise<T> {
  return deferred.promise;
}

/**
 * Helper to extract data from a fetch response.
 */
export async function fetchData<T>(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<T> {
  const response = await fetch(input, init);

  if (!response.ok) {
    throw new FetchError(
      `Fetch failed: ${response.status} ${response.statusText}`,
      response
    );
  }

  const contentType = response.headers.get('Content-Type');

  if (contentType?.includes('application/json')) {
    return response.json();
  }

  return response.text() as unknown as T;
}

/**
 * Error thrown when fetch fails.
 */
export class FetchError extends Error {
  constructor(
    message: string,
    public response: Response
  ) {
    super(message);
    this.name = 'FetchError';
  }

  get status(): number {
    return this.response.status;
  }

  get statusText(): string {
    return this.response.statusText;
  }
}

/**
 * Helper to safely serialize loader data.
 * Prevents XSS by escaping dangerous characters.
 */
export function serializeLoaderData(data: unknown): string {
  const json = JSON.stringify(data);
  // Escape characters that could break out of script tags
  return json
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/'/g, '\\u0027');
}

/**
 * Parse serialized loader data.
 */
export function parseLoaderData<T>(serialized: string): T {
  return JSON.parse(serialized);
}

/**
 * Combine multiple loaders into one.
 * Runs all loaders in parallel.
 */
export function combineLoaders<T extends Record<string, LoaderFunction<unknown>>>(
  loaders: T
): LoaderFunction<{ [K in keyof T]: Awaited<ReturnType<T[K]>> }> {
  return async (args) => {
    const entries = Object.entries(loaders);
    const results = await Promise.all(
      entries.map(async ([key, loader]) => [key, await loader(args)])
    );

    return Object.fromEntries(results) as { [K in keyof T]: Awaited<ReturnType<T[K]>> };
  };
}

/**
 * Create a loader that runs on the client side.
 * This is useful for client-only data like user preferences.
 */
export function clientLoader<T, P extends RouteParams = RouteParams>(
  load: (params: P) => T | Promise<T>
): LoaderFunction<T, P> {
  return async ({ params }) => {
    return load(params);
  };
}
