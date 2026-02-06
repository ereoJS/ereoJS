# Routing FAQ

Frequently asked questions about routing in EreoJS.

## How do optional segments work?

Use double brackets `[[param]]` for segments that may or may not be present in the URL:

```
routes/posts/[[page]].tsx
```

This matches both `/posts` and `/posts/2`. Inside the loader, check whether the parameter exists:

```tsx
export const loader = createLoader(async ({ params }) => {
  const page = params.page ? parseInt(params.page) : 1
  return { posts: await getPosts({ page }) }
})
```

Optional segments only apply to the last segment of a route path. You cannot have optional segments in the middle of a path.

## How do I add trailing slashes?

By default, EreoJS does not enforce trailing slashes. To add them, configure the router in `ereo.config.ts`:

```ts
// ereo.config.ts
import { defineConfig } from '@ereo/core'

export default defineConfig({
  routes: {
    trailingSlash: 'always', // 'always' | 'never' | 'ignore'
  },
})
```

- `'always'` --- Redirects `/about` to `/about/`
- `'never'` --- Redirects `/about/` to `/about` (default)
- `'ignore'` --- Accepts both forms without redirecting

## What is the route priority order?

When multiple routes could match a URL, EreoJS resolves them in this order:

1. **Static routes** --- Exact path matches (`/about`, `/posts/new`)
2. **Dynamic routes** --- Single parameter segments (`/posts/[id]`)
3. **Optional routes** --- Optional segments (`/posts/[[page]]`)
4. **Catch-all routes** --- Rest parameters (`/docs/[...slug]`)

Within the same priority level, routes defined in alphabetically earlier directories take precedence. For example, `routes/posts/new.tsx` (static) always wins over `routes/posts/[id].tsx` (dynamic) for the URL `/posts/new`.

## Can I have multiple layouts?

Yes. Each directory can have its own `_layout.tsx`, and layouts nest automatically:

```
routes/
  _layout.tsx              # Root layout (html, head, body)
  (marketing)/
    _layout.tsx            # Marketing layout (header, footer)
    index.tsx              # /
    pricing.tsx            # /pricing
  (app)/
    _layout.tsx            # App layout (sidebar, nav)
    dashboard.tsx          # /dashboard
    settings.tsx           # /settings
```

Route groups `(marketing)` and `(app)` let you apply different layouts to different sections without affecting URLs. A route inherits all layouts from its parent directories.

## What is the middleware execution order?

Middleware runs from outermost to innermost, following the directory structure:

```
routes/
  _middleware.ts           # 1. Runs first (root)
  dashboard/
    _middleware.ts         # 2. Runs second
    settings/
      _middleware.ts       # 3. Runs third
      index.tsx            # Handler
```

Each middleware calls `next()` to pass control to the next middleware or the route handler. After the handler responds, control flows back through the middleware in reverse order:

```ts
export const middleware: MiddlewareHandler = async (request, context, next) => {
  // Before handler
  console.log('Before')
  const response = await next()
  // After handler
  console.log('After')
  return response
}
```

Named middleware configured in `ereo.config.ts` runs before file-based middleware in the order they are listed in the route's `config.middleware` array.

## How do API routes differ from page routes?

**API routes** export HTTP method handlers (`GET`, `POST`, `PUT`, `DELETE`) and return `Response` objects. They do not render React components:

```ts
// routes/api/users.ts
export async function GET({ request }) {
  const users = await db.users.findMany()
  return Response.json({ users })
}
```

**Page routes** export a default React component and optionally a `loader`/`action`. They render HTML:

```tsx
// routes/users/index.tsx
export const loader = createLoader(async () => {
  return { users: await db.users.findMany() }
})

export default function Users({ loaderData }) {
  return <ul>{loaderData.users.map(u => <li key={u.id}>{u.name}</li>)}</ul>
}
```

API routes are typically placed under `routes/api/` by convention, but any route file that exports HTTP method handlers is treated as an API route regardless of its location.

## Can I colocate non-route files in the routes directory?

Files that do not export a default component or HTTP method handlers are ignored by the router. However, to keep things clean, it is recommended to place utilities, types, and shared components outside the `routes/` directory (e.g., in `src/lib/` or `src/components/`).

## How do I create a 404 page?

Add a `_404.tsx` file at the root of your routes directory:

```tsx
// routes/_404.tsx
export default function NotFound() {
  return (
    <div>
      <h1>404 - Page Not Found</h1>
      <a href="/">Go Home</a>
    </div>
  )
}
```

See the [Routing concepts](/concepts/routing) page for the full routing reference.
