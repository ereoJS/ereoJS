/**
 * @areo/server - Static File Serving
 *
 * Efficient static file serving with caching support.
 */
/**
 * Get MIME type for a file extension.
 */
export declare function getMimeType(filepath: string): string;
/**
 * Static file serving options.
 */
export interface StaticOptions {
    /** Root directory for static files */
    root: string;
    /** URL prefix (default: '/') */
    prefix?: string;
    /** Max age for cache-control (seconds, default: 0 in dev, 31536000 in prod) */
    maxAge?: number;
    /** Enable immutable caching for fingerprinted files */
    immutable?: boolean;
    /** Index file (default: 'index.html') */
    index?: string;
    /** Enable directory listing (default: false) */
    listing?: boolean;
    /** Fallback file for SPA routing */
    fallback?: string;
}
/**
 * Create a static file handler.
 */
export declare function serveStatic(options: StaticOptions): (request: Request) => Promise<Response | null>;
/**
 * Middleware version of static file serving.
 */
export declare function staticMiddleware(options: StaticOptions): (request: Request, context: any, next: () => Promise<Response>) => Promise<Response>;
//# sourceMappingURL=static.d.ts.map