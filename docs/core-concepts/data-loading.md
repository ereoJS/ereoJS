# Data Loading

EreoJS provides a unified data loading pattern with **loaders** and **actions**. Loaders fetch data for rendering, while actions handle mutations (form submissions, API calls, etc.). This pattern works consistently across all rendering modes.

## Three Ways to Define Loaders and Actions

EreoJS gives you three approaches, from simplest to most feature-rich. All three are valid and produce the same result: a `loader` and/or `action` export on your route module. Pick the one that fits your needs.

| Approach | Best For | Features |
|----------|----------|----------|
| **Plain function export** | Quick prototyping, simple routes | None — you handle everything |
| **`createLoader` / `createAction`** | Most routes | Caching, validation, transforms, error handling |
| **`defineRoute` builder** | Complex routes needing full type safety | All of the above + stable type inference across head/meta/middleware |

> **New to EreoJS?** Start with plain function exports — this is what the `create-ereo` starter templates use. Move to `createLoader`/`createAction` when you need caching or validation. Use `defineRoute` when type inference across head/meta matters.

### Approach 1: Plain Function Export

Export an `async function` named `loader` or `action`. This is the simplest form — no imports needed from `@ereo/data`.

```tsx
// routes/posts/index.tsx
import type { LoaderArgs, ActionArgs } from '@ereo/core'

export async function loader({ request, params, context }: LoaderArgs) {
  const posts = await db.posts.findMany()
  return { posts }
}

export async function action({ request, params, context }: ActionArgs) {
  const formData = await request.formData()
  const title = formData.get('title') as string
  await db.posts.create({ title })
  return { success: true }
}

export default function Posts({ loaderData }) {
  return (
    <ul>
      {loaderData.posts.map(post => (
        <li key={post.id}>{post.title}</li>
      ))}
    </ul>
  )
}
```

### Approach 2: createLoader / createAction

Import helpers from `@ereo/data` to get built-in caching, validation, transforms, and error handling. You can pass either a **plain function** (shorthand) or an **options object** (full features).

```tsx
// routes/posts/index.tsx
import { createLoader, createAction, redirect } from '@ereo/data'

// Shorthand — pass a function directly
export const loader = createLoader(async ({ params }) => {
  const posts = await db.posts.findMany()
  return { posts }
})

// Full options — with caching, transforms, error handling
export const loader = createLoader({
  load: async ({ params }) => {
    return db.posts.findMany()
  },
  cache: { maxAge: 60, tags: ['posts'] },
  transform: (posts) => ({ posts, count: posts.length }),
  onError: (error) => ({ posts: [], count: 0 }),
})
```

```tsx
// Shorthand action — you handle formData manually
export const action = createAction(async ({ request }) => {
  const formData = await request.formData()
  const title = formData.get('title') as string
  await db.posts.create({ title })
  return redirect('/posts')
})

// Full options action — with automatic FormData parsing and validation
export const action = createAction({
  handler: async ({ formData }) => {
    // formData is already parsed for you
    const title = formData.get('title') as string
    return db.posts.create({ title })
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

> **When to use which form?** Use the shorthand when you just need a simple loader/action. Use the options object when you need caching, validation, transforms, or custom error handling.

### Approach 3: defineRoute Builder

The `defineRoute` builder provides the best type inference. Types flow through the entire chain — adding `head()` or `meta()` never breaks loader type inference (a known limitation in some other frameworks).

```tsx
// routes/posts/[slug].tsx
import { defineRoute } from '@ereo/data'
import { z } from 'zod'
import { ereoSchema } from '@ereo/data'

export const route = defineRoute('/posts/[slug]')
  .loader(async ({ params }) => {
    // params.slug is typed as string
    const post = await db.posts.findUnique({ where: { slug: params.slug } })
    if (!post) throw new Response('Not Found', { status: 404 })
    return { post }
  })
  .action(
    async ({ params, body }) => {
      await db.comments.create({ postSlug: params.slug, ...body })
      return { success: true }
    },
    { schema: ereoSchema(z.object({ content: z.string().min(1) })) }
  )
  .head(({ data }) => ({
    title: data.post.title,         // Full type inference — never breaks!
    description: data.post.excerpt,
  }))
  .cache({ maxAge: 60, staleWhileRevalidate: 300 })
  .build()

