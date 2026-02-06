# Loaders

Loaders fetch data on the server before rendering a route component. They are the primary way to get data into your pages.

> **Not sure which approach to use?** See the [Data Loading overview](/concepts/data-loading) for a comparison of all three approaches (plain export, createLoader, defineRoute).

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

Creates a type-safe loader function. Accepts either a **plain function** (shorthand) or an **options object** (with caching, transforms, and error handling).

### Signature

```ts
// Shorthand — pass a function directly
function createLoader<T, P extends RouteParams = RouteParams>(
  fn: (args: LoaderArgs<P>) => T | Promise<T>
): LoaderFunction<T, P>

// Full options — with caching, transforms, error handling
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

### LoaderArgs

```ts
interface LoaderArgs<P = RouteParams> {
  request: Request;    // The incoming Request object
  params: P;           // URL parameters from dynamic segments
  context: AppContext;  // App context (cookies, headers, session, etc.)
}
```

### Examples

#### Shorthand (Plain Function)

The simplest way to use `createLoader` — just pass an async function:

```ts
export const loader = createLoader(async ({ params }) => {
  const post = await db.posts.findUnique({ where: { slug: params.slug } });
  if (!post) throw new Response('Not Found', { status: 404 });
  return { post };
});
```

This is equivalent to a plain function export but signals intent more clearly:

```ts
// These two are equivalent:
export const loader = createLoader(async (args) => { ... })
export async function loader(args) { ... }
```

#### Options Object (With Features)

Use the options object when you need caching, transforms, or error handling:

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

#### Typed Loader

```ts
interface PostData {
  post: Post;
  comments: Comment[];
}

interface PostParams {
  slug: string;
}

export const loader = createLoader<PostData, PostParams>({
  load: async ({ params }) => {
    const post = await db.posts.findUnique({ where: { slug: params.slug } });
    const comments = await db.comments.findMany({ where: { postId: post.id } });
    return { post, comments };
  },
});
```

## Plain Function Export (Alternative)

You can also export a plain async function as `loader`. No imports needed:

```ts
import type { LoaderArgs } from '@ereo/core'

export async function loader({ params }: LoaderArgs<{ id: string }>) {
  const post = await db.posts.find(params.id);
  if (!post) throw new Response('Not Found', { status: 404 });
  return { post };
}
```

This works because the EreoJS server calls whatever function is exported as `loader`. The `createLoader` helpers add features like caching and transforms on top.

## defer

Defers data loading for streaming responses. Wrap a promise in `defer()` to stream the data to the client after the initial page render.

### Signature

```ts
function defer<T>(promise: Promise<T>): DeferredData<T>
```

### Example

```ts
export const loader = createLoader(async ({ params }) => {
  // Critical data — awaited before render
  const post = await db.posts.find(params.id)

  // Non-critical data — deferred and streamed later
  const comments = defer(db.comments.findByPost(params.id))
  const related = defer(db.posts.findRelated(params.id))

  return { post, comments, related }
})
```

In the component, use `<Suspense>` and `<Await>`:

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

Type guard to check if a value is deferred data.

```ts
function isDeferred<T>(value: unknown): value is DeferredData<T>
```

```ts
if (isDeferred(loaderData.comments)) {
  const resolved = await resolveDeferred(loaderData.comments)
} else {
  const comments = loaderData.comments
}
```

## resolveDeferred

Resolves deferred data to its actual value.

```ts
function resolveDeferred<T>(deferred: DeferredData<T>): Promise<T>
```

## fetchData

Utility for fetching JSON data with error handling. Throws `FetchError` on non-OK responses.

```ts
function fetchData<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T>
```

```ts
export const loader = createLoader(async () => {
  const users = await fetchData<User[]>('https://api.example.com/users')
  return { users }
})
```

## FetchError

Error thrown when `fetchData` receives a non-OK response:

```ts
class FetchError extends Error {
  response: Response;
  get status(): number;
  get statusText(): string;
}
```

## combineLoaders

Combines multiple loaders into one. All loaders run in parallel.

### Signature

```ts
function combineLoaders<T extends Record<string, LoaderFunction<unknown>>>(
  loaders: T
): LoaderFunction<{ [K in keyof T]: Awaited<ReturnType<T[K]>> }>
```

### Example

```ts
const userLoader = createLoader(async ({ request }) => {
  return { user: await getUser(request) }
})

const settingsLoader = createLoader(async () => {
  return { settings: await getSettings() }
})

// Both run in parallel. Returns { user: {...}, settings: {...} }
export const loader = combineLoaders({
  user: userLoader,
  settings: settingsLoader,
})
```

## clientLoader

Creates a client-side loader that runs in the browser after hydration.

### Signature

```ts
function clientLoader<T, P extends RouteParams = RouteParams>(
  load: (params: P) => T | Promise<T>
): LoaderFunction<T, P>
```

### Example

```ts
// Server loader — initial data
export const loader = createLoader(async ({ params }) => {
  return { post: await db.posts.find(params.id) }
})

// Client loader — runs on client after hydration
export const clientLoader = clientLoader(async (params) => {
  const response = await fetch(`/api/posts/${params.id}`)
  return { post: await response.json() }
})
```

## serializeLoaderData / parseLoaderData

Serializes and deserializes loader data for transport. `serializeLoaderData` escapes dangerous characters to prevent XSS.

```ts
const serialized = serializeLoaderData(data)
const data = parseLoaderData<T>(serialized)
```

## Response Handling

Loaders can throw `Response` objects for redirects and errors:

```ts
import { redirect } from '@ereo/data'

export const loader = createLoader(async ({ request, params }) => {
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

  return { post }
})
```

## Best Practices

1. **Start with the shorthand** — Use `createLoader(fn)` until you need options
2. **Use defer for slow data** — Don't block rendering on non-critical content
3. **Handle errors explicitly** — Throw `Response` objects with appropriate status codes
4. **Type your loaders** — Use generics for type safety
5. **Consider caching** — Use the options object form when data can be cached
6. **Keep loaders focused** — One responsibility per loader, combine if needed

## Related

- [Data Loading Concepts](/concepts/data-loading) — Overview of all approaches
- [Actions](/api/data/actions) — Handling mutations
- [Caching](/api/data/cache) — Cache configuration
- [defineRoute Builder](/api/data/define-route) — Builder pattern
- [useLoaderData](/api/client/hooks#useloaderdata) — Client hook
