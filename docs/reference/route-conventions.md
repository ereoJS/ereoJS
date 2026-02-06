# Route Conventions

Complete reference for file naming patterns and special files in the EreoJS `routes/` directory.

## File-to-URL Mapping

Files in `routes/` map directly to URL paths:

| File | URL |
|------|-----|
| `routes/index.tsx` | `/` |
| `routes/about.tsx` | `/about` |
| `routes/contact.tsx` | `/contact` |
| `routes/blog/index.tsx` | `/blog` |
| `routes/blog/archive.tsx` | `/blog/archive` |

## Dynamic Segments

Use square brackets for URL parameters:

| File | URL Example | Params |
|------|-------------|--------|
| `routes/posts/[id].tsx` | `/posts/123` | `{ id: '123' }` |
| `routes/users/[userId]/posts/[postId].tsx` | `/users/5/posts/42` | `{ userId: '5', postId: '42' }` |

## Optional Segments

Use double brackets for optional URL segments:

| File | URL Examples | Params |
|------|--------------|--------|
| `routes/posts/[[page]].tsx` | `/posts`, `/posts/2` | `{}` or `{ page: '2' }` |

Optional segments can only appear at the end of a path.

## Catch-All Segments

Use `[...slug]` to capture all remaining segments as an array:

| File | URL Example | `params.slug` |
|------|-------------|---------------|
| `routes/docs/[...slug].tsx` | `/docs/intro` | `['intro']` |
| | `/docs/api/core` | `['api', 'core']` |
| | `/docs/a/b/c` | `['a', 'b', 'c']` |

## Special Files

These files have special meaning in the routing system:

| File | Purpose |
|------|---------|
| `_layout.tsx` | Layout wrapper for all routes in the directory and subdirectories |
| `_error.tsx` | Error boundary for the route segment |
| `_loading.tsx` | Loading UI shown while the route's data is being fetched |
| `_404.tsx` | Custom "not found" page when no route matches |
| `_middleware.ts` | Middleware that runs before route handlers in the directory |

### _layout.tsx

Wraps all routes in the same directory and its subdirectories. Layouts nest automatically:

```tsx
// routes/_layout.tsx
export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
```

Layouts can have their own `loader` to load shared data (e.g., user session, navigation items).

### _error.tsx

Catches errors thrown by loaders, actions, or components within the route segment:

```tsx
// routes/_error.tsx
export default function ErrorPage({ error }) {
  return <h1>Error: {error?.message}</h1>
}
```

### _loading.tsx

Displayed as a fallback while the route's loader is running:

```tsx
// routes/posts/_loading.tsx
export default function PostsLoading() {
  return <div className="skeleton">Loading...</div>
}
```

### _404.tsx

Rendered when no route matches the URL. Place at the root of `routes/` for a global 404 page:

```tsx
// routes/_404.tsx
export default function NotFound() {
  return <h1>404 - Page Not Found</h1>
}
```

### _middleware.ts

Runs before all route handlers in the directory:

```ts
// routes/dashboard/_middleware.ts
import type { MiddlewareHandler } from '@ereo/core'

export const middleware: MiddlewareHandler = async (request, context, next) => {
  // Check auth, set headers, log, etc.
  return next()
}
```

## Route Groups

Directories wrapped in parentheses create groups that do not affect the URL:

```
routes/
  (marketing)/
    _layout.tsx      # Marketing layout
    index.tsx        # / (not /marketing)
    pricing.tsx      # /pricing
  (app)/
    _layout.tsx      # App layout
    dashboard.tsx    # /dashboard
```

Use groups to apply different layouts or middleware to different sections without changing URLs.

## API Routes

Any route file can serve as an API endpoint by exporting HTTP method handlers:

```ts
// routes/api/users.ts
export async function GET({ request }) {
  return Response.json({ users: [] })
}

export async function POST({ request }) {
  const body = await request.json()
  return Response.json(body, { status: 201 })
}
```

The `api/` prefix is a convention, not a requirement. Any route file that exports `GET`, `POST`, `PUT`, `DELETE`, `PATCH`, `HEAD`, or `OPTIONS` functions is treated as an API route.

## Route Exports

Each route file can export these named values:

| Export | Type | Purpose |
|--------|------|---------|
| `default` | React component | Page component (required for page routes) |
| `loader` | Function | Server-side data loading (GET) |
| `action` | Function | Mutation handling (POST, PUT, DELETE) |
| `config` | Object | Route configuration (rendering, caching, middleware) |
| `meta` | Function | Page metadata (title, description, OG tags) |
| `shouldRevalidate` | Function | Controls when the loader re-runs |
| `ErrorBoundary` | React component | Inline error boundary |
| `GET`, `POST`, etc. | Function | HTTP method handlers (API routes) |

## Priority Order

When multiple routes could match a URL:

1. Static routes (`/about`)
2. Dynamic routes (`/posts/[id]`)
3. Optional routes (`/posts/[[page]]`)
4. Catch-all routes (`/docs/[...slug]`)

Within the same level, alphabetically earlier file names take priority.

## File Extensions

Route files can use `.tsx`, `.ts`, `.jsx`, or `.js` extensions. Use `.tsx` for routes with JSX (page routes) and `.ts` for routes without JSX (API routes, middleware).
