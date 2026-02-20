/**
 * Server Function HTTP Handler
 *
 * Mounts at /_server-fn/* and dispatches incoming POST requests to
 * the correct registered server function. Integrates with the Ereo
 * server as middleware.
 *
 * Usage:
 *   import { createServerFnHandler } from '@ereo/rpc';
 *
 *   const handler = createServerFnHandler();
 *
 *   // Use as middleware in BunServer
 *   server.use('/_server-fn/*', handler);
 *
 *   // Or call directly
 *   const response = await handler(request, appContext);
 */

import {
  getServerFn,
  SERVER_FN_BASE,
  ServerFnError,
  type ServerFnContext,
  type ServerFnMiddleware,
} from './server-fn';

// =============================================================================
// Types
// =============================================================================

export interface ServerFnHandlerOptions {
  /** Base path for server function endpoints (default: '/_server-fn') */
  basePath?: string;
  /** Global middleware applied to all server functions */
  middleware?: ServerFnMiddleware[];
  /** Custom error handler for unhandled errors */
  onError?: (error: unknown, fnId: string) => void;
  /** Context provider — creates app context from the request */
  createContext?: (request: Request) => unknown | Promise<unknown>;
  /** Disable CSRF header check (not recommended) */
  disableCsrfProtection?: boolean;
  /** Default middleware prepended to all server functions unless allowPublic is true */
  defaultMiddleware?: ServerFnMiddleware[];
}

export type ServerFnRequestHandler = (
  request: Request,
  appContext?: unknown
) => Promise<Response | null>;

// =============================================================================
// Handler
// =============================================================================

/**
 * Create a request handler for server functions.
 *
 * Returns a function that takes a Request and returns a Response (or null
 * if the request doesn't match a server function endpoint).
 */