// Export for the route module
export const { loader, action } = route
```

> **When to use `defineRoute`?** When your route has a loader, action, head/meta, and you want full type safety across all of them. Also useful when you need search params or hash params validation.

---

## Loaders

Loaders are async functions that run on the server before rendering a component. They receive the incoming request, URL parameters, and app context.

### Loader Arguments

Every loader receives the same arguments, regardless of which approach you use:

```tsx
export const loader = createLoader(async ({
  request,      // The incoming Request object
  params,       // URL parameters from dynamic segments (e.g., { id: '123' })
  context       // App context (cookies, headers, user session, etc.)
}) => {
  const url = new URL(request.url)
  const page = url.searchParams.get('page') || '1'
  const sessionId = context.get('session')

  return { posts: await db.posts.findMany() }
})
```

### Using Loader Data

Access loader data in your component via props or the `useLoaderData` hook:

```tsx
// Via props (recommended for simple cases)
export default function Posts({ loaderData }) {
  return <h1>{loaderData.posts.length} posts</h1>
}

// Via hook (useful when you need loader data in nested components)
import { useLoaderData } from '@ereo/client'

export default function Posts() {
  const { posts } = useLoaderData()
  return <h1>{posts.length} posts</h1>
}
```

### Typed Loaders

Add type safety by specifying the return type and params type:

```tsx
// With createLoader options
export const loader = createLoader<{ post: Post }, { id: string }>({
  load: async ({ params }) => {
    const post = await db.posts.find(params.id)
    if (!post) throw new Response('Not Found', { status: 404 })
    return { post }
  },
})

// With plain function
import type { LoaderArgs } from '@ereo/core'

export async function loader({ params }: LoaderArgs<{ id: string }>) {
  const post = await db.posts.find(params.id)
  return { post }
}
```

### Error Handling

Throw `Response` objects to trigger error boundaries with the appropriate HTTP status:

```tsx
export const loader = createLoader(async ({ params }) => {
  const post = await db.posts.find(params.id)

  if (!post) {
    throw new Response('Post not found', { status: 404 })
  }

  if (!post.published) {
    throw new Response('Post not published', { status: 403 })
  }

  return { post }
})
```

### Redirects

Return or throw redirects from loaders:

```tsx
import { redirect } from '@ereo/data'

export const loader = createLoader(async ({ request }) => {
  const user = await getUser(request)

  if (!user) {
    throw redirect('/login')
  }

  return { user }
})
```

---

## Actions

Actions handle form submissions and mutations. They run when a non-GET request (POST, PUT, DELETE, etc.) is sent to the route.

### Basic Action

Actions work with both standard HTML `<form>` elements and the `<Form>` component from `@ereo/client`:

```tsx
// routes/posts/new.tsx
export const action = createAction(async ({ request }) => {
  const formData = await request.formData()
  const title = formData.get('title') as string
  const content = formData.get('content') as string

  const post = await db.posts.create({ title, content })
  return redirect(`/posts/${post.id}`)
})
```

**Using a standard `<form>`** — works everywhere, triggers a full page navigation on submit. This is what the `create-ereo` starter templates use:

```tsx
export default function NewPost() {
  return (
    <form method="post">
      <input name="title" required />
      <textarea name="content" required />
      <button type="submit">Create Post</button>
    </form>
  )
}
```

**Using `<Form>` from `@ereo/client`** — adds progressive enhancement (client-side submit without full page reload, pending states via `useNavigation`):

```tsx
import { Form } from '@ereo/client'

export default function NewPost() {
  return (
    <Form method="post">
      <input name="title" required />
      <textarea name="content" required />
      <button type="submit">Create Post</button>
    </Form>
  )
}
```

> **When to use which?** Standard `<form>` is simpler and always works (even without JavaScript). `<Form>` adds client-side submission, pending UI states, and avoids full page reloads. Start with `<form>` and upgrade to `<Form>` when you need enhanced behavior.

### Returning Data from Actions

Actions can return data to the component — useful for showing validation errors or success messages:

```tsx
import { useActionData } from '@ereo/client'

