# EreoJS vs Astro

EreoJS and Astro both embrace islands architecture, but with different approaches. Astro is content-focused with multi-framework support, while EreoJS is React-focused with full-stack capabilities.

## Overview

| Aspect | EreoJS | Astro |
|--------|------|-------|
| Focus | Full-stack apps | Content sites |
| Framework | React only | Multi-framework |
| Islands | React islands | Any framework |
| Data Patterns | Loaders/Actions | Content collections, fetch |
| Rendering | SSR/SSG/Streaming | SSG-first, SSR optional |
| Runtime | Bun | Node.js |

## Philosophy

**Astro:**
- Content-first design
- Ship zero JS by default
- Multi-framework islands (React, Vue, Svelte, etc.)
- Static-first with SSR as opt-in
- `.astro` component format

**EreoJS:**
- Application-first design
- React throughout
- Progressive enhancement
- SSR-first with SSG as option
- Standard React/TSX components

## Component Syntax

**Astro:**
```astro
---
// Component script (server)
const posts = await getPosts()
---

<!-- Component template -->
<div>
  {posts.map(post => (
    <article>
      <h2>{post.title}</h2>
      <p>{post.excerpt}</p>
    </article>
  ))}
</div>

<style>
  article { margin: 1rem; }
</style>
```

**EreoJS:**
```tsx
import { createLoader } from '@ereo/data'

export const loader = createLoader(async () => {
  const posts = await getPosts()
  return { posts }
})

export default function Posts({ loaderData }) {
  return (
    <div>
      {loaderData.posts.map(post => (
        <article key={post.id}>
          <h2>{post.title}</h2>
          <p>{post.excerpt}</p>
        </article>
      ))}
    </div>
  )
}
```

Key differences:
- Astro has its own `.astro` format
- EreoJS uses standard React/TSX
- Both separate data from rendering

## Islands Architecture

**Astro:**
```astro
---
import Counter from '../components/Counter.jsx'
---

<h1>Static content</h1>

<!-- Hydration directives -->
<Counter client:load />
<Counter client:idle />
<Counter client:visible />
<Counter client:media="(max-width: 768px)" />
```

**EreoJS:**

For simple cases, use `'use client'` (hydrates on load):

```tsx
// app/components/Counter.tsx
'use client';
// ... component code
```

```tsx
import { Counter } from '~/components/Counter';

export default function Page() {
  return (
    <>
      <h1>Static content</h1>
      <Counter />
    </>
  )
}
```

