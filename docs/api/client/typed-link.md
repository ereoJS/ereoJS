# TypedLink

Type-safe link components that validate routes exist and require correct params at compile time.

## Import

```ts
import {
  TypedLink,
  TypedNavLink,
  useIsRouteActive,
  buildUrl,
} from '@ereo/client'
```

## TypedLink

A fully type-safe link component that validates:
1. The route path exists in your route definitions
2. Required params are provided with correct types
3. Search params match the route's search schema
4. Hash params match the route's hash schema (Ereo exclusive)

### Props

```ts
type TypedLinkProps<Path extends TypedRoutes> = {
  // Route path - must be a valid route
  to: Path

  // Route parameters - required if route has params
  params?: RouteParamsFor<Path>

  // Search parameters - typed per route
  search?: Partial<SearchParamsFor<Path>>

  // Hash parameters - typed per route (unique to Ereo!)
  hash?: Partial<HashParamsFor<Path>>

  // Prefetch strategy
  prefetch?: 'none' | 'intent' | 'render' | 'viewport'

  // Replace history instead of push
  replace?: boolean

  // Prevent scroll reset after navigation
  preventScrollReset?: boolean

  // State to pass to the location
  state?: unknown

  // Reload document instead of client navigation
  reloadDocument?: boolean

  // Standard anchor attributes
  className?: string
  style?: React.CSSProperties
  children?: React.ReactNode
  // ... other anchor attributes
}
```

### Basic Usage

```tsx
import { TypedLink } from '@ereo/client'

function Navigation() {
  return (
    <nav>
      {/* Static routes - no params needed */}
      <TypedLink to="/">Home</TypedLink>
      <TypedLink to="/about">About</TypedLink>

      {/* Dynamic routes - params required */}
      <TypedLink to="/users/[id]" params={{ id: '123' }}>
        User Profile
      </TypedLink>

      {/* Multiple params */}
      <TypedLink
        to="/users/[id]/posts/[postId]"
        params={{ id: '123', postId: '456' }}
      >
        View Post
      </TypedLink>
    </nav>
  )
}
```

### Compile-Time Validation

TypedLink catches errors at compile time:

```tsx
// Error: Route '/invalid' does not exist
<TypedLink to="/invalid">Invalid</TypedLink>

// Error: Property 'id' is missing
<TypedLink to="/users/[id]">User</TypedLink>

// Error: Type 'number' is not assignable to type 'string'
<TypedLink to="/users/[id]" params={{ id: 123 }}>User</TypedLink>

// Error: 'userId' does not exist, did you mean 'id'?
<TypedLink to="/users/[id]" params={{ userId: '123' }}>User</TypedLink>
```

### With Search Params

Search parameters are typed per route based on your `searchParams` export:

```tsx
// Route defines: searchParams = z.object({ page: z.number(), sort: z.enum(['asc', 'desc']) })

<TypedLink
  to="/posts"
  search={{ page: 2, sort: 'desc' }}
>
  Page 2
</TypedLink>

// Error: 'order' does not exist on search params
<TypedLink
  to="/posts"
  search={{ order: 'desc' }}
>
  Posts
</TypedLink>

// Error: Type '"invalid"' is not assignable to type '"asc" | "desc"'
<TypedLink
  to="/posts"
  search={{ sort: 'invalid' }}
>
  Posts
</TypedLink>
```

### With Hash Params (Ereo Exclusive)

Hash parameters provide type-safe URL fragments:

```tsx
// Route defines: hashParams = z.object({ section: z.string(), line: z.number() })

<TypedLink
  to="/docs/[topic]"
  params={{ topic: 'routing' }}
  hash={{ section: 'params', line: 42 }}
>
  Jump to Section
</TypedLink>
// Generates: /docs/routing#section=params&line=42

// Use for scroll targets, tab state, modal state, etc.
<TypedLink
  to="/settings"
  hash={{ tab: 'notifications' }}
>
  Notification Settings
</TypedLink>
```

### Prefetching

