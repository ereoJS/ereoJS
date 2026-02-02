/**
 * @areo/core - Core type definitions
 *
 * Central type definitions for the Areo framework.
 * Uses Web Standards (Request/Response) throughout.
 */

import type { ReactElement, ComponentType } from 'react';

// ============================================================================
// Configuration Types
// ============================================================================

export type BuildTarget = 'bun' | 'cloudflare' | 'node' | 'deno' | 'edge';

export interface ServerConfig {
  port?: number;
  hostname?: string;
  development?: boolean;
}

export interface BuildConfig {
  target?: BuildTarget;
  outDir?: string;
  minify?: boolean;
  sourcemap?: boolean;
}

export interface FrameworkConfig {
  server?: ServerConfig;
  build?: BuildConfig;
  plugins?: Plugin[];
  /** Base path for all routes (e.g., '/app') */
  basePath?: string;
  /** Directory containing routes (default: 'app/routes') */
  routesDir?: string;
}

// ============================================================================
// Plugin Types
// ============================================================================

export interface PluginContext {
  config: FrameworkConfig;
  mode: 'development' | 'production';
  root: string;
}

export interface Plugin {
  name: string;
  /** Called once when the plugin is registered */
  setup?: (context: PluginContext) => void | Promise<void>;
  /** Transform file contents during build */
  transform?: (code: string, id: string) => string | null | Promise<string | null>;
  /** Called when dev server starts */
  configureServer?: (server: DevServer) => void | Promise<void>;
  /** Add virtual modules */
  resolveId?: (id: string) => string | null;
  /** Load virtual modules */
  load?: (id: string) => string | null | Promise<string | null>;
  /** Build hooks */
  buildStart?: () => void | Promise<void>;
  buildEnd?: () => void | Promise<void>;
  // Extended hooks for deep integration
  /** Extend framework configuration */
  extendConfig?: (config: FrameworkConfig) => FrameworkConfig;
  /** Transform routes at build time */
  transformRoutes?: (routes: Route[]) => Route[];
  /** Add runtime middleware */
  runtimeMiddleware?: MiddlewareHandler[];
  /** Virtual modules map */
  virtualModules?: Record<string, string>;
}

export interface DevServer {
  /** WebSocket for HMR */
  ws: {
    send: (data: unknown) => void;
    on: (event: string, callback: (data: unknown) => void) => void;
  };
  /** Restart the server */
  restart: () => Promise<void>;
  /** Add middleware to the dev server */
  middlewares: MiddlewareHandler[];
  /** File watcher for development (optional) */
  watcher?: {
    add: (path: string) => void;
    on: (event: string, callback: (file: string) => void) => void;
  };
}

// ============================================================================
// Route-Level Configuration Types (Phase 1: Core Framework)
// ============================================================================

/** Middleware reference - can be a named middleware or inline function */
export type MiddlewareReference =
  | string  // Named middleware from app/middleware/
  | MiddlewareHandler;  // Inline middleware function

/** Render mode for a route */
export type RenderMode = 'ssg' | 'ssr' | 'csr' | 'json' | 'xml' | 'rsc';

/** Prerender/SSG configuration */
export interface PrerenderConfig {
  /** Enable static generation at build time */
  enabled: boolean;
  /** Static paths to pre-render. Can be array or function that returns paths */
  paths?: string[] | (() => Promise<string[]> | string[]);
  /** Revalidation period in seconds (ISR-style) */
  revalidate?: number;
  /** Cache tags for on-demand invalidation */
  tags?: string[] | ((params: RouteParams) => string[]);
  /** Fallback behavior for non-prerendered paths */
  fallback?: 'blocking' | 'static' | '404';
}

/** SSR streaming configuration */
export interface StreamingConfig {
  /** Enable streaming for this route */
  enabled: boolean;
  /** Named suspense boundaries that can stream independently */
  suspenseBoundaries?: string[];
}

/** Client-side rendering configuration */
export interface CSRConfig {
  /** Enable client-side only rendering */
  enabled: boolean;
  /** Client-side data loader (runs in browser) */
  clientLoader?: (params: RouteParams) => unknown | Promise<unknown>;
}

/** Complete render mode configuration */
export interface RenderConfig {
  /** Primary render mode */
  mode: RenderMode;
  /** SSG/ISR configuration */
  prerender?: PrerenderConfig;
  /** Streaming configuration for SSR */
  streaming?: StreamingConfig;
  /** CSR configuration */
  csr?: CSRConfig;
}