For explicit hydration strategies (like Astro's `client:*`), use `data-island` attributes:

```tsx
<Counter data-island="Counter" data-hydrate="load" />
<Counter data-island="Counter" data-hydrate="idle" />
<Counter data-island="Counter" data-hydrate="visible" />
<Counter
  data-island="Counter"
  data-hydrate="media"
  data-media="(max-width: 768px)"
/>
```

Similar hydration strategies:
- `client:load` / `data-hydrate="load"` - Immediate
- `client:idle` / `data-hydrate="idle"` - When idle
- `client:visible` / `data-hydrate="visible"` - When visible
- `client:media` / `data-hydrate="media"` - Media query

## Data Fetching

**Astro:**
```astro
---
// Direct fetch in frontmatter
const posts = await fetch('https://api.example.com/posts')
  .then(r => r.json())
---

<ul>
  {posts.map(post => <li>{post.title}</li>)}
</ul>
```

**EreoJS:**
```tsx
export const loader = createLoader(async () => {
  const posts = await fetch('https://api.example.com/posts')
    .then(r => r.json())
  return { posts }
})

export default function Posts({ loaderData }) {
  return (
    <ul>
      {loaderData.posts.map(post => <li key={post.id}>{post.title}</li>)}
    </ul>
  )
}
```

## Content Collections

**Astro:**
```ts
// src/content/config.ts
import { defineCollection, z } from 'astro:content'

const blog = defineCollection({
  schema: z.object({
    title: z.string(),
    date: z.date(),
  })
})

export const collections = { blog }
```

```astro
---
import { getCollection } from 'astro:content'

const posts = await getCollection('blog')
---
```

**EreoJS:**

EreoJS doesn't have built-in content collections. Use file-based content:

```tsx
// lib/content.ts
import { glob } from 'bun'
import matter from 'gray-matter'

export async function getPosts() {
  const files = glob.sync('content/blog/*.md')
  return files.map(file => {
    const content = Bun.file(file).text()
    const { data, content: body } = matter(content)
    return { ...data, body }
  })
}
```

## Form Handling

**Astro:**
```astro
---
// No built-in form handling
// Use API endpoints or client-side
---

<form action="/api/contact" method="post">
  <input name="email" type="email" />
  <button type="submit">Subscribe</button>
</form>
```

```ts
// src/pages/api/contact.ts
export async function POST({ request }) {
  const data = await request.formData()
  // Handle form...
  return new Response(JSON.stringify({ ok: true }))
}
```

**EreoJS:**
```tsx
import { createAction, redirect } from '@ereo/data'
import { Form, useActionData } from '@ereo/client'

export const action = createAction(async ({ request }) => {
  const data = await request.formData()
  const email = data.get('email')

  if (!isValidEmail(email)) {
    return { error: 'Invalid email' }
  }

  await subscribe(email)
  return redirect('/thank-you')
})

export default function Subscribe() {
  const actionData = useActionData()

  return (
    <Form method="post">
      <input name="email" type="email" />
      {actionData?.error && <p>{actionData.error}</p>}
      <button type="submit">Subscribe</button>
    </Form>
  )
}
```

EreoJS has first-class form support with progressive enhancement.

## Routing

**Astro:**
```
src/pages/
├── index.astro        # /
├── about.astro        # /about
├── posts/
│   ├── index.astro    # /posts
│   └── [slug].astro   # /posts/:slug
└── api/
    └── users.ts       # /api/users
```

**EreoJS:**
```
routes/
├── index.tsx          # /
├── about.tsx          # /about
├── posts/
│   ├── index.tsx      # /posts
│   └── [slug].tsx     # /posts/:slug
└── api/
    └── users.ts       # /api/users
```

Very similar structures.

## SSR vs SSG

**Astro (SSG-first):**
```astro
---
// Static by default
export const prerender = true // Explicit SSG (optional)

// For SSR
export const prerender = false
---
```

**EreoJS (SSR-first):**
```tsx
export const config = {
  render: 'ssr'  // Default
  // Or
  render: 'ssg'  // Static generation
}
```

## Multi-Framework Support

**Astro:**
```astro
---
import ReactCounter from '../components/ReactCounter.jsx'
import VueCounter from '../components/VueCounter.vue'
import SvelteCounter from '../components/SvelteCounter.svelte'
---

<ReactCounter client:load />
<VueCounter client:load />
<SvelteCounter client:load />
```

**EreoJS:**

EreoJS is React-only. This is by design for simplicity and consistency.

## Middleware

**Astro:**
```ts
// src/middleware.ts
export function onRequest({ request }, next) {
  console.log(request.url)
  return next()
}
```

**EreoJS:**
```ts
// routes/_middleware.ts
export const middleware = async (request, context, next) => {
  console.log(request.url)
  return next()
}
```

Similar patterns, but EreoJS supports route-level middleware files.

## Build Output

**Astro:**
- Static HTML files by default
- Partial hydration chunks
- Adapter-based SSR output

**EreoJS:**
- Server bundle
- Client bundles per island
- Static assets

## Performance Comparison

| Metric | EreoJS | Astro |
|--------|------|-------|
| Build Speed | Faster (Bun) | Fast (esbuild) |
| JS Shipped | Islands only | Islands only |
| First Paint | Similar | Similar |
| Time to Interactive | Similar | Similar |
| SSR Response Time | Faster (Bun) | Good |

Both ship minimal JavaScript through islands.

## Use Cases

**Choose Astro for:**
- Documentation sites
- Blogs
- Marketing sites
- Content-heavy sites
- Multi-framework teams

**Choose EreoJS for:**
- Full-stack applications
- Forms and mutations
- React-only teams
- Complex interactivity
- Real-time features

## Migration Considerations

### Astro to EreoJS

1. Convert `.astro` files to React components
2. Move data fetching to loaders
3. Convert `client:*` directives to `'use client'` (simple) or `data-island` attributes (for hydration control)
4. Add actions for form handling
5. Update build configuration

### EreoJS to Astro

1. Convert React components to `.astro` (for static) or keep React (for islands)
2. Move loaders to frontmatter or API routes
3. Convert `'use client'` / `data-island` to `client:*` directives
4. Use API routes for form handling

## Summary

Both frameworks embrace the islands architecture concept but serve different purposes:

- **Astro** is ideal for content-focused sites where you want to use multiple frameworks and ship minimal JavaScript
- **EreoJS** is ideal for full-stack React applications where you need forms, mutations, and complex server-side logic

The choice depends on your use case: content site vs. full-stack application.
