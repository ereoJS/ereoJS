/**
 * @ereo/trace - Routing Instrumentor (Layer 2)
 *
 * Creates child span for route matching.
 * Records: matched route pattern, params, layout chain, 404 misses.
 */

import type { Span } from '../types';

/**
 * Trace a route match operation.
 * Call this wrapping the matchWithLayouts() call in BunServer.handleRequest().
 */
export function traceRouteMatch<T>(
  parentSpan: Span,
  matchFn: () => T,
): T {
  const span = parentSpan.child('route.match', 'routing');
  try {
    const result = matchFn();
    if (result && typeof result === 'object' && 'route' in result) {
      const match = result as unknown as { route: { id: string; path: string }; params: Record<string, unknown>; layouts?: unknown[] };
      span.setAttribute('route.pattern', match.route.path);
      span.setAttribute('route.id', match.route.id);
      span.setAttribute('route.params', JSON.stringify(match.params));
      if (match.layouts) {
        span.setAttribute('route.layouts', (match.layouts as { id: string }[]).map((l) => l.id).join(' > '));
      }
    } else {
      span.setAttribute('route.matched', false);
      span.event('404', { pathname: 'unknown' });
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
 * Record route match details on the parent span after matching.
 * Lighter-weight alternative when you don't want to wrap matchWithLayouts().
 */
export function recordRouteMatch(
  parentSpan: Span,
  match: { route: { id: string; path: string }; params: Record<string, unknown> } | null,
): void {
  if (match) {
    parentSpan.setAttribute('route.pattern', match.route.path);
    parentSpan.setAttribute('route.id', match.route.id);
    parentSpan.event('route.matched', { pattern: match.route.path });
  } else {
    parentSpan.event('route.miss');
  }
}
