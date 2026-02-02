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

// Types
export type {
  // Configuration
  BuildTarget,
  ServerConfig,
  BuildConfig,
  FrameworkConfig,

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
