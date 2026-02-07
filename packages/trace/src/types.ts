/**
 * @ereo/trace - Core type definitions
 *
 * All interfaces and types for the tracing system.
 */

/** 16-byte hex trace identifier */
export type TraceId = string;

/** 8-byte hex span identifier */
export type SpanId = string;

/** The framework layer a span belongs to */
export type SpanLayer =
  | 'request'
  | 'routing'
  | 'data'
  | 'forms'
  | 'signals'
  | 'rpc'
  | 'database'
  | 'auth'
  | 'islands'
  | 'build'
  | 'errors'
  | 'custom';

/** Final status of a span */
export type SpanStatus = 'ok' | 'error' | 'timeout';

/** A timestamped event within a span */
export interface SpanEvent {
  name: string;
  time: number;
  attributes?: Record<string, string | number | boolean>;
}

/** Completed span data (immutable after end()) */
export interface SpanData {
  id: SpanId;
  traceId: TraceId;
  parentId: SpanId | null;
  name: string;
  layer: SpanLayer;
  status: SpanStatus;
  startTime: number;
  endTime: number;
  duration: number;
  attributes: Record<string, string | number | boolean>;
  events: SpanEvent[];
  children: SpanId[];
}

/** Origin of a trace (server or client) */
export type TraceOrigin = 'server' | 'client';

/** Metadata about a trace */
export interface TraceMetadata {
  origin: TraceOrigin;
  method?: string;
  pathname?: string;
  statusCode?: number;
  routePattern?: string;
}

/** A complete trace with all its spans */
export interface TraceData {
  id: TraceId;
  rootSpanId: SpanId;
  startTime: number;
  endTime: number;
  duration: number;
  spans: Map<SpanId, SpanData>;
  metadata: TraceMetadata;
}

/** Active span handle for recording data */
export interface Span {
  /** The span's unique ID */
  readonly id: SpanId;
  /** The trace this span belongs to */
  readonly traceId: TraceId;
  /** Set an attribute on the span */
  setAttribute(key: string, value: string | number | boolean): void;
  /** Record a timestamped event */
  event(name: string, attributes?: Record<string, string | number | boolean>): void;
  /** End the span (records end time) */
  end(): void;
  /** Record an error and set status to 'error' */
  error(err: unknown): void;
  /** Create a child span */
  child(name: string, layer: SpanLayer): Span;
}

/** Tracer interface for creating and managing traces */
export interface Tracer {
  /** Start a new trace with a root span */
  startTrace(name: string, layer: SpanLayer, metadata?: Partial<TraceMetadata>): Span;
  /** Start a new span as a child of the current active span */
  startSpan(name: string, layer: SpanLayer): Span;
  /** Get the currently active span, if any */
  activeSpan(): Span | null;
  /** Execute a function within a span, automatically ending it on completion */
  withSpan<T>(name: string, layer: SpanLayer, fn: (span: Span) => T | Promise<T>): T | Promise<T>;
  /** Get all stored traces */
  getTraces(): TraceData[];
  /** Get a single trace by ID */
  getTrace(id: TraceId): TraceData | undefined;
  /** Subscribe to trace events */
  subscribe(cb: (event: TraceStreamEvent) => void): () => void;
  /** Merge client-side spans into an existing completed trace */
  mergeClientSpans(traceId: TraceId, spans: SpanData[]): void;
}

/** Events emitted by the tracer for live streaming */
export type TraceStreamEvent =
  | { type: 'trace:start'; trace: TraceData }
  | { type: 'trace:end'; trace: TraceData }
  | { type: 'span:start'; span: SpanData }
  | { type: 'span:end'; span: SpanData }
  | { type: 'span:event'; spanId: SpanId; event: SpanEvent };

/** Configuration for the tracer */
export interface TracerConfig {
  /** Maximum number of completed traces to store (default: 200) */
  maxTraces?: number;
  /** Maximum spans per trace before capping (default: 500) */
  maxSpansPerTrace?: number;
  /** Layers to instrument (default: all) */
  layers?: SpanLayer[];
  /** Minimum duration (ms) to record (default: 0) */
  minDuration?: number;
}
