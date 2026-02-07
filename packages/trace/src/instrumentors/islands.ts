/**
 * @ereo/trace - Islands / Hydration Instrumentor (Layer 9)
 *
 * Client-side span per island hydration.
 * Records: component name, strategy, hydration duration, props size.
 */

import type { Span } from '../types';

export type HydrationStrategy = 'load' | 'idle' | 'visible' | 'media' | 'none';

/**
 * Trace an island hydration.
 */
export function traceHydration<T>(
  parentSpan: Span,
  componentName: string,
  strategy: HydrationStrategy,
  hydrateFn: () => T | Promise<T>,
  attrs?: { propsSize?: number },
): T | Promise<T> {
  const span = parentSpan.child(`hydrate:${componentName}`, 'islands');
  span.setAttribute('island.component', componentName);
  span.setAttribute('island.strategy', strategy);
  if (attrs?.propsSize) span.setAttribute('island.props_size', attrs.propsSize);

  try {
    const result = hydrateFn();
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
 * Record hydration timing event (lighter-weight than full span).
 */
export function recordHydration(
  parentSpan: Span,
  componentName: string,
  strategy: HydrationStrategy,
  durationMs: number,
): void {
  parentSpan.event('island.hydrated', {
    component: componentName,
    strategy,
    duration_ms: durationMs,
  });
}
