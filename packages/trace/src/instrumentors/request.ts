/**
 * @ereo/trace - Request Lifecycle Instrumentor (Layer 1)
 *
 * Middleware that creates the root trace span wrapping the entire request.
 * Records: method, pathname, headers, statusCode, total duration.
 *
 * Must be inserted as FIRST middleware in BunServer.setupMiddleware().
 */

import type { MiddlewareHandler } from '@ereo/core';
import type { Tracer } from '../types';
import { setTracer, setActiveSpan } from '../context';

export interface TraceMiddlewareOptions {
  /** Paths to exclude from tracing (e.g., static assets) */
  exclude?: string[];
  /** Whether to record request headers */
  recordHeaders?: boolean;
}

/**
 * Create trace middleware that instruments the full request lifecycle.
 *
 * @param tracer - The tracer instance (shared across requests)
 * @param options - Configuration options
 */
export function traceMiddleware(tracer: Tracer, options: TraceMiddlewareOptions = {}): MiddlewareHandler {
  const { exclude = ['/_ereo/', '/__ereo/', '/favicon.ico'], recordHeaders = false } = options;

  return async (request, context, next) => {
    const url = new URL(request.url);

    // Skip excluded paths
    for (const pattern of exclude) {
      if (url.pathname.startsWith(pattern)) {
        return next();
      }
    }

    // Create root trace span
    const rootSpan = tracer.startTrace(`${request.method} ${url.pathname}`, 'request', {
      origin: 'server',
      method: request.method,
      pathname: url.pathname,
    });

    rootSpan.setAttribute('http.method', request.method);
    rootSpan.setAttribute('http.pathname', url.pathname);
    rootSpan.setAttribute('http.search', url.search);

    if (recordHeaders) {
      const headers: string[] = [];
      request.headers.forEach((value, key) => {
        if (key.toLowerCase() !== 'cookie' && key.toLowerCase() !== 'authorization') {
          headers.push(`${key}: ${value}`);
        }
      });
      rootSpan.setAttribute('http.request_headers', headers.join('; '));
    }

    // Attach tracer + active span to context for downstream instrumentors
    setTracer(context, tracer);
    setActiveSpan(context, rootSpan);

    // Check for incoming trace ID from client
    const clientTraceId = request.headers.get('X-Ereo-Trace-Id');
    if (clientTraceId) {
      rootSpan.setAttribute('trace.client_id', clientTraceId);
    }

    let response: Response;
    try {
      response = await next();
    } catch (err) {
      rootSpan.error(err);
      rootSpan.setAttribute('http.status_code', 500);
      rootSpan.end();
      throw err;
    }

    rootSpan.setAttribute('http.status_code', response.status);
    if (response.status >= 400) {
      rootSpan.setAttribute('http.error', true);
    }

    rootSpan.end();

    // Inject trace ID into response header for client correlation
    const headers = new Headers(response.headers);
    headers.set('X-Ereo-Trace-Id', rootSpan.traceId);

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  };
}
