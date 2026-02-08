# EreoJS vs Next.js

This comparison helps developers understand the differences between EreoJS and Next.js, making it easier to choose the right framework or migrate between them.

## Overview

| Aspect | EreoJS | Next.js |
|--------|------|---------|
| Runtime | Bun | Node.js |
| Bundler | Bun | Webpack/Turbopack |
| Philosophy | Explicit, simple | Feature-rich, conventions |
| Client Components | `'use client'` + islands (`data-hydrate`) | `'use client'` directive |
| Data Fetching | Loaders/Actions | Server Components, API routes |
| Caching | Tag-based, explicit | ISR, fetch cache, implicit |

## Routing

### File Structure

Both use file-based routing with similar conventions:

**Next.js (App Router):**
```
app/
├── page.tsx           # /
├── about/page.tsx     # /about
├── posts/
│   ├── page.tsx       # /posts
│   └── [id]/page.tsx  # /posts/:id
└── (marketing)/
    └── pricing/page.tsx  # /pricing
```

**EreoJS:**
```
routes/
├── index.tsx          # /
├── about.tsx          # /about
├── posts/
│   ├── index.tsx      # /posts
│   └── [id].tsx       # /posts/:id
└── (marketing)/
    └── pricing.tsx    # /pricing
```

Key differences:
- Next.js requires `page.tsx` in directories
- EreoJS uses `index.tsx` or direct file names
- Both support route groups with parentheses

### Layouts

**Next.js:**
```tsx
// app/layout.tsx
export default function RootLayout({ children }) {
  return (
    <html>
      <body>{children}</body>
    </html>
  )
}
```

**EreoJS:**
```tsx
// routes/_layout.tsx
export default function RootLayout({ children }) {
  return (
    <html>
      <body>{children}</body>
    </html>
  )
}
```

Nearly identical, but EreoJS uses `_layout.tsx` prefix.

## Data Fetching

### Server-Side Data

**Next.js (App Router - Server Components):**
```tsx
// app/posts/[id]/page.tsx
async function getPost(id: string) {
  const res = await fetch(`https://api.example.com/posts/${id}`)
  return res.json()
}

export default async function Post({ params }) {
  const post = await getPost(params.id)

  return <h1>{post.title}</h1>
}
```

**EreoJS:**
```tsx
// routes/posts/[id].tsx
import { createLoader } from '@ereo/data'

export const loader = createLoader(async ({ params }) => {
  const res = await fetch(`https://api.example.com/posts/${params.id}`)
  const post = await res.json()
  return { post }
})

export default function Post({ loaderData }) {
  return <h1>{loaderData.post.title}</h1>
}
```

Key differences:
- Next.js uses async Server Components
- EreoJS uses explicit loader functions
- EreoJS separates data fetching from rendering

### Mutations

**Next.js (Server Actions):**
```tsx
// app/posts/new/page.tsx
async function createPost(formData: FormData) {
  'use server'
  await db.posts.create({
    title: formData.get('title')
  })
  redirect('/posts')
}

export default function NewPost() {
  return (
    <form action={createPost}>
      <input name="title" />
      <button type="submit">Create</button>
    </form>
  )
}
```

**EreoJS:**
```tsx
// routes/posts/new.tsx
import { createAction, redirect } from '@ereo/data'
import { Form } from '@ereo/client'

