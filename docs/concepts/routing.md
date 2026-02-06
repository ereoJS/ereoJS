# Routing

EreoJS uses file-based routing where your file structure in the `routes/` directory maps directly to URL paths. This convention eliminates manual route configuration while providing powerful features like dynamic segments, layouts, and route groups.

## Basic Routes

Files in `routes/` become URL paths:

| File | URL |
|------|-----|
| `routes/index.tsx` | `/` |
| `routes/about.tsx` | `/about` |
| `routes/contact.tsx` | `/contact` |
| `routes/blog/index.tsx` | `/blog` |
| `routes/blog/archive.tsx` | `/blog/archive` |

```tsx
// routes/about.tsx
export default function About() {
  return <h1>About Us</h1>
}
```

## Dynamic Routes

Use square brackets for dynamic segments:

| File | URL | `params` |
|------|-----|----------|
| `routes/posts/[id].tsx` | `/posts/123` | `{ id: '123' }` |
| `routes/users/[userId]/posts/[postId].tsx` | `/users/5/posts/42` | `{ userId: '5', postId: '42' }` |

```tsx
// routes/posts/[id].tsx
import { createLoader } from '@ereo/data'

export const loader = createLoader(async ({ params }) => {
  // params.id contains the dynamic value
  const post = await getPost(params.id)
  return { post }
})

export default function Post({ loaderData }) {
  return <h1>{loaderData.post.title}</h1>
}
```

### Optional Segments

Use double brackets for optional segments:

| File | URLs |
|------|------|
| `routes/posts/[[page]].tsx` | `/posts`, `/posts/2` |

```tsx
// routes/posts/[[page]].tsx
export const loader = createLoader(async ({ params }) => {
  const page = params.page ? parseInt(params.page) : 1
  const posts = await getPosts({ page })
  return { posts, page }
})
```

### Catch-All Routes

Use `[...slug]` to capture all remaining segments:

| File | URL | `params.slug` |
|------|-----|---------------|
| `routes/docs/[...slug].tsx` | `/docs/intro` | `['intro']` |
| | `/docs/api/core` | `['api', 'core']` |
| | `/docs/a/b/c/d` | `['a', 'b', 'c', 'd']` |

```tsx
// routes/docs/[...slug].tsx
export const loader = createLoader(async ({ params }) => {
  const path = params.slug.join('/')
  const doc = await getDoc(path)
  return { doc }
})
```

## Layouts

Create `_layout.tsx` files to wrap routes with shared UI:

```
routes/
├── _layout.tsx          # Root layout (wraps everything)
├── index.tsx
├── about.tsx
└── dashboard/
    ├── _layout.tsx      # Dashboard layout
    ├── index.tsx
    └── settings.tsx
```

```tsx
// routes/_layout.tsx
export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <title>My App</title>
      </head>
      <body>
        <nav>
          <a href="/">Home</a>
          <a href="/dashboard">Dashboard</a>
        </nav>
        {children}
      </body>
    </html>
  )
}
```

```tsx
// routes/dashboard/_layout.tsx
export default function DashboardLayout({ children }) {
  return (
    <div className="dashboard">
      <aside>
        <nav>
          <a href="/dashboard">Overview</a>
          <a href="/dashboard/settings">Settings</a>
        </nav>
      </aside>
      <main>{children}</main>
    </div>
  )
}
```

Layouts can have their own loaders:

```tsx
// routes/dashboard/_layout.tsx
export const loader = createLoader(async ({ request }) => {
  const user = await getUser(request)
  if (!user) throw redirect('/login')
  return { user }
})

export default function DashboardLayout({ children, loaderData }) {
  return (
    <div>
      <header>Welcome, {loaderData.user.name}</header>
      {children}
    </div>
  )
}
```

## Route Groups

Parentheses create groups that don't affect the URL:

```
routes/
├── (marketing)/
│   ├── _layout.tsx      # Marketing layout
│   ├── index.tsx        # /
│   ├── about.tsx        # /about
│   └── pricing.tsx      # /pricing
└── (app)/
    ├── _layout.tsx      # App layout
    ├── dashboard.tsx    # /dashboard
    └── settings.tsx     # /settings
```

Use groups to:
- Apply different layouts to different sections
- Organize routes without changing URLs
- Share middleware across related routes