/** Island component hydration strategy */
export interface IslandStrategy {
  /** Component name or selector */
  component: string;
  /** Hydration strategy */
  strategy: HydrationStrategy;
  /** Media query (for 'media' strategy) */
  mediaQuery?: string;
}

/** Per-route island configuration */
export interface IslandsConfig {
  /** Default hydration strategy for this route's islands */
  defaultStrategy?: HydrationStrategy;
  /** Component-specific overrides */
  components?: IslandStrategy[];
  /** Disable all hydration for this route */
  disabled?: boolean;
}

/** Route-level cache configuration */
export interface RouteCacheConfig {
  /** Edge/CDN cache configuration */
  edge?: {
    maxAge: number;
    staleWhileRevalidate?: number;
    /** Vary on these request headers */
    vary?: string[];
    /** Generate custom cache key */
    keyGenerator?: (args: { request: Request; params: RouteParams }) => string;
  };
  /** Browser cache configuration */
  browser?: {
    maxAge: number;
    private?: boolean;
  };
  /** Data cache (framework-level) */
  data?: {
    /** Cache key or key generator */
    key?: string | ((params: RouteParams) => string);
    /** Cache tags for invalidation */
    tags?: string[] | ((params: RouteParams) => string[]);
  };
}

/** Progressive enhancement configuration */
export interface ProgressiveConfig {
  /** Form submission behavior without JS */
  forms?: {
    /** Fallback behavior: 'server' uses native form posts, 'spa' requires JS */
    fallback: 'server' | 'spa';
    /** How to handle redirects from form submissions */
    redirect?: 'follow' | 'manual';
  };
  /** Link prefetching configuration */
  prefetch?: {
    /** When to prefetch: hover, visible, intent (near viewport), or never */
    trigger: 'hover' | 'visible' | 'intent' | 'never';
    /** Also prefetch loader data */
    data?: boolean;
    /** Time to keep prefetched data (ms) */
    ttl?: number;
  };
}

/** Route composition/layout configuration */
export interface RouteCompositionConfig {
  /** Layout stack from root to leaf */
  layouts?: string[];
  /** Inherit settings from parent routes */
  inherit?: {
    /** Inherit middleware from parent */
    middleware?: boolean;
    /** Merge or replace parent meta */
    meta?: 'merge' | 'replace' | false;
  };
  /** Error boundary configuration */
  errorBoundary?: {
    /** Error boundary component */
    component?: ComponentType<ErrorBoundaryProps>;
    /** Which errors to capture */
    capture?: 'all' | 'loader' | 'render';
  };
  /** Loading state configuration */
  loading?: {
    /** Loading component/skeleton */
    component?: ComponentType;
    /** Delay before showing loading UI (ms) */
    delay?: number;
    /** Timeout before showing error (ms) */
    timeout?: number;
  };
}

/** Authentication/authorization configuration */
export interface AuthConfig {
  /** Whether authentication is required */
  required?: boolean;
  /** Required roles */
  roles?: string[];
  /** Required permissions */
  permissions?: string[];
  /** Custom auth check */
  check?: (args: { request: Request; context: AppContext; params: RouteParams }) => boolean | Promise<boolean>;
  /** Redirect URL for unauthenticated users (can use {pathname} placeholder) */
  redirect?: string;
  /** API response for unauthorized access */
  unauthorized?: {
    status: number;
    body: unknown;
  };
}

/** Development mode configuration */
export interface DevConfig {
  /** Mock data configuration */
  mock?: {
    /** Enable mocking */
    enabled: boolean;
    /** Mock data to inject */
    data?: Record<string, unknown>;
  };
  /** Artificial latency for testing (ms) */
  latency?: number;
  /** Error injection rate (0-1) */
  errorRate?: number;
}

/** Error recovery and resilience configuration */
export interface ErrorConfig {
  /** Retry failed loaders automatically */
  retry?: { count: number; delay: number };
  /** Fallback UI while loading */
  fallback?: ComponentType;
  /** Error boundary strategy */
  onError?: 'boundary' | 'toast' | 'redirect' | 'silent';
  /** Maximum error boundary captures */
  maxCaptures?: number;
  /** Error reporting handler */
  reportError?: (error: Error, context: { route: string; phase: string }) => void;
}

