/**
 * @oreo/data
 *
 * Data loading and caching for the Oreo framework.
 * One pattern, not four - simple and explicit.
 */

// Loader
export {
  createLoader,
  defer,
  isDeferred,
  resolveDeferred,
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
  json,
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
