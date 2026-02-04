# defineRoute Builder

A builder pattern API for defining routes with stable type inference that never breaks when adding features.

## Import

```ts
import {
  defineRoute,
  // Types
  type TypedLoaderArgs,
  type TypedActionArgs,
  type HeadArgs,
  type TypedMetaArgs,
  type HeadData,
  type RouteMiddleware,
  type ValidationSchema,
  type RouteBuilder,
  type RouteBuilderWithLoader,
  type RouteBuilderWithLoaderAndAction,
  type RouteDefinition,
  // Type helpers
  type InferLoaderData,
  type InferActionData,
  type InferRouteParams,
  type InferRoutePath,
} from '@ereo/data'
```

## Overview

The `defineRoute` builder solves TanStack Start's documented limitation where adding `head` or `meta` breaks loader type inference. EreoJS uses branded types to preserve inference through the entire builder chain.

```ts
export const route = defineRoute('/users/[id]')
  .loader(async ({ params }) => {
    // params is typed as { id: string }
    return db.user.findUnique({ where: { id: params.id } })
  })
  .head(({ data }) => ({
    // data is FULLY typed - never breaks!
    title: data.name,
    description: data.bio,
  }))
  .build()

export const { loader } = route
```

## Basic Usage

### Simple Route

```ts
import { defineRoute } from '@ereo/data'

export const route = defineRoute('/about')
  .loader(async () => {
    return { content: await getAboutContent() }
  })
  .build()

export const { loader } = route
```

### Route with Parameters

```ts
export const route = defineRoute('/users/[id]')
  .loader(async ({ params }) => {
    // params.id is typed as string
    const user = await db.user.findUnique({
      where: { id: params.id },
    })

    if (!user) {
      throw new Response('Not Found', { status: 404 })
    }

    return { user }
  })
  .build()
```

### Multiple Parameters

```ts
export const route = defineRoute('/users/[id]/posts/[postId]')
  .loader(async ({ params }) => {
    // params is typed as { id: string; postId: string }
    return db.post.findUnique({
      where: {
        id: params.postId,
        authorId: params.id,
      },
    })
  })
  .build()
```

### Optional Parameters

```ts
export const route = defineRoute('/blog/[[page]]')
  .loader(async ({ params }) => {
    // params.page is typed as string | undefined
    const page = parseInt(params.page ?? '1', 10)
    return db.posts.findMany({ skip: (page - 1) * 10, take: 10 })
  })
  .build()
```

### Catch-All Parameters

```ts
export const route = defineRoute('/docs/[...path]')
  .loader(async ({ params }) => {
    // params.path is typed as string[]
    const docPath = params.path.join('/')
    return getDocument(docPath)
  })
  .build()
```

## Builder Methods

### loader

Define the route's data loader function.

```ts
.loader<TData>(
  fn: (args: TypedLoaderArgs<Params>) => TData | Promise<TData>
): RouteBuilderWithLoader<Path, Params, Awaited<TData>>
```

**TypedLoaderArgs:**

```ts
interface TypedLoaderArgs<P> {
  params: P                    // Typed route params
  request: Request            // Incoming request
  context: AppContext         // App context
  searchParams?: Record<string, unknown>  // Validated search params
  hashParams?: Record<string, unknown>    // Validated hash params
}
```

**Example:**

```ts
export const route = defineRoute('/posts')
  .loader(async ({ request, context }) => {
    const user = context.get<User>('user')
    const url = new URL(request.url)

    return db.posts.findMany({
      where: { authorId: user?.id },
      orderBy: { createdAt: 'desc' },
    })
  })
  .build()
```

### action

Define the route's action handler for form submissions.

```ts
.action<TBody, TResult>(
  fn: (args: TypedActionArgs<TBody, Params>) => TResult | Promise<TResult>,
  options?: { schema?: ValidationSchema<TBody> }
): RouteBuilderWithLoaderAndAction<...>
```

**TypedActionArgs:**

```ts
interface TypedActionArgs<TBody, P> {
  params: P            // Typed route params
  request: Request    // Incoming request
  context: AppContext // App context
  body: TBody         // Parsed and validated body
  formData?: FormData // Raw form data (if applicable)
}
```

**Example:**

```ts
import { z } from 'zod'
import { ereoSchema } from '@ereo/data'

const updateSchema = ereoSchema(z.object({
  name: z.string().min(1),
  email: z.string().email(),
}))

export const route = defineRoute('/users/[id]')
  .loader(async ({ params }) => {
    return db.user.findUnique({ where: { id: params.id } })
  })
  .action(
    async ({ params, body }) => {
      // body is typed as { name: string; email: string }
      await db.user.update({
        where: { id: params.id },
        data: body,
      })
      return { success: true }
    },
    { schema: updateSchema }
  )
  .build()
```

