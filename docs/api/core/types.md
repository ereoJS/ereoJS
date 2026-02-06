# Types

Core type definitions for the EreoJS framework.

## Import

```ts
import type {
  // Build & Server
  BuildTarget,
  ServerConfig,
  BuildConfig,
  FrameworkConfig,

  // Route Configuration
  RenderConfig,
  IslandsConfig,
  RouteCacheConfig,
  ProgressiveConfig,
  AuthConfig,
  ErrorConfig,
  RouteConfig,

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

  // Middleware
  MiddlewareHandler,
  NextFunction,
  Middleware,
  MiddlewareReference,

  // Cache
  CacheOptions,
  CacheControl,
  CacheAdapter,
  TaggedCache,
  CacheSetOptions,

  // Context & App
  AppContext,
  RequestContext,
  Application,
  ApplicationOptions,

  // Type-safe Routing
  RouteTypes,
  TypedRoutes,
  RouteParamsFor,
  LoaderDataFor,
  SearchParamsFor,
  HashParamsFor,
  ContextFor,
  ActionDataFor,
  HandleFor,

  // Path Parsing Types
  InferParams,
  HasParams,
  ParamNames,
  IsOptionalParam,
  IsCatchAllParam,
  StaticPrefix,
  IsStaticPath,
  BrandedPath
} from '@ereo/core'
```

## Build & Server Types

### BuildTarget

Supported deployment targets.

```ts
type BuildTarget = 'bun' | 'cloudflare' | 'node' | 'deno' | 'edge'
```

### ServerConfig

Server configuration options.

```ts
interface ServerConfig {
  port?: number             // Default: 3000
  hostname?: string         // Default: 'localhost'
  development?: boolean     // Default: process.env.NODE_ENV !== 'production'
}
```

### BuildConfig

Build configuration options.

```ts
interface BuildConfig {
  target?: BuildTarget      // Default: 'bun'
  outDir?: string           // Default: '.ereo'
  minify?: boolean          // Default: true
  sourcemap?: boolean       // Default: true
}
```

### FrameworkConfig

Complete framework configuration.

```ts
interface FrameworkConfig {
  server?: ServerConfig
  build?: BuildConfig
  plugins?: Plugin[]
  basePath?: string         // Base path for all routes (e.g., '/app')
  routesDir?: string        // Default: 'app/routes'
}
```

## Route Configuration Types

### RenderMode

Available rendering modes for routes.

```ts
type RenderMode = 'ssg' | 'ssr' | 'csr' | 'json' | 'xml' | 'rsc'
```

### RenderConfig

Route rendering configuration.

```ts
interface RenderConfig {
  /** Primary render mode */
  mode: RenderMode
  /** SSG/ISR configuration */
  prerender?: PrerenderConfig
  /** Streaming configuration for SSR */
  streaming?: StreamingConfig
  /** CSR configuration */
  csr?: CSRConfig
}
```

### IslandsConfig

Per-route island hydration configuration.

```ts
interface IslandsConfig {
  /** Default hydration strategy for this route's islands */
  defaultStrategy?: HydrationStrategy
  /** Component-specific hydration overrides */
  components?: IslandStrategy[]
  /** Disable all hydration for this route */
  disabled?: boolean
}
```

### RouteCacheConfig

Route-level cache configuration.

```ts
interface RouteCacheConfig {
  edge?: {
    maxAge: number
    staleWhileRevalidate?: number
    vary?: string[]
    keyGenerator?: (args: { request: Request; params: RouteParams }) => string
  }
  browser?: {
    maxAge: number
    private?: boolean
  }
  data?: {
    key?: string | ((params: RouteParams) => string)
    tags?: string[] | ((params: RouteParams) => string[])
  }
}
```

### PrerenderConfig

SSG/ISR configuration.

```ts
interface PrerenderConfig {
  enabled: boolean
  paths?: string[] | (() => Promise<string[]> | string[])
  revalidate?: number
  tags?: string[] | ((params: RouteParams) => string[])
  fallback?: 'blocking' | 'static' | '404'
}
```

### AuthConfig

Authentication/authorization configuration.

```ts
interface AuthConfig {
  required?: boolean
  roles?: string[]
  permissions?: string[]
  check?: (args: { request: Request; context: AppContext; params: RouteParams }) => boolean | Promise<boolean>
  redirect?: string
  unauthorized?: { status: number; body: unknown }
}
```

