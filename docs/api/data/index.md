# Data Loading System

The `@ereo/data` package provides a unified, type-safe data loading system for EreoJS. It follows a simple pattern: explicit data fetching with transparent caching.

## Installation

```bash
bun add @ereo/data
```

## Overview

The data package provides four main capabilities:

1. **Loaders** - Server-side data fetching before render
2. **Actions** - Handle form submissions and mutations
3. **Caching** - Transparent cache with tag-based invalidation
4. **Pipelines** - Automatic parallelization of data sources

```ts
import {
  // Loaders
  createLoader,
  defer,
  combineLoaders,
  clientLoader,

  // Actions
  createAction,
  typedAction,
  jsonAction,

  // Caching
  cached,
  cacheKey,
  MemoryCache,

  // Revalidation
  revalidateTag,
  revalidatePath,
  tags,

  // Pipelines
  createPipeline,
  dataSource,
  cachedSource,
} from '@ereo/data'
```

## Choosing an Approach

EreoJS supports three ways to define loaders and actions, from simplest to most feature-rich:

| Approach | When to Use | Features |
|----------|-------------|----------|
| **Plain function export** | Quick prototyping, simple routes | None — you handle everything yourself |
| **`createLoader` / `createAction`** | Most routes (recommended) | Caching, validation, transforms, error handling |
| **`defineRoute` builder** | Complex routes, full type safety | All of the above + stable inference across head/meta |

> For a detailed comparison with examples, see the [Data Loading concepts guide](/concepts/data-loading).

## Quick Start

### Plain Function Export (Simplest)

No imports from `@ereo/data` needed — just export a function named `loader` or `action`:

```tsx
// routes/posts/index.tsx
import type { LoaderArgs, ActionArgs } from '@ereo/core'

export async function loader({ params }: LoaderArgs) {
  const posts = await db.posts.findMany()
  return { posts }
}

export async function action({ request }: ActionArgs) {
  const formData = await request.formData()
  await db.posts.create({ title: formData.get('title') })
  return { success: true }
}

export default function Posts({ loaderData }) {
  return <ul>{loaderData.posts.map(p => <li key={p.id}>{p.title}</li>)}</ul>
}
```

### createLoader / createAction (Recommended)

Use `createLoader` and `createAction` when you need caching, validation, or error handling. Pass either a **plain function** (shorthand) or an **options object** (full features):

```tsx
// routes/posts/[slug]/page.tsx
import { createLoader, createAction, redirect } from '@ereo/data'

// Shorthand loader — just a function
export const loader = createLoader(async ({ params }) => {
  const post = await db.posts.findUnique({ where: { slug: params.slug } })
  if (!post) throw new Response('Not Found', { status: 404 })
  return { post }
})

// Options object loader — with caching
export const loader = createLoader({
  load: async ({ params }) => {
    const post = await db.posts.findUnique({ where: { slug: params.slug } })
    if (!post) throw new Response('Not Found', { status: 404 })
    return { post }
  },
  cache: { maxAge: 300, tags: ['posts'] },
})

export default function PostPage({ loaderData }) {
  return <article>{loaderData.post.title}</article>
}
```

```tsx
// Shorthand action — you parse formData yourself
export const action = createAction(async ({ request }) => {
  const formData = await request.formData()
  const title = formData.get('title') as string
  await db.posts.create({ data: { title } })
  return redirect('/posts')
})

// Options object action — with auto-parsed formData and validation
export const action = createAction({
  handler: async ({ formData }) => {
    const title = formData.get('title') as string
    await db.posts.create({ data: { title } })
    return redirect('/posts')
  },
  validate: (formData) => {
    const errors: Record<string, string[]> = {}
    if (!formData.get('title')) {
      errors.title = ['Title is required']
    }
    return { success: Object.keys(errors).length === 0, errors }
  },
})
```

### defineRoute Builder (Full Type Safety)

Use `defineRoute` when you need stable type inference across loader, action, head, and meta:

