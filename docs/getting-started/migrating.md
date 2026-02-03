# Migrating to EreoJS

This guide helps you migrate from other React frameworks to EreoJS. We cover the most common patterns and their EreoJS equivalents.

## From Next.js

### App Router (Server Components)

**Next.js:**
```tsx
// app/posts/[id]/page.tsx
async function getPost(id: string) {
  const res = await fetch(`https://api.example.com/posts/${id}`)
  return res.json()
}

export default async function Post({ params }) {
  const post = await getPost(params.id)

  return (
    <article>
      <h1>{post.title}</h1>
      <p>{post.content}</p>
    </article>
  )
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
  const { post } = loaderData

  return (
    <article>
      <h1>{post.title}</h1>
      <p>{post.content}</p>
    </article>
  )
}
```

### Pages Router (getServerSideProps)

**Next.js:**
```tsx
// pages/posts/[id].tsx
export async function getServerSideProps({ params }) {
  const res = await fetch(`https://api.example.com/posts/${params.id}`)
  const post = await res.json()

  return { props: { post } }
}

export default function Post({ post }) {
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

### API Routes

**Next.js:**
```ts
// app/api/users/route.ts
export async function GET() {
  const users = await db.users.findMany()
  return Response.json(users)
}

export async function POST(request: Request) {
  const body = await request.json()
  const user = await db.users.create(body)
  return Response.json(user, { status: 201 })
}
```

**EreoJS:**
```ts
// routes/api/users.ts
export async function GET() {
  const users = await db.users.findMany()
  return Response.json(users)
}

export async function POST(request: Request) {
  const body = await request.json()
  const user = await db.users.create(body)
  return Response.json(user, { status: 201 })
}
```

API routes work the same way in EreoJS.

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

### Static Generation (getStaticProps)

**Next.js:**
```tsx
export async function getStaticProps() {
  const posts = await getPosts()
  return { props: { posts }, revalidate: 60 }
}
```

**EreoJS:**
```tsx
export const config = {
  render: 'ssg',
  cache: {
    revalidate: 60,
    tags: ['posts']
  }
}

export const loader = createLoader(async () => {
  const posts = await getPosts()
  return { posts }
})
```

### Client Components

**Next.js:**
```tsx
'use client'

import { useState } from 'react'

export default function Counter() {
  const [count, setCount] = useState(0)
  return <button onClick={() => setCount(c => c + 1)}>{count}</button>
}
```

**EreoJS:**
```tsx
// islands/Counter.tsx
import { useState } from 'react'

export default function Counter() {
  const [count, setCount] = useState(0)
  return <button onClick={() => setCount(c => c + 1)}>{count}</button>
}

// In a route:
<Counter data-island="Counter" data-hydrate="load" />
```

EreoJS uses explicit islands instead of the 'use client' directive.

### Link Component

**Next.js:**
```tsx
import Link from 'next/link'

<Link href="/posts">Posts</Link>
```

**EreoJS:**
```tsx
import { Link } from '@ereo/client'

<Link href="/posts">Posts</Link>
```

### useRouter

**Next.js:**
```tsx
import { useRouter } from 'next/navigation'

const router = useRouter()
router.push('/posts')
router.back()
```

**EreoJS:**
```tsx
import { navigate, goBack } from '@ereo/client'

navigate('/posts')
goBack()
```

---

## From Remix

Remix and EreoJS share many concepts, making migration straightforward.

### Loaders

**Remix:**
```tsx
import { json } from '@remix-run/node'
import { useLoaderData } from '@remix-run/react'

export async function loader({ params }) {
  const post = await getPost(params.id)
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
  const post = await getPost(params.id)
  return { post }
})

export default function Post() {
  const { post } = useLoaderData()
  return <h1>{post.title}</h1>
}
```

### Actions

**Remix:**
```tsx
import { redirect } from '@remix-run/node'
import { Form } from '@remix-run/react'

export async function action({ request }) {
  const formData = await request.formData()
  await createPost(Object.fromEntries(formData))
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
  await createPost(Object.fromEntries(formData))
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

### useFetcher

**Remix:**
```tsx
import { useFetcher } from '@remix-run/react'

function LikeButton({ postId }) {
  const fetcher = useFetcher()
  return (
    <fetcher.Form method="post" action="/api/like">
      <input type="hidden" name="postId" value={postId} />
      <button type="submit">Like</button>
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
      <button type="submit">Like</button>
    </fetcher.Form>
  )
}
```

### useNavigation

**Remix:**
```tsx
import { useNavigation } from '@remix-run/react'

function SubmitButton() {
  const navigation = useNavigation()
  const isSubmitting = navigation.state === 'submitting'
  return <button disabled={isSubmitting}>Submit</button>
}
```

**EreoJS:**
```tsx
import { useNavigation } from '@ereo/client'

function SubmitButton() {
  const navigation = useNavigation()
  const isSubmitting = navigation.state === 'submitting'
  return <button disabled={isSubmitting}>Submit</button>
}
```

### Error Boundaries

**Remix:**
```tsx
import { useRouteError, isRouteErrorResponse } from '@remix-run/react'

export function ErrorBoundary() {
  const error = useRouteError()

  if (isRouteErrorResponse(error)) {
    return <h1>{error.status}: {error.statusText}</h1>
  }

  return <h1>Something went wrong</h1>
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

  return <h1>Something went wrong</h1>
}
```

### Meta

**Remix:**
```tsx
export function meta({ data }) {
  return [
    { title: data.post.title },
    { name: 'description', content: data.post.excerpt }
  ]
}
```

**EreoJS:**
```tsx
export function meta({ data }) {
  return [
    { title: data.post.title },
    { name: 'description', content: data.post.excerpt }
  ]
}
```

---

## Key Differences

### From Next.js

| Feature | Next.js | EreoJS |
|---------|---------|------|
| Runtime | Node.js | Bun |
| Client Components | `'use client'` directive | Islands with `data-island` |
| Data Fetching | Server Components / getServerSideProps | Loaders |
| Mutations | Server Actions / API routes | Actions |
| Caching | ISR / fetch cache | Tag-based invalidation |

### From Remix

| Feature | Remix | EreoJS |
|---------|-------|------|
| Runtime | Node.js (adapters) | Bun (native) |
| Client Interactivity | Full hydration | Islands (selective) |
| Bundler | esbuild | Bun |
| Streaming | Optional | Default |

---

## Migration Checklist

1. **Install Bun** if not already installed
2. **Create new EreoJS project** and copy routes
3. **Update imports** from framework-specific to `@ereo/*`
4. **Convert data fetching** to loaders
5. **Convert mutations** to actions
6. **Convert client components** to islands
7. **Update configuration** to `ereo.config.ts`
8. **Test all routes** and functionality
9. **Deploy** to Bun-compatible hosting

## Getting Help

- [GitHub Issues](https://github.com/ereo-framework/ereo/issues)
- [Discord Community](https://discord.gg/ereo)
