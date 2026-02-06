# Migration Guides

Moving to EreoJS from another framework? These guides walk you through the process. The recommended approach is incremental migration — move one route at a time while keeping your existing application running in parallel. This avoids risky big-bang rewrites and lets you validate each piece as you go.

## Migration Comparison Table

This table maps common features across frameworks to their EreoJS equivalents. Use it as a quick reference while migrating.

| Feature | Next.js | Remix | Express / Koa | EreoJS |
|---------|---------|-------|----------------|--------|
| **Data loading** | `getServerSideProps` / Server Components | `loader` export | Route handler (`req, res`) | `createLoader` export |
| **Mutations** | Server Actions / API routes | `action` export | Route handler (`req, res`) | `createAction` export |
| **Forms** | React state + `fetch` / Server Actions | `<Form>` component | `body-parser` middleware | `<Form>` component (progressive) |
| **Routing** | `app/` directory (App Router) or `pages/` | `routes/` directory | Manual `app.get()` / `router.use()` | `routes/` directory (file-based) |
| **Layouts** | `layout.tsx` (App Router) / `_app.tsx` | `_layout.tsx` / nested routes | Manual (template engines) | `_layout.tsx` with nested routes |
| **Middleware** | `middleware.ts` (Edge) | Loader-based | `app.use()` | `_middleware.ts` (composable chain) |
| **Error handling** | `error.tsx` (App Router) | `ErrorBoundary` export | Error middleware | `_error.tsx` / `ErrorBoundary` export |
| **Rendering** | SSR / SSG / ISR / RSC | SSR (streaming) | Manual (template engines) | SSR / SSG / Streaming / CSR |
| **Caching** | ISR (`revalidate`), fetch cache | `Cache-Control` headers | Manual | Tag-based invalidation + edge/data/browser layers |
| **Client interactivity** | Client Components (`'use client'`) | Full hydration | N/A (separate SPA) | Islands (`'use client'`, selective hydration) |
| **State management** | React state / external libraries | React state / external libraries | N/A | Signals (`@ereo/state`) + React integration |
| **Runtime** | Node.js (or Edge) | Node.js | Node.js | Bun |

## Where Are You Coming From?

### [From Next.js](/migration/from-nextjs)

The most common migration path. This guide covers both the App Router and Pages Router patterns. Key changes: `getServerSideProps` and Server Components are replaced by `createLoader` — a single, explicit data-loading pattern. Server Actions become `createAction` exports. Client Components (`'use client'`) work similarly but hydrate as islands (only the marked component ships JavaScript, not the entire page tree). The `app/` directory layout maps closely to EreoJS `routes/` with `_layout.tsx` files. ISR-style caching is replaced by tag-based invalidation with `revalidateTag`.

### [From Remix](/migration/from-remix)

The smoothest migration path. Remix and EreoJS share the same mental model: loaders for data, actions for mutations, `<Form>` for progressive enhancement, and error boundaries for error handling. Most Remix code ports with minimal changes — rename imports from `@remix-run/*` to `@ereo/*`, update `loader`/`action` to use `createLoader`/`createAction`, and replace `useNavigation().state` with `useNavigation().status`. The biggest differences are the Bun runtime (instead of Node.js), islands architecture (instead of full-page hydration), and tag-based caching.

### [From Express / Koa](/migration/from-express)

Moving from a backend framework to a fullstack framework. This guide covers mapping Express routes to EreoJS file-based routes, converting middleware (`app.use()`) to `_middleware.ts` files, replacing `req`/`res` handlers with `createLoader` and `createAction` (which use standard `Request`/`Response`), and adding React rendering for server-side HTML. If your Express app serves an API consumed by a separate frontend, you can migrate the API routes first and add server-rendered pages incrementally.

## General Migration Strategy

Follow these steps regardless of which framework you are migrating from:

**1. Create a new EreoJS project**

```bash
bun create ereo my-app
cd my-app
```

Start with the default template. You will move code from your existing project into this new structure.

**2. Set up shared infrastructure**

Point your new EreoJS project at the same database, cache, and external APIs as your existing application. Both apps will run in parallel during migration, so they need to share the same data layer. Configure your database connection in environment variables and set up your ORM (Drizzle is recommended).

**3. Migrate routes one at a time**

Pick a simple, low-traffic route first (like an about page or settings page). Create the corresponding file in `routes/`, write the loader to fetch the same data, and render the same UI. Verify it works end-to-end before moving to the next route. For each route:

- Create the route file in the `routes/` directory
- Write the `createLoader` to fetch the route's data
- Write the `createAction` if the route handles form submissions
- Build the React component using the loader data
- Test thoroughly, including form submissions and error states

**4. Migrate middleware**

Convert authentication, logging, rate limiting, and other middleware. Express `app.use()` middleware becomes `_middleware.ts` files in the appropriate route directory. The middleware signature changes from `(req, res, next)` to `(request, context, next)` using standard `Request` objects.

**5. Update deployment**

Once all routes are migrated, update your deployment pipeline to build and deploy the EreoJS application. EreoJS runs on Bun, so your deployment target needs Bun installed (or use the official Docker image). See the [Deployment guides](/ecosystem/deployment/) for platform-specific instructions.

## Common Patterns

### Import Mapping

Most framework-specific imports have a direct EreoJS equivalent:

```ts
// Next.js
import { useRouter } from 'next/navigation'
import { redirect } from 'next/navigation'
import Link from 'next/link'

// Remix
import { useLoaderData, redirect, Link } from '@remix-run/react'
import type { LoaderFunction } from '@remix-run/node'

// EreoJS
import { useLoaderData, redirect, Link } from '@ereo/client'
import { createLoader } from '@ereo/data'
```

### Data Fetching Patterns

```ts
// Next.js (Pages Router)
export async function getServerSideProps({ params }) {
  const post = await getPost(params.id)
  return { props: { post } }
}

// Next.js (App Router — Server Component)
export default async function Post({ params }) {
  const post = await getPost(params.id)
  return <h1>{post.title}</h1>
}

// EreoJS
export const loader = createLoader(async ({ params }) => {
  const post = await getPost(params.id)
  return { post }
})

export default function Post({ loaderData }) {
  return <h1>{loaderData.post.title}</h1>
}
```

### Form Handling

```tsx
// Remix
import { Form } from '@remix-run/react'

export async function action({ request }) {
  const data = await request.formData()
  await createPost(data.get('title'))
  return redirect('/posts')
}

// EreoJS
import { Form } from '@ereo/client'

export const action = createAction(async ({ request }) => {
  const data = await request.formData()
  await createPost(data.get('title'))
  return redirect('/posts')
})
```

### Auth Middleware

```ts
// Express
app.use('/dashboard', (req, res, next) => {
  if (!req.session.user) return res.redirect('/login')
  next()
})

// EreoJS — routes/dashboard/_middleware.ts
export const middleware = async (request, context, next) => {
  const user = await getSession(request)
  if (!user) return Response.redirect('/login')
  context.set('user', user)
  return next()
}
```

## Upgrading EreoJS

Already using EreoJS and need to upgrade to a newer version?

### [Version Upgrade Guide](/migration/version-upgrade)

Instructions for upgrading between EreoJS versions, including breaking changes, deprecation notices, codemods for automated migration, and step-by-step instructions for each version bump. Always check this guide before running `bun update` on your EreoJS dependencies.
