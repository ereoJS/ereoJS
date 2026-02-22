/**
 * server$ and createServerBlock — Higher-level wrappers around createServerFn
 *
 * Adds declarative config (rate limiting, CORS, auth, caching) that compiles
 * down to ServerFnMiddleware arrays.
 *
 * Usage:
 *   const getMetrics = server$(async (timeRange: string, ctx) => {
 *     return db.metrics.findMany({ where: { range: timeRange } })
 *   }, {
 *     rateLimit: { max: 30, window: '1m' },
 *     cache: { maxAge: 60 },
 *   })
 *
 *   const api = createServerBlock({
 *     rateLimit: { max: 30, window: '1m' },
 *     middleware: [authMiddleware],
 *   }, {
 *     getMetrics: async (timeRange: string, ctx) => { ... },
 *     deleteUser: {
 *       handler: async (userId: string, ctx) => { ... },
 *       rateLimit: { max: 5, window: '1m' },
 *     },
 *   })
 */

import {
  createServerFn,
  ServerFnError,
  type ServerFn,
  type ServerFnContext,
  type ServerFnMiddleware,
} from './server-fn';
import type { Schema } from './types';

// =============================================================================
// Config Types
// =============================================================================

export interface ServerFnRateLimitConfig {
  /** Max requests per window */
  max: number;
  /** Window duration as string: '30s', '1m', '5m', '1h', '1d' */
  window: string;
  /** Custom key function to identify clients (default: IP from x-forwarded-for) */
  keyFn?: (ctx: ServerFnContext) => string;
}

export interface ServerFnCacheConfig {
  /** Cache-Control max-age in seconds */
  maxAge: number;
  /** Whether the cache is public (default: false → private) */
  public?: boolean;
  /** stale-while-revalidate duration in seconds */
  staleWhileRevalidate?: number;
}

export interface ServerFnCorsConfig {
  /** Allowed origins: '*' for wildcard, or an array of specific origins */
  origins: string | string[];
  /** Allow credentials (default: false) */
  credentials?: boolean;
  /** Allowed methods (default: ['GET', 'POST']) */
  methods?: string[];
  /** Allowed headers (default: ['Content-Type', 'Authorization', 'X-Ereo-RPC']) */
  headers?: string[];
  /** Max age for preflight cache in seconds */
  maxAge?: number;
}

export interface ServerFnAuthConfig {
  /** Function to extract user from context. Return null to deny. */
  getUser: (ctx: ServerFnContext) => unknown | null | Promise<unknown | null>;
  /** Custom error message (default: 'Unauthorized') */
  message?: string;
}

export interface ServerFnConfig {
  /** Rate limiting configuration */
  rateLimit?: ServerFnRateLimitConfig;
  /** HTTP method hint (accepted but not yet wired — Phase 2) */
  method?: 'GET' | 'POST';
  /** Cache-Control header configuration */
  cache?: ServerFnCacheConfig;
  /** CORS header configuration */
  cors?: ServerFnCorsConfig;
  /** Authentication configuration */
  auth?: ServerFnAuthConfig;
  /** Additional middleware to run after config-generated middleware */
  middleware?: ServerFnMiddleware[];
  /** Input validation schema */
  input?: Schema<any>;
  /** Skip default middleware (marks function as publicly accessible) */
  allowPublic?: boolean;
  /** Explicit ID override (default: auto-generated) */
  id?: string;
}

// =============================================================================
// parseWindow — duration string → milliseconds
// =============================================================================

const WINDOW_UNITS: Record<string, number> = {
  s: 1_000,
  m: 60_000,
  h: 3_600_000,
  d: 86_400_000,
};

/**
 * Parse a window duration string into milliseconds.
 * Supports: '30s', '1m', '5m', '1h', '1d'
 */
export function parseWindow(str: string): number {
  const match = str.match(/^(\d+)(s|m|h|d)$/);
  if (!match) {
    throw new Error(
      `Invalid window format "${str}". Expected format: <number><unit> where unit is s, m, h, or d (e.g. '30s', '5m', '1h', '1d')`
    );
  }
  const value = parseInt(match[1], 10);
  if (value <= 0) {
    throw new Error(`Window value must be positive, got ${value}`);
  }
  return value * WINDOW_UNITS[match[2]];
}