```tsx
// routes/posts/[slug].tsx
import { defineRoute } from '@ereo/data'

export const route = defineRoute('/posts/[slug]')
  .loader(async ({ params }) => {
    const post = await db.posts.findUnique({ where: { slug: params.slug } })
    if (!post) throw new Response('Not Found', { status: 404 })
    return { post }
  })
  .head(({ data }) => ({
    title: data.post.title,         // Types flow through — never breaks!
    description: data.post.excerpt,
  }))
  .cache({ maxAge: 60 })
  .build()

export const { loader } = route
```

> See [defineRoute Builder](/api/data/define-route) for the full API reference.

## Loaders API

### createLoader

Creates a type-safe loader function. Accepts a **plain function** (shorthand) or an **options object** (with caching, transforms, error handling).

```ts
// Shorthand
function createLoader<T, P = RouteParams>(
  fn: (args: LoaderArgs<P>) => T | Promise<T>
): LoaderFunction<T, P>

// Full options
function createLoader<T, P = RouteParams>(
  options: LoaderOptions<T, P>
): LoaderFunction<T, P>
```

#### Options

```ts
interface LoaderOptions<T, P> {
  // The data fetching function
  load: (args: LoaderArgs<P>) => T | Promise<T>

  // Default cache options
  cache?: CacheOptions

  // Transform loaded data
  transform?: (data: T, args: LoaderArgs<P>) => T | Promise<T>

  // Error handler
  onError?: (error: Error, args: LoaderArgs<P>) => T | Response | Promise<T | Response>
}

interface LoaderArgs<P> {
  request: Request
  params: P
  context: AppContext
}
```

#### Examples

```ts
// Simple loader
export const loader = createLoader({
  load: async ({ params }) => {
    return db.users.findUnique({ where: { id: params.id } })
  },
})

// With caching and transformation
export const loader = createLoader({
  load: async ({ params }) => {
    return db.posts.findMany({ where: { authorId: params.userId } })
  },
  cache: {
    maxAge: 60,
    staleWhileRevalidate: 300,
    tags: ['posts'],
  },
  transform: (posts) => ({
    posts,
    count: posts.length,
  }),
})

// With error handling
export const loader = createLoader({
  load: async ({ params }) => {
    return externalApi.getUser(params.id)
  },
  onError: (error, { params }) => {
    console.error(`Failed to fetch user ${params.id}:`, error)
    return { user: null, error: 'Failed to load user' }
  },
})
```

### defer

Defer non-critical data for streaming.

```ts
function defer<T>(promise: Promise<T>): DeferredData<T>
```

```ts
export const loader = createLoader({
  load: async ({ params }) => {
    // Critical data - awaited
    const post = await db.posts.find(params.id)

    // Non-critical - deferred
    const comments = defer(db.comments.findByPost(params.id))
    const related = defer(db.posts.findRelated(params.id))

    return { post, comments, related }
  },
})
```

Use with Suspense in components:

```tsx
import { Suspense } from 'react'
import { Await } from '@ereo/client'

export default function PostPage({ loaderData }) {
  const { post, comments } = loaderData

  return (
    <article>
      <h1>{post.title}</h1>

      <Suspense fallback={<LoadingComments />}>
        <Await resolve={comments}>
          {(data) => <CommentList comments={data} />}
        </Await>
      </Suspense>
    </article>
  )
}
```

### combineLoaders

Combine multiple loaders to run in parallel.

```ts
function combineLoaders<T extends Record<string, LoaderFunction>>(
  loaders: T
): LoaderFunction<{ [K in keyof T]: ReturnType<T[K]> }>
```

```ts
const userLoader = createLoader({
  load: ({ request }) => getUser(request),
})

const settingsLoader = createLoader({
  load: () => getSettings(),
})

const notificationsLoader = createLoader({
  load: ({ context }) => getNotifications(context.get('user')),
})

// All run in parallel
export const loader = combineLoaders({
  user: userLoader,
  settings: settingsLoader,
  notifications: notificationsLoader,
})
```

