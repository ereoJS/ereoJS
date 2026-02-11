/**
 * @ereo/trace/noop - No-op Tracer
 *
 * Zero-cost tracer for production builds. All methods are empty.
 * Import as `@ereo/trace/noop` and alias during production builds
 * for complete tree-shaking.
 *
 * Exports the same named functions as `@ereo/trace` so it can be
 * used as a drop-in alias: `{ '@ereo/trace': '@ereo/trace/noop' }`.
 */

import type { Span, SpanLayer, TraceData, TraceStreamEvent, Tracer } from './types';

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

// ── Drop-in replacement exports ──────────────────────────────────
// These mirror the main `@ereo/trace` exports so bundler aliasing works:
//   alias: { '@ereo/trace': '@ereo/trace/noop' }

/** Returns the singleton noopTracer */
export function createTracer(): Tracer {
  return noopTracer;
}

/** No-op middleware — calls next() immediately */
export function traceMiddleware(_tracer: Tracer) {
  return (_ctx: any, next: () => any) => next();
}

/** No-op CLI reporter — does nothing */
export function createCLIReporter(_tracer: Tracer, _opts?: any): () => void {
  return () => {};
}

/** No-op viewer handler — returns empty HTML */
export function createViewerHandler(_tracer: Tracer) {
  return () => new Response('', { headers: { 'Content-Type': 'text/html' } });
}

/** No-op traces API handler */
export function createTracesAPIHandler(_tracer: Tracer) {
  return () => new Response(JSON.stringify({ traces: [] }), { headers: { 'Content-Type': 'application/json' } });
}

/** No-op trace WebSocket */
export function createTraceWebSocket(_tracer: Tracer) {
  return {
    upgrade: () => false,
    websocket: { open() {}, close() {}, message() {} },
    close() {},
  };
}

// Context — no-op setters/getters
export function setTracer(_ctx: any, _tracer: Tracer): void {}
export function getTracer(_ctx: any): Tracer | null { return null; }
export function setActiveSpan(_ctx: any, _span: Span): void {}
export function getActiveSpan(_ctx: any): Span | null { return null; }

// Instrumentors — all pass-through
export function traceRouteMatch<T>(_span: any, fn: () => T): T { return fn(); }
export function recordRouteMatch(): void {}
export function traceLoader<T>(_span: any, _key: string, fn: () => T | Promise<T>): T | Promise<T> { return fn(); }
export function recordLoaderMetrics(): void {}
export function traceCacheOperation(): void {}
export function traceFormSubmit<T>(_span: any, fn: () => T | Promise<T>): T | Promise<T> { return fn(); }
export function recordFormValidation(): void {}
export function recordSignalUpdate(): void {}
export function recordSignalBatch(): void {}
export function traceRPCCall<T>(_span: any, _method: string, fn: () => T | Promise<T>): T | Promise<T> { return fn(); }
export function recordRPCValidation(): void {}
export function tracedAdapter<T extends Record<string, any>>(adapter: T): T { return adapter; }
export function traceQuery<T>(_span: any, _name: string, fn: () => T | Promise<T>): T | Promise<T> { return fn(); }
export function traceAuthCheck<T>(_span: any, fn: () => T | Promise<T>): T | Promise<T> { return fn(); }
export function traceHydration<T>(_span: any, fn: () => T | Promise<T>): T | Promise<T> { return fn(); }
export function recordHydration(): void {}
export function traceBuildStage<T>(_span: any, _name: string, fn: () => T | Promise<T>): T | Promise<T> { return fn(); }
export function traceBuild<T>(_tracer: any, _name: string, fn: () => T | Promise<T>): T | Promise<T> { return fn(); }
export function traceError(): void {}
export function withErrorCapture<T>(fn: () => T | Promise<T>): T | Promise<T> { return fn(); }

// Serialization — passthrough
export function serializeTrace(trace: any): any { return trace; }
export function deserializeTrace(data: any): any { return data; }
export function serializeEvent(event: any): any { return event; }
export function exportTracesHTML(): string { return ''; }
export function generateViewerHTML(): string { return ''; }
export function createCollector() { return { mergeClientSpans() {}, getUnifiedTrace() { return undefined; } }; }
