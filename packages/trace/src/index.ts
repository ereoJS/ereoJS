/**
 * @ereo/trace - Full-stack developer observability for EreoJS
 *
 * Provides unified tracing across all 11 framework layers:
 * request, routing, data, forms, signals, rpc, database, auth, islands, build, errors.
 *
 * Usage:
 *   import { createTracer, traceMiddleware, createCLIReporter } from '@ereo/trace';
 *   const tracer = createTracer();
 *   server.use(traceMiddleware(tracer));
 *   createCLIReporter(tracer);
 */

// Core
export { createTracer, TracerImpl } from './tracer';
export { SpanImpl, generateSpanId, generateTraceId } from './span';
export { RingBuffer } from './ring-buffer';

// Context integration
export { setTracer, getTracer, setActiveSpan, getActiveSpan } from './context';

// No-op (for production builds)
export { noopTracer, noopSpan, NoopTracer } from './noop';

// CLI Reporter
export { createCLIReporter, type CLIReporterOptions } from './cli-reporter';

// Transport
export {
  createTraceWebSocket,
  createTracesAPIHandler,
  serializeTrace,
  deserializeTrace,
  type SerializedTraceData,
  type SerializedTraceStreamEvent,
} from './transport';

// Collector
export { createCollector, TraceCollector } from './collector';

// Viewer
export { createViewerHandler, exportTracesHTML, generateViewerHTML } from './viewer';

// All instrumentors
export {
  traceMiddleware,
  type TraceMiddlewareOptions,
  traceRouteMatch,
  recordRouteMatch,
  traceLoader,
  recordLoaderMetrics,
  traceCacheOperation,
  type LoaderTraceInfo,
  traceFormSubmit,
  recordFormValidation,
  recordSignalUpdate,
  recordSignalBatch,
  traceRPCCall,
  recordRPCValidation,
  tracedAdapter,
  traceQuery,
  type TracedAdapterMethods,
  traceAuthCheck,
  traceHydration,
  recordHydration,
  traceBuildStage,
  traceBuild,
  traceError,
  withErrorCapture,
  type ErrorPhase,
} from './instrumentors';

// Types
export type {
  TraceId,
  SpanId,
  SpanLayer,
  SpanStatus,
  SpanEvent,
  SpanData,
  TraceOrigin,
  TraceMetadata,
  TraceData,
  Span,
  Tracer,
  TraceStreamEvent,
  TracerConfig,
} from './types';
