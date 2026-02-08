/**
 * @ereo/core - Core type definitions
 *
 * Central type definitions for the EreoJS framework.
 * Uses Web Standards (Request/Response) throughout.
 */

import type { ReactElement, ComponentType } from 'react';
import type { EnvConfig } from './env';

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
  /** Environment variable validation schema */
  env?: EnvConfig;
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
  /** Client-side loader — runs in the browser before/instead of fetching from server */
  clientLoader?: ClientLoaderFunction;
  /** Client-side action — runs in the browser before/instead of posting to server */
  clientAction?: ClientActionFunction;
  meta?: MetaFunction;
  headers?: HeadersFunction;
  /** Per-route link descriptors for CSS/assets injected into <head> */
  links?: LinksFunction;
  handle?: RouteHandle;
  /**
   * Inline middleware exported directly from the route module.
   * Runs before the route's loader/action, after file-based middleware.
   */
  middleware?: MiddlewareHandler[];
  ErrorBoundary?: ComponentType<ErrorBoundaryProps>;
  /** Route-level configuration export */
  config?: RouteConfig;
  /** Parameter validation schema */
  params?: ParamValidationSchema;
  /** Search parameter validation schema */
  searchParams?: SearchParamValidationSchema;
  /**
   * Controls whether this route's loader should re-run after a navigation or mutation.
   * Return `true` to revalidate, `false` to skip.
   * If not exported, the framework defaults to always revalidating.
   */
  shouldRevalidate?: ShouldRevalidateFunction;

  // --- Method Handlers (API Routes) ---

  /** HTTP GET handler — takes precedence over loader when defined */
  GET?: MethodHandlerFunction;
  /** HTTP POST handler — takes precedence over action when defined */
  POST?: MethodHandlerFunction;
  /** HTTP PUT handler — takes precedence over action when defined */
  PUT?: MethodHandlerFunction;
  /** HTTP DELETE handler — takes precedence over action when defined */
  DELETE?: MethodHandlerFunction;
  /** HTTP PATCH handler — takes precedence over action when defined */
  PATCH?: MethodHandlerFunction;
  /** HTTP OPTIONS handler */
  OPTIONS?: MethodHandlerFunction;
  /** HTTP HEAD handler */
  HEAD?: MethodHandlerFunction;

  // --- Route Guards ---

  /** Runs before the loader; throw a Response to redirect or an Error to short-circuit */
  beforeLoad?: BeforeLoadFunction;

  // --- SSG ---

  /** Return an array of param objects for static generation at build time */
  generateStaticParams?: GenerateStaticParamsFunction;

  // --- Component Exports ---

  /** Fallback component shown while clientLoader.hydrate is running */
  HydrateFallback?: ComponentType;
  /** Component shown while the route is pending (navigation in progress) */
  PendingComponent?: ComponentType;
  /** Component shown when a notFound() is thrown from the route */
  NotFoundComponent?: ComponentType;
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
// Method Handler Types (API Routes)
// ============================================================================

/**
 * Handler for HTTP method exports (GET, POST, PUT, DELETE, PATCH, OPTIONS, HEAD).
 * When defined on a route module, takes precedence over loader/action.
 * May return a Response directly, or a value that will be JSON-serialized.
 */
export type MethodHandlerFunction<T = unknown, P = RouteParams> = (
  args: LoaderArgs<P>
) => T | Response | Promise<T | Response>;

// ============================================================================
// Route Guard Types
// ============================================================================

/**
 * Function that runs before the loader.
 * Throw a Response (e.g. redirect) or an Error to short-circuit the request.
 * Return void to allow the loader to proceed.
 */
export type BeforeLoadFunction<P = RouteParams> = (
  args: LoaderArgs<P>
) => void | Promise<void>;

// ============================================================================
// Static Generation Types
// ============================================================================

/**
 * Return an array of param objects for static page generation at build time.
 */
export type GenerateStaticParamsFunction<P = RouteParams> = () => P[] | Promise<P[]>;

// ============================================================================
// Revalidation Types
// ============================================================================

/**
 * Arguments passed to the `shouldRevalidate` function exported from route files.
 *
 * This function controls whether a route's loader should re-run after a navigation
 * or mutation. Without it, every loader on the page re-runs on every navigation,
 * which is wasteful for routes whose data hasn't changed.
 */
