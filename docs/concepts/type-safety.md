# Type Safety

EreoJS provides end-to-end type safety across route parameters, loader data, action results, middleware context, and navigation.

## Type System Overview

```
Route file path   →  RouteParamsFor<'/posts/[id]'>     →  { id: string }
Loader return     →  LoaderData<typeof loader>         →  { post: Post }
Action return     →  ActionData<typeof action>         →  { success: boolean }
Middleware context →  Generic get<T>()/set<T>()          →  { user: User }
Navigation        →  TypedLink, typedNavigate           →  Compile-time route checking
```

## Route Parameter Types

`RouteParamsFor` extracts parameter types from a route pattern:

```tsx
import type { RouteParamsFor } from '@ereo/core'

type PostParams = RouteParamsFor<'/posts/[id]'>
// { id: string }

type UserPost = RouteParamsFor<'/users/[userId]/posts/[postId]'>
// { userId: string; postId: string }

type Page = RouteParamsFor<'/posts/[[page]]'>     // { page?: string }
type Docs = RouteParamsFor<'/docs/[...slug]'>     // { slug: string[] }
```

Use in loaders with `LoaderArgs`:

```tsx
import type { LoaderArgs } from '@ereo/core'

export async function loader({ params }: LoaderArgs<{ id: string }>) {
  const post = await db.posts.find(params.id)  // params.id is string
  return { post }
}
```

## Inferred Loader and Action Types

Extract return types without manual interfaces:

```tsx
import { createLoader } from '@ereo/data'
import type { LoaderData, RouteComponentProps } from '@ereo/core'

export const loader = createLoader(async ({ params }) => {
  const post = await db.posts.find(params.id)
  return { post }
})

// Type component from the loader — or use RouteComponentProps for loaderData + params
export default function Post({ loaderData }: { loaderData: LoaderData<typeof loader> }) {
  return <h1>{loaderData.post.title}</h1>
}
```

## Typed Context

The `AppContext` provides generic `get<T>()` and `set<T>()` methods for sharing data between middleware and loaders. Use explicit type annotations to keep context access type-safe:

```tsx
import type { MiddlewareHandler } from '@ereo/core'

interface User {
  id: string
  email: string
}

export const middleware: MiddlewareHandler = async (request, context, next) => {
  const user = await getUser(request)
  if (!user) return Response.redirect('/login')
  context.set<User>('user', user)
  return next()
}
```

Access typed context in loaders:

```tsx
export const loader = createLoader(async ({ context }) => {
  const user = context.get<User>('user')
  return { user }
})
```

For full route-level type safety — where context types are inferred from the middleware chain — use the generated `ContextFor<T>` type (produced by the `createTypesPlugin`):

```tsx
import type { ContextFor } from '@ereo/core'

// After running type generation, context types flow through the route tree
type DashboardContext = ContextFor<'/dashboard'>
```

## Generating Route Types

Generate TypeScript declarations for all routes automatically:

```ts
// ereo.config.ts
import { defineConfig } from '@ereo/core'
import { createTypesPlugin } from '@ereo/bundler'

export default defineConfig({
  plugins: [createTypesPlugin()],
})
```

```bash
bun ereo generate-types
```

This produces `.ereo/types.d.ts` with a `RoutePaths` union, parameter types, and loader/action types for every route. Types regenerate automatically during `bun ereo dev`.

Use generated types for type-safe navigation:

```tsx
import { TypedLink } from '@ereo/client'
import { typedNavigate } from '@ereo/client'

<TypedLink to="/posts/[id]" params={{ id: '123' }}>Read Post</TypedLink>

await typedNavigate('/posts/[id]', { params: { id: '123' } })
```

## Anti-Patterns

### 1. Using `any` for Loader Data

```tsx
// BAD: typo goes undetected
export default function Post({ loaderData }: { loaderData: any }) {
  return <h1>{loaderData.psot.title}</h1>
}
// GOOD: caught at compile time
export default function Post({ loaderData }: { loaderData: LoaderData<typeof loader> }) {
  return <h1>{loaderData.post.title}</h1>
}
```

### 2. Not Using Generic Params on LoaderArgs

Without generics, `params` is `Record<string, string | undefined>`, requiring non-null assertions.

```tsx
// BAD                                          // GOOD
loader({ params }: LoaderArgs) {                loader({ params }: LoaderArgs<{ id: string }>) {
  db.posts.find(params.id!)                       db.posts.find(params.id)
}                                               }
```

### 3. Ignoring Inferred Types from `defineRoute`

The builder chain infers types end-to-end. Manually overriding them breaks the inference and causes drift.

### 4. Duplicating Types Instead of Inferring

Define the shape once in your loader, then use `LoaderData<typeof loader>` everywhere.

## Edge Cases

### Optional Parameters

Optional segments (`[[page]]`) produce optional properties. Always handle `undefined`:

```tsx
export async function loader({ params }: LoaderArgs<{ page?: string }>) {
  const page = params.page ? parseInt(params.page, 10) : 1
  return { posts: await getPosts({ page }) }
}
```

### Catch-All Routes

Catch-all segments (`[...slug]`) produce `string[]`. The array can be empty.

```tsx
export async function loader({ params }: LoaderArgs<{ slug: string[] }>) {
  const path = params.slug.length === 0 ? 'index' : params.slug.join('/')
  return { doc: await getDoc(path) }
}
```

### Narrowing Action Return Types

Use `as const` for discriminated unions so TypeScript can narrow:

```tsx
if (!title) return { success: false as const, errors: { title: ['Required'] } }
return { success: true as const, postId: post.id }
```

### Context Types with Optional Values

When some context values are only set by middleware on certain routes, use a union type or optional generic to handle both cases:

```tsx
// Middleware sets context.set<User>('user', user) on all authenticated routes
// But 'organization' is only set on /org/* routes
const user = context.get<User>('user')             // always set by auth middleware
const org = context.get<Org | undefined>('organization')  // only set on /org/* routes
```

## Next Steps

- [Types API Reference](/api/core/types) -- Full list of exported types
- [Type-Safe Routing API](/api/core/type-safe-routing) -- `TypedLink`, `typedNavigate`
- [Typed Middleware](/api/router/typed-middleware) -- Middleware type patterns
- [defineRoute API](/api/data/define-route) -- Builder chain with type inference
- [Routing Concept](/concepts/routing) -- File-based routing conventions
