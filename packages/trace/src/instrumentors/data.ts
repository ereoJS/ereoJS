/**
 * @ereo/trace - Data / Caching Instrumentor (Layer 3)
 *
 * Creates child span per loader in pipeline.
 * Records: loader key, duration, cacheHit, source, waitingFor.
 * Leverages existing PipelineMetrics/LoaderMetrics.
 */

import type { Span } from '../types';

/** Loader execution info for tracing */
export interface LoaderTraceInfo {
  key: string;
  duration: number;
  cacheHit?: boolean;
  source?: string;
  waitingFor?: string[];
  error?: string;
}

/**
 * Trace a single loader execution.
 */
export function traceLoader<T>(
  parentSpan: Span,
  loaderKey: string,
  loaderFn: () => T | Promise<T>,
): T | Promise<T> {
  const span = parentSpan.child(`loader:${loaderKey}`, 'data');
  span.setAttribute('loader.key', loaderKey);

  try {
    const result = loaderFn();
    if (result instanceof Promise) {
      return result
        .then((v) => {
          span.end();
          return v;
        })
        .catch((err) => {
          span.error(err);
          span.end();
          throw err;
        });
    }
    span.end();
    return result;
  } catch (err) {
    span.error(err);
    span.end();
    throw err;
  }
}

/**
 * Record loader metrics from existing PipelineMetrics onto the trace.
 * Call after pipeline.execute() completes.
 */
export function recordLoaderMetrics(
  parentSpan: Span,
  metrics: LoaderTraceInfo[],
): void {
  for (const metric of metrics) {
    const span = parentSpan.child(`loader:${metric.key}`, 'data');
    span.setAttribute('loader.key', metric.key);
    span.setAttribute('loader.duration_ms', metric.duration);

    if (metric.cacheHit !== undefined) {
      span.setAttribute('cache.hit', metric.cacheHit);
    }
    if (metric.source) {
      span.setAttribute('loader.source', metric.source);
    }
    if (metric.waitingFor && metric.waitingFor.length > 0) {
      span.setAttribute('loader.waiting_for', metric.waitingFor.join(', '));
    }
    if (metric.error) {
      span.setAttribute('error.message', metric.error);
    }
    span.end();
  }
}

/**
 * Trace a cache operation (hit/miss/set).
 */
export function traceCacheOperation(
  parentSpan: Span,
  operation: 'get' | 'set' | 'invalidate',
  key: string,
  hit?: boolean,
): void {
  parentSpan.event(`cache.${operation}`, {
    key: key.length > 100 ? key.slice(0, 100) + '...' : key,
    ...(hit !== undefined ? { hit } : {}),
  });
}
