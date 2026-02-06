# Migrating from Next.js

This guide helps you migrate from Next.js to EreoJS. We cover the most common patterns and their EreoJS equivalents.

## App Router (Server Components)

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

## Pages Router (getServerSideProps)

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

## API Routes

**Next.js:**
```ts
// app/api/users/route.ts
export async function GET() {
  const users = await db.select().from(usersTable)
  return Response.json(users)
}

export async function POST(request: Request) {
  const body = await request.json()
  const [user] = await db.insert(usersTable).values(body).returning()
  return Response.json(user, { status: 201 })
}
```

**EreoJS:**
```ts
// routes/api/users.ts
export async function GET() {
  const users = await db.select().from(usersTable)
  return Response.json(users)
}

export async function POST(request: Request) {
  const body = await request.json()
  const [user] = await db.insert(usersTable).values(body).returning()
  return Response.json(user, { status: 201 })
}
```

API routes work the same way in EreoJS. See the [Database Guide](/guides/database) for setting up `@ereo/db` with Drizzle ORM.

## Layouts

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

## Static Generation (getStaticProps)

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

## Client Components

**Next.js:**
```tsx
'use client'

import { useState } from 'react'

export default function Counter() {
  const [count, setCount] = useState(0)
  return <button onClick={() => setCount(c => c + 1)}>{count}</button>
}
```

**EreoJS** supports `'use client'` (simplest) and `data-island` attributes (advanced control):

```tsx
// app/components/Counter.tsx
'use client';

import { useState } from 'react';

export function Counter() {
  const [count, setCount] = useState(0);
  return <button onClick={() => setCount(c => c + 1)}>{count}</button>;
}

// In a route — just import and use:
import { Counter } from '~/components/Counter';

<Counter />
```

For fine-grained hydration control (e.g., hydrate on idle or when visible), use the `data-island` approach instead. See [Islands Architecture](/concepts/islands).

## Link Component

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

## useRouter

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

## Key Differences

| Feature | Next.js | EreoJS |
|---------|---------|------|
| Runtime | Node.js | Bun |
| Client Components | `'use client'` directive | `'use client'` or `data-island` (for hydration control) |
| Data Fetching | Server Components / getServerSideProps | Loaders |
| Mutations | Server Actions / API routes | Actions |
| Caching | ISR / fetch cache | Tag-based invalidation |

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
