/**
 * @oreo/core
 *
 * Core framework package providing the application container,
 * request context, plugin system, and type definitions.
 */

// Application
export { createApp, defineConfig, OreoApp, isOreoApp } from './app';

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
