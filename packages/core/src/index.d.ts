/**
 * @areo/core
 *
 * Core framework package providing the application container,
 * request context, plugin system, and type definitions.
 */
export { createApp, defineConfig, AreoApp, isAreoApp } from './app';
export { createContext, RequestContext, isRequestContext, attachContext, getContext, } from './context';
export { PluginRegistry, definePlugin, composePlugins, securityHeadersPlugin, isPlugin, } from './plugin';
export { env, parseEnvFile, loadEnvFiles, validateEnv, initializeEnv, getEnv, requireEnv, getAllEnv, getPublicEnv, setupEnv, generateEnvTypes, typedEnv, } from './env';
export type { EnvType, EnvSchema, EnvSchemaBuilder, ParsedEnv, EnvValidationResult, EnvValidationError, EnvConfig, EnvTypes, } from './env';
export type { BuildTarget, ServerConfig, BuildConfig, FrameworkConfig, MiddlewareReference, RenderMode, PrerenderConfig, StreamingConfig, CSRConfig, RenderConfig, IslandStrategy, IslandsConfig, RouteCacheConfig, ProgressiveConfig, RouteCompositionConfig, AuthConfig, DevConfig, RouteVariant, RouteConfig, RouteModuleWithConfig, ParamValidationSchema, SearchParamValidationSchema, ParamValidator, Plugin, PluginContext, DevServer, Route, RouteParams, RouteMatch, RouteModule, RouteHandle, LoaderArgs, ActionArgs, LoaderFunction, ActionFunction, LoaderData, MetaArgs, MetaDescriptor, MetaFunction, HeadersArgs, HeadersFunction, RouteComponentProps, ErrorBoundaryProps, NextFunction, MiddlewareHandler, Middleware, CacheOptions, CacheControl, AppContext, Application, ApplicationOptions, HydrationStrategy, IslandProps, MaybePromise, DeepPartial, InferLoaderData, InferActionData, RouteTypes, TypedRoutes, RouteParamsFor, LoaderDataFor, } from './types';
//# sourceMappingURL=index.d.ts.map