### clientLoader

Create client-side only loaders.

```ts
function clientLoader<T, P = RouteParams>(
  load: (params: P) => T | Promise<T>
): LoaderFunction<T, P>
```

```ts
import { createLoader, clientLoader as createClientLoader } from '@ereo/data'

// Server loader
export const loader = createLoader({
  load: async ({ params }) => {
    return { post: await db.posts.find(params.id) }
  },
})

// Client loader - runs after hydration
// Note: use an import alias to avoid the naming conflict with the route export
export const clientLoader = createClientLoader(async (params) => {
  const response = await fetch(`/api/posts/${params.id}/stats`)
  return { stats: await response.json() }
})
```

### Helper Functions

```ts
// Fetch with error handling
const data = await fetchData<User[]>('https://api.example.com/users')

// Serialize for transport
const json = serializeLoaderData({ user: { id: 1 } })

// Parse on client
const data = parseLoaderData<{ user: User }>(json)

// Check if deferred
if (isDeferred(value)) {
  const resolved = await resolveDeferred(value)
}
```

## Actions API

### createAction

Create type-safe form action handlers. Accepts a **plain function** (shorthand) or an **options object** (with validation, auto-parsed FormData, error handling).

```ts
// Shorthand
function createAction<T, P = RouteParams>(
  fn: (args: ActionArgs<P>) => T | Promise<T>
): ActionFunction<T, P>

// Full options
function createAction<T, P = RouteParams>(
  options: ActionOptions<T, P>
): ActionFunction<T, P>
```

#### Options

```ts
interface ActionOptions<T, P> {
  // Handle form submission
  handler: (args: ActionArgs<P> & { formData: FormData }) => T | Promise<T>

  // Validate form data
  validate?: (formData: FormData) => ValidationResult | Promise<ValidationResult>

  // Error handler
  onError?: (error: Error, args: ActionArgs<P>) => T | Response | Promise<T | Response>
}

interface ActionResult<T> {
  success: boolean
  data?: T
  errors?: Record<string, string[]>
}
```

#### Examples

```ts
// Basic action
export const action = createAction({
  handler: async ({ formData }) => {
    const email = formData.get('email') as string
    await newsletter.subscribe(email)
    return { subscribed: true }
  },
})

// With validation
export const action = createAction({
  handler: async ({ formData, context }) => {
    const user = context.get('user')
    const title = formData.get('title') as string

    return db.posts.create({
      data: { title, authorId: user.id }
    })
  },
  validate: (formData) => {
    const errors: Record<string, string[]> = {}

    const title = formData.get('title')
    if (!title || (title as string).length < 3) {
      errors.title = ['Title must be at least 3 characters']
    }

    return { success: Object.keys(errors).length === 0, errors }
  },
})
```

### typedAction

Create actions with typed body data (supports JSON and FormData).

```ts
function typedAction<TBody, TResult = TBody, P = RouteParams>(
  options: TypedActionOptions<TBody, TResult, P>
): ActionFunction<ActionResult<TResult>, P>
```

```ts
interface CreatePostInput {
  title: string
  content: string
  tags: string[]
  published: boolean
}

export const action = typedAction<CreatePostInput>({
  handler: async ({ body, context }) => {
    // body is typed as CreatePostInput
    return db.posts.create({
      data: {
        ...body,
        authorId: context.get('user').id,
      }
    })
  },
})
```

### jsonAction

Actions that only accept JSON payloads.

```ts
function jsonAction<TBody, TResult = TBody, P = RouteParams>(
  options: TypedActionOptions<TBody, TResult, P> & { strict?: boolean }
): ActionFunction<ActionResult<TResult>, P>
```

```ts
export const action = jsonAction<{ ids: number[] }>({
  strict: true,  // Returns 415 if not JSON
  handler: async ({ body }) => {
    await db.posts.deleteMany({
      where: { id: { in: body.ids } }
    })
    return { deleted: body.ids.length }
  },
})
```

### Schema Validation

