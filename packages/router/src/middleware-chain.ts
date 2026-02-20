/**
 * @ereo/router - Middleware Chain Executor
 *
 * Executes route-level middleware chains with support for named middleware,
 * inline middleware functions, and type-safe context passing.
 *
 * ## Type Compatibility
 *
 * This module provides `TypedMiddlewareHandler<TProvides, TRequires>` which extends
 * the base `MiddlewareHandler` from `@ereo/core`. The typed version adds generic
 * parameters for compile-time context type checking while remaining fully compatible
 * with the core middleware system.
 *
 * ```typescript
 * // Base type from @ereo/core:
 * type MiddlewareHandler = (
 *   request: Request,
 *   context: AppContext,
 *   next: NextFunction
 * ) => Response | Promise<Response>
 *
 * // Typed version (compatible with base):
 * type TypedMiddlewareHandler<TProvides, TRequires> = (
 *   request: Request,
 *   context: AppContext & TRequires,  // Extends AppContext
 *   next: NextFunction
 * ) => Response | Promise<Response>
 * ```
 *
 * Both types can be used interchangeably with `@ereo/server`'s middleware chain.
 */

import type {
  MiddlewareReference,
  MiddlewareHandler,
  AppContext,
  NextFunction,
  RouteConfig,
} from '@ereo/core';

// ============================================================================
// Type-Safe Middleware Creation
// ============================================================================

/**
 * Typed middleware context values.
 * Middleware can declare what values it adds to the context.
 */
export interface TypedMiddlewareContext {
  [key: string]: unknown;
}

/**
 * Typed middleware handler that declares its context additions.
 *
 * This type is fully compatible with `MiddlewareHandler` from `@ereo/core`.
 * The generic parameters allow TypeScript to track what context values
 * are provided and required by each middleware.
 *
 * @template TProvides - Context keys/types this middleware adds
 * @template TRequires - Context keys/types this middleware expects to exist
 *
 * @example
 * // A TypedMiddlewareHandler can be used anywhere a MiddlewareHandler is expected:
 * const typed: TypedMiddlewareHandler<{ user: User }> = async (req, ctx, next) => {
 *   ctx.set('user', await getUser(req));
 *   return next();
 * };
 *
 * // This works because TypedMiddlewareHandler extends MiddlewareHandler:
 * const handler: MiddlewareHandler = typed; // OK!
 */
export type TypedMiddlewareHandler<
  TProvides extends TypedMiddlewareContext = {},
  TRequires extends TypedMiddlewareContext = {}
> = (
  request: Request,
  context: AppContext & TRequires,
  next: NextFunction
) => Response | Promise<Response>;

/**
 * Typed middleware definition with metadata.
 */
export interface TypedMiddleware<
  TProvides extends TypedMiddlewareContext = {},
  TRequires extends TypedMiddlewareContext = {}
> {
  name: string;
  handler: TypedMiddlewareHandler<TProvides, TRequires>;
  /** Keys this middleware provides to the context */
  provides?: (keyof TProvides)[];
  /** Keys this middleware requires from the context */
  requires?: (keyof TRequires)[];
}

/**
 * Create a typed middleware with context type safety.
 *
 * @example
 * const authMiddleware = createMiddleware<{ user: User }>({
 *   name: 'auth',
 *   provides: ['user'],
 *   handler: async (req, ctx, next) => {
 *     const session = await getSession(req);
 *     if (!session) {
 *       return new Response('Unauthorized', { status: 401 });
 *     }
 *     ctx.set('user', session.user); // TypeScript knows 'user' is valid
 *     return next();
 *   },
 * });
 *
 * // In your loader:
 * export const loader = async ({ context }) => {
 *   const user = context.get<User>('user'); // Set by auth middleware
 * };
 */
export function createMiddleware<
  TProvides extends TypedMiddlewareContext = {},
  TRequires extends TypedMiddlewareContext = {}
>(
  config: TypedMiddleware<TProvides, TRequires>
): TypedMiddleware<TProvides, TRequires> & { register: () => void } {
  return {
    ...config,
    register() {
      registerMiddleware(config.name, config.handler as MiddlewareHandler);
    },
  };
}

