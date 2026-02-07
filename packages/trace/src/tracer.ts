/**
 * @ereo/trace - Core Tracer
 *
 * Creates and manages traces + spans. Stores completed traces in a ring buffer.
 * Emits events for live streaming to CLI/DevTools.
 */

import type {
  Span,
  SpanData,
  SpanEvent,
  SpanId,
  SpanLayer,
  TraceData,
  TraceId,
  TraceMetadata,
  TraceStreamEvent,
  Tracer,
  TracerConfig,
} from './types';
import { SpanImpl, generateTraceId } from './span';
import { RingBuffer } from './ring-buffer';

/** Active trace being recorded */
interface ActiveTrace {
  id: TraceId;
  rootSpanId: SpanId;
  startTime: number;
  spans: Map<SpanId, SpanData>;
  metadata: TraceMetadata;
  activeSpanCount: number;
}

/**
 * Core tracer implementation.
 *
 * Span stacks are per-trace to prevent cross-trace corruption when
 * multiple requests are active concurrently on the same tracer instance.
 * The primary instrumentation path (span.child()) always operates within
 * the correct trace via closures. The startSpan()/activeSpan() convenience
 * methods are best-effort and pick the most recently started trace.
 */
export class TracerImpl implements Tracer {
  private traces: RingBuffer<TraceData>;
  private activeTraces = new Map<TraceId, ActiveTrace>();
  private spanStacks = new Map<TraceId, SpanImpl[]>();
  private subscribers = new Set<(event: TraceStreamEvent) => void>();
  private config: Required<TracerConfig>;

  constructor(config: TracerConfig = {}) {
    this.config = {
      maxTraces: config.maxTraces ?? 200,
      maxSpansPerTrace: config.maxSpansPerTrace ?? 500,
      layers: config.layers ?? [],
      minDuration: config.minDuration ?? 0,
    };
    this.traces = new RingBuffer<TraceData>(this.config.maxTraces);
  }

  startTrace(name: string, layer: SpanLayer, metadata?: Partial<TraceMetadata>): Span {
    const traceId = generateTraceId();
    const span = this.createSpan(traceId, null, name, layer);

    const activeTrace: ActiveTrace = {
      id: traceId,
      rootSpanId: span.id,
      startTime: performance.now(),
      spans: new Map(),
      metadata: {
        origin: 'server',
        ...metadata,
      },
      activeSpanCount: 1,
    };

    this.activeTraces.set(traceId, activeTrace);
    this.spanStacks.set(traceId, [span]);

    // Emit trace:start
    const traceData = this.buildTraceData(activeTrace);
    this.emit({ type: 'trace:start', trace: traceData });

    return span;
  }

  startSpan(name: string, layer: SpanLayer): Span {
    const parentSpan = this.findActiveSpan();
    if (!parentSpan) {
      // No active trace, create an orphan trace
      return this.startTrace(name, layer);
    }

    const traceId = parentSpan.traceId;
    const activeTrace = this.activeTraces.get(traceId);
    if (activeTrace) activeTrace.activeSpanCount++;

    const span = this.createSpan(traceId, parentSpan.id, name, layer);
    const stack = this.spanStacks.get(traceId);
    if (stack) stack.push(span);
    return span;
  }

  activeSpan(): Span | null {
    return this.findActiveSpan();
  }

  withSpan<T>(name: string, layer: SpanLayer, fn: (span: Span) => T | Promise<T>): T | Promise<T> {
    const span = this.startSpan(name, layer);
    try {
      const result = fn(span);
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

  getTraces(): TraceData[] {
    return this.traces.toArray();
  }

  getTrace(id: TraceId): TraceData | undefined {
    return this.traces.get(id);
  }

  subscribe(cb: (event: TraceStreamEvent) => void): () => void {
    this.subscribers.add(cb);
    return () => {
      this.subscribers.delete(cb);
    };
  }

  /** Merge client spans into an existing trace */
  mergeClientSpans(traceId: TraceId, spans: SpanData[]): void {
    const trace = this.traces.get(traceId);
    if (!trace) return;

    for (const span of spans) {
      if (trace.spans.size >= this.config.maxSpansPerTrace) break;
      trace.spans.set(span.id, span);
    }

    // Update trace end time if needed
    for (const span of spans) {
      if (span.endTime > trace.endTime) {
        trace.endTime = span.endTime;
        trace.duration = trace.endTime - trace.startTime;
      }
    }
  }

  /** Find the active span from the most recently started trace's stack */
  private findActiveSpan(): SpanImpl | null {
    let latest: SpanImpl | null = null;
    for (const stack of this.spanStacks.values()) {
      const top = stack[stack.length - 1];
      if (top) latest = top;
    }
    return latest;
  }

  private createSpan(traceId: TraceId, parentId: SpanId | null, name: string, layer: SpanLayer): SpanImpl {
    const childFactory = (childName: string, childLayer: SpanLayer, pId: SpanId): Span => {
      const activeTrace = this.activeTraces.get(traceId);
      if (activeTrace) activeTrace.activeSpanCount++;
      const child = this.createSpan(traceId, pId, childName, childLayer);
      const stack = this.spanStacks.get(traceId);
      if (stack) stack.push(child);
      return child;
    };

    const onEnd = (span: SpanImpl) => {
      // Remove from per-trace stack
      const stack = this.spanStacks.get(traceId);
      if (stack) {
        const idx = stack.indexOf(span);
        if (idx !== -1) stack.splice(idx, 1);
      }

      const spanData = span.toData();
      const activeTrace = this.activeTraces.get(traceId);

      if (activeTrace) {
        if (activeTrace.spans.size < this.config.maxSpansPerTrace) {
          activeTrace.spans.set(spanData.id, spanData);
        }
        activeTrace.activeSpanCount--;

        this.emit({ type: 'span:end', span: spanData });

        // If all spans ended, finalize the trace
        if (activeTrace.activeSpanCount <= 0) {
          this.finalizeTrace(activeTrace);
        }
      }
    };

    const onEvent = (spanId: SpanId, event: SpanEvent) => {
      this.emit({ type: 'span:event', spanId, event });
    };

    const span = new SpanImpl(traceId, parentId, name, layer, onEnd, childFactory, onEvent);

    this.emit({ type: 'span:start', span: span.toData() });

    return span;
  }

  private finalizeTrace(active: ActiveTrace): void {
    this.activeTraces.delete(active.id);
    this.spanStacks.delete(active.id);

    let endTime = active.startTime;
    for (const span of active.spans.values()) {
      if (span.endTime > endTime) endTime = span.endTime;
    }

    const duration = endTime - active.startTime;

    // Apply minimum duration filter
    if (this.config.minDuration > 0 && duration < this.config.minDuration) {
      return;
    }

    const traceData: TraceData = {
      id: active.id,
      rootSpanId: active.rootSpanId,
      startTime: active.startTime,
      endTime,
      duration,
      spans: active.spans,
      metadata: active.metadata,
    };

    this.traces.push(traceData);
    this.emit({ type: 'trace:end', trace: traceData });
  }

  private buildTraceData(active: ActiveTrace): TraceData {
    return {
      id: active.id,
      rootSpanId: active.rootSpanId,
      startTime: active.startTime,
      endTime: 0,
      duration: 0,
      spans: active.spans,
      metadata: active.metadata,
    };
  }

  private emit(event: TraceStreamEvent): void {
    for (const cb of this.subscribers) {
      try {
        cb(event);
      } catch {
        // Subscriber errors must not break tracing
      }
    }
  }
}

/** Create a new Tracer instance */
export function createTracer(config?: TracerConfig): Tracer {
  return new TracerImpl(config);
}
