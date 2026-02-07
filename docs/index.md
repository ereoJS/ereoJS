---
layout: home

hero:
  name: "EreoJS"
  text: "React Fullstack Framework"
  tagline: Built on Bun for speed, simplicity, and developer experience
  actions:
    - theme: brand
      text: Get Started
      link: /getting-started/
    - theme: alt
      text: View on GitHub
      link: https://github.com/ereo-framework/ereo

features:
  - icon: ⚡
    title: Bun-Powered Performance
    details: Built from the ground up for Bun's runtime, leveraging its blazing-fast bundler, server, and native TypeScript support.
  - icon: 🏝️
    title: Islands Architecture
    details: Ship minimal JavaScript with selective hydration. Only interactive components get hydrated on the client.
  - icon: 📁
    title: File-Based Routing
    details: Convention-based routing from your file structure. Supports layouts, dynamic routes, catch-all routes, and route groups.
  - icon: 🔄
    title: Simple Data Patterns
    details: Load data with loaders, handle mutations with actions. One pattern that works everywhere - SSR, SSG, and client-side.
  - icon: 💾
    title: Explicit Caching
    details: Tag-based cache invalidation with full control. No magic, no surprises - you decide what gets cached and when it's invalidated.
  - icon: 🌊
    title: Streaming SSR
    details: Stream HTML with React Suspense support. Fast time-to-first-byte with progressive content loading.
---

## Quick Start

Create a new EreoJS project:

```bash
bunx create-ereo@latest my-app
cd my-app
bun dev
```

## Choose Your Learning Path

**New to EreoJS?** Follow the [Getting Started guide](/getting-started/) to build your first app.

**Coming from another framework?** Jump to the migration guide for [Next.js](/migration/from-nextjs), [Remix](/migration/from-remix), or [Express](/migration/from-express).

**Looking for a specific topic?** Browse the [Guides](/guides/) for practical how-to articles or the [API Reference](/api/core/create-app) for detailed API docs.

**Want to understand the architecture?** Read the [Core Concepts](/concepts/) to learn how EreoJS works under the hood.

## Why EreoJS?

EreoJS combines the best ideas from modern React frameworks while staying true to web standards and keeping things simple:

- **Web Standards First** - Uses standard Request/Response APIs throughout
- **Type-Safe by Default** - Full TypeScript support with inferred types for routes, loaders, and actions
- **Progressive Enhancement** - Forms work without JavaScript, then enhance with client-side features
- **Minimal Abstraction** - Learn web APIs, not framework magic

## Framework Comparison

| Feature | EreoJS | Next.js | Remix |
|---------|------|---------|-------|
| Runtime | Bun | Node | Node/Bun |
| Bundler | Bun | Webpack/Turbopack | esbuild |
| Islands | Native | Manual | Manual |
| Data Loading | Loaders | Server Components | Loaders |
| Caching | Tag-based | ISR/Cache | Manual |
| Forms | Progressive | Client-only | Progressive |

[See detailed comparisons →](/architecture/comparisons/vs-nextjs)

## Example

```tsx
// app/routes/posts/[id].tsx
import { createLoader, createAction } from '@ereo/data'

export const config = {
  render: 'ssr',
  cache: { tags: ['posts'] }
}

export const loader = createLoader(async ({ params }) => {
  const post = await db.posts.find(params.id)
  return { post }
})

export const action = createAction(async ({ request }) => {
  const formData = await request.formData()
  await db.posts.update(formData.get('id'), {
    title: formData.get('title')
  })
  return { success: true }
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
