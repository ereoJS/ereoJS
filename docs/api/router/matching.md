# Route Matching

How EreoJS matches URLs to route handlers.

## Import

```ts
import { createFileRouter, matchRoute } from '@ereo/router'
```

## Matching Order

Routes are matched in this order:

1. **Static routes** - Exact path matches
2. **Dynamic routes** - Single parameter segments
3. **Catch-all routes** - Rest parameters
4. **Layout routes** - Applied hierarchically

```
/posts              → routes/posts/index.tsx (static)
/posts/hello-world  → routes/posts/[slug].tsx (dynamic)
/docs/a/b/c         → routes/docs/[...path].tsx (catch-all)
```

## Pattern Types

### Static Segments

```
routes/about.tsx        → /about
routes/blog/index.tsx   → /blog
routes/api/health.tsx   → /api/health
```

### Dynamic Segments

Single parameter in brackets:

```
routes/users/[id].tsx           → /users/123
routes/posts/[slug].tsx         → /posts/hello-world
routes/[category]/[product].tsx → /electronics/laptop
```

Access parameters in loader:

```ts
export const loader = createLoader(async ({ params }) => {
  const { id } = params  // { id: '123' }
  return { user: await db.users.find(id) }
})
```

### Optional Segments

Use double brackets for optional parameters:

```
routes/posts/[[page]].tsx → /posts or /posts/2
```

```ts
export const loader = createLoader(async ({ params }) => {
  const page = params.page ? parseInt(params.page) : 1
  return { posts: await db.posts.paginate(page) }
})
```

### Catch-All Segments

Use `[...name]` for rest parameters:

```
routes/docs/[...path].tsx → /docs/getting-started
                          → /docs/api/core/create-app
                          → /docs/a/b/c/d
```

```ts
export const loader = createLoader(async ({ params }) => {
  const { path } = params  // 'getting-started' or 'api/core/create-app'
  const segments = path.split('/')
  return { doc: await loadDoc(segments) }
})
```

### Optional Catch-All

Use `[[...name]]` for optional rest:

```
routes/[[...path]].tsx → / (path = undefined)
                       → /any/path (path = 'any/path')
```

## Route Groups

Parentheses create route groups without affecting the URL:

```
routes/
├── (marketing)/
│   ├── about.tsx       → /about
│   └── pricing.tsx     → /pricing
└── (app)/
    ├── dashboard.tsx   → /dashboard
    └── settings.tsx    → /settings
```

Groups are useful for:
- Organizing related routes
- Applying different layouts to groups

## Parallel Routes

Use `@name` for parallel/named slots:

```
routes/
├── @sidebar/
│   └── default.tsx
├── @main/
│   └── default.tsx
└── layout.tsx
```

```tsx
// layout.tsx
export default function Layout({ sidebar, main }) {
  return (
    <div className="flex">
      <aside>{sidebar}</aside>
      <main>{main}</main>
    </div>
  )
}
```

## matchRoute Function

Programmatically match routes:

```ts
import { matchRoute } from '@ereo/router'

const result = matchRoute('/posts/hello-world', routes)

if (result) {
  console.log(result.route)   // Route configuration
  console.log(result.params)  // { slug: 'hello-world' }
  console.log(result.path)    // '/posts/hello-world'
}
```

## Route Specificity

When multiple routes could match, the most specific wins:

```
/posts/new      → routes/posts/new.tsx (static wins)
/posts/hello    → routes/posts/[slug].tsx (dynamic)
```

Specificity rules:
1. More static segments = higher priority
2. Dynamic segments beat catch-all
3. Longer paths beat shorter paths

## Query Parameters

Query parameters are available via `request.url`:

```ts
export const loader = createLoader(async ({ request }) => {
  const url = new URL(request.url)
  const page = url.searchParams.get('page') || '1'
  const sort = url.searchParams.get('sort') || 'date'

  return { posts: await getPosts({ page, sort }) }
})
```

## Hash Fragments

Hash fragments (`#section`) are client-side only and not sent to the server.

Handle them in your component:

```tsx
import { useEffect } from 'react'

export default function Page() {
  useEffect(() => {
    const hash = window.location.hash.slice(1)
    if (hash) {
      document.getElementById(hash)?.scrollIntoView()
    }
  }, [])

  return <div>...</div>
}
```

## Related

- [File Router](./file-router.md)
- [Middleware](./middleware.md)
- [Routing Concepts](/core-concepts/routing)
