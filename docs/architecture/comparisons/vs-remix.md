# EreoJS vs Remix

EreoJS and Remix share many philosophical similarities. Both emphasize web standards, progressive enhancement, and explicit data patterns. This comparison highlights the differences.

## Overview

| Aspect | EreoJS | Remix |
|--------|------|-------|
| Runtime | Bun (native) | Node.js (adapters) |
| Bundler | Bun | esbuild |
| Hydration | Islands (selective) | Full page |
| Philosophy | Very similar | Web standards focused |
| Data Patterns | Loaders/Actions | Loaders/Actions |
| Caching | Tag-based, explicit | Manual, headers |

## Core Similarities

EreoJS and Remix share these core concepts:
- **Loaders** for data fetching
- **Actions** for mutations
- **Progressive enhancement** for forms
- **Nested layouts** with file-based routing
- **Web standard APIs** (Request/Response)

## Data Loading

Both frameworks use loaders, with nearly identical APIs:

**Remix:**
```tsx
import { json } from '@remix-run/node'
import { useLoaderData } from '@remix-run/react'

export async function loader({ params }) {
  const post = await db.posts.find(params.id)
  return json({ post })
}

export default function Post() {
  const { post } = useLoaderData()
  return <h1>{post.title}</h1>
}
```

**EreoJS:**
```tsx
import { createLoader } from '@ereo/data'
import { useLoaderData } from '@ereo/client'

export const loader = createLoader(async ({ params }) => {
  const post = await db.posts.find(params.id)
  return { post }
})

export default function Post() {
  const { post } = useLoaderData()
  return <h1>{post.title}</h1>
}
```

Key differences:
- EreoJS uses `createLoader` wrapper for type safety
- Remix uses `json()` helper (EreoJS returns objects directly)
- APIs are otherwise nearly identical

## Actions

**Remix:**
```tsx
import { redirect } from '@remix-run/node'
import { Form } from '@remix-run/react'

export async function action({ request }) {
  const formData = await request.formData()
  await db.posts.create(Object.fromEntries(formData))
  return redirect('/posts')
}

export default function NewPost() {
  return (
    <Form method="post">
      <input name="title" />
      <button type="submit">Create</button>
    </Form>
  )
}
```

**EreoJS:**
```tsx
import { createAction, redirect } from '@ereo/data'
import { Form } from '@ereo/client'

export const action = createAction(async ({ request }) => {
  const formData = await request.formData()
  await db.posts.create(Object.fromEntries(formData))
  return redirect('/posts')
})

export default function NewPost() {
  return (
    <Form method="post">
      <input name="title" />
      <button type="submit">Create</button>
    </Form>
  )
}
```

Nearly identical. The main difference is EreoJS's `createAction` wrapper.

## Client-Side Interactivity

This is where EreoJS and Remix differ significantly:

**Remix (full hydration):**
```tsx
// Every component hydrates
import { useState } from 'react'

export default function Page() {
  return (
    <div>
      <StaticContent />
      <InteractiveCounter />
      <MoreStaticContent />
    </div>
  )
}

function InteractiveCounter() {
  const [count, setCount] = useState(0)
  return <button onClick={() => setCount(c + 1)}>{count}</button>
}
```

**EreoJS (islands):**

Mark interactive components with `'use client'` — only they get hydrated:

```tsx
import { Counter } from '~/components/Counter';

export default function Page() {
  return (
    <div>
      <StaticContent />
      {/* Only this ships JavaScript */}
      <Counter />
      <MoreStaticContent />
    </div>
  )
}
```

For deferred hydration, use `data-island` attributes:

```tsx
<Counter data-island="Counter" data-hydrate="idle" />
```

Key differences:
- Remix hydrates the entire page
- EreoJS only hydrates `'use client'` components (islands)
- EreoJS ships less JavaScript
- EreoJS offers hydration strategies (`idle`, `visible`, etc.) for fine-grained control

## Routing

**Remix:**
```
app/routes/
├── _index.tsx           # /
├── about.tsx            # /about
├── posts._index.tsx     # /posts
├── posts.$id.tsx        # /posts/:id
└── posts.$id_.edit.tsx  # /posts/:id/edit
```

**EreoJS:**
```
routes/
├── index.tsx            # /
├── about.tsx            # /about
├── posts/
│   ├── index.tsx        # /posts
│   ├── [id].tsx         # /posts/:id
│   └── [id]/
│       └── edit.tsx     # /posts/:id/edit
```

Key differences:
- Remix uses dot notation for nesting
- EreoJS uses directory structure
- Both support dynamic segments
- EreoJS uses `[param]`, Remix uses `$param`

## Error Handling

**Remix:**
```tsx
import { useRouteError, isRouteErrorResponse } from '@remix-run/react'

export function ErrorBoundary() {
  const error = useRouteError()

  if (isRouteErrorResponse(error)) {
    return <h1>{error.status}: {error.statusText}</h1>
  }

  return <h1>Error</h1>
}
```