Use Zod or similar libraries for validation:

```ts
import { z } from 'zod'

const CreatePostSchema = z.object({
  title: z.string().min(1).max(200),
  content: z.string().min(10),
  tags: z.array(z.string()).default([]),
  published: z.boolean().default(false),
})

export const action = typedAction({
  schema: CreatePostSchema,
  handler: async ({ body }) => {
    // body is inferred from schema
    return db.posts.create({ data: body })
  },
})
```

### Response Helpers

```ts
import { redirect, json, error } from '@ereo/data'

// Redirect
throw redirect('/login', 302)
throw redirect('/posts', 303)  // POST -> GET

// JSON response
return json({ status: 'ok' }, { status: 200 })

// Error response
throw error('Not authorized', 403)
```

### Form Data Utilities

```ts
import {
  parseFormData,
  formDataToObject,
  validateRequired,
  combineValidators,
  coerceValue,
} from '@ereo/data'

// Parse form data with type coercion
const data = formDataToObject<{
  name: string
  age: number
  active: boolean
  tags: string[]
}>(formData)
// Handles: numbers, booleans, arrays, nested objects

// Validate required fields
const result = validateRequired(formData, ['name', 'email'])

// Combine validators
const validate = combineValidators(
  (fd) => validateRequired(fd, ['email']),
  (fd) => validateEmail(fd.get('email')),
)
```

## Caching

### cached

Wrap any async function with caching.

```ts
function cached<T>(
  key: string,
  fn: () => Promise<T>,
  options: CacheOptions
): Promise<T>
```

```ts
import { cached, cacheKey } from '@ereo/data'

export const loader = createLoader({
  load: async ({ params }) => {
    const post = await cached(
      cacheKey('post', params.slug),
      () => db.posts.findUnique({ where: { slug: params.slug } }),
      { maxAge: 300, tags: ['posts', `post:${params.slug}`] }
    )

    return { post }
  },
})
```

### Cache Options

```ts
interface CacheOptions {
  // Maximum age in seconds
  maxAge?: number

  // Serve stale while revalidating (seconds)
  staleWhileRevalidate?: number

  // Cache tags for invalidation
  tags?: string[]

  // Private cache (per-user)
  private?: boolean
}
```

### MemoryCache

Direct cache access for advanced use cases.

```ts
import { MemoryCache, getCache, setCache } from '@ereo/data'

// Get global cache instance
const cache = getCache()

// Set cache entry
await cache.set('key', {
  value: data,
  timestamp: Date.now(),
  maxAge: 300,
  tags: ['posts'],
})

// Get cache entry
const entry = await cache.get<Post>('key')
if (entry && !isExpired(entry)) {
  return entry.value
}

// Delete by tag
await cache.deleteByTag('posts')

// Clear all
await cache.clear()
```

### Cache Key Generation

```ts
import { cacheKey, generateCacheKey } from '@ereo/data'

// Generate key from parts
const key = cacheKey('posts', userId, 'recent')
// 'posts:123:recent'

// Generate from request
const key = generateCacheKey(request)
// 'GET:/api/posts?limit=10'
```

### Cache-Control Headers

```ts
import { buildCacheControl, parseCacheControl } from '@ereo/data'

const header = buildCacheControl({
  maxAge: 300,
  staleWhileRevalidate: 600,
  private: false,
})
// 'public, max-age=300, stale-while-revalidate=600'

const options = parseCacheControl('public, max-age=300')
// { maxAge: 300 }
```

### @Cached Decorator

For class-based APIs:

```ts
import { Cached } from '@ereo/data'

class PostService {
  @Cached({ maxAge: 300, tags: ['posts'] })
  async getPost(id: string) {
    return db.posts.find(id)
  }
}
```

## Revalidation

### revalidateTag

Invalidate cached data by tag.

```ts
import { revalidateTag } from '@ereo/data'

// In an action after mutation
export const action = createAction({
  handler: async ({ formData }) => {
    await db.posts.create({ data: { title: formData.get('title') } })

    // Invalidate all posts cache
    await revalidateTag('posts')

    return redirect('/posts')
  },
})
```