/**
 * Chain multiple typed middleware together with type inference.
 *
 * @example
 * const protectedRoute = chainMiddleware(
 *   authMiddleware,    // provides: { user: User }
 *   adminMiddleware,   // requires: { user: User }, provides: { isAdmin: boolean }
 *   rateLimitMiddleware
 * );
 */
export function chainMiddleware<
  M1 extends TypedMiddleware<any, any>,
  M2 extends TypedMiddleware<any, any>,
>(
  m1: M1,
  m2: M2
): TypedMiddleware<
  M1 extends TypedMiddleware<infer P1, any> ? (M2 extends TypedMiddleware<infer P2, any> ? P1 & P2 : P1) : {},
  M1 extends TypedMiddleware<any, infer R1> ? R1 : {}
>;
export function chainMiddleware<
  M1 extends TypedMiddleware<any, any>,
  M2 extends TypedMiddleware<any, any>,
  M3 extends TypedMiddleware<any, any>,
>(
  m1: M1,
  m2: M2,
  m3: M3
): TypedMiddleware<any, any>;
export function chainMiddleware(...middlewares: TypedMiddleware<any, any>[]): TypedMiddleware<any, any> {
  const combinedProvides = middlewares.flatMap((m) => m.provides || []);
  const combinedRequires = middlewares.flatMap((m) => m.requires || []);

  return {
    name: middlewares.map((m) => m.name).join('+'),
    provides: combinedProvides,
    requires: combinedRequires,
    handler: composeMiddleware(...middlewares.map((m) => m.handler as MiddlewareHandler)),
  };
}

// ============================================================================
// Registry
// ============================================================================

/** Registry of named middleware */
const namedMiddlewareRegistry = new Map<string, MiddlewareHandler>();

/** Registry of typed middleware with metadata */
const typedMiddlewareRegistry = new Map<string, TypedMiddleware<any, any>>();

/**
 * Register a named middleware in the global registry.
 *
 * @example
 * registerMiddleware('auth', async (req, ctx, next) => {
 *   if (!ctx.get('user')) {
 *     return new Response('Unauthorized', { status: 401 });
 *   }
 *   return next();
 * });
 */
export function registerMiddleware(name: string, handler: MiddlewareHandler): void {
  namedMiddlewareRegistry.set(name, handler);
}

/**
 * Register a typed middleware with metadata.
 */
export function registerTypedMiddleware<
  TProvides extends TypedMiddlewareContext,
  TRequires extends TypedMiddlewareContext
>(middleware: TypedMiddleware<TProvides, TRequires>): void {
  typedMiddlewareRegistry.set(middleware.name, middleware);
  namedMiddlewareRegistry.set(middleware.name, middleware.handler as MiddlewareHandler);
}

/**
 * Get typed middleware metadata.
 */
export function getTypedMiddleware(name: string): TypedMiddleware<any, any> | undefined {
  return typedMiddlewareRegistry.get(name);
}

/**
 * Validate middleware chain for type safety.
 * Ensures that all required context values are provided by preceding middleware.
 */