### head

Define head/meta data generator. **This never breaks loader inference** (unlike TanStack Start).

```ts
.head(
  fn: (args: HeadArgs<LoaderData, Params>) => HeadData
): RouteBuilderWithLoader<...>
```

**HeadData:**

```ts
interface HeadData {
  title?: string
  description?: string
  canonical?: string
  robots?: string
  openGraph?: {
    title?: string
    description?: string
    image?: string
    type?: string
  }
  twitter?: {
    card?: 'summary' | 'summary_large_image' | 'app' | 'player'
    site?: string
    creator?: string
  }
  links?: Array<{ rel: string; href: string; [key: string]: string }>
  scripts?: Array<{ src?: string; content?: string; type?: string }>
}
```

**Example:**

```ts
export const route = defineRoute('/posts/[slug]')
  .loader(async ({ params }) => {
    return db.post.findUnique({ where: { slug: params.slug } })
  })
  .head(({ data }) => ({
    title: data.title,
    description: data.excerpt,
    openGraph: {
      title: data.title,
      image: data.coverImage,
      type: 'article',
    },
    twitter: {
      card: 'summary_large_image',
    },
  }))
  .build()
```

### meta

Define meta tags generator (alternative to head).

```ts
.meta(
  fn: (args: TypedMetaArgs<LoaderData, Params>) => MetaDescriptor[]
): RouteBuilderWithLoader<...>
```

**Example:**

```ts
export const route = defineRoute('/posts/[slug]')
  .loader(async ({ params }) => {
    return db.post.findUnique({ where: { slug: params.slug } })
  })
  .meta(({ data }) => [
    { title: data.title },
    { name: 'description', content: data.excerpt },
    { property: 'og:title', content: data.title },
    { property: 'og:image', content: data.coverImage },
  ])
  .build()
```

### searchParams

Define typed search parameter validation.

```ts
.searchParams<T>(
  schema: ValidationSchema<T>
): RouteBuilder<Path, Params>
```

**Example:**

```ts
import { z } from 'zod'
import { ereoSchema } from '@ereo/data'

export const searchParams = ereoSchema(z.object({
  page: z.coerce.number().default(1),
  limit: z.coerce.number().default(10),
  sort: z.enum(['newest', 'oldest', 'popular']).default('newest'),
  tag: z.string().optional(),
}))

export const route = defineRoute('/posts')
  .searchParams(searchParams)
  .loader(async ({ searchParams }) => {
    // searchParams is typed as { page: number; limit: number; sort: ...; tag?: string }
    return db.posts.findMany({
      skip: (searchParams.page - 1) * searchParams.limit,
      take: searchParams.limit,
      orderBy: getOrderBy(searchParams.sort),
      where: searchParams.tag ? { tags: { has: searchParams.tag } } : {},
    })
  })
  .build()
```

### hashParams (Ereo Exclusive)

Define typed hash parameter validation. This feature is unique to EreoJS.

```ts
.hashParams<T>(
  schema: ValidationSchema<T>
): RouteBuilder<Path, Params>
```

**Example:**

```ts
export const hashParams = ereoSchema(z.object({
  section: z.string().optional(),
  highlight: z.string().optional(),
}))

export const route = defineRoute('/docs/[topic]')
  .hashParams(hashParams)
  .loader(async ({ params, hashParams }) => {
    const doc = await getDoc(params.topic)
    return {
      doc,
      initialSection: hashParams?.section,
    }
  })
  .build()
```

### cache

Set cache options for the loader.

```ts
.cache(options: CacheOptions): RouteBuilderWithLoader<...>
```

**CacheOptions:**

```ts
interface CacheOptions {
  maxAge?: number       // Cache duration in seconds
  staleWhileRevalidate?: number
  private?: boolean     // Set Cache-Control: private
  immutable?: boolean   // Set Cache-Control: immutable
}
```

**Example:**

```ts
export const route = defineRoute('/products')
  .loader(async () => {
    return db.products.findMany()
  })
  .cache({
    maxAge: 300,              // 5 minutes
    staleWhileRevalidate: 60, // Serve stale for 1 minute while revalidating
  })
  .build()
```

### middleware

Add route-level middleware.

```ts
.middleware(
  ...handlers: RouteMiddleware<Params>[]
): RouteBuilder<...>
```

**Example:**