### ErrorConfig

Error recovery and resilience configuration.

```ts
interface ErrorConfig {
  retry?: { count: number; delay: number }
  fallback?: ComponentType
  onError?: 'boundary' | 'toast' | 'redirect' | 'silent'
  maxCaptures?: number
  reportError?: (error: Error, context: { route: string; phase: string }) => void
}
```

### RuntimeConfig

Runtime configuration for edge/Node environments.

```ts
interface RuntimeConfig {
  runtime?: 'node' | 'edge' | 'auto'
  regions?: string[]
  memory?: number
  timeout?: number
}
```

### RouteConfig

Complete route-level configuration export.

```ts
interface RouteConfig {
  middleware?: MiddlewareReference[]
  render?: RenderConfig
  islands?: IslandsConfig
  cache?: RouteCacheConfig
  progressive?: ProgressiveConfig
  route?: RouteCompositionConfig
  auth?: AuthConfig
  dev?: DevConfig
  error?: ErrorConfig
  runtime?: RuntimeConfig
  variants?: RouteVariant[]
}
```

### RouteModuleWithConfig

Extended RouteModule that includes a config export.

```ts
interface RouteModuleWithConfig extends RouteModule {
  config?: RouteConfig
}
```

### RouteModule

Standard route module exports. These are the named exports a route file can provide.

```ts
interface RouteModule {
  /** The route's React component */
  default?: ComponentType<RouteComponentProps>
  /** Server-side data loader (runs on GET requests) */
  loader?: LoaderFunction
  /** Server-side mutation handler (runs on POST/PUT/DELETE/PATCH) */
  action?: ActionFunction
  /** Client-side loader — runs in the browser before/instead of fetching from server */
  clientLoader?: ClientLoaderFunction
  /** Client-side action — runs in the browser before/instead of posting to server */
  clientAction?: ClientActionFunction
  /** Page metadata (title, description, og tags, etc.) */
  meta?: MetaFunction
  /** Custom response headers */
  headers?: HeadersFunction
  /** Per-route link descriptors for CSS/assets injected into <head> */
  links?: LinksFunction
  /** Arbitrary data attached to the route (accessible via useMatches) */
  handle?: RouteHandle
  /** Inline middleware exported directly from the route module */
  middleware?: MiddlewareHandler[]
  /** Error boundary component */
  ErrorBoundary?: ComponentType<RouteErrorComponentProps>
  /** Route-level configuration */
  config?: RouteConfig
  /** Parameter validation schema */
  params?: ParamValidationSchema
  /** Search parameter validation schema */
  searchParams?: SearchParamValidationSchema
  /** Controls whether this route's loader should re-run after navigation/mutation */
  shouldRevalidate?: ShouldRevalidateFunction

  // --- HTTP Method Handlers (API Routes) ---
  /** When defined, these take precedence over loader/action */
  GET?: MethodHandlerFunction
  POST?: MethodHandlerFunction
  PUT?: MethodHandlerFunction
  DELETE?: MethodHandlerFunction
  PATCH?: MethodHandlerFunction
  OPTIONS?: MethodHandlerFunction
  HEAD?: MethodHandlerFunction

  // --- Route Guards ---
  /** Runs before the loader; throw a Response to redirect or an Error to short-circuit */
  beforeLoad?: BeforeLoadFunction

  // --- Static Generation ---
  /** Return an array of param objects for static generation at build time */
  generateStaticParams?: GenerateStaticParamsFunction

  // --- Component Exports ---
  /** Fallback component shown while clientLoader.hydrate is running */
  HydrateFallback?: ComponentType
  /** Component shown while the route is pending (navigation in progress) */
  PendingComponent?: ComponentType
  /** Component shown when a notFound() is thrown from the route */
  NotFoundComponent?: ComponentType
}
```

## Data Loading Types

### LoaderArgs

Arguments passed to loader functions.

```ts
interface LoaderArgs<P = RouteParams> {
  /** The incoming Request object (Web Standards) */
  request: Request
  /** URL parameters from dynamic segments */
  params: P
  /** App context (cache control, key-value store, cookies, headers) */
  context: AppContext
}
```

### ActionArgs