export interface ShouldRevalidateArgs {
  /** The URL being navigated away from */
  currentUrl: URL;
  /** The URL being navigated to */
  nextUrl: URL;
  /** Current route params */
  currentParams: RouteParams;
  /** Next route params */
  nextParams: RouteParams;
  /** The form method if this revalidation was triggered by an action (e.g., 'POST') */
  formMethod?: string;
  /** The form action URL if this revalidation was triggered by an action */
  formAction?: string;
  /** The form data if this revalidation was triggered by an action */
  formData?: FormData;
  /** The action result if this revalidation was triggered by an action */
  actionResult?: unknown;
  /** Whether the framework would revalidate by default (true in most cases) */
  defaultShouldRevalidate: boolean;
}

/**
 * Function exported from route files to control when a route's loader re-runs.
 *
 * Return `true` to revalidate (re-run the loader), `false` to skip.
 * If not exported, the framework defaults to always revalidating.
 *
 * @example
 * ```typescript
 * // Only revalidate when search params change
 * export function shouldRevalidate({ currentUrl, nextUrl }: ShouldRevalidateArgs) {
 *   return currentUrl.search !== nextUrl.search;
 * }
 *
 * // Skip revalidation for non-mutating navigations
 * export function shouldRevalidate({ formMethod, defaultShouldRevalidate }: ShouldRevalidateArgs) {
 *   if (!formMethod) return false; // Don't revalidate on GET navigations
 *   return defaultShouldRevalidate;
 * }
 * ```
 */
export type ShouldRevalidateFunction = (args: ShouldRevalidateArgs) => boolean;

// ============================================================================
// Client Loader / Client Action Types
// ============================================================================

/**
 * Arguments passed to a clientLoader function.
 * Runs in the browser. Can call the server loader via `serverLoader()`.
 */
export interface ClientLoaderArgs<P = RouteParams> {
  /** Route params */
  params: P;
  /** Current request URL (constructed from window.location) */
  request: Request;
  /** Call the server loader to get server data */
  serverLoader: <T = unknown>() => Promise<T>;
}

/**
 * Client-side loader function. Runs in the browser on client-side navigations.
 *
 * Use cases:
 * - Client-side caching (localStorage, IndexedDB)
 * - Optimistic data from local state
 * - Offline-first with fallback to server
 * - Skip server round-trip when data is already available
 *
 * @example
 * ```typescript
 * export const clientLoader: ClientLoaderFunction = async ({ serverLoader, params }) => {
 *   // Check cache first
 *   const cached = localStorage.getItem(`user-${params.id}`);
 *   if (cached) return JSON.parse(cached);
 *
 *   // Fall back to server
 *   const data = await serverLoader();
 *   localStorage.setItem(`user-${params.id}`, JSON.stringify(data));
 *   return data;
 * };
 * // Set hydrate to true to also run clientLoader on initial SSR hydration
 * clientLoader.hydrate = true;
 * ```
 */
export type ClientLoaderFunction<T = unknown, P = RouteParams> = ((
  args: ClientLoaderArgs<P>
) => T | Promise<T>) & {
  /**
   * If true, the clientLoader runs during initial hydration (after SSR).
   * Default is false — only runs on client-side navigations.
   */
  hydrate?: boolean;
};

/**
 * Arguments passed to a clientAction function.
 * Runs in the browser. Can call the server action via `serverAction()`.
 */
export interface ClientActionArgs<P = RouteParams> {
  /** Route params */
  params: P;
  /** The request (with form data) */
  request: Request;
  /** Call the server action to submit data */
  serverAction: <T = unknown>() => Promise<T>;
}

/**
 * Client-side action function. Runs in the browser on form submissions.
 *
 * Use cases:
 * - Optimistic UI updates
 * - Client-side validation before server round-trip
 * - Offline form queuing
 *
 * @example
 * ```typescript
 * export const clientAction: ClientActionFunction = async ({ request, serverAction }) => {
 *   const formData = await request.formData();
 *   // Optimistic update
 *   updateLocalState(formData);
 *   // Then send to server
 *   return serverAction();
 * };
 * ```
 */
export type ClientActionFunction<T = unknown, P = RouteParams> = (
  args: ClientActionArgs<P>
) => T | Promise<T>;

// ============================================================================
// Links Types
// ============================================================================

/**
 * A single link descriptor for injecting into <head>.
 * Supports stylesheets, preloads, prefetches, icons, and more.
 */
export interface LinkDescriptor {
  /** Relationship type (e.g., 'stylesheet', 'preload', 'prefetch', 'icon') */
  rel: string;
  /** URL of the resource */
  href: string;
  /** MIME type */
  type?: string;
  /** For preload: resource type (e.g., 'script', 'style', 'image', 'font') */
  as?: string;
  /** Cross-origin setting */
  crossOrigin?: 'anonymous' | 'use-credentials' | '';
  /** Media query for conditional loading */
  media?: string;
  /** Subresource integrity hash */
  integrity?: string;
  /** Image sizes (for rel="icon") */
  sizes?: string;
  /** Image srcSet (for rel="preload" as="image") */
  imageSrcSet?: string;
  /** Image sizes attribute */
  imageSizes?: string;
  /** Title (for alternate stylesheets) */
  title?: string;
  /** Additional attributes */
  [key: string]: string | undefined;
}