### revalidatePath

Invalidate by URL path.

```ts
import { revalidatePath } from '@ereo/data'

// Invalidate specific path
await revalidatePath('/posts')
await revalidatePath('/posts/my-post')
```

### revalidate

Combined revalidation options.

```ts
import { revalidate } from '@ereo/data'

await revalidate({
  tags: ['posts', 'comments'],
  paths: ['/posts', '/feed'],
})

// Clear everything
await revalidate({ all: true })
```

### Tag Helpers

```ts
import { tags } from '@ereo/data'

// Resource tag: 'post:123'
const postTag = tags.resource('post', post.id)

// Collection tag: 'posts'
const postsTag = tags.collection('posts')

// User-scoped tag: 'user:456:posts'
const userPostsTag = tags.userScoped(userId, 'posts')
```

### On-Demand Revalidation

```ts
import { onDemandRevalidate } from '@ereo/data'

// Revalidate tags and paths in one call
await onDemandRevalidate(
  'posts',           // tag
  'comments',        // tag
  '/posts',          // path (starts with /)
  '/feed',           // path
)
```

### Revalidation Handler

Create an API endpoint for external revalidation:

```ts
// routes/api/revalidate.ts
import { createRevalidationHandler } from '@ereo/data'

// Use POST export for API routes (see Routing > API Routes)
export const POST = createRevalidationHandler(process.env.REVALIDATE_SECRET)
```

Call from external services:

```bash
curl -X POST https://example.com/api/revalidate \
  -H "Authorization: Bearer secret-token" \
  -H "Content-Type: application/json" \
  -d '{"tags": ["posts"]}'
```

### unstable_cache

Next.js-compatible caching wrapper:

```ts
import { unstable_cache } from '@ereo/data'

const getCachedPosts = unstable_cache(
  async (userId: string) => {
    return db.posts.findMany({ where: { authorId: userId } })
  },
  ['posts', 'by-user'],
  { tags: ['posts'], revalidate: 3600 }
)

const posts = await getCachedPosts(userId)
```

## Data Pipelines

Pipelines provide automatic parallelization with dependency management.

### createPipeline

```ts
function createPipeline<TLoaders, P = RouteParams>(
  config: PipelineConfig<TLoaders, P>
): Pipeline<TLoaders, P>
```

```ts
import { createPipeline, dataSource, cachedSource } from '@ereo/data'

const pipeline = createPipeline({
  loaders: {
    user: dataSource(async ({ context }) => {
      return context.get('user')
    }),

    posts: cachedSource(
      async ({ data }) => {
        // Access user from previous loader
        return db.posts.findMany({ where: { authorId: data.user.id } })
      },
      { tags: ['posts'], ttl: 300 }
    ),

    stats: dataSource(async ({ data }) => {
      return db.stats.getForUser(data.user.id)
    }),

    comments: dataSource(async ({ data }) => {
      const postIds = data.posts.map(p => p.id)
      return db.comments.findMany({ where: { postId: { in: postIds } } })
    }),
  },

  dependencies: {
    posts: ['user'],      // posts depends on user
    stats: ['user'],      // stats depends on user
    comments: ['posts'],  // comments depends on posts
  },

  metrics: true,  // Enable timing metrics
})

// Use as loader
export const loader = pipeline.toLoader()
```

### Execution Flow

Given the dependencies above:

```
1. user loads first (no dependencies)
2. posts and stats load in parallel (both depend only on user)
3. comments loads after posts (depends on posts)
```

### Data Source Helpers

```ts
import { dataSource, cachedSource, optionalSource } from '@ereo/data'

// Simple data source
const userSource = dataSource(async ({ params }) => {
  return db.users.find(params.id)
})

// Cached data source
const postsSource = cachedSource(
  async () => db.posts.findMany(),
  { tags: ['posts'], ttl: 300 }
)

// Optional with fallback
const prefsSource = optionalSource(
  async ({ params }) => db.preferences.find(params.userId),
  { theme: 'light', language: 'en' }  // fallback value
)
```