Arguments passed to action functions. Has the same shape as `LoaderArgs`.

```ts
interface ActionArgs<P = RouteParams> {
  /** The incoming Request object (includes form data for mutations) */
  request: Request
  /** URL parameters from dynamic segments */
  params: P
  /** App context (cache control, key-value store, cookies, headers) */
  context: AppContext
}
```

### LoaderFunction

Type for loader functions.

```ts
type LoaderFunction<T = unknown, P = RouteParams> =
  (args: LoaderArgs<P>) => T | Promise<T>
```

### ActionFunction

Type for action functions.

```ts
type ActionFunction<T = unknown, P = RouteParams> =
  (args: ActionArgs<P>) => T | Promise<T>
```

### LoaderData

Wrapper type that includes loader return data and optional headers.

```ts
interface LoaderData<T = unknown> {
  data: T
  headers?: Headers
}
```

## Method Handler Types (API Routes)

### MethodHandlerFunction

Handler for HTTP method exports (`GET`, `POST`, `PUT`, `DELETE`, `PATCH`, `OPTIONS`, `HEAD`). When defined on a route module, takes precedence over `loader`/`action`.

```ts
type MethodHandlerFunction<T = unknown, P = RouteParams> = (
  args: LoaderArgs<P>
) => T | Response | Promise<T | Response>
```

## Route Guard Types

### BeforeLoadFunction

Runs before the loader. Throw a `Response` (e.g., redirect) or an `Error` to short-circuit the request. Return `void` to allow the loader to proceed.

```ts
type BeforeLoadFunction<P = RouteParams> = (
  args: LoaderArgs<P>
) => void | Promise<void>
```

## Static Generation Types

### GenerateStaticParamsFunction

Return an array of param objects for static page generation at build time.

```ts
type GenerateStaticParamsFunction<P = RouteParams> = () => P[] | Promise<P[]>
```

## Revalidation Types

### ShouldRevalidateArgs

Arguments passed to the `shouldRevalidate` function exported from route files.

```ts
interface ShouldRevalidateArgs {
  currentUrl: URL
  nextUrl: URL
  currentParams: RouteParams
  nextParams: RouteParams
  formMethod?: string
  formAction?: string
  formData?: FormData
  actionResult?: unknown
  /** Whether the framework would revalidate by default */
  defaultShouldRevalidate: boolean
}
```

### ShouldRevalidateFunction

Controls whether a route's loader should re-run after navigation or mutation. Return `true` to revalidate, `false` to skip.

```ts
type ShouldRevalidateFunction = (args: ShouldRevalidateArgs) => boolean
```

## Client Loader / Client Action Types

### ClientLoaderArgs

Arguments passed to a `clientLoader` function. Runs in the browser.

```ts
interface ClientLoaderArgs<P = RouteParams> {
  params: P
  request: Request
  /** Call the server loader to get server data */
  serverLoader: <T = unknown>() => Promise<T>
}
```

### ClientLoaderFunction

Client-side loader that runs in the browser on client-side navigations. Use for client-side caching, optimistic data, or offline-first patterns.

```ts
type ClientLoaderFunction<T = unknown, P = RouteParams> = ((
  args: ClientLoaderArgs<P>
) => T | Promise<T>) & {
  /** If true, also runs during initial hydration (after SSR). Default: false */
  hydrate?: boolean
}
```

### ClientActionArgs

Arguments passed to a `clientAction` function. Runs in the browser.

```ts
interface ClientActionArgs<P = RouteParams> {
  params: P
  request: Request
  /** Call the server action to submit data */
  serverAction: <T = unknown>() => Promise<T>
}
```

### ClientActionFunction

Client-side action that runs in the browser on form submissions. Use for optimistic UI updates, client-side validation, or offline form queuing.

```ts
type ClientActionFunction<T = unknown, P = RouteParams> = (
  args: ClientActionArgs<P>
) => T | Promise<T>
```

## Links Types

### LinkDescriptor

A single link descriptor for injecting into `<head>`.

```ts
interface LinkDescriptor {
  rel: string       // e.g., 'stylesheet', 'preload', 'prefetch', 'icon'
  href: string
  type?: string
  as?: string       // For preload: 'script', 'style', 'image', 'font'
  crossOrigin?: 'anonymous' | 'use-credentials' | ''
  media?: string
  integrity?: string
  sizes?: string
  [key: string]: string | undefined
}
```

