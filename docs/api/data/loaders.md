# Loaders

Loaders fetch data on the server before rendering a route component.

## Import

```ts
import {
  createLoader,
  defer,
  isDeferred,
  resolveDeferred,
  fetchData,
  serializeLoaderData,
  parseLoaderData,
  combineLoaders,
  clientLoader
} from '@ereo/data'
```

## createLoader

Creates a type-safe loader function.

### Signature

```ts
function createLoader<T, P = Record<string, string>>(
  options: LoaderOptions<T, P> | LoaderHandler<T, P>
): LoaderFunction<T, P>
```

### Parameters

```ts
interface LoaderOptions<T, P> {
  // The loader handler function
  handler: LoaderHandler<T, P>

  // Cache configuration
  cache?: {
    ttl?: number
    tags?: string[]
  }

  // Validation for params
  validate?: (params: P) => boolean
}

type LoaderHandler<T, P> = (args: LoaderArgs<P>) => T | Promise<T>

interface LoaderArgs<P> {
  request: Request
  params: P
  context: RequestContext
}
```

### Examples

#### Basic Loader

```ts
export const loader = createLoader(async ({ params }) => {
  const post = await db.posts.find(params.id)
  return { post }
})
```

#### With Options

```ts
export const loader = createLoader({
  handler: async ({ params }) => {
    const post = await db.posts.find(params.id)
    return { post }
  },
  cache: {
    ttl: 3600,
    tags: ['posts']
  },
  validate: (params) => /^\d+$/.test(params.id)
})
```

#### With Request Context

```ts
export const loader = createLoader(async ({ request, context }) => {
  // Access cookies
  const sessionId = request.headers.get('Cookie')?.match(/session=([^;]+)/)?.[1]

  // Access context data (set by middleware)
  const user = context.get('user')

  // Set cache headers
  context.cache.set({ maxAge: 60 })

  return { user, posts: await getPosts(user.id) }
})
```

## defer

Defers data loading for streaming responses.

### Signature

```ts
function defer<T>(promise: Promise<T>): DeferredData<T>
```

### Example

```ts
export const loader = createLoader(async ({ params }) => {
  // Critical data - awaited immediately
  const post = await db.posts.find(params.id)

  // Non-critical data - deferred
  const comments = defer(db.comments.findByPost(params.id))
  const related = defer(db.posts.findRelated(params.id))

  return { post, comments, related }
})
```

In the component:

```tsx
import { Suspense } from 'react'
import { Await } from '@ereo/client'

export default function Post({ loaderData }) {
  return (
    <article>
      <h1>{loaderData.post.title}</h1>

      <Suspense fallback={<LoadingComments />}>
        <Await resolve={loaderData.comments}>
          {(comments) => <CommentList comments={comments} />}
        </Await>
      </Suspense>
    </article>
  )
}
```

## isDeferred

Type guard for deferred data.

### Signature

```ts
function isDeferred<T>(value: unknown): value is DeferredData<T>
```

### Example

```ts
const maybeDeferred = loaderData.comments

if (isDeferred(maybeDeferred)) {
  // Handle as deferred
  const resolved = await resolveDeferred(maybeDeferred)
} else {
  // Handle as regular data
  const comments = maybeDeferred
}
```

## resolveDeferred

Resolves deferred data to its actual value.

### Signature

```ts
function resolveDeferred<T>(deferred: DeferredData<T>): Promise<T>
```

### Example

```ts
const comments = defer(fetchComments())

// Later...
const resolvedComments = await resolveDeferred(comments)
```

## fetchData

Utility for fetching JSON data with error handling.

### Signature

```ts
function fetchData(url: string, options?: RequestInit): Promise<any>
```

### Example

```ts
export const loader = createLoader(async () => {
  const users = await fetchData('https://api.example.com/users')
  return { users }
})
```

### FetchError

Thrown when fetch fails:

```ts
class FetchError extends Error {
  status: number
  statusText: string
  url: string
}
```

## combineLoaders

Combines multiple loaders into one.

### Signature

```ts
function combineLoaders<T extends LoaderFunction[]>(
  ...loaders: T
): LoaderFunction<CombinedData<T>>
```

### Example

```ts
const userLoader = createLoader(async ({ request }) => {
  const user = await getUser(request)
  return { user }
})

const settingsLoader = createLoader(async () => {
  const settings = await getSettings()
  return { settings }
})

// Combined loader returns { user, settings }
export const loader = combineLoaders(userLoader, settingsLoader)
```

## clientLoader

Creates a client-side loader that runs after hydration.

### Signature

```ts
function clientLoader<T>(
  fn: (params: Record<string, string>) => T | Promise<T>
): ClientLoaderFunction<T>
```

### Example

```ts
// Server loader
export const loader = createLoader(async ({ params }) => {
  return { post: await db.posts.find(params.id) }
})

// Client loader - runs on client after hydration
export const clientLoader = clientLoader(async (params) => {
  // Fetch fresh data on the client
  const response = await fetch(`/api/posts/${params.id}`)
  return { post: await response.json() }
})
```

## serializeLoaderData

Serializes loader data for transport to the client.

### Signature

```ts
function serializeLoaderData(data: unknown): string
```

### Example

```ts
const data = { user: { id: 1, name: 'Alice' } }
const serialized = serializeLoaderData(data)
// '{"user":{"id":1,"name":"Alice"}}'
```

## parseLoaderData

Parses serialized loader data.

### Signature

```ts
function parseLoaderData(json: string): unknown
```

### Example

```ts
const json = '{"user":{"id":1,"name":"Alice"}}'
const data = parseLoaderData(json)
// { user: { id: 1, name: 'Alice' } }
```

## Response Handling

Loaders can throw Response objects for redirects and errors:

```ts
import { redirect } from '@ereo/data'

export const loader = createLoader(async ({ request }) => {
  const user = await getUser(request)

  // Redirect if not authenticated
  if (!user) {
    throw redirect('/login')
  }

  // Throw 404
  const post = await db.posts.find(params.id)
  if (!post) {
    throw new Response('Not Found', { status: 404 })
  }

  // Throw 403
  if (post.authorId !== user.id) {
    throw new Response('Forbidden', { status: 403 })
  }

  return { post }
})
```

## Best Practices

1. **Keep loaders focused** - One responsibility per loader
2. **Use defer for slow data** - Don't block on non-critical data
3. **Handle errors explicitly** - Throw appropriate Response objects
4. **Type your loaders** - Use generics for type safety
5. **Validate params** - Use the validate option for input validation
6. **Consider caching** - Use cache options for frequently accessed data

## Related

- [Data Loading Concepts](/core-concepts/data-loading)
- [Actions](/api/data/actions)
- [Caching](/api/data/cache)
- [useLoaderData](/api/client/hooks#useloaderdata)