export const action = createAction(async ({ request }) => {
  const formData = await request.formData()
  const email = formData.get('email') as string

  if (!email || !isValidEmail(email)) {
    return { error: 'Please enter a valid email', values: { email } }
  }

  await subscribe(email)
  return { success: true }
})

export default function Subscribe() {
  const actionData = useActionData()

  return (
    <Form method="post">
      <input
        name="email"
        defaultValue={actionData?.values?.email}
      />
      {actionData?.error && <p className="error">{actionData.error}</p>}
      {actionData?.success && <p className="success">Subscribed!</p>}
      <button type="submit">Subscribe</button>
    </Form>
  )
}
```

### Actions with Validation (Options Object)

When you use the options object form of `createAction`, you get automatic FormData parsing and a separate validation step:

```tsx
export const action = createAction({
  handler: async ({ formData }) => {
    // formData is already parsed — no need to call request.formData()
    const title = formData.get('title') as string
    await db.posts.create({ title })
    return redirect('/posts')
  },
  validate: (formData) => {
    const errors: Record<string, string[]> = {}
    if (!formData.get('title')) {
      errors.title = ['Title is required']
    }
    if (!formData.get('content')) {
      errors.content = ['Content is required']
    }
    return { success: Object.keys(errors).length === 0, errors }
  },
})
```

When validation fails, the action automatically returns `{ success: false, errors: { ... } }` without running the handler.

### Typed Actions (JSON / API)

For API endpoints that accept JSON, use `typedAction` or `jsonAction`:

```tsx
import { typedAction } from '@ereo/data'

interface CreatePostBody {
  title: string
  content: string
  tags: string[]
}

export const action = typedAction<CreatePostBody>({
  handler: async ({ body }) => {
    // body is typed as CreatePostBody
    const post = await db.posts.create(body)
    return { id: post.id }
  },
})
```

With schema validation (e.g., Zod):

```tsx
import { typedAction } from '@ereo/data'
import { z } from 'zod'

export const action = typedAction({
  schema: z.object({
    title: z.string().min(1).max(200),
    content: z.string().min(10),
    tags: z.array(z.string()).default([]),
  }),
  handler: async ({ body }) => {
    // body is inferred from schema, validation is automatic
    return db.posts.create({ data: body })
  },
})
```

### JSON-Only Actions

For API endpoints that only accept JSON, use `jsonAction`. It optionally enforces `Content-Type: application/json`:

```tsx
import { jsonAction } from '@ereo/data'

export const action = jsonAction<{ title: string }, Post>({
  handler: async ({ body }) => {
    return db.posts.create({ data: body })
  },
  strict: true,  // Returns 415 error if Content-Type is not application/json
})
```

### Simple Action Wrapper

The `action()` function is a convenience wrapper that creates an action with automatic `ActionResult` wrapping:

```tsx
import { action } from '@ereo/data'

// Automatically wraps return value in { success: true, data: ... }
export const myAction = action(async ({ formData }) => {
  const title = formData.get('title') as string
  return db.posts.create({ title })
})
```

This is equivalent to `createAction({ handler })` — use it when you want `ActionResult` wrapping without validation or error handling.

### FormData Utilities

EreoJS provides utilities for working with form data:

```tsx
import {
  formDataToObject,
  parseFormData,
  validateRequired,
  combineValidators,
  coerceValue,
} from '@ereo/data'

// Convert FormData to a typed object with automatic type coercion
// Supports nested objects (user.name), arrays (tags[]), indexed arrays (items[0])
const data = formDataToObject<MyType>(formData)
// { coerce: false } disables automatic type coercion
const rawData = formDataToObject<MyType>(formData, { coerce: false })

// Simpler FormData parsing (supports field[] arrays only)
const parsed = parseFormData<{ title: string; tags: string[] }>(formData)

// Validate required fields
const result = validateRequired(formData, ['title', 'content', 'email'])
// Returns: { success: false, errors: { title: ['title is required'] } }

// Combine multiple validators into one
const validate = combineValidators(
  (fd) => validateRequired(fd, ['title']),
  (fd) => {
    const email = fd.get('email') as string
    if (!email.includes('@')) {
      return { success: false, errors: { email: ['Invalid email'] } }
    }
    return { success: true }
  },
)
```

### Multiple Actions in One Route

Use an `intent` field to handle different actions on the same route:

```tsx
export const action = createAction(async ({ request }) => {
  const formData = await request.formData()
  const intent = formData.get('intent')

  switch (intent) {
    case 'update':
      return handleUpdate(formData)
    case 'delete':
      return handleDelete(formData)
    case 'publish':
      return handlePublish(formData)
    default:
      throw new Response('Invalid intent', { status: 400 })
  }
})