```tsx
// Prefetch on hover/focus (default)
<TypedLink to="/dashboard" prefetch="intent">
  Dashboard
</TypedLink>

// Prefetch when link renders
<TypedLink to="/about" prefetch="render">
  About
</TypedLink>

// Prefetch when visible in viewport
<TypedLink to="/posts" prefetch="viewport">
  Posts
</TypedLink>

// No prefetching
<TypedLink to="/external" prefetch="none">
  External
</TypedLink>
```

### History Options

```tsx
// Replace current history entry
<TypedLink to="/step-2" replace>
  Next Step
</TypedLink>

// Pass state to destination
<TypedLink
  to="/checkout"
  state={{ from: 'cart', itemCount: 3 }}
>
  Checkout
</TypedLink>

// Prevent scroll to top
<TypedLink to="/posts/[id]" params={{ id: '1' }} preventScrollReset>
  Post 1
</TypedLink>
```

## TypedNavLink

A TypedLink variant with active state styling support.

### Props

```ts
type TypedNavLinkProps<Path extends TypedRoutes> = Omit<
  TypedLinkProps<Path>,
  'className' | 'style'
> & {
  // Class name - can be a function receiving active state
  className?: string | ((props: { isActive: boolean; isPending: boolean }) => string)

  // Style - can be a function receiving active state
  style?: CSSProperties | ((props: { isActive: boolean; isPending: boolean }) => CSSProperties)

  // Match end of URL only
  end?: boolean
}
```

### Basic Usage

```tsx
import { TypedNavLink } from '@ereo/client'

function Navigation() {
  return (
    <nav>
      <TypedNavLink
        to="/"
        end
        className={({ isActive }) => isActive ? 'nav-active' : 'nav-link'}
      >
        Home
      </TypedNavLink>

      <TypedNavLink
        to="/posts"
        className={({ isActive }) => isActive ? 'nav-active' : 'nav-link'}
      >
        Posts
      </TypedNavLink>

      <TypedNavLink
        to="/users/[id]"
        params={{ id: '123' }}
        className={({ isActive }) => isActive ? 'nav-active' : 'nav-link'}
      >
        My Profile
      </TypedNavLink>
    </nav>
  )
}
```

### With Tailwind CSS

```tsx
<TypedNavLink
  to="/dashboard"
  className={({ isActive }) =>
    `px-4 py-2 rounded-lg transition-colors ${
      isActive
        ? 'bg-blue-500 text-white'
        : 'text-gray-600 hover:bg-gray-100'
    }`
  }
>
  Dashboard
</TypedNavLink>
```

### Dynamic Styles

```tsx
<TypedNavLink
  to="/settings"
  style={({ isActive }) => ({
    fontWeight: isActive ? 'bold' : 'normal',
    borderBottom: isActive ? '2px solid blue' : 'none',
  })}
>
  Settings
</TypedNavLink>
```

### End Matching

```tsx
// Active only on "/" exactly
<TypedNavLink to="/" end>Home</TypedNavLink>

// Active on "/posts", "/posts/123", "/posts/new", etc.
<TypedNavLink to="/posts">Posts</TypedNavLink>

// Active only on "/posts" exactly
<TypedNavLink to="/posts" end>All Posts</TypedNavLink>
```

## useIsRouteActive

Hook to check if a typed route is currently active.

### Signature

```ts
function useIsRouteActive<Path extends TypedRoutes>(
  path: Path,
  options?: {
    params?: RouteParamsFor<Path>
    end?: boolean
  }
): boolean
```

### Example

```tsx
import { useIsRouteActive } from '@ereo/client'

function Sidebar() {
  const isUsersActive = useIsRouteActive('/users/[id]', {
    params: { id: '123' },
  })

  const isPostsActive = useIsRouteActive('/posts', { end: false })

  return (
    <aside>
      <section className={isUsersActive ? 'active' : ''}>
        <h3>User Section</h3>
      </section>

      <section className={isPostsActive ? 'active' : ''}>
        <h3>Posts Section</h3>
      </section>
    </aside>
  )
}
```

## buildUrl

Utility function to build URLs programmatically with type safety.

### Signature

```ts
function buildUrl<Path extends TypedRoutes>(
  pattern: Path,
  options?: {
    params?: RouteParamsFor<Path>
    search?: Partial<SearchParamsFor<Path>>
    hash?: Partial<HashParamsFor<Path>>
  }
): string
```

### Example

