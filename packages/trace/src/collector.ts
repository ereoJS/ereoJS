/**
 * @ereo/trace - Collector
 *
 * Merges server + client spans into unified traces.
 * Client spans arrive via WebSocket with their traceId,
 * and are stitched into the corresponding server trace.
 */

import type { SpanData, TraceData, TraceId, Tracer } from './types';

/**
 * Collector that merges client-side spans into server traces.
 */
export class TraceCollector {
  constructor(private tracer: Tracer) {}

  /**
   * Merge client spans into an existing server trace.
   * Called when client spans arrive via WebSocket.
   */
  mergeClientSpans(traceId: TraceId, clientSpans: SpanData[]): void {
    this.tracer.mergeClientSpans(traceId, clientSpans);
  }

  /**
   * Get a unified trace with both server and client spans.
   */
  getUnifiedTrace(traceId: TraceId): TraceData | undefined {
    return this.tracer.getTrace(traceId);
  }
}

/**
 * Create a collector instance.
 */
export function createCollector(tracer: Tracer): TraceCollector {
  return new TraceCollector(tracer);
}
