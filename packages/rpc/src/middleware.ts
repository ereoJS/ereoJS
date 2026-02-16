/**
 * Common middleware helpers
 *
 * Pre-built middleware for common use cases like auth, rate limiting, and logging.
 */

import type { BaseContext, MiddlewareFn, MiddlewareResult } from './types';

// =============================================================================
// Rate Limiting - Shared Store (Module-level singleton)
// =============================================================================

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

class RateLimitStore {
  private stores = new Map<string, Map<string, RateLimitEntry>>();
  private cleanupInterval: ReturnType<typeof setInterval> | null = null;
  private readonly CLEANUP_INTERVAL_MS: number;

  constructor(cleanupIntervalMs = 60000) {
    this.CLEANUP_INTERVAL_MS = cleanupIntervalMs;
  }

  getStore(windowMs: number): Map<string, RateLimitEntry> {
    const key = String(windowMs);
    let store = this.stores.get(key);
    if (!store) {
      store = new Map<string, RateLimitEntry>();
      this.stores.set(key, store);
      this.scheduleCleanup();
    }
    return store;
  }

  private scheduleCleanup() {
    if (this.cleanupInterval) return;

    this.cleanupInterval = setInterval(
      () => this.runCleanupCycle(),
      this.CLEANUP_INTERVAL_MS
    );
  }

