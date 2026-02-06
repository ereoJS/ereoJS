/**
 * @ereo/data
 *
 * Data loading and caching for the EreoJS framework.
 * One pattern, not four - simple and explicit.
 */

// Loader
export {
  createLoader,
  defer,
  isDeferred,
  resolveDeferred,
  hasDeferredData,
  resolveAllDeferred,
  fetchData,
  FetchError,
  serializeLoaderData,
  parseLoaderData,
  combineLoaders,
  clientLoader,
} from './loader';

export type { LoaderOptions, DeferredData } from './loader';

// Action
export {
  createAction,
  action,
  typedAction,
  jsonAction,
  parseRequestBody,
  formDataToObject,
  coerceValue,
  redirect,
  throwRedirect,
  json,
  data,
  error,
  parseFormData,
  validateRequired,
  combineValidators,
} from './action';

export type {
  ActionOptions,
  TypedActionOptions,
  TypedActionArgs,
  ActionBody,
  ValidationResult,
  ActionResult,
} from './action';

// Cache
export {
  MemoryCache,
  getCache,
  setCache,
  cached,
  generateCacheKey,
  cacheKey,
  buildCacheControl,
  parseCacheControl,
  Cached,
  createDataCacheAdapter,
} from './cache';

export type { CacheEntry, CacheStorage } from './cache';

// Revalidation
export {
  revalidateTag,
  revalidatePath,
  revalidate,
  unstable_cache,
  createRevalidationHandler,
  tags,
  onDemandRevalidate,
} from './revalidate';

export type { RevalidateOptions, RevalidateResult } from './revalidate';

// Data Pipeline (auto-parallelization)
export {
  createPipeline,
  dataSource,
  cachedSource,
  optionalSource,
  combinePipelines,
  formatMetrics,
  generateMetricsVisualization,
} from './pipeline';

export type {
  DataSource,
  PipelineConfig,
  PipelineResult,
  PipelineMetrics,
  LoaderMetrics,
  ExecutionStep,
  WaterfallInfo,
} from './pipeline';

// Route Definition Builder (stable type inference)
export {
  defineRoute,
} from './define-route';

export type {
  RouteBuilder,
  RouteBuilderWithLoader,
  RouteBuilderWithLoaderAndAction,
  RouteDefinition,
  TypedLoaderArgs,
  TypedActionArgs as RouteTypedActionArgs,
  HeadArgs,
  HeadData,
  TypedMetaArgs,
  RouteMiddleware,
  ValidationSchema,
  InferLoaderData as InferRouteLoaderData,
  InferActionData as InferRouteActionData,
  InferRouteParams,
  InferRoutePath,
} from './define-route';

// Schema Adapters (Zod type alignment)
export {
  ereoSchema,
  isEreoSchema,
  createPaginationParser,
  createSortParser,
  createFilterParser,
  parseBoolean,
  parseStringArray,
  parseDate,
  parseEnum,
  schemaBuilder,
} from './schema-adapters';

export type {
  EreoSchema,
  ZodLikeSchema,
  ValidationError,
  InferSchemaOutput,
  InferSchemaInput,
  PaginationParams,
  PaginationSchemaOptions,
  SortParams,
  FilterParams,
} from './schema-adapters';