export const action = createAction(async ({ request }) => {
  const formData = await request.formData()
  await db.posts.create({
    title: formData.get('title')
  })
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

Key differences:
- Next.js uses `'use server'` directive
- EreoJS uses explicit action exports
- Both support progressive enhancement

## Client-Side Interactivity

**Next.js:**
```tsx
'use client'

import { useState } from 'react'

export default function Counter() {
  const [count, setCount] = useState(0)
  return <button onClick={() => setCount(c => c + 1)}>{count}</button>
}
```

**EreoJS (Islands):**

EreoJS also supports `'use client'` — the familiar pattern from Next.js:

```tsx
// app/components/Counter.tsx
'use client';

import { useState } from 'react';

export function Counter() {
  const [count, setCount] = useState(0);
  return <button onClick={() => setCount(c => c + 1)}>{count}</button>;
}

// In a route — just import and use:
<Counter />
```

For advanced hydration control, EreoJS additionally offers `data-island` attributes:

```tsx
<Counter data-island="Counter" data-hydrate="idle" />
```

Key differences:
- Both support `'use client'`, so the migration path is familiar
- EreoJS adds `data-island` for hydration strategies (`idle`, `visible`, `media`, `never`)
- EreoJS ships less JavaScript by default — only island components get hydrated

## Caching

**Next.js:**
```tsx
// Implicit caching with fetch
const data = await fetch(url, {
  next: { revalidate: 3600, tags: ['posts'] }
})

// ISR
export const revalidate = 60

// Revalidation
import { revalidateTag } from 'next/cache'
revalidateTag('posts')
```

**EreoJS:**
```tsx
// Route-level caching
export const config = {
  cache: {
    maxAge: 3600,
    tags: ['posts']
  }
}

// Revalidation
import { revalidateTag } from '@ereo/data'
await revalidateTag('posts')
```

Key differences:
- Next.js has implicit fetch caching
- EreoJS requires explicit cache configuration
- Both support tag-based invalidation

## Streaming

**Next.js:**
```tsx
import { Suspense } from 'react'

async function Comments({ postId }) {
  const comments = await getComments(postId)
  return <CommentList comments={comments} />
}

export default function Post({ params }) {
  return (
    <article>
      <PostContent id={params.id} />
      <Suspense fallback={<Loading />}>
        <Comments postId={params.id} />
      </Suspense>
    </article>
  )
}
```

**EreoJS:**
```tsx
import { Suspense } from 'react'
import { defer } from '@ereo/data'
import { Await } from '@ereo/client'

export const loader = createLoader(async ({ params }) => {
  const post = await getPost(params.id)
  const comments = defer(getComments(params.id))
  return { post, comments }
})

export default function Post({ loaderData }) {
  return (
    <article>
      <PostContent post={loaderData.post} />
      <Suspense fallback={<Loading />}>
        <Await resolve={loaderData.comments}>
          {(comments) => <CommentList comments={comments} />}
        </Await>
      </Suspense>
    </article>
  )
}
```

Key differences:
- Next.js streams async Server Components
- EreoJS uses `defer()` with `<Await>` pattern
- Both support React Suspense

## Middleware

**Next.js:**
```ts
// middleware.ts (root level only)
import { NextResponse } from 'next/server'

export function middleware(request) {
  if (!request.cookies.get('session')) {
    return NextResponse.redirect('/login')
  }
  return NextResponse.next()
}

export const config = {
  matcher: '/dashboard/:path*'
}
```

**EreoJS:**
```ts
// routes/dashboard/_middleware.ts
export const middleware = async (request, context, next) => {
  if (!request.headers.get('Cookie')?.includes('session')) {
    return Response.redirect('/login')
  }
  return next()
}
```

Key differences:
- Next.js has single middleware file with matchers
- EreoJS has route-level middleware files
- EreoJS middleware is more composable

## Performance

### Bundle Size

| Metric | EreoJS | Next.js |
|--------|------|---------|
| Framework Runtime | ~15KB | ~85KB |
| Islands Overhead | ~2KB per island | Full component tree |
| React Hydration | Selective | Full page |

### Build Speed

EreoJS uses Bun's native bundler, which is significantly faster than Webpack:

| Project Size | EreoJS | Next.js (Webpack) | Next.js (Turbopack) |
|--------------|------|-------------------|---------------------|
| Small (10 routes) | ~0.5s | ~3s | ~1.5s |
| Medium (50 routes) | ~2s | ~15s | ~5s |
| Large (200 routes) | ~5s | ~60s | ~15s |

### Runtime Performance

Both achieve similar runtime performance for SSR. EreoJS's advantage comes from:
- Bun's faster JavaScript execution
- Smaller client bundles with islands
- Less hydration overhead

## TypeScript Support

Both have excellent TypeScript support. Main differences:

**Next.js:**
- Generates types for routes automatically
- Server/Client boundary types
- Complex configuration

**EreoJS:**
- Simpler type inference
- Explicit loader/action types
- Manual type generation for routes

## When to Choose EreoJS

- You want explicit control over caching
- You prefer islands architecture over full hydration
- You're using Bun or want faster builds
- You value simplicity over features
- You're coming from Remix and want similar patterns

## When to Choose Next.js

- You need the Vercel ecosystem integration
- You want React Server Components
- You prefer implicit caching and conventions
- You need the larger community and ecosystem
- You're already invested in the Next.js way

## Migration Path

See the [migration guide](/migration/) for detailed instructions on migrating from Next.js to EreoJS.
