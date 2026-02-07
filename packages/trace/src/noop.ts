/**
 * @ereo/trace/noop - No-op Tracer
 *
 * Zero-cost tracer for production builds. All methods are empty.
 * Import as `@ereo/trace/noop` and alias during production builds
 * for complete tree-shaking.
 */

import type { Span, SpanData, SpanLayer, TraceData, TraceId, TraceMetadata, TraceStreamEvent, Tracer } from './types';

const NOOP_SPAN: Span = {
  id: '',
  traceId: '',
  setAttribute() {},
  event() {},
  end() {},
  error() {},
  child(): Span {
    return NOOP_SPAN;
  },
};

class NoopTracer implements Tracer {
  startTrace(): Span {
    return NOOP_SPAN;
  }
  startSpan(): Span {
    return NOOP_SPAN;
  }
  activeSpan(): Span | null {
    return null;
  }
  withSpan<T>(_name: string, _layer: SpanLayer, fn: (span: Span) => T | Promise<T>): T | Promise<T> {
    return fn(NOOP_SPAN);
  }
  getTraces(): TraceData[] {
    return [];
  }
  getTrace(): TraceData | undefined {
    return undefined;
  }
  subscribe(): () => void {
    return () => {};
  }
  mergeClientSpans(): void {}
}

/** Singleton no-op tracer instance */
export const noopTracer: Tracer = new NoopTracer();

/** No-op span for direct usage */
export const noopSpan: Span = NOOP_SPAN;

export { NoopTracer };
