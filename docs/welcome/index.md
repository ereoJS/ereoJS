# What is EreoJS?

EreoJS is a **React fullstack framework** built on [Bun](https://bun.sh). It provides file-based routing, server-side rendering, islands architecture, and simple data patterns — all optimized for Bun's runtime performance.

Instead of stitching together a dozen libraries for routing, data loading, caching, and state management, EreoJS gives you a single cohesive stack. You write React components, export loaders and actions, and the framework handles server rendering, streaming, hydration, and cache invalidation.

Here is what a typical route looks like:

```tsx
// routes/posts/[id].tsx
import { createLoader } from '@ereo/data'

export const loader = createLoader({
  load: async ({ params }) => {
    const post = await db.posts.find(params.id)
    if (!post) throw new Response('Not found', { status: 404 })
    return { post }
  },
  cache: { maxAge: 60, tags: ['posts'] },
})

export default function Post({ loaderData }) {
  return (
    <article>
      <h1>{loaderData.post.title}</h1>
      <p>{loaderData.post.content}</p>
    </article>
  )
}
```

That single file defines a URL (`/posts/:id`), loads data on the server, caches it for 60 seconds with a `posts` tag, and renders a React component. No separate route configuration, no boilerplate wiring.

## How It Works

Every request in EreoJS flows through a predictable lifecycle:

```
Request → Router → Middleware → Loader → Render → Stream → Response
```

1. **Request** — Bun receives an incoming HTTP request.
2. **Router** — The file-based router matches the URL to a route module in `routes/`.
3. **Middleware** — Any `_middleware.ts` files in the matched path run in order, setting context (auth, headers, etc.).
4. **Loader** — The route's `loader` function fetches data on the server. For mutations (POST, PUT, DELETE), the `action` runs first, then the loader re-runs.
5. **Render** — React renders the component tree on the server with the loader data. Islands are marked for selective hydration.
6. **Stream** — HTML streams to the client as it becomes available. Deferred data streams in via Suspense boundaries.
7. **Response** — The client receives HTML, hydrates interactive islands, and the page becomes fully interactive.

This lifecycle applies to every page request. For client-side navigations (via `<Link>` or `navigate()`), steps 2-4 happen via a fetch call and the client re-renders without a full page reload.

## Who is EreoJS For?

### Frontend Developers

You know React and want a fullstack framework that feels familiar. EreoJS gives you file-based routing, server-side rendering, and progressive enhancement without learning a new paradigm.

**Start here:** [Getting Started](/getting-started/) → [Your First App](/getting-started/your-first-app)

### Backend Developers

You want to build web applications with a modern stack. EreoJS uses standard Request/Response APIs and runs on Bun — you'll feel right at home.

**Start here:** [Core Concepts](/concepts/) → [API Routes Guide](/guides/api-routes)

### Teams Migrating

You're moving from Next.js, Remix, or Express and want a smooth transition. EreoJS shares many patterns with these frameworks.

**Start here:** [Migration Guides](/migration/)

## Key Features

**Bun Runtime** — EreoJS runs on Bun, which means native TypeScript execution without a compile step, fast bundling via Bun's built-in bundler, and access to Bun's test runner. No webpack, no babel, no transpilation overhead.

**File-Based Routing** — Your file structure is your route table. Place a file in `routes/` and it becomes a URL. Supports dynamic segments (`[id]`), catch-all routes (`[...slug]`), optional segments (`[[page]]`), layouts, and route groups — all through file naming conventions.

**Islands Architecture** — Most pages don't need JavaScript for every component. EreoJS ships zero JS for static content and selectively hydrates only the interactive parts (islands). This keeps bundle sizes small and pages fast.

**Loaders and Actions** — Data loading is colocated with routes. Loaders run on the server before rendering; actions handle form submissions and mutations. Three levels of API complexity let you start simple and scale up: plain exports, `createLoader`/`createAction`, or the fully typed `defineRoute` builder.

**Tag-Based Caching** — Cache data at the loader level with semantic tags like `posts` or `user:123`. Invalidate specific tags after mutations, and the framework handles revalidation. No cache-busting hacks or timestamp tricks.

**Streaming SSR** — Pages begin streaming HTML to the client as soon as critical data is ready. Non-critical data loads in the background via `defer()` and streams in through React Suspense boundaries, giving fast time-to-first-byte without sacrificing content.

**Type Safety** — Route parameters, loader data, action data, and middleware context are all fully typed. The `defineRoute` builder maintains type inference across the entire chain — loader, action, head, meta — without manual type annotations.

**Progressive Enhancement** — Forms work with or without JavaScript. Standard `<form>` elements submit to actions and the page round-trips through the server. Upgrade to `<Form>` from `@ereo/client` for client-side submissions with pending states, without rewriting your markup.

## Quick Start

```bash
bunx create-ereo my-app
cd my-app
bun dev
```

This scaffolds a new project, installs dependencies, and starts the dev server at `http://localhost:3000`. See the [Installation Guide](/getting-started/installation) for more options.

## Learn More

- [Feature Overview](/welcome/feature-overview) — Comprehensive feature list with links to every API
- [Learning Paths](/welcome/learning-paths) — Guided paths based on your background and goals
- [What's New](/welcome/whats-new) — Latest changes and releases in v0.1.24
- [Getting Started](/getting-started/) — Step-by-step setup from prerequisites to first deployment
- [Core Concepts](/concepts/) — Deep dives into routing, data loading, islands, and caching
