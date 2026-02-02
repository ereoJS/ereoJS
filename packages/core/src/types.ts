/**
 * @oreo/core - Core type definitions
 *
 * Central type definitions for the Oreo framework.
 * Uses Web Standards (Request/Response) throughout.
 */

import type { ReactElement, ComponentType } from 'react';

// ============================================================================
// Configuration Types
// ============================================================================

export type BuildTarget = 'bun' | 'cloudflare' | 'node' | 'deno';

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
}

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
}

export interface RouteModule {
  default?: ComponentType<RouteComponentProps>;
  loader?: LoaderFunction;
  action?: ActionFunction;
  meta?: MetaFunction;
  headers?: HeadersFunction;
  handle?: RouteHandle;
  ErrorBoundary?: ComponentType<ErrorBoundaryProps>;
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
 * declare module '@oreo/core' {
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
