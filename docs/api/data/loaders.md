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
  FetchError,
  serializeLoaderData,
  parseLoaderData,
  combineLoaders,
  clientLoader,
} from '@ereo/data';
```

## createLoader

Creates a type-safe loader function.

### Signature

```ts
function createLoader<T, P extends RouteParams = RouteParams>(
  options: LoaderOptions<T, P>
): LoaderFunction<T, P>
```

### LoaderOptions

```ts
interface LoaderOptions<T, P extends RouteParams = RouteParams> {
  load: (args: LoaderArgs<P>) => T | Promise<T>;
  cache?: CacheOptions;
  transform?: (data: Awaited<T>, args: LoaderArgs<P>) => Awaited<T> | Promise<Awaited<T>>;
  onError?: (error: Error, args: LoaderArgs<P>) => T | Response | Promise<T | Response>;
}
```

### Examples

#### Basic Loader

```ts
export const loader = createLoader({
  load: async ({ params }) => {
    const post = await db.posts.findUnique({ where: { slug: params.slug } });
    return { post };
  },
});
```

#### With Caching

```ts
export const loader = createLoader({
  load: async ({ params }) => {
    return db.posts.findMany({ where: { authorId: params.userId } });
  },
  cache: {
    maxAge: 60,
    staleWhileRevalidate: 300,
    tags: ['posts'],
  },
});
```

#### With Transform

```ts
export const loader = createLoader({
  load: async () => {
    return db.posts.findMany();
  },
  transform: (posts) => ({
    posts,
    count: posts.length,
  }),
});
```

#### With Error Handling

```ts
export const loader = createLoader({
  load: async ({ params }) => {
    return externalApi.getUser(params.id);
  },
  onError: (error, { params }) => {
    console.error(`Failed to fetch user ${params.id}:`, error);
    return { user: null, error: 'Failed to load user' };
  },
});
```

## defer

Defers data loading for streaming responses.

```ts
function defer<T>(promise: Promise<T>): DeferredData<T>
```

### Example

```ts
export const loader = createLoader({
  load: async ({ params }) => {
    const post = await db.posts.find(params.id);
    const comments = defer(db.comments.findByPost(params.id));
    return { post, comments };
  },
});
```

## isDeferred

Type guard for deferred data.

```ts
function isDeferred<T>(value: unknown): value is DeferredData<T>
```

## resolveDeferred

Resolves deferred data.

```ts
function resolveDeferred<T>(deferred: DeferredData<T>): Promise<T>
```

## fetchData

Fetches JSON data with error handling.

```ts
function fetchData<T>(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<T>
```

Throws `FetchError` on non-OK responses.

## FetchError

Error thrown when fetch fails:

```ts
class FetchError extends Error {
  response: Response;
  get status(): number;
  get statusText(): string;
}
```

## serializeLoaderData / parseLoaderData

Serializes and deserializes loader data for transport:

```ts
const serialized = serializeLoaderData(data);
const data = parseLoaderData<T>(serialized);
```

## combineLoaders

Combines multiple loaders into one.

```ts
function combineLoaders<T extends Record<string, LoaderFunction<unknown>>>(
  loaders: T
): LoaderFunction<{ [K in keyof T]: Awaited<ReturnType<T[K]>> }>
```

## clientLoader

Creates a client-side loader.

```ts
function clientLoader<T, P extends RouteParams = RouteParams>(
  load: (params: P) => T | Promise<T>
): LoaderFunction<T, P>
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