// =============================================================================
// Rate Limit Store (separate from RPC middleware store)
// =============================================================================

interface ServerFnRateLimitEntry {
  count: number;
  resetAt: number;
}

// Track all per-instance stores so clearServerFnRateLimitStore can reset them
const allRateLimitStores: Map<string, ServerFnRateLimitEntry>[] = [];

/** Clear all server function rate limit stores. Useful for testing. */
export function clearServerFnRateLimitStore(): void {
  for (const store of allRateLimitStores) {
    store.clear();
  }
}

// =============================================================================
// Middleware Builders
// =============================================================================

const MAX_RATE_LIMIT_ENTRIES = 10_000;

/**
 * Build a rate limiting middleware from declarative config.
 * Each call creates an isolated rate limit store — two functions with the same
 * window duration do NOT share counters.
 * Throws ServerFnError('RATE_LIMITED') when limit is exceeded.
 */
export function buildRateLimitMiddleware(config: ServerFnRateLimitConfig): ServerFnMiddleware {
  const windowMs = parseWindow(config.window);
  const { max } = config;
  const keyFn = config.keyFn ?? ((ctx: ServerFnContext) => {
    const xff = ctx.request.headers.get('x-forwarded-for');
    if (xff) return xff.split(',')[0].trim();
    return ctx.request.headers.get('x-real-ip') ?? 'unknown';
  });

  // Per-instance store: each middleware gets its own Map
  const store = new Map<string, ServerFnRateLimitEntry>();
  allRateLimitStores.push(store);

  return async (ctx: ServerFnContext, next: () => Promise<unknown>): Promise<unknown> => {
    const key = keyFn(ctx);
    const now = Date.now();

    let entry = store.get(key);
    if (!entry || entry.resetAt < now) {
      // Memory protection: clean up if store is too large
      if (store.size >= MAX_RATE_LIMIT_ENTRIES) {
        const expired: string[] = [];
        for (const [k, v] of store) {
          if (v.resetAt < now) expired.push(k);
        }
        for (const k of expired) store.delete(k);

        // Fail open if still at capacity
        if (store.size >= MAX_RATE_LIMIT_ENTRIES) {
          return next();
        }
      }
      entry = { count: 0, resetAt: now + windowMs };
      store.set(key, entry);
    }

    entry.count++;

    if (entry.count > max) {
      throw new ServerFnError('RATE_LIMITED', 'Too many requests', { statusCode: 429 });
    }

    return next();
  };
}

/**
 * Build a Cache-Control middleware from declarative config.
 * Sets the Cache-Control header on ctx.responseHeaders after the handler succeeds.
 */
export function buildCacheMiddleware(config: ServerFnCacheConfig): ServerFnMiddleware {
  return async (ctx: ServerFnContext, next: () => Promise<unknown>): Promise<unknown> => {
    const result = await next();

    const directives: string[] = [];
    directives.push(config.public ? 'public' : 'private');
    directives.push(`max-age=${config.maxAge}`);
    if (config.staleWhileRevalidate !== undefined) {
      directives.push(`stale-while-revalidate=${config.staleWhileRevalidate}`);
    }

    ctx.responseHeaders.set('Cache-Control', directives.join(', '));
    return result;
  };
}

/**
 * Build a CORS middleware from declarative config.
 * Sets Access-Control-* headers on ctx.responseHeaders.
 */
