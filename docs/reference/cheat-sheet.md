# Cheat Sheet

Quick-reference patterns for common EreoJS tasks.

## Create a Project

```bash
bun create ereo my-app
cd my-app
bun dev
```

## Add a Route

Create a file in `routes/`:

```tsx
// routes/about.tsx
export default function About() {
  return <h1>About Us</h1>
}
```

Result: accessible at `/about`.

## Add a Loader

```tsx
// routes/posts/index.tsx
import { createLoader } from '@ereo/data'

export const loader = createLoader(async () => {
  const posts = await db.posts.findMany()
  return { posts }
})

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

## Add an Action

```tsx
// routes/posts/new.tsx
import { createAction, redirect } from '@ereo/data'

export const action = createAction(async ({ request }) => {
  const formData = await request.formData()
  await db.posts.create({
    title: formData.get('title') as string,
  })
  return redirect('/posts')
})

export default function NewPost() {
  return (
    <form method="post">
      <input name="title" required />
      <button type="submit">Create</button>
    </form>
  )
}
```

## Add a Layout

```tsx
// routes/_layout.tsx
export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head><title>My App</title></head>
      <body>
        <nav>
          <a href="/">Home</a>
          <a href="/about">About</a>
        </nav>
        {children}
      </body>
    </html>
  )
}
```

## Add Middleware

```ts
// routes/dashboard/_middleware.ts
import type { MiddlewareHandler } from '@ereo/core'

export const middleware: MiddlewareHandler = async (request, context, next) => {
  const user = await getUser(request)
  if (!user) return Response.redirect('/login')
  context.set('user', user)
  return next()
}
```

## Add an Island

```tsx
// components/Counter.island.tsx
'use client'

import { useState } from 'react'

export default function Counter() {
  const [count, setCount] = useState(0)
  return <button onClick={() => setCount(c => c + 1)}>Count: {count}</button>
}
```

Use in a route:

```tsx
// routes/index.tsx
import Counter from '../components/Counter.island'

export default function Home() {
  return (
    <div>
      <h1>Welcome</h1>
      <Counter />
    </div>
  )
}
```

## Add an API Route

```ts
// routes/api/posts.ts
export async function GET({ request }) {
  const posts = await db.posts.findMany()
  return Response.json({ posts })
}

export async function POST({ request }) {
  const body = await request.json()
  const post = await db.posts.create(body)
  return Response.json(post, { status: 201 })
}
```

## Add an Error Boundary

```tsx
// routes/_error.tsx
export default function ErrorPage({ error }) {
  return (
    <div>
      <h1>Something went wrong</h1>
      <p>{error?.message}</p>
      <a href="/">Go Home</a>
    </div>
  )
}
```

## Configure Caching

```tsx
// routes/posts/[id].tsx
export const loader = createLoader({
  load: async ({ params }) => {
    return db.posts.find(params.id)
  },
  cache: {
    maxAge: 60,
    tags: ['posts'],
    staleWhileRevalidate: 300,
  },
})
```

Invalidate after a mutation:

```tsx
import { revalidateTag } from '@ereo/data'

export const action = createAction(async ({ request }) => {
  await db.posts.create(/* ... */)
  await revalidateTag('posts')
  return redirect('/posts')
})
```

## Add a Dynamic Route

```tsx
// routes/posts/[id].tsx
export const loader = createLoader(async ({ params }) => {
  const post = await db.posts.find(params.id)
  if (!post) throw new Response('Not found', { status: 404 })
  return { post }
})

export default function Post({ loaderData }) {
  return <h1>{loaderData.post.title}</h1>
}
```

## Add Route Groups

```
routes/
  (marketing)/
    _layout.tsx      # Marketing layout
    index.tsx        # /
    pricing.tsx      # /pricing
  (app)/
    _layout.tsx      # App layout
    dashboard.tsx    # /dashboard
```

## Add Form Validation

```tsx
import { useForm, useField, required, email } from '@ereo/forms'

const form = useForm({
  defaultValues: { email: '', password: '' },
  validators: {
    email: [required(), email()],
    password: [required()],
  },
  onSubmit: async (values) => { /* submit */ },
})

const emailField = useField(form, 'email')
```

## Deploy

```bash
# Build for production
bun run build

# Start production server
bun ereo start

# Deploy to Fly.io
fly deploy

# Deploy to Railway
railway up
```

## Quick Reference Links

| Topic | Link |
|-------|------|
| Routing | [/concepts/routing](/concepts/routing) |
| Data Loading | [/concepts/data-loading](/concepts/data-loading) |
| Islands | [/concepts/islands](/concepts/islands) |
| Caching | [/concepts/caching](/concepts/caching) |
| Forms | [/guides/forms](/guides/forms-basic) |
| Middleware | [/concepts/middleware](/concepts/middleware) |
| Config | [/reference/config-reference](/reference/config-reference) |
| CLI | [/reference/cli-reference](/reference/cli-reference) |
