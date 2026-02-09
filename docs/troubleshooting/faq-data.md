# Data Loading FAQ

Frequently asked questions about loaders, actions, and data fetching in EreoJS.

## When do loaders re-run?

Loaders re-run in the following situations:

- **On every navigation** --- By default, when the user navigates to a route, the loader runs again
- **After an action** --- When a form submission triggers an action on the same route, loaders re-run to reflect the mutation
- **On revalidation** --- When `revalidatePath` or `revalidateTag` is called

You can control this behavior with `shouldRevalidate`:

```tsx
export function shouldRevalidate({ currentUrl, nextUrl }) {
  // Only re-run when search params change
  return currentUrl.search !== nextUrl.search
}
```

See the [Data Loading](/concepts/data-loading) guide for details on `shouldRevalidate`.

## How do I cache loader data?

Use the `cache` option in `createLoader` or the route `config`:

```tsx
// Option 1: In the loader
export const loader = createLoader({
  load: async ({ params }) => {
    return db.posts.find(params.id)
  },
  cache: {
    maxAge: 60,                  // Cache for 60 seconds
    tags: ['posts'],             // Tag for invalidation
    staleWhileRevalidate: 300,   // Serve stale while refreshing
  },
})

// Option 2: In route config
export const config = {
  cache: {
    data: { maxAge: 60, tags: ['posts'] },
    edge: { maxAge: 3600, staleWhileRevalidate: 86400 },
  },
}
```

Invalidate cached data with `revalidateTag('posts')` or `revalidatePath('/posts')` after mutations.

## How do I prevent data loading waterfalls?

Waterfalls occur when loaders run sequentially instead of in parallel. EreoJS provides several tools to avoid this:

**1. Use `combineLoaders` for parallel execution:**

```tsx
import { createLoader, combineLoaders } from '@ereo/data'

export const loader = combineLoaders({
  user: createLoader(async ({ request }) => getUser(request)),
  posts: createLoader(async () => db.posts.findMany()),
  stats: createLoader(async () => db.stats.get()),
})
```

**2. Use `defer` for non-critical data:**

```tsx
import { createLoader, defer } from '@ereo/data'

export const loader = createLoader(async ({ params }) => {
  const post = await db.posts.find(params.id)         // Critical, awaited
  const comments = defer(db.comments.findByPost(params.id))  // Streamed later
  return { post, comments }
})
```

**3. Use `createPipeline` for complex dependency graphs:**

```tsx
import { createPipeline, dataSource } from '@ereo/data'

const pipeline = createPipeline({
  loaders: {
    post: dataSource(async ({ params }) => db.posts.find(params.id)),
    author: dataSource(async ({ data }) => db.users.find(data.post.authorId)),
    related: dataSource(async ({ params }) => db.posts.findRelated(params.id)),
  },
  dependencies: { author: ['post'] },
})
```

Here `post` and `related` run in parallel, while `author` waits only for `post`.

## How do I handle errors in loaders?

Throw a `Response` object with the appropriate status code. The nearest `_error.tsx` boundary catches it:

```tsx
export const loader = createLoader(async ({ params }) => {
  const post = await db.posts.find(params.id)

  if (!post) {
    throw new Response('Not found', { status: 404 })
  }

  return { post }
})
```

For a structured error response, use the `error` helper:

```tsx
import { error } from '@ereo/data'

export const loader = createLoader(async ({ params }) => {
  const post = await db.posts.find(params.id)
  if (!post) throw error('Post not found', 404)
  return { post }
})
```

See the [Error Handling guide](/guides/error-handling) for building error boundaries.

## How do I pass data between routes?

Loaders are isolated by design. To share data between routes:

**1. Use layout loaders** --- Data loaded in a `_layout.tsx` loader is available to all child routes via `useRouteLoaderData`:

```tsx
// routes/dashboard/_layout.tsx
export const loader = createLoader(async ({ request }) => {
  return { user: await getUser(request) }
})

// routes/dashboard/settings.tsx
import { useRouteLoaderData } from '@ereo/client'

export default function Settings() {
  const { user } = useRouteLoaderData('dashboard/_layout')
  return <h1>Settings for {user.name}</h1>
}
```

**2. Use URL search params** --- Pass small values through the URL:

```tsx
await navigate(`/results?query=${encodeURIComponent(searchTerm)}`)
```

**3. Use signals for client-side state** --- Use `@ereo/state` for state that needs to be shared across components:

```tsx
import { signal } from '@ereo/state'

export const selectedItems = signal<string[]>([])
```

## Can I fetch data on the client side?

Yes. Use `clientLoader` for data that should be fetched in the browser after hydration:

```tsx
import { clientLoader } from '@ereo/data'

export const loader = clientLoader(async () => {
  const res = await fetch('/api/realtime-data')
  return res.json()
})
```

You can also use standard `fetch` or any data fetching library inside islands and client components. For React-based client fetching, `useEffect` or a library like `swr` works as expected:

```tsx
// components/LivePrice.island.tsx
'use client'

import { useState, useEffect } from 'react'

export default function LivePrice({ symbol }) {
  const [price, setPrice] = useState(null)

  useEffect(() => {
    const interval = setInterval(async () => {
      const res = await fetch(`/api/price/${symbol}`)
      const data = await res.json()
      setPrice(data.price)
    }, 5000)
    return () => clearInterval(interval)
  }, [symbol])

  return <span>{price ?? 'Loading...'}</span>
}
```

See the [Data Loading](/concepts/data-loading) guide for the complete data loading reference.
