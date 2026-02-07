/**
 * @ereo/trace - Database Instrumentor (Layer 7)
 *
 * Creates child span per DB query.
 * Records: SQL (first 200 chars), param count, row count, duration.
 * Wraps DatabaseAdapter methods externally — no changes to @ereo/db.
 */

import type { Span } from '../types';

/** Generic database adapter interface (matches @ereo/db DatabaseAdapter shape) */
export interface TracedAdapterMethods {
  query?(sql: string, params?: unknown[]): Promise<unknown>;
  execute?(sql: string, params?: unknown[]): Promise<unknown>;
  get?(sql: string, params?: unknown[]): Promise<unknown>;
  all?(sql: string, params?: unknown[]): Promise<unknown[]>;
  run?(sql: string, params?: unknown[]): Promise<unknown>;
}

/**
 * Wrap a database adapter to add tracing spans.
 * Returns a proxy that instruments query/execute/get/all/run methods.
 */
export function tracedAdapter<T extends TracedAdapterMethods>(
  adapter: T,
  getSpan: () => Span | undefined,
): T {
  const methodsToTrace = ['query', 'execute', 'get', 'all', 'run'];

  return new Proxy(adapter, {
    get(target, prop, receiver) {
      const value = Reflect.get(target, prop, receiver);

      if (typeof prop !== 'string' || typeof value !== 'function' || !methodsToTrace.includes(prop)) {
        return value;
      }

      return async function tracedMethod(sql: string, params?: unknown[]) {
        const parentSpan = getSpan();
        if (!parentSpan) {
          return value.call(target, sql, params);
        }

        const span = parentSpan.child(`db.${prop}`, 'database');
        span.setAttribute('db.operation', prop);
        span.setAttribute('db.statement', typeof sql === 'string' ? sql.slice(0, 200) : '');
        if (params) {
          span.setAttribute('db.param_count', params.length);
        }

        try {
          const result = await value.call(target, sql, params);

          if (Array.isArray(result)) {
            span.setAttribute('db.row_count', result.length);
          }

          span.end();
          return result;
        } catch (err) {
          span.error(err);
          span.end();
          throw err;
        }
      };
    },
  });
}

/**
 * Trace a single database query (manual instrumentation).
 */
export function traceQuery<T>(
  parentSpan: Span,
  operation: string,
  sql: string,
  queryFn: () => Promise<T>,
): Promise<T> {
  const span = parentSpan.child(`db.${operation}`, 'database');
  span.setAttribute('db.operation', operation);
  span.setAttribute('db.statement', sql.slice(0, 200));

  return queryFn()
    .then((result) => {
      if (Array.isArray(result)) {
        span.setAttribute('db.row_count', result.length);
      }
      span.end();
      return result;
    })
    .catch((err) => {
      span.error(err);
      span.end();
      throw err;
    });
}