### LinksFunction

Function exported from route files to declare per-route CSS and assets. Links are injected into `<head>` when the route is active.

```ts
type LinksFunction = () => LinkDescriptor[]
```

## Cookie Types

### CookieSetOptions

Options for setting cookies.

```ts
interface CookieSetOptions {
  maxAge?: number
  expires?: Date
  path?: string        // Default: '/'
  domain?: string
  secure?: boolean     // Default: false, auto-set for HTTPS
  httpOnly?: boolean   // Default: true
  sameSite?: 'Strict' | 'Lax' | 'None'
}
```

### CookieJar

Interface for reading and writing cookies in the request context.

```ts
interface CookieJar {
  get(name: string): string | undefined
  getAll(): Record<string, string>
  set(name: string, value: string, options?: CookieSetOptions): void
  delete(name: string, options?: Pick<CookieSetOptions, 'path' | 'domain'>): void
  has(name: string): boolean
}
```

## Not Found Helper

### notFound

Throw from a loader or action to trigger a 404 response. The framework catches this and renders the nearest error boundary.

```ts
function notFound(data?: unknown): never
```

```ts
// Example
export async function loader({ params }: LoaderArgs) {
  const user = await db.user.findUnique({ where: { id: params.id } })
  if (!user) throw notFound({ message: 'User not found' })
  return { user }
}
```

### NotFoundError

The error class thrown by `notFound()`.

```ts
class NotFoundError extends Error {
  readonly status = 404
  readonly data: unknown
}
```

## Meta Types

### MetaDescriptor

Describes a meta tag. All properties are optional — include only the ones relevant to the tag you want to create.

```ts
interface MetaDescriptor {
  /** Page title (sets <title>) */
  title?: string
  /** Name attribute (e.g., 'description', 'viewport') */
  name?: string
  /** Property attribute (e.g., 'og:title', 'og:image') */
  property?: string
  /** Content value for name/property meta tags */
  content?: string
  /** Character set declaration */
  charSet?: 'utf-8'
  /** Additional attributes */
  [key: string]: string | undefined
}
```

### MetaArgs

Arguments passed to meta functions.

```ts
interface MetaArgs<T = unknown, P = RouteParams> {
  /** Loader data for this route */
  data: T
  /** Route parameters */
  params: P
  /** Current location info */
  location: { pathname: string; search: string; hash: string }
}
```

### MetaFunction

Type for meta functions.

```ts
type MetaFunction<T = unknown> =
  (args: MetaArgs<T>) => MetaDescriptor[]
```

## Component Props Types

### RouteComponentProps

Props passed to route components.

```ts
interface RouteComponentProps<T = unknown> {
  /** Data returned by the route's loader */
  loaderData: T
  /** Route parameters */
  params: RouteParams
  /** Child route content (for layouts) */
  children?: ReactElement
}
```

### RouteErrorComponentProps

Props passed to route-level error components (the fallback UI shown when a loader, action, or render throws).

```ts
interface RouteErrorComponentProps {
  /** The error that was thrown */
  error: Error
  /** Route parameters */
  params: RouteParams
}
```

## Middleware Types

### MiddlewareHandler

Core middleware handler signature used throughout EreoJS.

```ts
type MiddlewareHandler = (
  request: Request,
  context: AppContext,
  next: NextFunction
) => Response | Promise<Response>
```

Note: Parameter order is `(request, context, next)`, not `(request, next, context)`.

### NextFunction

Function to continue the middleware chain.

```ts
type NextFunction = () => Promise<Response>
```

### MiddlewareReference

Reference to named middleware (from app/middleware/) or inline function.

```ts
type MiddlewareReference =
  | string              // Named middleware from app/middleware/
  | MiddlewareHandler   // Inline middleware function
```

### Middleware

Named middleware definition with optional path matching.

```ts
interface Middleware {
  name?: string                     // Used in logging/debugging
  handler: MiddlewareHandler        // The middleware function
  paths?: string[]                  // Path patterns to match (default: all)
}
```

## Parameter Validation Types

Types for validating route parameters and search parameters.

### ParamValidationSchema

Schema for validating route parameters.