```tsx
// routes/(marketing)/_layout.tsx
export default function MarketingLayout({ children }) {
  return (
    <div className="marketing">
      <Header showSignUp />
      {children}
      <Footer />
    </div>
  )
}

// routes/(app)/_layout.tsx
export default function AppLayout({ children }) {
  return (
    <div className="app">
      <Sidebar />
      {children}
    </div>
  )
}
```

## API Routes

For API-only routes, export functions named after HTTP methods (`GET`, `POST`, `PUT`, `DELETE`). These take priority over `loader`/`action` exports:

```ts
// routes/api/posts.ts
export async function GET({ request, params, context }) {
  const posts = await db.posts.findMany()
  return Response.json({ posts })
}

export async function POST({ request }) {
  const body = await request.json()
  const post = await db.posts.create(body)
  return Response.json(post, { status: 201 })
}

export async function DELETE({ request }) {
  const { id } = await request.json()
  await db.posts.delete(id)
  return Response.json({ success: true })
}
```

You can also use `loader` (for GET) and `action` (for non-GET) as an alternative. This is more convenient when you don't need per-method control:

```ts
// routes/api/posts.ts
import type { LoaderArgs, ActionArgs } from '@ereo/core'

export async function loader({ request }: LoaderArgs) {
  const posts = await db.posts.findMany()
  return posts // Automatically serialized to JSON
}

export async function action({ request }: ActionArgs) {
  const body = await request.json()
  const post = await db.posts.create(body)
  return post
}
```

> **Which approach to use?** Use HTTP method exports (`GET`, `POST`, etc.) for REST APIs where you need fine-grained control per method. Use `loader`/`action` for page routes with components. Both approaches are valid — see [Data Loading](/concepts/data-loading) for all three approaches and when to pick each one.

## Route Priority

When multiple routes could match, EreoJS uses this priority:

1. **Static routes** - Exact matches (`/about`)
2. **Dynamic routes** - Parameter segments (`/posts/[id]`)
3. **Catch-all routes** - Rest parameters (`/docs/[...slug]`)

For routes at the same level, more specific patterns win:

```
routes/
├── posts/
│   ├── new.tsx           # /posts/new (highest priority)
│   ├── [id].tsx          # /posts/:id
│   └── [...slug].tsx     # /posts/* (lowest priority)
```

## Route Configuration

Export a `config` object to configure route behavior:

```tsx
// routes/posts/[id].tsx
import type { RouteConfig } from '@ereo/core'

export const config: RouteConfig = {
  // Rendering mode
  render: {
    mode: 'ssr',  // 'ssg' | 'ssr' | 'csr' | 'json' | 'xml' | 'rsc'
  },

  // Caching (edge, browser, and data layers)
  cache: {
    edge: {
      maxAge: 3600,
      staleWhileRevalidate: 86400,
    },
    data: {
      tags: ['posts'],
    },
  },

  // Islands configuration
  islands: {
    defaultStrategy: 'idle',  // 'load' | 'idle' | 'visible' | 'media' | 'none'
  },

  // Middleware chain (named or inline)
  middleware: ['auth', 'rateLimit'],

  // Progressive enhancement
  progressive: {
    forms: { fallback: 'server' },
    prefetch: { trigger: 'intent', data: true },
  },
}
```

## Error Handling

EreoJS provides two ways to handle errors in routes.

### Option A: `_error.tsx` File (Recommended)

Create a `_error.tsx` file in a route directory. It catches errors for that route segment and all nested routes. The error is passed as a prop:

```tsx
// routes/_error.tsx (global error boundary)
export default function ErrorPage({ error }: { error: Error }) {
  return (
    <div>
      <h1>Something went wrong</h1>
      <p>{error?.message || 'An unexpected error occurred.'}</p>
      <a href="/">Go Home</a>
    </div>
  )
}
```

This is the pattern used in the `create-ereo` starter templates.

### Option B: `useRouteError` Hook (Advanced)

For more control — such as distinguishing HTTP error responses from runtime errors — use the `useRouteError` hook:

```tsx
// routes/posts/_error.tsx
import { useRouteError, isRouteErrorResponse } from '@ereo/client'

export default function PostsError() {
  const error = useRouteError()

  if (isRouteErrorResponse(error)) {
    if (error.status === 404) {
      return <h1>Post not found</h1>
    }
    return <h1>Error: {error.statusText}</h1>
  }

  return <h1>Something went wrong</h1>
}
```

