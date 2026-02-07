/**
 * @ereo/trace - Instrumentors barrel export
 */

export { traceMiddleware, type TraceMiddlewareOptions } from './request';
export { traceRouteMatch, recordRouteMatch } from './routing';
export { traceLoader, recordLoaderMetrics, traceCacheOperation, type LoaderTraceInfo } from './data';
export { traceFormSubmit, recordFormValidation } from './forms';
export { recordSignalUpdate, recordSignalBatch } from './signals';
export { traceRPCCall, recordRPCValidation } from './rpc';
export { tracedAdapter, traceQuery, type TracedAdapterMethods } from './database';
export { traceAuthCheck } from './auth';
export { traceHydration, recordHydration } from './islands';
export { traceBuildStage, traceBuild } from './build';
export { traceError, withErrorCapture, type ErrorPhase } from './errors';