/** Runtime configuration for edge/Node environments */
export interface RuntimeConfig {
  /** Execution environment */
  runtime?: 'node' | 'edge' | 'auto';
  /** Region affinity */
  regions?: string[];
  /** Memory limit hint */
  memory?: number;
  /** Timeout in seconds */
  timeout?: number;
}

/** Route variant (multiple URL patterns for same file) */
export interface RouteVariant {
  /** URL path pattern */
  path: string;
  /** Parameter schema/validation */
  params?: Record<string, 'string' | 'number'>;
  /** Variant-specific config */
  config?: Partial<RouteConfig>;
}

/** Complete route-level configuration export */
export interface RouteConfig {
  /** Route middleware chain */
  middleware?: MiddlewareReference[];
  /** Render mode configuration */
  render?: RenderConfig;
  /** Island hydration strategy */
  islands?: IslandsConfig;
  /** Cache configuration */
  cache?: RouteCacheConfig;
  /** Progressive enhancement */
  progressive?: ProgressiveConfig;
  /** Route composition */
  route?: RouteCompositionConfig;
  /** Authentication */
  auth?: AuthConfig;
  /** Development settings */
  dev?: DevConfig;
  /** Error recovery */
  error?: ErrorConfig;
  /** Runtime configuration */
  runtime?: RuntimeConfig;
  /** Route variants (multiple URL patterns) */
  variants?: RouteVariant[];
}

/** Extended RouteModule with config export */
export interface RouteModuleWithConfig extends RouteModule {
  /** Route-level configuration */
  config?: RouteConfig;
}

// ============================================================================
// Validation Types
// ============================================================================

/** Parameter validation schema */
export interface ParamValidationSchema {
  [key: string]: ParamValidator<unknown>;
}

/** Search parameter validation schema */
export interface SearchParamValidationSchema {
  [key: string]: ParamValidator<unknown> | { default: unknown; validator?: ParamValidator<unknown> };
}

/** Parameter validator function or schema */
export type ParamValidator<T> = {
  parse: (value: string | string[] | undefined) => T;
  optional?: boolean;
  default?: T;
};

// ============================================================================
// Route Types
// ============================================================================

export interface RouteParams {
  [key: string]: string | string[] | undefined;
}

export interface RouteMatch {
  route: Route;
  params: RouteParams;
  pathname: string;
}

export interface Route {
  id: string;
  path: string;
  file: string;
  index?: boolean;
  layout?: boolean;
  children?: Route[];
  /** Loaded module */
  module?: RouteModule;
  /** Parsed route configuration from module */
  config?: RouteConfig;
}

export interface RouteModule {
  default?: ComponentType<RouteComponentProps>;
  loader?: LoaderFunction;
  action?: ActionFunction;
  meta?: MetaFunction;
  headers?: HeadersFunction;
  handle?: RouteHandle;
  ErrorBoundary?: ComponentType<ErrorBoundaryProps>;
  /** Route-level configuration export */
  config?: RouteConfig;
  /** Parameter validation schema */
  params?: ParamValidationSchema;
  /** Search parameter validation schema */
  searchParams?: SearchParamValidationSchema;
}

export interface RouteHandle {
  [key: string]: unknown;
}

// ============================================================================
// Data Loading Types
// ============================================================================

export interface LoaderArgs<P = RouteParams> {
  request: Request;
  params: P;
  context: AppContext;
}

export interface ActionArgs<P = RouteParams> {
  request: Request;
  params: P;
  context: AppContext;
}

export type LoaderFunction<T = unknown, P = RouteParams> = (
  args: LoaderArgs<P>
) => T | Promise<T>;

export type ActionFunction<T = unknown, P = RouteParams> = (
  args: ActionArgs<P>
) => T | Promise<T>;

export interface LoaderData<T = unknown> {
  data: T;
  headers?: Headers;
}

// ============================================================================
// Meta Types
// ============================================================================

export interface MetaArgs<T = unknown, P = RouteParams> {
  data: T;
  params: P;
  location: { pathname: string; search: string; hash: string };
}

export interface MetaDescriptor {
  title?: string;
  name?: string;
  property?: string;
  content?: string;
  charSet?: 'utf-8';
  [key: string]: string | undefined;
}

export type MetaFunction<T = unknown, P = RouteParams> = (
  args: MetaArgs<T, P>
) => MetaDescriptor[];