### Option C: Inline `ErrorBoundary` Export

You can also export an `ErrorBoundary` component directly from a route file. This catches errors for that specific route without creating a separate file:

```tsx
// routes/blog/[slug].tsx
export async function loader({ params }) {
  const post = getPostBySlug(params.slug)
  if (!post) throw new Response('Not found', { status: 404 })
  return { post }
}

export default function BlogPost({ loaderData }) {
  return <article>{loaderData.post.title}</article>
}

// Inline error boundary — catches errors from this route's loader/component
export function ErrorBoundary({ error }: { error: Error }) {
  return <h1>Post Not Found</h1>
}
```

## Loading States

Create `_loading.tsx` for route-level loading UI:

```tsx
// routes/posts/_loading.tsx
export default function PostsLoading() {
  return (
    <div className="loading">
      <div className="skeleton" />
      <div className="skeleton" />
      <div className="skeleton" />
    </div>
  )
}
```

## Middleware

Create `_middleware.ts` to run code before route handlers:

```ts
// routes/dashboard/_middleware.ts
import type { MiddlewareHandler } from '@ereo/core'

export const middleware: MiddlewareHandler = async (request, context, next) => {
  const user = await getUser(request)

  if (!user) {
    return Response.redirect('/login')
  }

  context.set('user', user)
  return next()
}
```

## Custom 404 Page

Create a `_404.tsx` file to display a custom page when no route matches:

```tsx
// routes/_404.tsx
export default function NotFound() {
  return (
    <div>
      <h1>404 - Page Not Found</h1>
      <p>The page you're looking for doesn't exist.</p>
      <a href="/">Go Home</a>
    </div>
  )
}
```

Place `_404.tsx` at the root of `routes/` for a global 404 page. It works alongside `_error.tsx` — the 404 page handles unmatched routes, while the error boundary handles runtime errors.

## Revalidation Control

Export a `shouldRevalidate` function to control when a route's loader re-runs after navigation. Without it, loaders re-run on every navigation:

```tsx
// routes/dashboard/stats.tsx
import type { ShouldRevalidateArgs } from '@ereo/core'

export function shouldRevalidate({ currentUrl, nextUrl }: ShouldRevalidateArgs) {
  // Only re-run the loader when search params change
  return currentUrl.search !== nextUrl.search
}
```

The function receives:

```ts
interface ShouldRevalidateArgs {
  currentUrl: URL              // URL navigating away from
  nextUrl: URL                 // URL navigating to
  currentParams: RouteParams   // Current route params
  nextParams: RouteParams      // Next route params
  formMethod?: string          // Form method if triggered by an action
  formAction?: string          // Form action URL
  formData?: FormData          // Form data
  actionResult?: unknown       // Action result
  defaultShouldRevalidate: boolean  // Framework default (usually true)
}
```

Return `true` to re-run the loader, `false` to skip. Common patterns:

```ts
// Skip revalidation for non-mutating navigations
export function shouldRevalidate({ formMethod, defaultShouldRevalidate }) {
  if (!formMethod) return false
  return defaultShouldRevalidate
}

// Only revalidate when params change
export function shouldRevalidate({ currentParams, nextParams }) {
  return currentParams.id !== nextParams.id
}
```

## Route Metadata

Export a `meta` function for page metadata. It receives the loader data, route params, and current location:

```tsx
// routes/posts/[id].tsx
import type { MetaArgs } from '@ereo/core'

export function meta({ data, params, location }: MetaArgs<{ post: Post }, { id: string }>) {
  return [
    { title: data.post.title },
    { name: 'description', content: data.post.excerpt },
    { property: 'og:title', content: data.post.title },
    { property: 'og:image', content: data.post.image }
  ]
}
```

## Programmatic Navigation

Use the navigation API for client-side transitions:

```tsx
import { navigate, goBack, goForward } from '@ereo/client'

// Navigate to a route
await navigate('/posts/123')

// With options
await navigate('/posts', {
  replace: true,           // Replace history entry instead of pushing
  state: { from: 'search' },  // Pass state to the target route
  viewTransition: true,    // Animate the transition (View Transitions API)
})

// History navigation
goBack()
goForward()
```