```ts
import { buildUrl } from '@ereo/client'

// Simple static route
const url1 = buildUrl('/about')
// '/about'

// With params
const url2 = buildUrl('/users/[id]', { params: { id: '123' } })
// '/users/123'

// With search params
const url3 = buildUrl('/posts', {
  search: { page: 2, sort: 'newest' },
})
// '/posts?page=2&sort=newest'

// With hash params
const url4 = buildUrl('/docs/[topic]', {
  params: { topic: 'routing' },
  hash: { section: 'params' },
})
// '/docs/routing#section=params'

// Full example
const url5 = buildUrl('/posts/[slug]', {
  params: { slug: 'hello-world' },
  search: { showComments: true },
  hash: { comment: 'c123' },
})
// '/posts/hello-world?showComments=true#comment=c123'
```

## Patterns

### Tab Navigation

```tsx
function Tabs() {
  const tabs = [
    { to: '/settings' as const, params: {}, label: 'General' },
    { to: '/settings/profile' as const, params: {}, label: 'Profile' },
    { to: '/settings/security' as const, params: {}, label: 'Security' },
  ]

  return (
    <div role="tablist" className="tabs">
      {tabs.map((tab) => (
        <TypedNavLink
          key={tab.to}
          to={tab.to}
          end
          role="tab"
          className={({ isActive }) =>
            `tab ${isActive ? 'tab-active' : ''}`
          }
        >
          {tab.label}
        </TypedNavLink>
      ))}
    </div>
  )
}
```

### Breadcrumbs

```tsx
function Breadcrumbs() {
  return (
    <nav aria-label="Breadcrumb">
      <ol className="flex gap-2">
        <li>
          <TypedLink to="/">Home</TypedLink>
        </li>
        <li>/</li>
        <li>
          <TypedLink to="/users">Users</TypedLink>
        </li>
        <li>/</li>
        <li aria-current="page">
          <TypedLink to="/users/[id]" params={{ id: '123' }}>
            John Doe
          </TypedLink>
        </li>
      </ol>
    </nav>
  )
}
```

### Pagination

```tsx
function Pagination({ currentPage, totalPages }: {
  currentPage: number
  totalPages: number
}) {
  return (
    <nav className="pagination">
      {currentPage > 1 && (
        <TypedLink
          to="/posts"
          search={{ page: currentPage - 1 }}
        >
          Previous
        </TypedLink>
      )}

      {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
        <TypedNavLink
          key={page}
          to="/posts"
          search={{ page }}
          className={({ isActive }) =>
            isActive ? 'page-active' : 'page'
          }
        >
          {page}
        </TypedNavLink>
      ))}

      {currentPage < totalPages && (
        <TypedLink
          to="/posts"
          search={{ page: currentPage + 1 }}
        >
          Next
        </TypedLink>
      )}
    </nav>
  )
}
```

### Conditional Links

```tsx
function ConditionalLink({
  to,
  params,
  disabled,
  children,
}: {
  to: TypedRoutes
  params?: Record<string, string>
  disabled?: boolean
  children: React.ReactNode
}) {
  if (disabled) {
    return (
      <span className="text-gray-400 cursor-not-allowed">
        {children}
      </span>
    )
  }

  return (
    <TypedLink to={to} params={params}>
      {children}
    </TypedLink>
  )
}
```

## Migration from Link

If you're migrating from the standard `Link` component:

```tsx
// Before (Link)
<Link href="/users/123">User</Link>
<Link href={`/users/${userId}/posts/${postId}`}>Post</Link>

// After (TypedLink)
<TypedLink to="/users/[id]" params={{ id: '123' }}>User</TypedLink>
<TypedLink
  to="/users/[id]/posts/[postId]"
  params={{ id: userId, postId: postId }}
>
  Post
</TypedLink>
```

Benefits:
- Compile-time route validation
- Autocomplete for routes and params
- Refactoring safety - renaming routes shows errors
- Search/hash param type safety

## Related

- [Link Component](/api/client/link) - Standard link component
- [Typed Navigation](/api/client/typed-navigation) - Programmatic navigation
- [Type-Safe Routing](/api/core/type-safe-routing) - Overview
- [Prefetch](/api/client/prefetch) - Prefetching strategies
