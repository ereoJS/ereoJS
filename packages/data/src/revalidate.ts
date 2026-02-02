/**
 * @areo/data - Cache Revalidation
 *
 * Explicit cache invalidation by tags.
 * No hidden magic - you control exactly when caches are cleared.
 */

import { getCache } from './cache';

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
export async function revalidateTag(...tags: string[]): Promise<RevalidateResult> {
  const cache = getCache();
  const revalidatedTags: string[] = [];

  for (const tag of tags) {
    await cache.deleteByTag(tag);
    revalidatedTags.push(tag);
  }

  return {
    success: true,
    revalidated: {
      tags: revalidatedTags,
      paths: [],
    },
    timestamp: Date.now(),
  };
}

/**
 * Revalidate cache entries by path.
 */
export async function revalidatePath(...paths: string[]): Promise<RevalidateResult> {
  const cache = getCache();
  const revalidatedPaths: string[] = [];

  const allKeys = await cache.keys();

  for (const path of paths) {
    for (const key of allKeys) {
      // Match path in cache key (format: METHOD:path)
      if (key.includes(`:${path}`) || key.endsWith(path)) {
        await cache.delete(key);
        revalidatedPaths.push(path);
      }
    }
  }

  return {
    success: true,
    revalidated: {
      tags: [],
      paths: [...new Set(revalidatedPaths)],
    },
    timestamp: Date.now(),
  };
}

/**
 * Revalidate with options.
 */
export async function revalidate(options: RevalidateOptions): Promise<RevalidateResult> {
  const cache = getCache();

  if (options.all) {
    await cache.clear();
    return {
      success: true,
      revalidated: { tags: ['*'], paths: ['*'] },
      timestamp: Date.now(),
    };
  }

  const tagResult = options.tags ? await revalidateTag(...options.tags) : null;
  const pathResult = options.paths ? await revalidatePath(...options.paths) : null;

  return {
    success: true,
    revalidated: {
      tags: tagResult?.revalidated.tags ?? [],
      paths: pathResult?.revalidated.paths ?? [],
    },
    timestamp: Date.now(),
  };
}

/**
 * Unstable cache function - wrap async function with caching.
 * Similar to Next.js unstable_cache but with explicit tags.
 */
export function unstable_cache<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  keyParts: string[],
  options: { tags?: string[]; revalidate?: number } = {}
): T {
  return (async (...args: Parameters<T>): Promise<Awaited<ReturnType<T>>> => {
    const { cached, cacheKey } = await import('./cache');

    const key = cacheKey(keyParts.join(':'), JSON.stringify(args));

    return cached(key, () => fn(...args), {
      maxAge: options.revalidate ?? 3600,
      tags: options.tags ?? [],
    });
  }) as T;
}

/**
 * Create a revalidation handler for API routes.
 * Returns a handler that can be used to trigger revalidation.
 */
export function createRevalidationHandler(secret?: string) {
  return async (request: Request): Promise<Response> => {
    // Verify secret if provided
    if (secret) {
      const authHeader = request.headers.get('Authorization');
      if (authHeader !== `Bearer ${secret}`) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }

    try {
      const body = await request.json() as RevalidateOptions;
      const result = await revalidate(body);

      return new Response(JSON.stringify(result), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (error) {
      return new Response(
        JSON.stringify({
          error: error instanceof Error ? error.message : 'Unknown error',
        }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }
  };
}

/**
 * Helper to create tag names.
 */
export const tags = {
  /** Create a resource tag (e.g., 'post:123') */
  resource: (type: string, id: string | number) => `${type}:${id}`,
  /** Create a collection tag (e.g., 'posts') */
  collection: (type: string) => type,
  /** Create a user-scoped tag (e.g., 'user:123:posts') */
  userScoped: (userId: string | number, type: string) => `user:${userId}:${type}`,
};

/**
 * On-demand ISR-style revalidation.
 * Use this in actions after mutations.
 */
export async function onDemandRevalidate(
  ...tagsOrPaths: string[]
): Promise<RevalidateResult> {
  const tags: string[] = [];
  const paths: string[] = [];

  for (const item of tagsOrPaths) {
    if (item.startsWith('/')) {
      paths.push(item);
    } else {
      tags.push(item);
    }
  }

  return revalidate({ tags, paths });
}