## Navigation: `<a>` vs `<Link>`

You can use standard HTML `<a>` tags or the `<Link>` component from `@ereo/client`. Both work — choose based on whether you need client-side navigation features.

**Standard `<a>` tags** work everywhere and trigger a full page navigation (server round-trip). The `create-ereo` starter templates use `<a>` tags for simplicity:

```tsx
<a href="/posts">Posts</a>
<a href="/about">About</a>
```

**`<Link>` and `<NavLink>`** enable client-side navigation (no full page reload) and prefetching. Use these when you want faster transitions and preloading:

```tsx
import { Link, NavLink } from '@ereo/client'

// Client-side navigation with prefetch on hover
<Link href="/posts/123" prefetch="intent">Read More</Link>

// NavLink highlights the active route
<NavLink
  href="/posts"
  className={({ isActive }) => isActive ? 'active' : ''}
>
  Posts
</NavLink>
```

Prefetch strategies for `<Link>`:
- `"none"` - No prefetching
- `"intent"` - Prefetch on hover/focus
- `"render"` - Prefetch when link renders
- `"viewport"` - Prefetch when visible

> **Tip:** Start with `<a>` tags. Switch to `<Link>` when you want faster in-app navigation without full page reloads.

## Type-Safe Routes

EreoJS provides built-in type utilities for route parameters and loader data. These types are available from `@ereo/core`:

```tsx
import type { RouteParamsFor, LoaderDataFor } from '@ereo/core'

type PostParams = RouteParamsFor<'/posts/[id]'>
// { id: string }

type PostData = LoaderDataFor<'/posts/[id]'>
// Inferred from the route's loader return type (requires generated types)
```

For automatic type generation during build, use the types plugin in your `ereo.config.ts`:

```ts
import { defineConfig } from '@ereo/core'
import { createTypesPlugin } from '@ereo/bundler'

export default defineConfig({
  plugins: [createTypesPlugin()],
})
```

The types plugin scans your routes directory and generates TypeScript declarations for route parameters, loader data, and action data. Types are regenerated automatically during development and on each build.

## Anti-Patterns

### Over-nesting routes

```
routes/app/dashboard/admin/settings/profile/index.tsx
```

Deep nesting creates hard-to-manage URLs like `/app/dashboard/admin/settings/profile`. Use route groups and flatter structures instead:

```
routes/(admin)/settings.tsx          # /settings
routes/(admin)/settings/profile.tsx  # /settings/profile
```

### Catch-all as default

Don't use `[...slug].tsx` when you actually want a few specific routes. Catch-alls are harder to type, debug, and don't benefit from route-level configuration.

```tsx
// Bad: catch-all when you know the routes
// routes/docs/[...slug].tsx
// Then manually matching slug[0] === 'intro' || slug[0] === 'api'

// Good: explicit routes
// routes/docs/intro.tsx
// routes/docs/api.tsx
```

### Putting business logic in routes

Routes should delegate to service functions, not contain business logic:

```tsx
// Bad: database queries and business rules inline
export const loader = createLoader(async ({ params }) => {
  const post = await db.query('SELECT * FROM posts WHERE id = ?', [params.id])
  if (post.status === 'draft' && post.author_id !== currentUser.id) {
    throw new Response('Forbidden', { status: 403 })
  }
  return { post }
})

// Good: delegate to a service
export const loader = createLoader(async ({ params, context }) => {
  const post = await postService.getVisiblePost(params.id, context.get('user'))
  return { post }
})
```

## Edge Cases & Gotchas

### Trailing slashes

EreoJS normalizes URLs by default — `/about/` and `/about` resolve to the same route. If you need strict trailing slash behavior, configure it in `ereo.config.ts`.

### URL encoding

Dynamic params are automatically decoded. `params.id` for `/posts/hello%20world` is `"hello world"`, not `"hello%20world"`. Be careful when using params in database queries or URLs.

### Route group conflicts

Two route groups with the same file name create ambiguity:

```
routes/(marketing)/about.tsx    # /about
routes/(company)/about.tsx      # /about — conflict!
```

EreoJS resolves this by alphabetical group order, but it's better to avoid the conflict entirely.

### Middleware and layout ordering

Middleware runs before the layout loader. If your middleware redirects, the layout loader never runs. Keep this in mind when middleware depends on layout data.