/**
 * Function exported from route files to declare per-route CSS and assets.
 * Links are injected into <head> when the route is active and removed on navigation.
 *
 * @example
 * ```typescript
 * export const links: LinksFunction = () => [
 *   { rel: 'stylesheet', href: '/styles/dashboard.css' },
 *   { rel: 'preload', href: '/fonts/inter.woff2', as: 'font', type: 'font/woff2', crossOrigin: 'anonymous' },
 *   { rel: 'icon', href: '/favicon-dashboard.png', type: 'image/png' },
 * ];
 * ```
 */
export type LinksFunction = () => LinkDescriptor[];

// ============================================================================
// Not Found Helper
// ============================================================================

/**
 * A special error class thrown by `notFound()` to signal a 404 response.
 * The server catches this and renders the nearest error boundary with status 404.
 */
export class NotFoundError extends Error {
  readonly status = 404;
  readonly data: unknown;

  constructor(data?: unknown) {
    super('Not Found');
    this.name = 'NotFoundError';
    this.data = data;
  }
}

/**
 * Throw from a loader or action to trigger a 404 response.
 * The framework catches this and renders the nearest error boundary.
 *
 * @param data - Optional data to pass to the error boundary
 *
 * @example
 * ```typescript
 * export async function loader({ params }: LoaderArgs) {
 *   const user = await db.user.findUnique({ where: { id: params.id } });
 *   if (!user) throw notFound({ message: 'User not found' });
 *   return { user };
 * }
 * ```
 */