export function createServerFnHandler(
  options: ServerFnHandlerOptions = {}
): ServerFnRequestHandler {
  const {
    basePath = SERVER_FN_BASE,
    middleware: globalMiddleware = [],
    onError,
    createContext,
    disableCsrfProtection = false,
    defaultMiddleware = [],
  } = options;

  const prefix = basePath.endsWith('/') ? basePath : basePath + '/';

  return async (request: Request, appContext?: unknown): Promise<Response | null> => {
    const url = new URL(request.url);

    // Check if this is a server function request
    if (!url.pathname.startsWith(prefix) && url.pathname !== basePath) {
      return null;
    }

    // Only POST is allowed
    if (request.method !== 'POST') {
      return jsonResponse(
        { ok: false, error: { code: 'METHOD_NOT_ALLOWED', message: 'Server functions only accept POST requests' } },
        405
      );
    }

    // CSRF protection: require X-Ereo-RPC header on all POST requests
    if (!disableCsrfProtection && !request.headers.get('X-Ereo-RPC')) {
      return jsonResponse(
        { ok: false, error: { code: 'CSRF_ERROR', message: 'Missing X-Ereo-RPC header' } },
        403
      );
    }

    // Extract function ID from the URL
    let fnId: string;
    try {
      fnId = decodeURIComponent(url.pathname.slice(prefix.length));
    } catch {
      return jsonResponse(
        { ok: false, error: { code: 'BAD_REQUEST', message: 'Invalid function ID encoding' } },
        400
      );
    }
    if (!fnId || fnId.includes('..') || fnId.includes('\0')) {
      return jsonResponse(
        { ok: false, error: { code: 'BAD_REQUEST', message: 'Invalid function ID' } },
        400
      );
    }

    // Look up the function
    const fn = getServerFn(fnId);
    if (!fn) {
      return jsonResponse(
        { ok: false, error: { code: 'NOT_FOUND', message: `Server function "${fnId}" not found` } },
        404
      );
    }

    // Parse request body
    let body: { input?: unknown };
    try {
      const contentType = request.headers.get('Content-Type') ?? '';
      if (contentType.includes('application/json')) {
        body = await request.json();
      } else {
        body = { input: undefined };
      }
    } catch {
      return jsonResponse(
        { ok: false, error: { code: 'PARSE_ERROR', message: 'Invalid request body' } },
        400
      );
    }

    // Build server function context
    let resolvedContext: unknown;
    try {
      resolvedContext = createContext ? await createContext(request) : appContext ?? {};
    } catch (error) {
      onError?.(error, fnId);
      console.error(`Server function "${fnId}" context creation error:`, error instanceof Error ? error.message : error);
      return jsonResponse(
        { ok: false, error: { code: 'INTERNAL_ERROR', message: 'Context creation failed' } },
        500
      );
    }
    const responseHeaders = new Headers();

    const ctx: ServerFnContext = {
      request,
      responseHeaders,
      appContext: resolvedContext,
    };

    try {
      // Validate input
      let input = body.input;
      if (fn.inputSchema) {
        try {
          input = fn.inputSchema.parse(input);
        } catch (validationError: any) {
          const details = extractValidationDetails(validationError);
          return jsonResponse(
            { ok: false, error: { code: 'VALIDATION_ERROR', message: 'Input validation failed', details } },
            400
          );
        }
      }

      // Build middleware chain: global middleware + default middleware (unless allowPublic) + function-specific middleware
      const fnDefaultMiddleware = fn.allowPublic ? [] : defaultMiddleware;
      const allMiddleware = [...globalMiddleware, ...fnDefaultMiddleware, ...fn.middleware];

      const runChain = async (index: number): Promise<unknown> => {
        if (index < allMiddleware.length) {
          return allMiddleware[index](ctx, () => runChain(index + 1));
        }
        return fn.handler(input, ctx);
      };

      const result = await runChain(0);

      // Build successful response
      const response = jsonResponse({ ok: true, data: result }, 200);

      // Copy response headers set during execution
      responseHeaders.forEach((value, key) => {
        response.headers.set(key, value);
      });

      return response;
    } catch (error) {
      // Helper to copy accumulated middleware headers (CORS, cache, etc.) onto error responses.
      // Without this, browsers see "CORS error" when the real error was 401/429.
      const withResponseHeaders = (response: Response): Response => {
        responseHeaders.forEach((value, key) => {
          response.headers.set(key, value);
        });
        return response;
      };

      // ServerFnError — structured error
      if (error instanceof ServerFnError) {
        return withResponseHeaders(jsonResponse(
          {
            ok: false,
            error: {
              code: error.code,
              message: error.message,
              ...(error.details ? { details: error.details } : {}),
            },
          },
          error.statusCode
        ));
      }

      // Zod-style validation error thrown from handler
      if (isZodError(error)) {
        const details = extractValidationDetails(error);
        return withResponseHeaders(jsonResponse(
          { ok: false, error: { code: 'VALIDATION_ERROR', message: 'Validation failed', details } },
          400
        ));
      }

      // Unhandled error
      onError?.(error, fnId);

      if (!(error instanceof Error)) {
        console.error(`Server function "${fnId}" error:`, error);
      } else {
        console.error(`Server function "${fnId}" error:`, error.message);
      }

      return withResponseHeaders(jsonResponse(
        { ok: false, error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } },
        500
      ));
    }
  };
}

// =============================================================================
// Helpers
// =============================================================================

function jsonResponse(data: unknown, status: number): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function isZodError(error: unknown): boolean {
  return (
    error instanceof Error &&
    (error.name === 'ZodError' || Array.isArray((error as any).issues))
  );
}

function extractValidationDetails(error: unknown): Record<string, unknown> {
  if (error instanceof Error && Array.isArray((error as any).issues)) {
    return {
      issues: (error as any).issues.map((issue: any) => ({
        path: issue.path,
        message: issue.message,
        code: issue.code,
      })),
    };
  }
  if (error instanceof Error) {
    return { message: error.message };
  }
  return { message: 'Validation failed' };
}