  /** Run one cleanup cycle — removes expired entries and empty stores */
  runCleanupCycle() {
    const now = Date.now();
    const emptyStoreKeys: string[] = [];
    for (const [windowMsStr, store] of this.stores) {
      const expired: string[] = [];
      for (const [key, entry] of store) {
        if (entry.resetAt < now) {
          expired.push(key);
        }
      }
      for (const key of expired) {
        store.delete(key);
      }
      // Clean up empty stores
      if (store.size === 0) {
        emptyStoreKeys.push(windowMsStr);
      }
    }
    for (const key of emptyStoreKeys) {
      this.stores.delete(key);
    }

    // Stop cleanup if no stores remain
    if (this.stores.size === 0 && this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  // For testing purposes
  clear() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.stores.clear();
  }
}

// Module-level singleton
const globalRateLimitStore = new RateLimitStore();

// =============================================================================
// Logging Middleware
// =============================================================================

export interface LoggingOptions {
  /** Log function (default: console.log) */
  log?: (...args: unknown[]) => void;
  /** Include timing information */
  timing?: boolean;
}

/**
 * Logs RPC calls with optional timing
 */
export function logging(options: LoggingOptions = {}): MiddlewareFn<BaseContext, BaseContext> {
  const { log = console.log, timing = true } = options;

  return async ({ ctx, next }) => {
    const start = timing ? performance.now() : 0;

    const result = await next(ctx);

    if (timing) {
      const duration = (performance.now() - start).toFixed(2);
      log(`[RPC] ${duration}ms`);
    } else {
      log('[RPC] Request completed');
    }

    return result;
  };
}

// =============================================================================
// Rate Limiting Middleware
// =============================================================================

export interface RateLimitOptions {
  /** Max requests per window */
  limit: number;
  /** Window size in milliseconds */
  windowMs: number;
  /** Key function to identify clients (default: IP address) */
  keyFn?: (ctx: BaseContext) => string;
  /** Error message */
  message?: string;
}

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

/**
 * Simple in-memory rate limiting
 *
 * For production, consider using Redis or similar.
 */
export function rateLimit(options: RateLimitOptions): MiddlewareFn<BaseContext, BaseContext> {
  const {
    limit,
    windowMs,
    keyFn = (ctx) => ctx.request.headers.get('x-forwarded-for') ?? 'unknown',
    message = 'Too many requests',
  } = options;

  // Use the shared store based on windowMs
  const store = globalRateLimitStore.getStore(windowMs);

  const MAX_ENTRIES = 10_000;

  return async ({ ctx, next }) => {
    const key = keyFn(ctx);
    const now = Date.now();

    let entry = store.get(key);
    if (!entry || entry.resetAt < now) {
      // Prevent unbounded growth from spoofed headers
      if (store.size >= MAX_ENTRIES) {
        const expired: string[] = [];
        for (const [k, v] of store) {
          if (v.resetAt < now) expired.push(k);
        }
        for (const k of expired) store.delete(k);

        // If still at capacity after cleanup, fail open (allow request without tracking)
        // to prevent legitimate traffic from being blocked by store exhaustion
        if (store.size >= MAX_ENTRIES) {
          return next(ctx);
        }
      }
      entry = { count: 0, resetAt: now + windowMs };
      store.set(key, entry);
    }

    entry.count++;

    if (entry.count > limit) {
      return {
        ok: false,
        error: { code: 'RATE_LIMITED', message },
      };
    }

    return next(ctx);
  };
}

/**
 * Clear the global rate limit store. Useful for testing.
 */
export function clearRateLimitStore(): void {
  globalRateLimitStore.clear();
}

/**
 * Trigger one cleanup cycle on the global rate limit store. Useful for testing.
 */
export function _triggerCleanup(): void {
  globalRateLimitStore.runCleanupCycle();
}

/** @internal Exported for testing the interval-based cleanup path */
export { RateLimitStore as _RateLimitStore };

// =============================================================================
// Auth Middleware Helpers
// =============================================================================

/**
 * Create an auth middleware that extracts user from context
 *
 * Usage:
 *   const authMiddleware = createAuthMiddleware(async (ctx) => {
 *     const token = ctx.request.headers.get('Authorization');
 *     return verifyToken(token); // Returns user or null
 *   });
 */
export function createAuthMiddleware<TUser>(
  getUser: (ctx: BaseContext) => TUser | null | Promise<TUser | null>,
  options: { message?: string } = {}
): MiddlewareFn<BaseContext, BaseContext & { user: TUser }> {
  const { message = 'Unauthorized' } = options;

  return async ({ ctx, next }) => {
    const user = await getUser(ctx);

    if (!user) {
      return {
        ok: false,
        error: { code: 'UNAUTHORIZED', message },
      };
    }

    return next({ ...ctx, user });
  };
}

/**
 * Require specific roles
 *
 * Usage:
 *   const adminOnly = requireRoles(['admin']);
 *   const adminProcedure = protectedProcedure.use(adminOnly);
 */
export function requireRoles<TContext extends BaseContext & { user: { role?: string } }>(
  roles: string[],
  options: { message?: string } = {}
): MiddlewareFn<TContext, TContext> {
  const { message = 'Insufficient permissions' } = options;

  return async ({ ctx, next }) => {
    const userRole = ctx.user?.role;

    if (!userRole || !roles.includes(userRole)) {
      return {
        ok: false,
        error: { code: 'FORBIDDEN', message },
      };
    }

    return next(ctx);
  };
}

// =============================================================================
// Validation Middleware
// =============================================================================

/**
 * Add custom validation to a procedure
 *
 * Usage:
 *   const validatedProcedure = procedure.use(
 *     validate(async (ctx) => {
 *       if (ctx.ctx.maintenanceMode) {
 *         return { ok: false, error: { code: 'MAINTENANCE', message: 'System is under maintenance' } };
 *       }
 *       return { ok: true };
 *     })
 *   );
 */
export function validate<TContext extends BaseContext>(
  validator: (ctx: TContext) => Promise<{ ok: true } | { ok: false; error: { code: string; message: string } }>
): MiddlewareFn<TContext, TContext> {
  return async ({ ctx, next }) => {
    const result = await validator(ctx);
    if (!result.ok) {
      return { ok: false, error: result.error };
    }
    return next(ctx);
  };
}

// =============================================================================
// Context Extension Middleware
// =============================================================================

/**
 * Extend context with additional data
 *
 * Usage:
 *   const withDb = extend(async (ctx) => ({
 *     db: createDbConnection(),
 *   }));
 *
 *   const dbProcedure = procedure.use(withDb);
 */
export function extend<TContext extends BaseContext, TExtension extends object>(
  extender: (ctx: TContext) => TExtension | Promise<TExtension>
): MiddlewareFn<TContext, TContext & TExtension> {
  return async ({ ctx, next }) => {
    const extension = await extender(ctx);
    return next({ ...ctx, ...extension });
  };
}

// =============================================================================
// Timing / Metrics Middleware
// =============================================================================

export interface TimingContext {
  timing: {
    start: number;
    getDuration: () => number;
  };
}

/**
 * Add timing information to context
 */
export function timing<TContext extends BaseContext>(): MiddlewareFn<TContext, TContext & TimingContext> {
  return async ({ ctx, next }) => {
    const start = performance.now();
    return next({
      ...ctx,
      timing: {
        start,
        getDuration: () => performance.now() - start,
      },
    });
  };
}

// =============================================================================
// Error Handling Middleware
// =============================================================================

/**
 * Catch and transform errors
 *
 * Usage:
 *   const withErrorHandling = catchErrors((error) => {
 *     if (error instanceof DatabaseError) {
 *       return { code: 'DATABASE_ERROR', message: 'Database operation failed' };
 *     }
 *     throw error; // Re-throw unknown errors
 *   });
 */
export function catchErrors<TContext extends BaseContext>(
  handler: (error: unknown) => { code: string; message: string } | never
): MiddlewareFn<TContext, TContext> {
  return async ({ ctx, next }) => {
    try {
      return await next(ctx);
    } catch (error) {
      const errorResult = handler(error);
      return { ok: false, error: errorResult };
    }
  };
}