export function notFound(data?: unknown): never {
  throw new NotFoundError(data);
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

/**
 * Props passed to route-level error components (the fallback UI).
 * This is distinct from ErrorBoundaryProps in @ereo/client which is for the
 * ErrorBoundary wrapper component itself.
 */
export interface RouteErrorComponentProps {
  error: Error;
  params: RouteParams;
}

/**
 * @deprecated Use RouteErrorComponentProps instead. This alias is kept for backwards compatibility.
 */
export type ErrorBoundaryProps = RouteErrorComponentProps;

// ============================================================================
// Middleware Types
// ============================================================================

/**
 * Function to continue the middleware chain.
 * Called by middleware to pass control to the next middleware or final handler.
 */
export type NextFunction = () => Promise<Response>;

/**
 * Core middleware handler signature used throughout the EreoJS framework.
 *
 * This is the base type for all middleware. Both `@ereo/router`'s `TypedMiddlewareHandler`
 * and `@ereo/server`'s middleware chain use this signature.
 *
 * @param request - The incoming Request object (Web Standards)
 * @param context - The application context (AppContext) for sharing data
 * @param next - Function to call the next middleware in the chain
 * @returns A Response or Promise<Response>
 *
 * @example
 * const loggingMiddleware: MiddlewareHandler = async (request, context, next) => {
 *   const start = Date.now();
 *   const response = await next();
 *   console.log(`Request took ${Date.now() - start}ms`);
 *   return response;
 * };
 *
 * @see TypedMiddlewareHandler in @ereo/router for type-safe context passing
 */
export type MiddlewareHandler = (
  request: Request,
  context: AppContext,
  next: NextFunction
) => Response | Promise<Response>;

/**
 * Named middleware definition with optional path matching.
 *
 * This interface is used for registering middleware with metadata.
 * For server-side middleware chains, see `MiddlewareDefinition` in `@ereo/server`.
 */
export interface Middleware {
  /** Optional name for the middleware (used in logging and debugging) */
  name?: string;
  /** The middleware handler function */
  handler: MiddlewareHandler;
  /** Path patterns to match (default: all paths). Supports wildcards like '/api/*'. */
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
  /** Add additional cache tags dynamically */
  addTags: (tags: string[]) => void;
}

// ============================================================================
// Cookie Types
// ============================================================================

export interface CookieSetOptions {
  /** Max-Age in seconds */
  maxAge?: number;
  /** Expiry date */
  expires?: Date;
  /** Cookie path (default: '/') */
  path?: string;
  /** Cookie domain */
  domain?: string;
  /** Secure flag (default: false, set automatically for HTTPS) */
  secure?: boolean;
  /** HttpOnly flag (default: true) */
  httpOnly?: boolean;
  /** SameSite attribute */
  sameSite?: 'Strict' | 'Lax' | 'None';
}

export interface CookieJar {
  /** Get a cookie value by name */
  get(name: string): string | undefined;
  /** Get all cookies as a record */
  getAll(): Record<string, string>;
  /** Set a cookie */
  set(name: string, value: string, options?: CookieSetOptions): void;
  /** Delete a cookie */
  delete(name: string, options?: Pick<CookieSetOptions, 'path' | 'domain'>): void;
  /** Check if a cookie exists */
  has(name: string): boolean;
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
  /** Cookie jar for reading/writing cookies (optional for backward compat) */
  cookies?: CookieJar;
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
 * Extended route type definition with full type safety.
 * Includes search params, hash params (unique to Ereo), and context inheritance.
 *
 * @example
 * declare module '@ereo/core' {
 *   interface RouteTypes {
 *     '/blog/[slug]': {
 *       params: { slug: string };
 *       search: { page?: number; sort?: 'asc' | 'desc' };
 *       hash: { section?: string };
 *       loader: { post: Post; comments: Comment[] };
 *       action: { success: boolean };
 *       context: { user: User };  // Inherited from parent layouts
 *       meta: true;
 *       handle: { breadcrumb: string };
 *     };
 *   }
 * }
 */
export interface RouteTypeDefinition {
  /** Route path parameters (inferred from path pattern) */
  params: RouteParams;
  /** Search/query parameters with typed schema */
  search?: Record<string, unknown>;
  /** Hash parameters - unique to Ereo, not supported by TanStack */
  hash?: Record<string, unknown>;
  /** Loader return type */
  loader?: unknown;
  /** Action return type */
  action?: unknown;
  /** Accumulated context from parent layouts */
  context?: Record<string, unknown>;
  /** Whether route has meta function */
  meta?: boolean;
  /** Route handle data */
  handle?: unknown;
}

/**
 * Module augmentation target for route types.
 * Generated by the bundler during development.
 *
 * @example
 * declare module '@ereo/core' {
 *   interface RouteTypes {
 *     '/blog/[slug]': {
 *       params: { slug: string };
 *       search: { page?: number };
 *       hash: { section?: string };
 *       loader: { post: Post };
 *       context: { user: User };
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

/**
 * Extract search param types for a route path.
 * TanStack limitation: they don't support this at route level.
 */
export type SearchParamsFor<T extends TypedRoutes> =
  T extends keyof RouteTypes
    ? RouteTypes[T] extends { search: infer S }
      ? S
      : Record<string, string | string[] | undefined>
    : Record<string, string | string[] | undefined>;

/**
 * Extract hash param types for a route path.
 * This is UNIQUE to Ereo - TanStack has no hash param support.
 */
export type HashParamsFor<T extends TypedRoutes> =
  T extends keyof RouteTypes
    ? RouteTypes[T] extends { hash: infer H }
      ? H
      : Record<string, string | undefined>
    : Record<string, string | undefined>;

/**
 * Extract accumulated context type for a route path.
 * Context is inherited from parent layouts through the route tree.
 */
export type ContextFor<T extends TypedRoutes> =
  T extends keyof RouteTypes
    ? RouteTypes[T] extends { context: infer C }
      ? C
      : Record<string, unknown>
    : Record<string, unknown>;

/**
 * Extract action data type for a route path.
 */
export type ActionDataFor<T extends TypedRoutes> =
  T extends keyof RouteTypes
    ? RouteTypes[T] extends { action: infer A }
      ? A
      : unknown
    : unknown;

/**
 * Extract handle type for a route path.
 */
export type HandleFor<T extends TypedRoutes> =
  T extends keyof RouteTypes
    ? RouteTypes[T] extends { handle: infer H }
      ? H
      : undefined
    : undefined;

/**
 * Check if a route has a loader.
 */
export type HasLoader<T extends TypedRoutes> =
  T extends keyof RouteTypes
    ? RouteTypes[T] extends { loader: infer L }
      ? L extends never
        ? false
        : true
      : false
    : false;

/**
 * Check if a route has an action.
 */
export type HasAction<T extends TypedRoutes> =
  T extends keyof RouteTypes
    ? RouteTypes[T] extends { action: infer A }
      ? A extends never
        ? false
        : true
      : false
    : false;

/**
 * Full route data combining all type information.
 * Useful for components that need complete route type info.
 */
export type RouteData<T extends TypedRoutes> = {
  params: RouteParamsFor<T>;
  search: SearchParamsFor<T>;
  hash: HashParamsFor<T>;
  loaderData: LoaderDataFor<T>;
  actionData: ActionDataFor<T> | undefined;
  context: ContextFor<T>;
  handle: HandleFor<T>;
};
