/**
 * @areo/server - Middleware Chain
 *
 * Hono-inspired middleware system for request processing.
 * Uses Web Standards throughout.
 */
import type { MiddlewareHandler } from '@areo/core';
import { RequestContext } from '@areo/core';
/**
 * Middleware definition with optional path matching.
 */
export interface MiddlewareDefinition {
    path?: string | string[];
    handler: MiddlewareHandler;
}
/**
 * Middleware chain executor.
 */
export declare class MiddlewareChain {
    private middlewares;
    /**
     * Add middleware to the chain.
     */
    use(handler: MiddlewareHandler): this;
    use(path: string, handler: MiddlewareHandler): this;
    /**
     * Execute middleware chain.
     */
    execute(request: Request, context: RequestContext, final: () => Promise<Response>): Promise<Response>;
    /**
     * Simple path matching (supports * wildcard).
     */
    private matchPath;
}
/**
 * Create a middleware chain.
 */
export declare function createMiddlewareChain(): MiddlewareChain;
/**
 * Logging middleware.
 */
export declare function logger(): MiddlewareHandler;
/**
 * CORS middleware.
 */
export interface CorsOptions {
    origin?: string | string[] | ((origin: string) => boolean);
    methods?: string[];
    allowedHeaders?: string[];
    exposedHeaders?: string[];
    credentials?: boolean;
    maxAge?: number;
}
export declare function cors(options?: CorsOptions): MiddlewareHandler;
/**
 * Security headers middleware.
 */
export interface SecurityHeadersOptions {
    contentSecurityPolicy?: string | false;
    xFrameOptions?: 'DENY' | 'SAMEORIGIN' | false;
    xContentTypeOptions?: boolean;
    referrerPolicy?: string | false;
    permissionsPolicy?: string | false;
}
export declare function securityHeaders(options?: SecurityHeadersOptions): MiddlewareHandler;
/**
 * Compression middleware (uses Bun's built-in compression).
 */
export declare function compress(): MiddlewareHandler;
/**
 * Rate limiting middleware.
 */
export interface RateLimitOptions {
    windowMs?: number;
    max?: number;
    keyGenerator?: (request: Request) => string;
}
export declare function rateLimit(options?: RateLimitOptions): MiddlewareHandler;
//# sourceMappingURL=middleware.d.ts.map