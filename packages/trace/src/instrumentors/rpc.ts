/**
 * @ereo/trace - RPC Instrumentor (Layer 6)
 *
 * Creates child span per procedure call.
 * Records: procedure path, type (query/mutation), input validation time, handler time, error code.
 */

import type { Span } from '../types';

/**
 * Trace an RPC procedure call.
 */
export function traceRPCCall<T>(
  parentSpan: Span,
  procedure: string,
  type: 'query' | 'mutation' | 'subscription',
  callFn: () => T | Promise<T>,
): T | Promise<T> {
  const span = parentSpan.child(`rpc:${procedure}`, 'rpc');
  span.setAttribute('rpc.procedure', procedure);
  span.setAttribute('rpc.type', type);

  try {
    const result = callFn();
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
 * Record RPC validation timing.
 */
export function recordRPCValidation(
  parentSpan: Span,
  procedure: string,
  validationMs: number,
  valid: boolean,
): void {
  parentSpan.event('rpc.validation', {
    procedure,
    duration_ms: validationMs,
    valid,
  });
}