export function buildCorsMiddleware(config: ServerFnCorsConfig): ServerFnMiddleware {
  // Validate: wildcard origin with credentials is forbidden by the CORS specification.
  // Browsers silently reject responses with Access-Control-Allow-Origin: * when
  // Access-Control-Allow-Credentials: true is also set.
  if (config.origins === '*' && config.credentials) {
    throw new Error(
      'CORS config error: origins "*" cannot be used with credentials: true. ' +
      'The CORS specification forbids this combination. Specify explicit origins instead.'
    );
  }

  const methods = config.methods ?? ['GET', 'POST'];
  const headers = config.headers ?? ['Content-Type', 'Authorization', 'X-Ereo-RPC'];

  return async (ctx: ServerFnContext, next: () => Promise<unknown>): Promise<unknown> => {
    // Determine origin header
    if (config.origins === '*') {
      ctx.responseHeaders.set('Access-Control-Allow-Origin', '*');
    } else {
      const allowedOrigins = Array.isArray(config.origins) ? config.origins : [config.origins];
      const requestOrigin = ctx.request.headers.get('Origin') ?? '';
      if (allowedOrigins.includes(requestOrigin)) {
        ctx.responseHeaders.set('Access-Control-Allow-Origin', requestOrigin);
      }
    }

    ctx.responseHeaders.set('Access-Control-Allow-Methods', methods.join(', '));
    ctx.responseHeaders.set('Access-Control-Allow-Headers', headers.join(', '));

    if (config.credentials) {
      ctx.responseHeaders.set('Access-Control-Allow-Credentials', 'true');
    }

    if (config.maxAge !== undefined) {
      ctx.responseHeaders.set('Access-Control-Max-Age', String(config.maxAge));
    }

    return next();
  };
}

/**
 * Build an auth middleware from declarative config.
 * Throws ServerFnError('UNAUTHORIZED') if getUser returns null/undefined.
 */
export function buildAuthMiddleware(config: ServerFnAuthConfig): ServerFnMiddleware {
  const message = config.message ?? 'Unauthorized';

  return async (ctx: ServerFnContext, next: () => Promise<unknown>): Promise<unknown> => {
    const user = await config.getUser(ctx);
    if (user == null) {
      throw new ServerFnError('UNAUTHORIZED', message, { statusCode: 401 });
    }
    // Make authenticated user available to downstream middleware and handlers
    ctx.user = user;
    return next();
  };
}

// =============================================================================
// compileConfigMiddleware — config → ordered middleware array
// =============================================================================

/**
 * Convert a declarative ServerFnConfig into an ordered array of middleware.
 * Order: CORS → rate limit → auth → cache → user middleware
 */
export function compileConfigMiddleware(config: ServerFnConfig): ServerFnMiddleware[] {
  const middleware: ServerFnMiddleware[] = [];

  if (config.cors) {
    middleware.push(buildCorsMiddleware(config.cors));
  }

  if (config.rateLimit) {
    middleware.push(buildRateLimitMiddleware(config.rateLimit));
  }

  if (config.auth) {
    middleware.push(buildAuthMiddleware(config.auth));
  }

  if (config.cache) {
    middleware.push(buildCacheMiddleware(config.cache));
  }

  if (config.middleware) {
    middleware.push(...config.middleware);
  }

  return middleware;
}

// =============================================================================
// ID Generation (Phase 1: counter-based)
// =============================================================================

let idCounter = 0;

function generateId(fnName?: string): string {
  idCounter++;
  const name = fnName || 'anonymous';
  return `server$_${name}_${idCounter}`;
}

/** Reset ID counter. For testing only. */
export function _resetIdCounter(): void {
  idCounter = 0;
}

// =============================================================================
// server$ — single function wrapper
// =============================================================================

/**
 * Create a server function with optional declarative config.
 *
 * @example
 * ```ts
 * const getMetrics = server$(async (timeRange: string, ctx) => {
 *   return db.metrics.findMany({ where: { range: timeRange } })
 * }, {
 *   rateLimit: { max: 30, window: '1m' },
 *   cache: { maxAge: 60 },
 * })
 * ```
 */
export function server$<TInput = void, TOutput = unknown>(
  handler: (input: TInput, ctx: ServerFnContext) => Promise<TOutput> | TOutput,
  config?: ServerFnConfig
): ServerFn<TInput, TOutput> {
  const fnName = handler.name || undefined;
  const id = config?.id ?? generateId(fnName);
  const middleware = config ? compileConfigMiddleware(config) : [];

  return createServerFn<TInput, TOutput>({
    id,
    handler,
    middleware,
    input: config?.input,
    allowPublic: config?.allowPublic,
  });
}