```ts
interface ParamValidationSchema {
  [key: string]: ParamValidator<unknown>
}
```

### SearchParamValidationSchema

Schema for validating search/query parameters.

```ts
interface SearchParamValidationSchema {
  [key: string]: ParamValidator<unknown> | {
    default: unknown
    validator?: ParamValidator<unknown>
  }
}
```

### ParamValidator

Validator function or schema for parameters.

```ts
type ParamValidator<T> = {
  parse: (value: string | string[] | undefined) => T
  optional?: boolean
  default?: T
}
```

Example usage:

```ts
// In a route module
export const params: ParamValidationSchema = {
  id: {
    parse: (value) => {
      if (!value || Array.isArray(value)) throw new Error('Invalid id')
      return value
    }
  }
}

export const searchParams: SearchParamValidationSchema = {
  page: {
    default: 1,
    validator: {
      parse: (value) => parseInt(value as string) || 1
    }
  }
}
```

## Cache Types

### CacheOptions

Cache configuration options (for request-level caching).

```ts
interface CacheOptions {
  maxAge?: number
  staleWhileRevalidate?: number
  tags?: string[]
  private?: boolean
}
```

### CacheSetOptions

Options when setting cache values (for CacheAdapter).

```ts
interface CacheSetOptions {
  ttl?: number          // Time to live in seconds
  tags?: string[]       // Cache tags for grouped invalidation
}
```

### CacheAdapterOptions

Options for creating cache instances.

```ts
interface CacheAdapterOptions {
  maxSize?: number      // Maximum entries (default: Infinity)
  defaultTtl?: number   // Default TTL in seconds
  tagged?: boolean      // Enable tag support
}
```

### CacheAdapter

Interface for cache implementations.

```ts
interface CacheAdapter {
  get<T>(key: string): Promise<T | undefined>
  set<T>(key: string, value: T, options?: CacheSetOptions): Promise<void>
  delete(key: string): Promise<boolean>
  has(key: string): Promise<boolean>
  clear(): Promise<void>
}
```

### TaggedCache

Extended cache with tag-based invalidation support.

```ts
interface TaggedCache extends CacheAdapter {
  invalidateTag(tag: string): Promise<void>
  invalidateTags(tags: string[]): Promise<void>
  getByTag(tag: string): Promise<string[]>
}
```

### CacheControl

Request-scoped cache control interface.

```ts
interface CacheControl {
  /** Set cache options for this request */
  set(options: CacheOptions): void
  /** Get current cache options */
  get(): CacheOptions | undefined
  /** Get all accumulated cache tags */
  getTags(): string[]
  /** Add additional cache tags dynamically */
  addTags(tags: string[]): void
}
```

## Plugin Types

### Plugin

Plugin interface for extending EreoJS.

```ts
interface Plugin {
  name: string
  setup?: (context: PluginContext) => void | Promise<void>
  transform?: (code: string, id: string) => string | null | Promise<string | null>
  configureServer?: (server: DevServer) => void | Promise<void>
  resolveId?: (id: string) => string | null
  load?: (id: string) => string | null | Promise<string | null>
  buildStart?: () => void | Promise<void>
  buildEnd?: () => void | Promise<void>
  extendConfig?: (config: FrameworkConfig) => FrameworkConfig
  transformRoutes?: (routes: Route[]) => Route[]
  runtimeMiddleware?: MiddlewareHandler[]
  virtualModules?: Record<string, string>
}
```

### PluginContext

Context passed to plugin setup functions.

```ts
interface PluginContext {
  config: FrameworkConfig
  mode: 'development' | 'production'
  root: string
}
```

### DevServer

Development server interface available in plugins.

```ts
interface DevServer {
  ws: {
    send: (data: unknown) => void
    on: (event: string, callback: (data: unknown) => void) => void
  }
  restart: () => Promise<void>
  middlewares: MiddlewareHandler[]
  watcher?: {
    add: (path: string) => void
    on: (event: string, callback: (file: string) => void) => void
  }
}
```

## Application Types

### ApplicationOptions

Options for creating an EreoApp instance.

```ts
interface ApplicationOptions {
  config?: FrameworkConfig
  routes?: Route[]
}
```

### Application

Interface implemented by EreoApp.

