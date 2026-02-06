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
  const user = await getUser(request)
  return { user }
})

const postsLoader = createLoader(async () => {
  const posts = await db.posts.findMany()
  return { posts }
})

// Both run in parallel. Returns { user, posts }
export const loader = combineLoaders({ user: userLoader, posts: postsLoader })
```

## Client Loaders

Add client-side data fetching that runs after hydration — useful for real-time data or client-only state:

```tsx
import { createLoader, clientLoader } from '@ereo/data'

// Server loader — runs on the server
export const loader = createLoader(async () => {
  const posts = await db.posts.findMany()
  return { posts }
})

// Client loader — runs in the browser after hydration
export const clientLoader = clientLoader(async () => {
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
import { json, redirect, error } from '@ereo/data'

// JSON response with custom status
return json({ success: true })
return json({ data }, { status: 201 })

// Redirect (default 302)
return redirect('/posts')
return redirect('/posts', 303)  // 303 after POST

// Error response
throw error('Not found', 404)
throw error('Unauthorized', 401)
```

## Best Practices

1. **Start simple** — Use plain function exports until you need caching or validation
2. **Keep loaders focused** — One loader per route; use `combineLoaders` for complex pages
3. **Handle errors explicitly** — Throw `Response` objects with appropriate status codes
4. **Use types** — Type your loader data for better developer experience
5. **Defer non-critical data** — Don't block the page on secondary content
6. **Validate in actions** — Always validate form data before processing
7. **Return meaningful data** — Actions should return success/error information
8. **Use redirects after mutations** — Redirect after successful POST to prevent re-submission
