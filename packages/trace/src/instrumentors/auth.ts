/**
 * @ereo/trace - Auth Instrumentor (Layer 8)
 *
 * Creates child span for auth checks.
 * Records: provider, success/fail, role check result, redirect target.
 */

import type { Span } from '../types';

/**
 * Trace an auth check operation.
 */
export function traceAuthCheck<T>(
  parentSpan: Span,
  operation: 'requireAuth' | 'optionalAuth' | 'requireRoles' | 'custom',
  checkFn: () => T | Promise<T>,
  attrs?: { provider?: string; roles?: string[] },
): T | Promise<T> {
  const span = parentSpan.child(`auth:${operation}`, 'auth');
  span.setAttribute('auth.operation', operation);
  if (attrs?.provider) span.setAttribute('auth.provider', attrs.provider);
  if (attrs?.roles) span.setAttribute('auth.roles', attrs.roles.join(', '));

  try {
    const result = checkFn();
    if (result instanceof Promise) {
      return result
        .then((v) => {
          span.setAttribute('auth.result', 'ok');
          span.end();
          return v;
        })
        .catch((err) => {
          span.setAttribute('auth.result', 'denied');
          if (err instanceof Response) {
            const location = err.headers.get('Location');
            if (location) span.setAttribute('auth.redirect', location);
          }
          span.error(err);
          span.end();
          throw err;
        });
    }
    span.setAttribute('auth.result', 'ok');
    span.end();
    return result;
  } catch (err) {
    span.setAttribute('auth.result', 'denied');
    span.error(err);
    span.end();
    throw err;
  }
}