```ts
interface Application {
  config: FrameworkConfig
  routes: Route[]
  plugins: Plugin[]
  handle: (request: Request) => Promise<Response>
  use: (plugin: Plugin) => Application
  dev: () => Promise<void>
  build: () => Promise<void>
  start: () => Promise<void>
}
```

### AppContext

Request context interface available in loaders, actions, and middleware.

```ts
interface AppContext {
  /** Request-specific cache control */
  cache: CacheControl
  /** Get a value from the context store */
  get: <T>(key: string) => T | undefined
  /** Set a value in the context store */
  set: <T>(key: string, value: T) => void
  /** Response headers to be merged into the final response */
  responseHeaders: Headers
  /** Current request URL info */
  url: URL
  /** Environment variables (server-side) */
  env: Record<string, string | undefined>
  /** Cookie jar for reading/writing cookies */
  cookies?: CookieJar
}
```

## Type-Safe Routing

EreoJS provides comprehensive type-safe routing that exceeds TanStack Start. See the [Type-Safe Routing Guide](/api/core/type-safe-routing) for full details.

### RouteTypes Registry

The automatically generated interface containing type information for all routes.

```ts
// Auto-generated in .ereo/routes.d.ts
declare module '@ereo/core' {
  interface RouteTypes {
    '/users/[id]': {
      params: { id: string }
      search: { tab?: string; sort?: 'asc' | 'desc' }
      hash: { section?: string }          // Unique to Ereo!
      loader: { user: User }
      action: { success: boolean }
      context: { auth: AuthContext }
    }
  }
}
```

### TypedRoutes

Union of all valid route paths.

```ts
type TypedRoutes = keyof RouteTypes
// '/users' | '/users/[id]' | '/posts' | ...
```

### RouteParamsFor

Extracts params type from a route path.

```ts
type RouteParamsFor<Path extends TypedRoutes> = RouteTypes[Path]['params']

// Example:
type Params = RouteParamsFor<'/users/[id]'>
// { id: string }

type MultiParams = RouteParamsFor<'/users/[id]/posts/[postId]'>
// { id: string; postId: string }
```

### SearchParamsFor

Extracts search params type from a route.

```ts
type SearchParamsFor<Path extends TypedRoutes> = RouteTypes[Path]['search']

// Example:
type SearchParams = SearchParamsFor<'/posts'>
// { page?: number; sort?: 'newest' | 'oldest' }
```

### HashParamsFor (Ereo Exclusive)

Extracts hash params type from a route. This feature is unique to EreoJS.

```ts
type HashParamsFor<Path extends TypedRoutes> = RouteTypes[Path]['hash']

// Example:
type HashParams = HashParamsFor<'/docs/[topic]'>
// { section?: string; highlight?: string }
```

### LoaderDataFor

Extracts loader data type from a route.

```ts
type LoaderDataFor<Path extends TypedRoutes> = RouteTypes[Path]['loader']

// Example:
type PostData = LoaderDataFor<'/posts/[slug]'>
// { post: Post }
```

### ActionDataFor

Extracts action data type from a route.

```ts
type ActionDataFor<Path extends TypedRoutes> = RouteTypes[Path]['action']

// Example:
type ActionResult = ActionDataFor<'/posts/[slug]'>
// { success: boolean }
```

### ContextFor

Extracts inherited context type from a route.

```ts
type ContextFor<Path extends TypedRoutes> = RouteTypes[Path]['context']

// Example:
type RouteContext = ContextFor<'/dashboard/settings'>
// { user: User; settings: Settings }
```

### HandleFor

Extracts handle type from a route.

```ts
type HandleFor<Path extends TypedRoutes> = RouteTypes[Path]['handle']

// Example:
type RouteHandle = HandleFor<'/users/[id]'>
// { breadcrumb: string }
```

## Path Parsing Types

Template literal types for compile-time path parameter inference.

### InferParams

Infers params type from a path pattern at compile time.

```ts
type InferParams<Path extends string> = /* template literal magic */

// Examples:
type P1 = InferParams<'/users/[id]'>
// { id: string }

type P2 = InferParams<'/users/[id]/posts/[postId]'>
// { id: string; postId: string }

type P3 = InferParams<'/blog/[[page]]'>
// { page?: string }

type P4 = InferParams<'/docs/[...path]'>
// { path: string[] }

type P5 = InferParams<'/[lang]/docs/[version]/[...path]'>
// { lang: string; version: string; path: string[] }
```

