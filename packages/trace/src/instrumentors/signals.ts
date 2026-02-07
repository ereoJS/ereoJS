/**
 * @ereo/trace - Signals Instrumentor (Layer 5)
 *
 * Records signal update events (not spans) for dev mode.
 * Records: signal name, subscriber count, batch groups.
 */

import type { Span } from '../types';

/**
 * Record a signal update event on the active span.
 */
export function recordSignalUpdate(
  span: Span,
  name: string,
  attrs?: { subscriberCount?: number; batched?: boolean },
): void {
  span.event('signal.update', {
    name,
    ...(attrs?.subscriberCount !== undefined ? { subscribers: attrs.subscriberCount } : {}),
    ...(attrs?.batched !== undefined ? { batched: attrs.batched } : {}),
  });
}

/**
 * Record a batch of signal updates.
 */
export function recordSignalBatch(
  span: Span,
  signalNames: string[],
  attrs?: { subscriberCount?: number },
): void {
  span.event('signal.batch', {
    count: signalNames.length,
    signals: signalNames.join(', '),
    ...(attrs?.subscriberCount !== undefined ? { total_subscribers: attrs.subscriberCount } : {}),
  });
}