### Pipeline Metrics

```ts
const result = await pipeline.execute(args)

console.log(formatMetrics(result.metrics))
// Pipeline completed in 45.2ms
// Parallel efficiency: 78%
//
// Loader Timings:
//   user                 ━━──────────────── 12.3ms
//   posts                ──━━━━━━━━──────── 25.1ms
//   stats                ──━━━━━──────────  18.4ms
//   comments             ─────────━━━━━━━━  20.1ms
```

### Waterfall Detection

```ts
if (result.metrics.waterfalls.length > 0) {
  for (const waterfall of result.metrics.waterfalls) {
    console.warn(`Potential optimization: ${waterfall.suggestion}`)
  }
}
```

### Combine Pipelines

```ts
import { combinePipelines } from '@ereo/data'

const combined = combinePipelines({
  dashboard: dashboardPipeline,
  sidebar: sidebarPipeline,
})

const { dashboard, sidebar } = await combined.execute(args)
```

## Type Safety

### Typed Loaders

```ts
interface PostParams {
  slug: string
}

interface PostData {
  post: Post
  comments: Comment[]
}

export const loader = createLoader<PostData, PostParams>({
  load: async ({ params }) => {
    // params.slug is typed
    const post = await db.posts.findUnique({ where: { slug: params.slug } })
    const comments = await db.comments.findMany({ where: { postId: post.id } })
    return { post, comments }
  },
})
```

### Typed Actions

```ts
interface CreatePostInput {
  title: string
  content: string
}

interface CreatePostResult {
  post: Post
}

export const action = typedAction<CreatePostInput, CreatePostResult>({
  handler: async ({ body }) => {
    // body.title and body.content are typed
    const post = await db.posts.create({ data: body })
    return { post }
  },
})
```

## Error Handling

### Loader Errors

```ts
export const loader = createLoader({
  load: async ({ params }) => {
    const post = await db.posts.find(params.id)

    // Throw Response for HTTP errors
    if (!post) {
      throw new Response('Not Found', { status: 404 })
    }

    // Throw redirect
    if (post.redirectTo) {
      throw redirect(post.redirectTo)
    }

    return { post }
  },
  onError: (error, { params }) => {
    // Log and return fallback
    console.error(`Error loading post ${params.id}:`, error)
    return { post: null, error: 'Failed to load post' }
  },
})
```

### Action Errors

```ts
export const action = createAction({
  handler: async ({ formData }) => {
    try {
      return await db.posts.create({ ... })
    } catch (error) {
      if (error.code === 'P2002') {
        return {
          success: false,
          errors: { slug: ['This slug is already taken'] }
        }
      }
      throw error
    }
  },
  onError: (error) => {
    console.error('Action failed:', error)
    throw error('Something went wrong', 500)
  },
})
```

### FetchError

```ts
import { fetchData, FetchError } from '@ereo/data'

try {
  const data = await fetchData('https://api.example.com/users')
} catch (error) {
  if (error instanceof FetchError) {
    console.error(`Fetch failed: ${error.status} ${error.statusText}`)
    if (error.status === 404) {
      return { users: [] }
    }
  }
  throw error
}
```

## Best Practices

1. **Use createLoader for type safety** - Get full TypeScript support
2. **Defer non-critical data** - Stream secondary content
3. **Tag cache entries** - Enable targeted invalidation
4. **Use pipelines for complex pages** - Automatic parallelization
5. **Validate action inputs** - Use schema validation for complex forms
6. **Handle errors explicitly** - Provide meaningful error states
7. **Colocate loaders with routes** - Keep data logic near components

## Related

- [Loaders Reference](/api/data/loaders)
- [Actions Reference](/api/data/actions)
- [Cache Reference](/api/data/cache)
- [Revalidation Reference](/api/data/revalidation)
- [Streaming Guide](/guides/streaming)
