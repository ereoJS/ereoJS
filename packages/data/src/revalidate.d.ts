/**
 * @areo/data - Cache Revalidation
 *
 * Explicit cache invalidation by tags.
 * No hidden magic - you control exactly when caches are cleared.
 */
/**
 * Revalidation options.
 */
export interface RevalidateOptions {
    /** Tags to revalidate */
    tags?: string[];
    /** Specific paths to revalidate */
    paths?: string[];
    /** Revalidate everything */
    all?: boolean;
}
/**
 * Revalidation result.
 */
export interface RevalidateResult {
    success: boolean;
    revalidated: {
        tags: string[];
        paths: string[];
    };
    timestamp: number;
}
/**
 * Revalidate cache entries by tags.
 */
export declare function revalidateTag(...tags: string[]): Promise<RevalidateResult>;
/**
 * Revalidate cache entries by path.
 */
export declare function revalidatePath(...paths: string[]): Promise<RevalidateResult>;
/**
 * Revalidate with options.
 */
export declare function revalidate(options: RevalidateOptions): Promise<RevalidateResult>;
/**
 * Unstable cache function - wrap async function with caching.
 * Similar to Next.js unstable_cache but with explicit tags.
 */
export declare function unstable_cache<T extends (...args: any[]) => Promise<any>>(fn: T, keyParts: string[], options?: {
    tags?: string[];
    revalidate?: number;
}): T;
/**
 * Create a revalidation handler for API routes.
 * Returns a handler that can be used to trigger revalidation.
 */
export declare function createRevalidationHandler(secret?: string): (request: Request) => Promise<Response>;
/**
 * Helper to create tag names.
 */
export declare const tags: {
    /** Create a resource tag (e.g., 'post:123') */
    resource: (type: string, id: string | number) => string;
    /** Create a collection tag (e.g., 'posts') */
    collection: (type: string) => string;
    /** Create a user-scoped tag (e.g., 'user:123:posts') */
    userScoped: (userId: string | number, type: string) => string;
};
/**
 * On-demand ISR-style revalidation.
 * Use this in actions after mutations.
 */
export declare function onDemandRevalidate(...tagsOrPaths: string[]): Promise<RevalidateResult>;
//# sourceMappingURL=revalidate.d.ts.map