/**
 * @areo/data - Unified Data Loading
 *
 * A single, simple pattern for server-side data fetching.
 * No confusion about which loading method to use.
 */
import type { LoaderArgs, LoaderFunction, RouteParams, CacheOptions } from '@areo/core';
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
export declare function createLoader<T, P extends RouteParams = RouteParams>(options: LoaderOptions<T, P>): LoaderFunction<T, P>;
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
export declare function defer<T>(promise: Promise<T>): DeferredData<T>;
/**
 * Check if a value is deferred data.
 */
export declare function isDeferred<T>(value: unknown): value is DeferredData<T>;
/**
 * Wait for deferred data to resolve.
 */
export declare function resolveDeferred<T>(deferred: DeferredData<T>): Promise<T>;
/**
 * Helper to extract data from a fetch response.
 */
export declare function fetchData<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T>;
/**
 * Error thrown when fetch fails.
 */
export declare class FetchError extends Error {
    response: Response;
    constructor(message: string, response: Response);
    get status(): number;
    get statusText(): string;
}
/**
 * Helper to safely serialize loader data.
 * Prevents XSS by escaping dangerous characters.
 */
export declare function serializeLoaderData(data: unknown): string;
/**
 * Parse serialized loader data.
 */
export declare function parseLoaderData<T>(serialized: string): T;
/**
 * Combine multiple loaders into one.
 * Runs all loaders in parallel.
 */
export declare function combineLoaders<T extends Record<string, LoaderFunction<unknown>>>(loaders: T): LoaderFunction<{
    [K in keyof T]: Awaited<ReturnType<T[K]>>;
}>;
/**
 * Create a loader that runs on the client side.
 * This is useful for client-only data like user preferences.
 */
export declare function clientLoader<T, P extends RouteParams = RouteParams>(load: (params: P) => T | Promise<T>): LoaderFunction<T, P>;
//# sourceMappingURL=loader.d.ts.map