export default function PostEditor({ loaderData }) {
  return (
    <div>
      <Form method="post">
        <input name="title" defaultValue={loaderData.post.title} />
        <button name="intent" value="update">Save</button>
        <button name="intent" value="publish">Publish</button>
      </Form>

      <Form method="post">
        <button name="intent" value="delete">Delete</button>
      </Form>
    </div>
  )
}
```

---

## API Routes (HTTP Method Exports)

For pure API endpoints, you can export functions named after HTTP methods. These take priority over `loader`/`action` exports:

```ts
// routes/api/posts.ts

export async function GET({ request, params, context }) {
  const posts = await db.posts.findMany()
  return Response.json({ posts })
}

export async function POST({ request, params, context }) {
  const body = await request.json()
  const post = await db.posts.create(body)
  return Response.json(post, { status: 201 })
}

export async function DELETE({ request }) {
  const { id } = await request.json()
  await db.posts.delete(id)
  return Response.json({ success: true })
}
```

> **Loader/Action vs HTTP Method exports:** Use `loader`/`action` for page routes with components. Use `GET`/`POST`/`PUT`/`DELETE` for API-only routes that return JSON.

---

## Deferred Data

Use `defer` to stream data that isn't immediately needed. The page renders right away with critical data, and deferred data streams in when ready:

```tsx
import { createLoader, defer } from '@ereo/data'
import { Suspense } from 'react'
import { Await } from '@ereo/client'

export const loader = createLoader(async ({ params }) => {
  // Critical data — awaited before render
  const post = await db.posts.find(params.id)

  // Non-critical data — streamed later
  const comments = defer(db.comments.findByPost(params.id))
  const related = defer(db.posts.findRelated(params.id))

  return { post, comments, related }
})

export default function Post({ loaderData }) {
  const { post, comments, related } = loaderData

  return (
    <article>
      <h1>{post.title}</h1>
      <p>{post.content}</p>

      <Suspense fallback={<p>Loading comments...</p>}>
        <Await resolve={comments}>
          {(data) => (
            <ul>
              {data.map(c => <li key={c.id}>{c.text}</li>)}
            </ul>
          )}
        </Await>
      </Suspense>

      <Suspense fallback={<p>Loading related...</p>}>
        <Await resolve={related}>
          {(posts) => <RelatedPosts posts={posts} />}
        </Await>
      </Suspense>
    </article>
  )
}
```

## Combining Loaders

Combine multiple loaders to run in parallel for complex data requirements:

```tsx
import { createLoader, combineLoaders } from '@ereo/data'

const userLoader = createLoader(async ({ request }) => {
  return getUser(request)
})

const postsLoader = createLoader(async () => {
  return db.posts.findMany()
})

// Both run in parallel.
// Returns { user: User, posts: Post[] } — each key holds the return value of its loader
export const loader = combineLoaders({ user: userLoader, posts: postsLoader })
```

> **Tip:** Each loader's return value is assigned to its key. If `userLoader` returns a `User` object, the combined result has `{ user: User }`. Avoid wrapping in extra objects like `{ user }` — just return the value directly.

## Client Loaders

Add client-side data fetching that runs after hydration — useful for real-time data or client-only state:

```tsx
import { createLoader, clientLoader as createClientLoader } from '@ereo/data'

// Server loader — runs on the server
export const loader = createLoader(async () => {
  const posts = await db.posts.findMany()
  return { posts }
})

// Client loader — runs in the browser after hydration
export const clientLoader = createClientLoader(async () => {
  const response = await fetch('/api/posts')
  const posts = await response.json()
  return { posts }
})
```

## Data Revalidation

Revalidate cached data after mutations:

```tsx
import { revalidatePath, revalidateTag } from '@ereo/data'