// ============================================================================
// Headers Types
// ============================================================================

export interface HeadersArgs {
  loaderHeaders: Headers;
  actionHeaders: Headers;
  parentHeaders: Headers;
}

export type HeadersFunction = (args: HeadersArgs) => Headers | HeadersInit;

// ============================================================================
// Component Types
// ============================================================================

export interface RouteComponentProps<T = unknown> {
  loaderData: T;
  params: RouteParams;
  children?: ReactElement;
}

export interface ErrorBoundaryProps {
  error: Error;
  params: RouteParams;
}

// ============================================================================
// Middleware Types
// ============================================================================

export type NextFunction = () => Promise<Response>;

export type MiddlewareHandler = (
  request: Request,
  context: AppContext,
  next: NextFunction
) => Response | Promise<Response>;

export interface Middleware {
  name?: string;
  handler: MiddlewareHandler;
  /** Path patterns to match (default: all paths) */
  paths?: string[];
}

// ============================================================================
// Cache Types
// ============================================================================

export interface CacheOptions {
  maxAge?: number;
  staleWhileRevalidate?: number;
  tags?: string[];
  private?: boolean;
}

export interface CacheControl {
  set: (options: CacheOptions) => void;
  get: () => CacheOptions | undefined;
  getTags: () => string[];
}

// ============================================================================
// Context Types
// ============================================================================

export interface AppContext {
  /** Request-specific cache control */
  cache: CacheControl;
  /** Get a value from context store */
  get: <T>(key: string) => T | undefined;
  /** Set a value in context store */
  set: <T>(key: string, value: T) => void;
  /** Response headers to be merged */
  responseHeaders: Headers;
  /** Current request URL info */
  url: URL;
  /** Environment variables (safe for server) */
  env: Record<string, string | undefined>;
}

// ============================================================================
// Application Types
// ============================================================================

export interface ApplicationOptions {
  config?: FrameworkConfig;
  routes?: Route[];
}

export interface Application {
  config: FrameworkConfig;
  routes: Route[];
  plugins: Plugin[];
  /** Handle an incoming request */
  handle: (request: Request) => Promise<Response>;
  /** Register a plugin */
  use: (plugin: Plugin) => Application;
  /** Start the development server */
  dev: () => Promise<void>;
  /** Build for production */
  build: () => Promise<void>;
  /** Start production server */
  start: () => Promise<void>;
}

// ============================================================================
// Island Types (for selective hydration)
// ============================================================================

export type HydrationStrategy =
  | 'load'      // Hydrate immediately on page load
  | 'idle'      // Hydrate when browser is idle
  | 'visible'   // Hydrate when element is visible
  | 'media'     // Hydrate when media query matches
  | 'none';     // Never hydrate (static only)

export interface IslandProps {
  /** Hydration strategy */
  'client:load'?: boolean;
  'client:idle'?: boolean;
  'client:visible'?: boolean;
  'client:media'?: string;
  /** Island identifier for hydration */
  'data-island'?: string;
}

// ============================================================================
// Utility Types
// ============================================================================

export type MaybePromise<T> = T | Promise<T>;

export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

/** Extract loader data type from a route module */
export type InferLoaderData<T extends RouteModule> =
  T['loader'] extends LoaderFunction<infer D> ? D : never;

/** Extract action data type from a route module */
export type InferActionData<T extends RouteModule> =
  T['action'] extends ActionFunction<infer D> ? D : never;

// ============================================================================
// Route Type Registry (for type-safe routing)
// ============================================================================

/**
 * Module augmentation target for route types.
 * Generated by the bundler during development.
 *
 * @example
 * declare module '@areo/core' {
 *   interface RouteTypes {
 *     '/blog/[slug]': {
 *       params: { slug: string };
 *       loader: { post: Post };
 *     };
 *   }
 * }
 */
export interface RouteTypes {}

export type TypedRoutes = keyof RouteTypes extends never
  ? string
  : keyof RouteTypes;

export type RouteParamsFor<T extends TypedRoutes> =
  T extends keyof RouteTypes
    ? RouteTypes[T] extends { params: infer P }
      ? P
      : RouteParams
    : RouteParams;

export type LoaderDataFor<T extends TypedRoutes> =
  T extends keyof RouteTypes
    ? RouteTypes[T] extends { loader: infer D }
      ? D
      : unknown
    : unknown;