```ts
const requireAuth: RouteMiddleware = async (req, ctx, params, next) => {
  const user = ctx.get<User>('user')
  if (!user) {
    return new Response(null, {
      status: 302,
      headers: { Location: '/login' },
    })
  }
  return next()
}

const requireAdmin: RouteMiddleware = async (req, ctx, params, next) => {
  const user = ctx.get<User>('user')
  if (!user?.isAdmin) {
    return new Response('Forbidden', { status: 403 })
  }
  return next()
}

export const route = defineRoute('/admin/users')
  .middleware(requireAuth, requireAdmin)
  .loader(async () => {
    return db.users.findMany()
  })
  .build()
```

### configure

Set route configuration options.

```ts
.configure(config: RouteConfig): RouteBuilder<...>
```

**Example:**

```ts
export const route = defineRoute('/api/heavy-operation')
  .configure({
    streaming: true,
    timeout: 30000,
  })
  .loader(async () => {
    // Long-running operation
  })
  .build()
```

### build

Finalize the route definition.

```ts
.build(): RouteDefinition<Path, Params, LoaderData, ActionData, ActionBody>
```

Always call `.build()` at the end of your chain to get the final route definition.

## Complete Example

```ts
// app/routes/posts/[slug].tsx
import { defineRoute } from '@ereo/data'
import { z } from 'zod'
import { ereoSchema } from '@ereo/data'

// Search params schema
export const searchParams = ereoSchema(z.object({
  showComments: z.coerce.boolean().default(true),
}))

// Hash params schema (unique to Ereo!)
export const hashParams = ereoSchema(z.object({
  comment: z.string().optional(),
}))

// Action body schema
const commentSchema = ereoSchema(z.object({
  content: z.string().min(1).max(1000),
  parentId: z.string().optional(),
}))

// Route definition with stable type inference
export const route = defineRoute('/posts/[slug]')
  .searchParams(searchParams)
  .hashParams(hashParams)
  .loader(async ({ params, searchParams }) => {
    const post = await db.posts.findUnique({
      where: { slug: params.slug },
      include: { comments: searchParams.showComments },
    })

    if (!post) {
      throw new Response('Not Found', { status: 404 })
    }

    return { post }
  })
  .action(
    async ({ params, body, context }) => {
      const user = context.get<User>('user')

      await db.comments.create({
        data: {
          postSlug: params.slug,
          authorId: user.id,
          content: body.content,
          parentId: body.parentId,
        },
      })

      return { success: true }
    },
    { schema: commentSchema }
  )
  .head(({ data }) => ({
    title: data.post.title,
    description: data.post.excerpt,
    openGraph: {
      title: data.post.title,
      image: data.post.coverImage,
      type: 'article',
    },
  }))
  .cache({ maxAge: 60, staleWhileRevalidate: 300 })
  .build()

// Export for route module
export const { loader, action } = route
```

## Type Inference Helpers

Extract types from route definitions:

```ts
import type {
  InferLoaderData,
  InferActionData,
  InferRouteParams,
  InferRoutePath,
} from '@ereo/data'

// Extract loader data type
type PostData = InferLoaderData<typeof route>
// { post: Post }

// Extract action data type
type ActionResult = InferActionData<typeof route>
// { success: boolean }

// Extract params type
type Params = InferRouteParams<typeof route>
// { slug: string }

// Extract path type
type Path = InferRoutePath<typeof route>
// '/posts/[slug]'
```

## Types Reference

### TypedLoaderArgs

Extended loader arguments with typed params and validated parameters.

```ts
interface TypedLoaderArgs<P extends RouteParams = RouteParams> extends LoaderArgs<P> {
  /** Route parameters (typed from path pattern) */
  params: P
  /** Incoming request */
  request: Request
  /** Application context */
  context: AppContext
  /** Validated search params (if schema provided) */
  searchParams?: Record<string, unknown>
  /** Validated hash params (if schema provided) */
  hashParams?: Record<string, unknown>
}
```

### TypedActionArgs

Extended action arguments with typed body.

```ts
interface TypedActionArgs<TBody, P extends RouteParams = RouteParams> extends ActionArgs<P> {
  /** Route parameters */
  params: P
  /** Incoming request */
  request: Request
  /** Application context */
  context: AppContext
  /** Parsed and validated body */
  body: TBody
  /** Raw form data (if applicable) */
  formData?: FormData
}
```

### HeadArgs

Arguments passed to the head function.

```ts
interface HeadArgs<TLoaderData, P extends RouteParams = RouteParams> {
  /** Loader data (fully typed) */
  data: TLoaderData
  /** Route params */
  params: P
  /** Request object */
  request: Request
}
```

