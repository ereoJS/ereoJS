/**
 * @areo/data
 *
 * Data loading and caching for the Areo framework.
 * One pattern, not four - simple and explicit.
 */
export { createLoader, defer, isDeferred, resolveDeferred, fetchData, FetchError, serializeLoaderData, parseLoaderData, combineLoaders, clientLoader, } from './loader';
export type { LoaderOptions, DeferredData } from './loader';
export { createAction, action, typedAction, jsonAction, parseRequestBody, formDataToObject, coerceValue, redirect, json, error, parseFormData, validateRequired, combineValidators, } from './action';
export type { ActionOptions, TypedActionOptions, TypedActionArgs, ActionBody, ValidationResult, ActionResult, } from './action';
export { MemoryCache, getCache, setCache, cached, generateCacheKey, cacheKey, buildCacheControl, parseCacheControl, Cached, } from './cache';
export type { CacheEntry, CacheStorage } from './cache';
export { revalidateTag, revalidatePath, revalidate, unstable_cache, createRevalidationHandler, tags, onDemandRevalidate, } from './revalidate';
export type { RevalidateOptions, RevalidateResult } from './revalidate';
export { createPipeline, dataSource, cachedSource, optionalSource, combinePipelines, formatMetrics, generateMetricsVisualization, } from './pipeline';
export type { DataSource, PipelineConfig, PipelineResult, PipelineMetrics, LoaderMetrics, ExecutionStep, WaterfallInfo, } from './pipeline';
//# sourceMappingURL=index.d.ts.map