export const action = createAction(async ({ request }) => {
  const formData = await request.formData()
  await db.posts.create(Object.fromEntries(formData))

  // Revalidate specific path
  await revalidatePath('/posts')

  // Or revalidate by tag
  await revalidateTag('posts')

  return redirect('/posts')
})
```

## Response Helpers

EreoJS provides helpers for common response types:

```tsx
import { json, data, redirect, throwRedirect, error } from '@ereo/data'

// JSON response with custom status
return json({ success: true })
return json({ post }, { status: 201 })

// XSS-safe data response (escapes <, >, &, ' characters)
// Use this when embedding data in HTML/script tags
return data({ post })

// Redirect (default 302)
return redirect('/posts')
return redirect('/posts', 303)  // 303 after POST

// Throw a redirect — useful inside loaders to stop execution immediately
throwRedirect('/login')  // throws, never returns

// Error response (default status 500)
throw error('Not found', 404)
throw error('Unauthorized', 401)
```

| Helper | Description |
|--------|-------------|
| `json(data, init?)` | Standard JSON response |
| `data(value, init?)` | XSS-safe JSON response (escapes dangerous characters) |
| `redirect(url, statusOrInit?)` | HTTP redirect (default 302) |
| `throwRedirect(url, statusOrInit?)` | Throws a redirect response (stops execution) |
| `error(message, status?)` | JSON error response (default 500) |

## Data Pipelines

For complex pages that load data from multiple sources, use `createPipeline` to automatically parallelize independent data fetches and manage dependencies between them:

```tsx
import { createPipeline, dataSource, cachedSource, optionalSource } from '@ereo/data'

const pipeline = createPipeline({
  loaders: {
    // Regular data source
    post: dataSource(async ({ params }) => {
      return db.posts.find(params.id)
    }),

    // Cached data source — ttl is in seconds
    categories: cachedSource(
      async () => db.categories.findMany(),
      { ttl: 300, tags: ['categories'] }
    ),

    // Optional data source — uses fallback value on failure
    analytics: optionalSource(
      async ({ params }) => db.analytics.get(params.id),
      { views: 0, likes: 0 }  // fallback
    ),

    // This depends on 'post' — declared below in dependencies
    comments: dataSource(async ({ params }) => {
      return db.comments.findByPost(params.id)
    }),
  },
  dependencies: {
    comments: ['post'],  // comments waits for post to load first
  },
  metrics: true,  // Enable timing metrics
})

// Convert to a standard loader export
export const loader = pipeline.toLoader()
```

The pipeline automatically:
- Runs independent loaders in parallel (`post`, `categories`, `analytics` start together)
- Respects dependencies (`comments` waits for `post`)
- Detects unnecessary waterfalls and suggests optimizations
- Tracks timing metrics for each loader

### Pipeline Metrics

When `metrics: true`, the pipeline result includes detailed timing data:

```tsx
const result = await pipeline.execute(args)
// result.data — the loaded data
// result.metrics.total — total execution time (ms)
// result.metrics.parallelEfficiency — 0 to 1 (higher = better parallelization)
// result.metrics.waterfalls — detected unnecessary sequential waits

// Format metrics for console output
import { formatMetrics } from '@ereo/data'
console.log(formatMetrics(result.metrics))
```

---

## Fetching External Data

Use `fetchData` for type-safe external API calls with automatic JSON/text detection:

```tsx
import { fetchData, FetchError } from '@ereo/data'

export const loader = createLoader(async () => {
  try {
    // Automatically parses JSON based on Content-Type header
    const posts = await fetchData<Post[]>('https://api.example.com/posts')
    return { posts }
  } catch (err) {
    if (err instanceof FetchError) {
      // Access the original Response for status info
      console.error(`API failed: ${err.status} ${err.statusText}`)
    }
    throw err
  }
})
```

---

## Data Serialization

For embedding loader data in HTML (e.g., during SSR hydration), use the XSS-safe serialization helpers:

```tsx
import { serializeLoaderData, parseLoaderData } from '@ereo/data'

// Server: serialize with XSS protection (escapes <, >, &, ')
const html = `<script>window.__DATA__ = ${serializeLoaderData(loaderData)}</script>`

// Client: parse it back
const data = parseLoaderData<MyData>(window.__DATA__)
```

---

## Revalidation Helpers

Beyond `revalidateTag` and `revalidatePath`, EreoJS provides additional revalidation utilities:

```tsx
import {
  revalidate,
  onDemandRevalidate,
  createRevalidationHandler,
  tags,
} from '@ereo/data'