**EreoJS:**
```tsx
import { useRouteError, isRouteErrorResponse } from '@ereo/client'

export function ErrorBoundary() {
  const error = useRouteError()

  if (isRouteErrorResponse(error)) {
    return <h1>{error.status}: {error.statusText}</h1>
  }

  return <h1>Error</h1>
}
```

Identical APIs.

## Caching

**Remix:**
```tsx
// Manual cache headers
export async function loader() {
  return json(data, {
    headers: {
      'Cache-Control': 'public, max-age=3600'
    }
  })
}
```

**EreoJS:**
```tsx
// Route-level configuration
export const config = {
  cache: {
    maxAge: 3600,
    tags: ['posts']
  }
}

// Tag-based invalidation
await revalidateTag('posts')
```

Key differences:
- Remix uses manual Cache-Control headers
- EreoJS has built-in tag-based invalidation
- EreoJS caching is more declarative

## Streaming

**Remix:**
```tsx
import { defer } from '@remix-run/node'
import { Await } from '@remix-run/react'

export async function loader() {
  const post = await getPost()
  const comments = getComments() // Not awaited
  return defer({ post, comments })
}

export default function Post() {
  const { post, comments } = useLoaderData()
  return (
    <article>
      <h1>{post.title}</h1>
      <Suspense fallback={<Loading />}>
        <Await resolve={comments}>
          {(data) => <Comments data={data} />}
        </Await>
      </Suspense>
    </article>
  )
}
```

**EreoJS:**
```tsx
import { createLoader, defer } from '@ereo/data'
import { Await } from '@ereo/client'

export const loader = createLoader(async () => {
  const post = await getPost()
  const comments = defer(getComments())
  return { post, comments }
})

export default function Post({ loaderData }) {
  return (
    <article>
      <h1>{loaderData.post.title}</h1>
      <Suspense fallback={<Loading />}>
        <Await resolve={loaderData.comments}>
          {(data) => <Comments data={data} />}
        </Await>
      </Suspense>
    </article>
  )
}
```

Nearly identical patterns.

## useFetcher

Both have similar fetcher APIs:

**Remix:**
```tsx
import { useFetcher } from '@remix-run/react'

function LikeButton({ postId }) {
  const fetcher = useFetcher()
  return (
    <fetcher.Form method="post" action="/api/like">
      <input type="hidden" name="postId" value={postId} />
      <button disabled={fetcher.state === 'submitting'}>
        {fetcher.state === 'submitting' ? 'Liking...' : 'Like'}
      </button>
    </fetcher.Form>
  )
}
```

**EreoJS:**
```tsx
import { useFetcher } from '@ereo/client'

function LikeButton({ postId }) {
  const fetcher = useFetcher()
  return (
    <fetcher.Form method="post" action="/api/like">
      <input type="hidden" name="postId" value={postId} />
      <button disabled={fetcher.state === 'submitting'}>
        {fetcher.state === 'submitting' ? 'Liking...' : 'Like'}
      </button>
    </fetcher.Form>
  )
}
```

Identical.

## Deployment

**Remix:**
- Requires adapters for different platforms
- Adapters: Node, Cloudflare, Deno, Vercel, etc.
- Each adapter has different APIs

**EreoJS:**
- Native Bun deployment
- Adapters for other runtimes
- Simpler deployment story for Bun

## Build Performance

| Metric | EreoJS | Remix |
|--------|------|-------|
| Cold Start | ~0.5s | ~2s |
| Hot Reload | <50ms | ~200ms |
| Production Build | ~2s | ~8s |

EreoJS is faster due to Bun's native bundler.

## Bundle Size

| Metric | EreoJS | Remix |
|--------|------|-------|
| Framework Runtime | ~15KB | ~45KB |
| Per-Route JS | Varies (islands) | Full component |
| Hydration | Selective | Full |

EreoJS ships less JavaScript when using islands.

## State Management

**Remix:**
- Uses React state and context
- No built-in state management
- Community solutions (Zustand, Jotai, etc.)

**EreoJS:**
- Built-in signals (@ereo/state)
- Works across islands
- Also supports React state

```tsx
// EreoJS signals
import { signal } from '@ereo/state'

export const cartItems = signal([])

// In any island
function CartButton() {
  const items = cartItems.get()
  return <span>{items.length}</span>
}
```

## When to Choose EreoJS

- You want islands architecture for smaller bundles
- You're using Bun or want faster builds
- You want built-in tag-based caching
- You prefer explicit hydration control
- You want built-in reactive state

## When to Choose Remix

- You need the adapter ecosystem
- You're deploying to Cloudflare Workers
- You prefer full-page hydration model
- You want the larger community
- You need Shopify Hydrogen support

## Migration Path

Migrating from Remix to EreoJS is straightforward:

1. Convert `$param` to `[param]` in routes
2. Wrap loaders with `createLoader`
3. Wrap actions with `createAction`
4. Convert interactive components to islands
5. Update imports from `@remix-run/*` to `@ereo/*`

See the [migration guide](/migration/) for details.
