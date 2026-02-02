/**
 * @areo/core - Request Context
 *
 * Web Standards-based request context that travels through the request lifecycle.
 * Provides cache control, key-value storage, and response header management.
 */
import type { AppContext, CacheControl } from './types';
/**
 * Create a new request context for handling a request.
 * Each request gets its own isolated context.
 */
export declare function createContext(request: Request): RequestContext;
/**
 * Request-scoped context that provides:
 * - Cache control configuration
 * - Key-value storage for passing data between middleware/loaders
 * - Response headers management
 */
export declare class RequestContext implements AppContext {
    readonly url: URL;
    readonly env: Record<string, string | undefined>;
    readonly responseHeaders: Headers;
    private store;
    private cacheOptions;
    private cacheTags;
    constructor(request: Request);
    /**
     * Cache control for the current request.
     * Allows setting explicit caching with tags for invalidation.
     */
    readonly cache: CacheControl;
    /**
     * Get a value from the context store.
     * Useful for sharing data between middleware and loaders.
     */
    get<T>(key: string): T | undefined;
    /**
     * Set a value in the context store.
     * Values are scoped to the current request only.
     */
    set<T>(key: string, value: T): void;
    /**
     * Check if a key exists in the context store.
     */
    has(key: string): boolean;
    /**
     * Delete a key from the context store.
     */
    delete(key: string): boolean;
    /**
     * Build Cache-Control header value from options.
     */
    buildCacheControlHeader(): string | null;
    /**
     * Apply cache control and other context headers to a response.
     */
    applyToResponse(response: Response): Response;
}
/**
 * Type guard to check if a value is a RequestContext.
 */
export declare function isRequestContext(value: unknown): value is RequestContext;
export declare function attachContext(request: Request, context: RequestContext): void;
export declare function getContext(request: Request): RequestContext | undefined;
//# sourceMappingURL=context.d.ts.map