// =============================================================================
// createServerBlock — grouped functions with shared config
// =============================================================================

/** A function definition within a block: either a bare handler or { handler, ...overrides } */
type BlockFnDef<TInput, TOutput> =
  | ((input: TInput, ctx: ServerFnContext) => Promise<TOutput> | TOutput)
  | ({
      handler: (input: TInput, ctx: ServerFnContext) => Promise<TOutput> | TOutput;
    } & Partial<ServerFnConfig>);

/** Map of function names to their definitions */
type BlockFnMap = Record<string, BlockFnDef<any, any>>;

/** The result: same keys, but each value is a callable ServerFn */
type BlockResult<T extends BlockFnMap> = {
  [K in keyof T]: T[K] extends (input: infer I, ctx: ServerFnContext) => Promise<infer O> | infer O
    ? ServerFn<I, O>
    : T[K] extends { handler: (input: infer I, ctx: ServerFnContext) => Promise<infer O> | infer O }
    ? ServerFn<I, O>
    : never;
};

/**
 * Create a group of server functions with shared config.
 * Per-function overrides replace (not merge) the block-level config for that key.
 * Middleware arrays are concatenated: block middleware runs first.
 *
 * @example
 * ```ts
 * const api = createServerBlock({
 *   rateLimit: { max: 30, window: '1m' },
 *   middleware: [authMiddleware],
 * }, {
 *   getMetrics: async (timeRange: string, ctx) => { ... },
 *   deleteUser: {
 *     handler: async (userId: string, ctx) => { ... },
 *     rateLimit: { max: 5, window: '1m' },
 *   },
 * })
 * ```
 */
export function createServerBlock<T extends BlockFnMap>(
  blockConfig: ServerFnConfig,
  fns: T
): BlockResult<T> {
  const result = {} as Record<string, ServerFn<any, any>>;

  for (const name of Object.keys(fns)) {
    const def = fns[name];
    let handler: (input: any, ctx: ServerFnContext) => Promise<any> | any;
    let fnOverrides: Partial<ServerFnConfig> = {};

    if (typeof def === 'function') {
      handler = def;
    } else {
      handler = def.handler;
      // Extract overrides (everything except handler)
      const { handler: _h, ...overrides } = def;
      fnOverrides = overrides;
    }

    // Merge config: per-fn config objects replace block-level, middleware concatenates
    // Use 'key in' checks so that explicit undefined overrides can clear block-level config
    const mergedConfig: ServerFnConfig = {
      // Start with block config
      rateLimit: blockConfig.rateLimit,
      cache: blockConfig.cache,
      cors: blockConfig.cors,
      auth: blockConfig.auth,
      method: blockConfig.method,
      input: blockConfig.input,
      allowPublic: blockConfig.allowPublic,
      // Override with per-fn config (full replacement for config objects)
      ...('rateLimit' in fnOverrides ? { rateLimit: fnOverrides.rateLimit } : {}),
      ...('cache' in fnOverrides ? { cache: fnOverrides.cache } : {}),
      ...('cors' in fnOverrides ? { cors: fnOverrides.cors } : {}),
      ...('auth' in fnOverrides ? { auth: fnOverrides.auth } : {}),
      ...('method' in fnOverrides ? { method: fnOverrides.method } : {}),
      ...('input' in fnOverrides ? { input: fnOverrides.input } : {}),
      ...('allowPublic' in fnOverrides ? { allowPublic: fnOverrides.allowPublic } : {}),
      // Middleware: block first, then per-fn
      middleware: [
        ...(blockConfig.middleware ?? []),
        ...(fnOverrides.middleware ?? []),
      ],
      // ID: explicit per-fn id, or auto-generated from name
      id: fnOverrides.id ?? generateId(name),
    };

    const compiledMiddleware = compileConfigMiddleware(mergedConfig);

    result[name] = createServerFn({
      id: mergedConfig.id!,
      handler,
      middleware: compiledMiddleware,
      input: mergedConfig.input,
      allowPublic: mergedConfig.allowPublic,
    });
  }

  return result as BlockResult<T>;
}