export function validateMiddlewareChain(names: string[]): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  const providedKeys = new Set<string>();

  for (const name of names) {
    const middleware = typedMiddlewareRegistry.get(name);
    if (!middleware) continue;

    // Check if required keys are provided
    const requires = middleware.requires || [];
    for (const key of requires) {
      if (!providedKeys.has(key as string)) {
        errors.push(
          `Middleware '${name}' requires '${String(key)}' but it's not provided by preceding middleware`
        );
      }
    }

    // Add provided keys
    const provides = middleware.provides || [];
    for (const key of provides) {
      providedKeys.add(key as string);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Get a named middleware from the registry.
 */
export function getMiddleware(name: string): MiddlewareHandler | undefined {
  return namedMiddlewareRegistry.get(name);
}

/**
 * Check if a named middleware exists in the registry.
 */
export function hasMiddleware(name: string): boolean {
  return namedMiddlewareRegistry.has(name);
}

/**
 * Remove a named middleware from the registry.
 */
export function unregisterMiddleware(name: string): boolean {
  return namedMiddlewareRegistry.delete(name);
}

/**
 * Clear all named middleware from the registry.
 */
export function clearMiddlewareRegistry(): void {
  namedMiddlewareRegistry.clear();
  typedMiddlewareRegistry.clear();
}

/**
 * Resolve a middleware reference to a handler function.
 * String references are looked up in the named middleware registry.
 */
export function resolveMiddleware(
  reference: MiddlewareReference
): MiddlewareHandler | undefined {
  if (typeof reference === 'function') {
    return reference;
  }
  return namedMiddlewareRegistry.get(reference);
}

/**
 * Options for executing a middleware chain.
 */
export interface MiddlewareChainOptions {
  /** Request object */
  request: Request;
  /** Application context */
  context: AppContext;
  /** Final handler to call when chain completes */
  finalHandler: NextFunction;
  /** Error handler for middleware errors */
  onError?: (error: Error) => Response | Promise<Response>;
}

/**
 * Execute a middleware chain.
 *
 * @param middleware Array of middleware references
 * @param options Chain execution options
 * @returns Response from the chain
 *
 * @example
 * const response = await executeMiddlewareChain(
 *   ['csrf', 'auth', customMiddleware],
 *   {
 *     request,
 *     context,
 *     finalHandler: async () => renderRoute(),
 *   }
 * );
 */
export async function executeMiddlewareChain(
  middleware: MiddlewareReference[],
  options: MiddlewareChainOptions
): Promise<Response> {
  const { request, context, finalHandler, onError } = options;

  // Resolve all middleware references to handlers
  const handlers: MiddlewareHandler[] = [];
  for (const ref of middleware) {
    const handler = resolveMiddleware(ref);
    if (!handler) {
      if (typeof ref === 'string') {
        throw new Error(`Named middleware not found: ${ref}`);
      }
      throw new Error('Invalid middleware reference');
    }
    handlers.push(handler);
  }

  // Build the chain
  let index = 0;

  const next: NextFunction = async (): Promise<Response> => {
    if (index >= handlers.length) {
      // Chain complete, call final handler
      return finalHandler();
    }

    const currentIndex = index++;
    const handler = handlers[currentIndex];
    let called = false;

    try {
      return await handler(request, context, async () => {
        if (called) {
          throw new Error('next() called multiple times in middleware');
        }
        called = true;
        return next();
      });
    } catch (error) {
      if (onError) {
        return onError(error instanceof Error ? error : new Error(String(error)));
      }
      throw error;
    }
  };

  return next();
}

/**
 * Create a middleware chain executor bound to a route config.
 *
 * @param config Route configuration containing middleware array
 * @returns Function to execute the middleware chain
 *
 * @example
 * const executor = createMiddlewareExecutor(routeConfig);
 * const response = await executor({ request, context, finalHandler });
 */
export function createMiddlewareExecutor(config: RouteConfig) {
  const middleware = config.middleware || [];

  return async (options: Omit<MiddlewareChainOptions, 'finalHandler'> & { finalHandler: NextFunction }) => {
    return executeMiddlewareChain(middleware, options);
  };
}

/**
 * Compose multiple middleware handlers into a single handler.
 */
export function composeMiddleware(...handlers: MiddlewareHandler[]): MiddlewareHandler {
  return async (request: Request, context: AppContext, next: NextFunction): Promise<Response> => {
    let index = 0;

    const composedNext: NextFunction = async (): Promise<Response> => {
      if (index >= handlers.length) {
        return next();
      }

      const currentIndex = index++;
      const handler = handlers[currentIndex];
      let called = false;

      return handler(request, context, async () => {
        if (called) {
          throw new Error('next() called multiple times in middleware');
        }
        called = true;
        return composedNext();
      });
    };

    return composedNext();
  };
}

/**
 * Create a conditional middleware that only runs when the predicate matches.
 */
export function when(
  predicate: (request: Request, context: AppContext) => boolean | Promise<boolean>,
  middleware: MiddlewareHandler
): MiddlewareHandler {
  return async (request: Request, context: AppContext, next: NextFunction): Promise<Response> => {
    const shouldRun = await predicate(request, context);
    if (shouldRun) {
      return middleware(request, context, next);
    }
    return next();
  };
}

/**
 * Create a middleware that only runs for specific HTTP methods.
 */
export function method(
  methods: string | string[],
  middleware: MiddlewareHandler
): MiddlewareHandler {
  const methodSet = new Set(Array.isArray(methods) ? methods : [methods]);

  return when(
    (request) => methodSet.has(request.method),
    middleware
  );
}

/**
 * Convert a glob pattern to a RegExp.
 * Supports * (match anything except /) and ** (match anything including /).
 */
export function globToRegex(glob: string): RegExp {
  const escaped = glob
    .replace(/[.+^${}()|[\]\\]/g, '\\$&') // Escape regex special chars except * and ?
    .replace(/\*\*/g, '{{GLOBSTAR}}')     // Temporarily replace **
    .replace(/\*/g, '[^/]*')              // * matches anything except /
    .replace(/\?/g, '[^/]')               // ? matches single char except /
    .replace(/\{\{GLOBSTAR\}\}/g, '.*');  // ** matches anything including /
  return new RegExp(`^${escaped}$`);
}

/**
 * Create a middleware that only runs for specific path patterns.
 */
export function path(
  patterns: string | string[] | RegExp | RegExp[],
  middleware: MiddlewareHandler
): MiddlewareHandler {
  const patternList = Array.isArray(patterns) ? patterns : [patterns];

  return when(
    (request) => {
      const url = new URL(request.url);
      return patternList.some((pattern) => {
        if (typeof pattern === 'string') {
          // Exact match
          if (url.pathname === pattern) return true;
          // Glob pattern: /api/* matches /api/anything
          if (pattern.endsWith('/*')) {
            const prefix = pattern.slice(0, -1); // Remove the *
            return url.pathname.startsWith(prefix);
          }
          // Prefix match with path boundary check
          return url.pathname.startsWith(pattern + '/') || url.pathname === pattern;
        }
        return pattern.test(url.pathname);
      });
    },
    middleware
  );
}

// ============================================================================
// Built-in Middleware Helpers
// ============================================================================

/**
 * Create a logging middleware.
 */
export function createLoggerMiddleware(
  options: { includeBody?: boolean; includeHeaders?: string[] } = {}
): MiddlewareHandler {
  return async (request, context, next) => {
    const startTime = Date.now();
    const url = new URL(request.url);

    const logData: Record<string, unknown> = {
      method: request.method,
      pathname: url.pathname,
      timestamp: new Date().toISOString(),
    };

    if (options.includeHeaders) {
      logData.headers = Object.fromEntries(
        options.includeHeaders.map((h) => [h, request.headers.get(h)])
      );
    }

    try {
      const response = await next();
      const duration = Date.now() - startTime;

      console.log({
        ...logData,
        status: response.status,
        duration: `${duration}ms`,
      });

      return response;
    } catch (error) {
      const duration = Date.now() - startTime;
      console.error({
        ...logData,
        error: error instanceof Error ? error.message : String(error),
        duration: `${duration}ms`,
      });
      throw error;
    }
  };
}

/**
 * Create a CORS middleware.
 */
export function createCorsMiddleware(options: {
  origin?: string | string[] | ((origin: string) => boolean);
  methods?: string[];
  headers?: string[];
  credentials?: boolean;
  maxAge?: number;
} = {}): MiddlewareHandler {
  const {
    origin = '*',
    methods = ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE'],
    headers = ['Content-Type', 'Authorization'],
    credentials = false,
    maxAge = 86400,
  } = options;

  return async (request, context, next) => {
    // Resolve the allowed origin for this request
    const resolveOrigin = (): string | null => {
      if (typeof origin === 'string') return origin;
      const requestOrigin = request.headers.get('Origin');
      if (Array.isArray(origin)) {
        return requestOrigin && origin.includes(requestOrigin) ? requestOrigin : null;
      }
      if (typeof origin === 'function') {
        return requestOrigin && origin(requestOrigin) ? requestOrigin : null;
      }
      return null;
    };

    const allowedOrigin = resolveOrigin();

    // Handle preflight — short-circuit before running downstream handlers
    if (request.method === 'OPTIONS') {
      const preflightHeaders = new Headers();
      if (allowedOrigin) preflightHeaders.set('Access-Control-Allow-Origin', allowedOrigin);
      preflightHeaders.set('Access-Control-Allow-Methods', methods.join(', '));
      if (headers.length > 0) preflightHeaders.set('Access-Control-Allow-Headers', headers.join(', '));
      if (credentials) preflightHeaders.set('Access-Control-Allow-Credentials', 'true');
      preflightHeaders.set('Access-Control-Max-Age', String(maxAge));

      return new Response(null, {
        status: 204,
        headers: preflightHeaders,
      });
    }

    const response = await next();

    const corsHeaders = new Headers(response.headers);

    if (allowedOrigin) {
      corsHeaders.set('Access-Control-Allow-Origin', allowedOrigin);
    }

    corsHeaders.set('Access-Control-Allow-Methods', methods.join(', '));

    if (headers.length > 0) {
      corsHeaders.set('Access-Control-Allow-Headers', headers.join(', '));
    }

    if (credentials) {
      corsHeaders.set('Access-Control-Allow-Credentials', 'true');
    }

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: corsHeaders,
    });
  };
}

