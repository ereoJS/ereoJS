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
  port?: number
  host?: string
  https?: {
    key: string
    cert: string
  }
}
```

### BuildConfig

Build configuration options.

```ts
interface BuildConfig {
  target?: BuildTarget
  outDir?: string
  minify?: boolean
  sourcemap?: boolean | 'inline' | 'external'
  splitting?: boolean
  external?: string[]
}
```

### FrameworkConfig

Complete framework configuration.

```ts
interface FrameworkConfig {
  server?: ServerConfig
  build?: BuildConfig
  plugins?: Plugin[]
  routes?: {
    dir?: string
    extensions?: string[]
  }
}
```

## Route Configuration Types

### RenderConfig

Route rendering configuration.

```ts
interface RenderConfig {
  mode: 'ssr' | 'ssg' | 'csr' | 'streaming'
}
```

### IslandsConfig

Islands architecture configuration.

```ts
interface IslandsConfig {
  strategy?: 'load' | 'idle' | 'visible' | 'media'
  preload?: string[]
  maxConcurrent?: number
}
```

### RouteCacheConfig

Route-level cache configuration.

```ts
interface RouteCacheConfig {
  maxAge?: number
  staleWhileRevalidate?: number
  revalidate?: number
  tags?: string[]
  private?: boolean
}
```

### RouteConfig

Complete route configuration.

```ts
interface RouteConfig {
  render?: RenderConfig['mode'] | RenderConfig
  cache?: RouteCacheConfig
  islands?: IslandsConfig
  middleware?: MiddlewareReference[]
  auth?: AuthConfig
  progressive?: ProgressiveConfig
  error?: ErrorConfig
}
```

## Data Loading Types

### LoaderArgs

Arguments passed to loader functions.

```ts
interface LoaderArgs<P = Record<string, string>> {
  request: Request
  params: P
  context: RequestContext
}
```

### ActionArgs

Arguments passed to action functions.

```ts
interface ActionArgs<P = Record<string, string>> {
  request: Request
  params: P
  context: RequestContext
}
```

### LoaderFunction

Type for loader functions.

```ts
type LoaderFunction<T = unknown, P = Record<string, string>> =
  (args: LoaderArgs<P>) => T | Promise<T>
```

### ActionFunction

Type for action functions.

```ts
type ActionFunction<T = unknown, P = Record<string, string>> =
  (args: ActionArgs<P>) => T | Promise<T>
```

### LoaderData

Extracts loader data type from a loader function.

```ts
type LoaderData<T extends LoaderFunction> =
  T extends LoaderFunction<infer D> ? D : never
```

## Meta Types

### MetaDescriptor

Describes a meta tag.

```ts
type MetaDescriptor =
  | { title: string }
  | { name: string; content: string }
  | { property: string; content: string }
  | { httpEquiv: string; content: string }
  | { charset: string }
  | { tagName: 'link'; rel: string; href: string; [key: string]: string }
```

### MetaArgs

Arguments passed to meta functions.

```ts
interface MetaArgs<T = unknown> {
  data: T
  params: Record<string, string>
  location: URL
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
interface RouteComponentProps<T = unknown, P = Record<string, string>> {
  loaderData: T
  actionData?: unknown
  params: P
  searchParams: URLSearchParams
}
```

### RouteErrorComponentProps

Props passed to error boundary components.

```ts
interface RouteErrorComponentProps {
  error: Error | Response
}
```

## Middleware Types

### MiddlewareHandler

Function signature for middleware.

```ts
type MiddlewareHandler = (
  request: Request,
  next: NextFunction,
  context: AppContext
) => Response | Promise<Response>
```

### NextFunction

Function to call the next middleware.

```ts
type NextFunction = () => Response | Promise<Response>
```

### MiddlewareReference

Reference to named middleware.

```ts
type MiddlewareReference =
  | string
  | MiddlewareHandler
  | { name: string; options?: Record<string, unknown> }
```

## Cache Types

### CacheOptions

Cache configuration options.

```ts
interface CacheOptions {
  maxSize?: number
  ttl?: number
  tagged?: boolean
}
```

### CacheSetOptions

Options when setting cache values.

```ts
interface CacheSetOptions {
  ttl?: number
  tags?: string[]
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
  keys(): Promise<string[]>
}
```

### TaggedCache

Extended cache with tag support.

```ts
interface TaggedCache extends CacheAdapter {
  invalidateTag(tag: string): Promise<void>
  invalidateTags(tags: string[]): Promise<void>
  getByTag(tag: string): Promise<string[]>
  getStats(): { size: number; tags: number }
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

### Awaited

Unwraps Promise types (built into TypeScript).

```ts
// If T is Promise<U>, returns U
type Awaited<T> = T extends Promise<infer U> ? U : T
```

### Prettify

Flattens intersection types for better IDE display.

```ts
type Prettify<T> = {
  [K in keyof T]: T[K]
} & {}
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
  render: 'ssr',
  cache: {
    maxAge: 3600,
    tags: ['posts']
  }
}
```
