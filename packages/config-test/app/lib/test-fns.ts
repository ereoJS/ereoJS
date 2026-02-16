/**
 * Server functions configured with every ServerFnConfig option.
 * Used to verify each config feature works at runtime.
 */
import {
  server$,
  createServerBlock,
  clearServerFnRateLimitStore,
} from '@ereo/rpc';
import type { ServerFnMiddleware } from '@ereo/rpc';

// =============================================================================
// Shared state for capturing middleware effects
// =============================================================================

/** Captured response headers from the last call (set by captureMiddleware).
 * Note: only captures headers set BEFORE next() in the middleware chain (e.g. CORS).
 * Cache headers are set AFTER next() returns, so they won't appear here. */
export let capturedHeaders: Record<string, string> = {};

/** Execution log from custom middleware */
export let middlewareLog: string[] = [];

/** Reset all shared test state */
export function resetTestState() {
  capturedHeaders = {};
  middlewareLog = [];
  clearServerFnRateLimitStore();
}

// =============================================================================
// Capture middleware — records ctx.responseHeaders after the handler chain
// =============================================================================

const captureMiddleware: ServerFnMiddleware = async (ctx, next) => {
  const result = await next();
  capturedHeaders = {};
  ctx.responseHeaders.forEach((value, key) => {
    capturedHeaders[key] = value;
  });
  return result;
};

// =============================================================================
// Custom logging middleware — records execution into middlewareLog
// =============================================================================

const loggingMiddleware: ServerFnMiddleware = async (ctx, next) => {
  middlewareLog.push('logging:before');
  const result = await next();
  middlewareLog.push('logging:after');
  return result;
};

const timingMiddleware: ServerFnMiddleware = async (ctx, next) => {
  const start = Date.now();
  middlewareLog.push('timing:start');
  const result = await next();
  const elapsed = Date.now() - start;
  middlewareLog.push(`timing:end:${elapsed}ms`);
  return result;
};

// =============================================================================
// 1. Rate Limiting — max 3 requests per 30s window
// =============================================================================

export const rateLimitedFn = server$(
  async function rateLimited() {
    return { message: 'ok', time: Date.now() };
  },
  {
    rateLimit: { max: 3, window: '30s' },
    id: 'test-rate-limit',
  }
);

// =============================================================================
// 2. Rate Limiting with Custom Key — key by a custom header
// =============================================================================

export const rateLimitCustomKeyFn = server$(
  async function rateLimitCustomKey() {
    return { message: 'ok', time: Date.now() };
  },
  {
    rateLimit: {
      max: 2,
      window: '30s',
      keyFn: (ctx) => ctx.request.headers.get('x-client-id') ?? 'default',
    },
    id: 'test-rate-limit-custom-key',
  }
);

// =============================================================================
// 3. Auth — always rejects (getUser returns null)
// =============================================================================

export const authRejectFn = server$(
  async function authReject() {
    return { secret: 'you should not see this' };
  },
  {
    auth: {
      getUser: () => null,
      message: 'Access denied: authentication required',
    },
    id: 'test-auth-reject',
  }
);

// =============================================================================
// 4. Auth — always accepts (getUser returns a user)
// =============================================================================

export const authAcceptFn = server$(
  async function authAccept() {
    return { secret: 'authenticated data', user: 'admin' };
  },
  {
    auth: {
      getUser: () => ({ id: 1, name: 'TestUser', role: 'admin' }),
    },
    id: 'test-auth-accept',
  }
);

// =============================================================================
// 5. Cache — public cache with stale-while-revalidate + capture middleware
// =============================================================================

export const cacheFn = server$(
  async function cacheTest() {
    return { data: 'cached response', generatedAt: Date.now() };
  },
  {
    cache: { maxAge: 60, public: true, staleWhileRevalidate: 300 },
    middleware: [captureMiddleware],
    id: 'test-cache',
  }
);

// =============================================================================
// 6. Cache — private cache, no stale-while-revalidate
// =============================================================================

export const cachePrivateFn = server$(
  async function cachePrivate() {
    return { data: 'private cached' };
  },
  {
    cache: { maxAge: 30 },
    middleware: [captureMiddleware],
    id: 'test-cache-private',
  }
);

// =============================================================================
// 7. CORS — wildcard origin with credentials + capture
// =============================================================================

export const corsWildcardFn = server$(
  async function corsWildcard() {
    return { data: 'cors wildcard' };
  },
  {
    cors: { origins: '*', credentials: true, maxAge: 3600 },
    middleware: [captureMiddleware],
    id: 'test-cors-wildcard',
  }
);

// =============================================================================
// 8. CORS — specific origins + custom methods/headers
// =============================================================================

export const corsSpecificFn = server$(
  async function corsSpecific() {
    return { data: 'cors specific' };
  },
  {
    cors: {
      origins: ['http://localhost:3457', 'https://example.com'],
      methods: ['GET', 'POST', 'PUT'],
      headers: ['Content-Type', 'Authorization', 'X-Custom-Header'],
      credentials: true,
      maxAge: 7200,
    },
    middleware: [captureMiddleware],
    id: 'test-cors-specific',
  }
);

// =============================================================================
// 9. Custom Middleware — logging + timing middleware
// =============================================================================

export const customMiddlewareFn = server$(
  async function customMiddleware() {
    middlewareLog.push('handler:executed');
    return { data: 'middleware test' };
  },
  {
    middleware: [loggingMiddleware, timingMiddleware],
    id: 'test-custom-middleware',
  }
);

// =============================================================================
// 10. Combined Config — rate limit + auth + cache + CORS + custom middleware
// =============================================================================

export const combinedFn = server$(
  async function combined() {
    middlewareLog.push('combined:handler');
    return { data: 'combined config' };
  },
  {
    rateLimit: { max: 5, window: '1m' },
    auth: { getUser: () => ({ id: 1 }) },
    cache: { maxAge: 120, public: false },
    cors: { origins: '*' },
    middleware: [captureMiddleware],
    id: 'test-combined',
  }
);

// =============================================================================
// 11. createServerBlock — shared config with per-fn overrides
// =============================================================================

export const blockApi = createServerBlock(
  {
    rateLimit: { max: 4, window: '30s' },
    auth: { getUser: () => ({ id: 1, role: 'user' }) },
    middleware: [loggingMiddleware],
  },
  {
    // Inherits all block config (rateLimit: 4/30s, auth, loggingMiddleware)
    shared: async () => {
      return { source: 'shared', message: 'uses block config' };
    },

    // Overrides rateLimit (2/30s), inherits auth and loggingMiddleware
    strictLimit: {
      handler: async () => {
        return { source: 'strictLimit', message: 'stricter rate limit' };
      },
      rateLimit: { max: 2, window: '30s' },
    },

    // Removes auth (set to undefined), inherits rateLimit and loggingMiddleware
    public: {
      handler: async () => {
        return { source: 'public', message: 'no auth required' };
      },
      auth: undefined,
    },

    // Adds extra middleware, inherits everything else
    extraMiddleware: {
      handler: async () => {
        middlewareLog.push('block-extra:handler');
        return { source: 'extraMiddleware', message: 'has extra middleware' };
      },
      middleware: [timingMiddleware],
    },
  }
);