/**
 * Create a rate limiting middleware.
 */
export function createRateLimitMiddleware(options: {
  windowMs?: number;
  maxRequests?: number;
  keyGenerator?: (request: Request) => string;
  skipSuccessfulRequests?: boolean;
} = {}): MiddlewareHandler {
  const {
    windowMs = 60000,
    maxRequests = 100,
    keyGenerator = (req) => req.headers.get('X-Forwarded-For') || 'unknown',
    skipSuccessfulRequests = false,
  } = options;

  // Simple in-memory store (use Redis in production)
  const store = new Map<string, { count: number; resetTime: number }>();
  let lastCleanup = Date.now();

  return async (request, context, next) => {
    const key = keyGenerator(request);
    const now = Date.now();

    // Periodically clean up expired entries to prevent memory leaks.
    // When the store exceeds the threshold, also evict the soonest-to-expire
    // entries to prevent unbounded growth from spoofed IPs.
    const MAX_ENTRIES = 10_000;
    if (now - lastCleanup > windowMs || store.size > MAX_ENTRIES) {
      lastCleanup = now;
      const expired: string[] = [];
      for (const [k, v] of store) {
        if (now > v.resetTime) expired.push(k);
      }
      for (const k of expired) store.delete(k);
      // Hard eviction: if still over limit after removing expired, drop oldest 20%
      if (store.size > MAX_ENTRIES) {
        const entries = Array.from(store.entries());
        entries.sort((a, b) => a[1].resetTime - b[1].resetTime);
        const toRemove = Math.max(1, Math.floor(entries.length * 0.2));
        for (let i = 0; i < toRemove; i++) {
          store.delete(entries[i][0]);
        }
      }
    }

    let record = store.get(key);
    if (!record || now > record.resetTime) {
      record = { count: 0, resetTime: now + windowMs };
    }

    record.count++;
    store.set(key, record);

    // Check limit
    if (record.count > maxRequests) {
      return new Response('Rate limit exceeded', {
        status: 429,
        headers: {
          'Retry-After': String(Math.ceil((record.resetTime - now) / 1000)),
        },
      });
    }

    const response = await next();

    // Add rate limit headers
    const newResponse = new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
    });

    newResponse.headers.set('X-RateLimit-Limit', String(maxRequests));
    newResponse.headers.set('X-RateLimit-Remaining', String(Math.max(0, maxRequests - record.count)));
    newResponse.headers.set('X-RateLimit-Reset', String(Math.ceil(record.resetTime / 1000)));

    // Don't count successful requests against the rate limit
    if (skipSuccessfulRequests && response.status < 400) {
      record.count = Math.max(0, record.count - 1);
    }

    return newResponse;
  };
}