### TypedMetaArgs

Arguments passed to the meta function.

```ts
interface TypedMetaArgs<TLoaderData, P extends RouteParams = RouteParams> {
  /** Loader data */
  data: TLoaderData
  /** Route params */
  params: P
  /** Location info */
  location: {
    pathname: string
    search: string
    hash: string
  }
}
```

### RouteMiddleware

Middleware handler for route-level middleware.

```ts
type RouteMiddleware<P extends RouteParams = RouteParams> = (
  request: Request,
  context: AppContext,
  params: P,
  next: () => Promise<Response>
) => Response | Promise<Response>
```

### ValidationSchema

Schema interface compatible with Zod, Yup, and similar validation libraries.

```ts
interface ValidationSchema<T> {
  /** Parse and validate data (throws on error) */
  parse: (data: unknown) => T
  /** Parse safely (returns result object) */
  safeParse?: (data: unknown) =>
    | { success: true; data: T }
    | { success: false; error: unknown }
}
```

### RouteDefinition

The final output of `.build()`.

```ts
interface RouteDefinition<
  Path extends string,
  Params extends RouteParams,
  LoaderData,
  ActionData,
  ActionBody
> {
  /** The route path pattern */
  path: Path
  /** Loader function (if defined) */
  loader?: (args: LoaderArgs<Params>) => Promise<LoaderData>
  /** Action function (if defined) */
  action?: (args: ActionArgs<Params>) => Promise<ActionData>
  /** Head data generator */
  head?: (args: HeadArgs<LoaderData, Params>) => HeadData
  /** Meta tags generator */
  meta?: (args: TypedMetaArgs<LoaderData, Params>) => MetaDescriptor[]
  /** Route-level middleware */
  middleware?: RouteMiddleware<Params>[]
  /** Route configuration */
  config?: RouteConfig
  /** Cache options */
  cache?: CacheOptions
  /** Type brands for inference */
  readonly _types: {
    path: Path
    params: Params
    loaderData: LoaderData
    actionData: ActionData
    actionBody: ActionBody
  }
}
```

### Builder Types

```ts
// Initial builder (before loader)
interface RouteBuilder<Path, Params> {
  loader<TData>(fn): RouteBuilderWithLoader<Path, Params, TData>
  searchParams<T>(schema): RouteBuilder<Path, Params>
  hashParams<T>(schema): RouteBuilder<Path, Params>
  middleware(...handlers): RouteBuilder<Path, Params>
  configure(config): RouteBuilder<Path, Params>
  build(): RouteDefinition<Path, Params, never, never, never>
}

// After loader is defined
interface RouteBuilderWithLoader<Path, Params, LoaderData> {
  action<TBody, TResult>(fn, options?): RouteBuilderWithLoaderAndAction<...>
  head(fn): RouteBuilderWithLoader<Path, Params, LoaderData>
  meta(fn): RouteBuilderWithLoader<Path, Params, LoaderData>
  cache(options): RouteBuilderWithLoader<Path, Params, LoaderData>
  middleware(...handlers): RouteBuilderWithLoader<Path, Params, LoaderData>
  configure(config): RouteBuilderWithLoader<Path, Params, LoaderData>
  build(): RouteDefinition<Path, Params, LoaderData, never, never>
}

// After both loader and action are defined
interface RouteBuilderWithLoaderAndAction<Path, Params, LoaderData, ActionData, ActionBody> {
  head(fn): RouteBuilderWithLoaderAndAction<...>
  meta(fn): RouteBuilderWithLoaderAndAction<...>
  cache(options): RouteBuilderWithLoaderAndAction<...>
  middleware(...handlers): RouteBuilderWithLoaderAndAction<...>
  configure(config): RouteBuilderWithLoaderAndAction<...>
  build(): RouteDefinition<Path, Params, LoaderData, ActionData, ActionBody>
}
```

## TanStack Start Comparison

| Feature | TanStack Start | EreoJS |
|---------|---------------|--------|
| Path param inference | Breaks with loader | Stable |
| Adding head breaks types | Yes | No |
| Adding meta breaks types | Yes | No |
| Search params per route | Limited | Full |
| Hash params per route | No | Yes |
| Builder pattern | No | Yes |
| Zero-config types | No | Yes |

## Related

- [Type-Safe Routing](/api/core/type-safe-routing) - Overview
- [Schema Adapters](/api/data/schema-adapters) - Validation
- [TypedLink Component](/api/client/typed-link) - Navigation
