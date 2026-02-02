/**
 * @oreo/router - Middleware Chain Executor
 *
 * Executes route-level middleware chains with support for named middleware
 * and inline middleware functions.
 */

import type {
  MiddlewareReference,
  MiddlewareHandler,
  AppContext,
  NextFunction,
  RouteConfig,
} from '@oreo/core';

/** Registry of named middleware */
const namedMiddlewareRegistry = new Map<string, MiddlewareHandler>();

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

    const handler = handlers[index++];

    try {
      return await handler(request, context, next);
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

      const handler = handlers[index++];
      return handler(request, context, composedNext);
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
function globToRegex(glob: string): RegExp {
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
          // Simple prefix match
          return url.pathname.startsWith(pattern);
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
    headers = [],
    credentials = false,
    maxAge = 86400,
  } = options;

  return async (request, context, next) => {
    const response = await next();

    const corsHeaders = new Headers(response.headers);

    // Handle origin
    if (typeof origin === 'string') {
      corsHeaders.set('Access-Control-Allow-Origin', origin);
    } else if (Array.isArray(origin)) {
      const requestOrigin = request.headers.get('Origin');
      if (requestOrigin && origin.includes(requestOrigin)) {
        corsHeaders.set('Access-Control-Allow-Origin', requestOrigin);
      }
    } else if (typeof origin === 'function') {
      const requestOrigin = request.headers.get('Origin') || '';
      if (origin(requestOrigin)) {
        corsHeaders.set('Access-Control-Allow-Origin', requestOrigin);
      }
    }

    // Handle methods
    corsHeaders.set('Access-Control-Allow-Methods', methods.join(', '));

    // Handle headers
    if (headers.length > 0) {
      corsHeaders.set('Access-Control-Allow-Headers', headers.join(', '));
    }

    // Handle credentials
    if (credentials) {
      corsHeaders.set('Access-Control-Allow-Credentials', 'true');
    }

    // Handle max age
    corsHeaders.set('Access-Control-Max-Age', String(maxAge));

    // Handle preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: corsHeaders,
      });
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

  return async (request, context, next) => {
    const key = keyGenerator(request);
    const now = Date.now();

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

    // Reset on successful request if configured
    if (skipSuccessfulRequests && response.status < 400) {
      store.delete(key);
    }

    return newResponse;
  };
}