// Revalidate with options — supports tags, paths, or clearing everything
await revalidate({ tags: ['posts'], paths: ['/blog'] })
await revalidate({ all: true })  // Clear entire cache

// onDemandRevalidate auto-detects tags vs paths (paths start with "/")
await onDemandRevalidate('posts', '/blog', `user-${userId}`)
// Equivalent to: revalidate({ tags: ['posts', `user-${userId}`], paths: ['/blog'] })

// Tag name helpers for consistent naming
tags.resource('post', '123')        // 'post:123'
tags.collection('posts')            // 'posts'
tags.userScoped('456', 'bookmarks') // 'user:456:bookmarks'
```

### Webhook Revalidation Handler

Expose an API route for external services (CMS, webhooks) to trigger cache invalidation:

```tsx
// routes/api/revalidate.ts
import { createRevalidationHandler } from '@ereo/data'

// Accepts POST requests with { tags?, paths?, all? } body
// Optional secret enables Bearer token authentication
export const POST = createRevalidationHandler(process.env.REVALIDATION_SECRET)
```

External services can then call:
```bash
curl -X POST https://your-app.com/api/revalidate \
  -H "Authorization: Bearer your-secret" \
  -H "Content-Type: application/json" \
  -d '{"tags": ["posts"]}'
```

---

## Schema Adapters

EreoJS includes schema utilities for parsing and validating URL parameters, especially useful with `defineRoute`:

### ereoSchema (Zod Alignment)

When using Zod with `z.coerce`, TypeScript types may not align with the actual runtime output. `ereoSchema` wraps your Zod schema to fix this:

```tsx
import { ereoSchema } from '@ereo/data'
import { z } from 'zod'

// Without ereoSchema: z.coerce.number() has input type string but output type number
// This can break type inference in defineRoute
const schema = ereoSchema(z.object({
  page: z.coerce.number().default(1),
  limit: z.coerce.number().default(20),
}))

export const route = defineRoute('/posts')
  .searchParams(schema)
  .loader(async ({ searchParams }) => {
    // searchParams.page is correctly typed as number
    return db.posts.paginate(searchParams.page, searchParams.limit)
  })
  .build()
```

### Schema Builder (No Zod Required)

Build validation schemas without a Zod dependency using `schemaBuilder`:

```tsx
import { schemaBuilder } from '@ereo/data'

const searchSchema = schemaBuilder()
  .string('q', { optional: true })
  .number('page', { default: 1, min: 1 })
  .number('limit', { default: 20, min: 1, max: 100 })
  .enum('sort', ['newest', 'oldest', 'popular'], { default: 'newest' })
  .build()
```

### Pagination, Sort, and Filter Parsers

Pre-built parsers for common URL parameter patterns:

```tsx
import {
  createPaginationParser,
  createSortParser,
  createFilterParser,
} from '@ereo/data'

const pagination = createPaginationParser({ defaultLimit: 20, maxLimit: 100 })
const sort = createSortParser(['title', 'createdAt', 'views'], 'createdAt', 'desc')
const filter = createFilterParser({ status: ['draft', 'published', 'archived'] })
```

### Type Coercion Utilities

Low-level helpers for parsing URL/form values:

```tsx
import { parseBoolean, parseStringArray, parseDate, parseEnum } from '@ereo/data'

parseBoolean('true')              // true
parseBoolean('0')                 // false
parseStringArray('a,b,c')         // ['a', 'b', 'c']
parseDate('2024-01-15')           // Date object
parseEnum('admin', ['admin', 'user'])  // 'admin'
```

---

## Best Practices

1. **Start simple** — Use plain function exports until you need caching or validation
2. **Keep loaders focused** — One loader per route; use `combineLoaders` for complex pages
3. **Handle errors explicitly** — Throw `Response` objects with appropriate status codes
4. **Use types** — Type your loader data for better developer experience
5. **Defer non-critical data** — Don't block the page on secondary content
6. **Validate in actions** — Always validate form data before processing
7. **Return meaningful data** — Actions should return success/error information
8. **Use redirects after mutations** — Redirect after successful POST to prevent re-submission
