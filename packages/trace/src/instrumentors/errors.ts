/**
 * @ereo/trace - Error Instrumentor (Layer 11)
 *
 * Captures errors on the active span.
 * Records: error message, stack (truncated), error class, phase.
 */

import type { Span } from '../types';

export type ErrorPhase = 'middleware' | 'loader' | 'action' | 'render' | 'rpc' | 'unknown';

/**
 * Record an error event on the active span.
 */
export function traceError(
  span: Span,
  err: unknown,
  phase: ErrorPhase = 'unknown',
): void {
  span.error(err);
  span.setAttribute('error.phase', phase);

  if (err instanceof Error) {
    span.setAttribute('error.class', err.constructor.name);
    span.event('error', {
      message: err.message,
      class: err.constructor.name,
      phase,
    });
  }
}

/**
 * Wrap an async function and capture errors on the span.
 */
export function withErrorCapture<T>(
  span: Span,
  phase: ErrorPhase,
  fn: () => T | Promise<T>,
): T | Promise<T> {
  try {
    const result = fn();
    if (result instanceof Promise) {
      return result.catch((err) => {
        traceError(span, err, phase);
        throw err;
      });
    }
    return result;
  } catch (err) {
    traceError(span, err, phase);
    throw err;
  }
}