### HasParams

Check if a route path has dynamic parameters.

```ts
type HasParams<Path extends string> = /* ... */

// Examples:
type Has = HasParams<'/users/[id]'>  // true
type NoParams = HasParams<'/about'>   // false
```

### ParamNames

Extract parameter names from a path.

```ts
type ParamNames<Path extends string> = /* ... */

// Example:
type Names = ParamNames<'/users/[id]/posts/[postId]'>
// 'id' | 'postId'
```

### IsOptionalParam

Check if a specific parameter is optional.

```ts
type IsOptionalParam<Path extends string, Param extends string> = /* ... */

// Example:
type IsOpt = IsOptionalParam<'/blog/[[page]]', 'page'>  // true
```

### IsCatchAllParam

Check if a specific parameter is catch-all.

```ts
type IsCatchAllParam<Path extends string, Param extends string> = /* ... */

// Example:
type IsCatch = IsCatchAllParam<'/docs/[...path]', 'path'>  // true
```

### StaticPrefix

Get the static prefix of a path (before any parameters).

```ts
type StaticPrefix<Path extends string> = /* ... */

// Example:
type Prefix = StaticPrefix<'/api/users/[id]'>  // '/api/users'
```

### IsStaticPath

Check if a path has no dynamic parameters.

```ts
type IsStaticPath<Path extends string> = /* ... */

// Examples:
type Static = IsStaticPath<'/about'>        // true
type Dynamic = IsStaticPath<'/users/[id]'>  // false
```

### BrandedPath

Type brand for preserving path information.

```ts
type BrandedPath<Path extends string> = string & { readonly __path: Path }
```

## Utility Types

### MaybePromise

Represents a value that may be sync or async.

```ts
type MaybePromise<T> = T | Promise<T>
```

### DeepPartial

Makes all properties optional recursively.

```ts
type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P]
}
```

### InferLoaderData

Extracts loader data type from a route module.

```ts
type InferLoaderData<T extends RouteModule> =
  T['loader'] extends LoaderFunction<infer D> ? D : never

// Usage
type Data = InferLoaderData<typeof import('./routes/posts')>
```

### InferActionData

Extracts action data type from a route module.

```ts
type InferActionData<T extends RouteModule> =
  T['action'] extends ActionFunction<infer D> ? D : never
```

## Island Types

Types for selective hydration (islands architecture).

### HydrationStrategy

When to hydrate an island component.

```ts
type HydrationStrategy =
  | 'load'      // Hydrate immediately on page load
  | 'idle'      // Hydrate when browser is idle
  | 'visible'   // Hydrate when element is visible
  | 'media'     // Hydrate when media query matches
  | 'none'      // Never hydrate (static only)
```

### IslandProps

Props available for island components.

```ts
interface IslandProps {
  'client:load'?: boolean
  'client:idle'?: boolean
  'client:visible'?: boolean
  'client:media'?: string
  'data-island'?: string
}
```

### IslandStrategy

Component-specific hydration configuration.

```ts
interface IslandStrategy {
  component: string
  strategy: HydrationStrategy
  mediaQuery?: string  // For 'media' strategy
}
```

## Example Usage

```ts
import type {
  LoaderFunction,
  ActionFunction,
  RouteConfig,
  MetaFunction
} from '@ereo/core'

interface Post {
  id: string
  title: string
  content: string
}

interface PostParams {
  id: string
}

// Type-safe loader
export const loader: LoaderFunction<{ post: Post }, PostParams> = async ({
  params
}) => {
  const post = await db.posts.find(params.id)
  return { post }
}

// Type-safe action
export const action: ActionFunction<{ success: boolean }, PostParams> = async ({
  request
}) => {
  const formData = await request.formData()
  // ...
  return { success: true }
}

// Type-safe meta
export const meta: MetaFunction<{ post: Post }> = ({ data }) => [
  { title: data.post.title },
  { name: 'description', content: data.post.content.slice(0, 160) }
]

// Route config
export const config: RouteConfig = {
  render: { mode: 'ssr' },
  cache: {
    edge: { maxAge: 3600 },
    data: { tags: ['posts'] },
  },
}
```
