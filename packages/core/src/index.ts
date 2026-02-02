/**
 * @areo/core
 *
 * Core framework package providing the application container,
 * request context, plugin system, and type definitions.
 */

// Application
export { createApp, defineConfig, AreoApp, isAreoApp } from './app';

// Context
export {
  createContext,
  RequestContext,
  isRequestContext,
  attachContext,
  getContext,
} from './context';

// Plugin System
export {
  PluginRegistry,
  definePlugin,
  composePlugins,
  securityHeadersPlugin,
  isPlugin,
} from './plugin';

// Environment Variables
export {
  env,
  parseEnvFile,
  loadEnvFiles,
  validateEnv,
  initializeEnv,
  getEnv,
  requireEnv,
  getAllEnv,
  getPublicEnv,
  setupEnv,
  generateEnvTypes,
  typedEnv,
} from './env';

// Unified Cache Interface
export {
  MemoryCacheAdapter,
  createCache,
  createTaggedCache,
  isTaggedCache,
  wrapCacheAdapter,
} from './cache';

export type {
  CacheAdapter,
  TaggedCache,
  CacheSetOptions,
  CacheOptions as CacheAdapterOptions,
} from './cache';

export type {
  EnvType,
  EnvSchema,
  EnvSchemaBuilder,
  ParsedEnv,
  EnvValidationResult,
  EnvValidationError,
  EnvConfig,
  EnvTypes,
} from './env';

// Types
export type {
  // Configuration
  BuildTarget,
  ServerConfig,
  BuildConfig,
  FrameworkConfig,

  // Route-Level Configuration (NEW)
  MiddlewareReference,
  RenderMode,
  PrerenderConfig,
  StreamingConfig,
  CSRConfig,
  RenderConfig,
  IslandStrategy,
  IslandsConfig,
  RouteCacheConfig,
  ProgressiveConfig,
  RouteCompositionConfig,
  AuthConfig,
  DevConfig,
  ErrorConfig,
  RuntimeConfig,
  RouteVariant,
  RouteConfig,
  RouteModuleWithConfig,
  ParamValidationSchema,
  SearchParamValidationSchema,
  ParamValidator,

  // Plugins
  Plugin,
  PluginContext,
  DevServer,

  // Routes
  Route,
  RouteParams,
  RouteMatch,
  RouteModule,
  RouteHandle,

  // Data Loading
  LoaderArgs,
  ActionArgs,
  LoaderFunction,
  ActionFunction,
  LoaderData,

  // Meta
  MetaArgs,
  MetaDescriptor,
  MetaFunction,

  // Headers
  HeadersArgs,
  HeadersFunction,

  // Components
  RouteComponentProps,
  RouteErrorComponentProps,
  /** @deprecated Use RouteErrorComponentProps instead */
  ErrorBoundaryProps,

  // Middleware
  NextFunction,
  MiddlewareHandler,
  Middleware,

  // Cache
  CacheOptions,
  CacheControl,

  // Context
  AppContext,

  // Application
  Application,
  ApplicationOptions,

  // Islands
  HydrationStrategy,
  IslandProps,

  // Utility Types
  MaybePromise,
  DeepPartial,
  InferLoaderData,
  InferActionData,

  // Type-safe Routing
  RouteTypes,
  TypedRoutes,
  RouteParamsFor,
  LoaderDataFor,
} from './types';
