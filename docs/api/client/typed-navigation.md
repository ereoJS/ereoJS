# Typed Navigation

Type-safe programmatic navigation utilities for client-side and server-side navigation with compile-time route validation.

## Import

```ts
import {
  typedNavigate,
  typedRedirect,
  useTypedNavigate,
  buildTypedUrl,
  parseTypedSearchParams,
  parseTypedHashParams,
  preloadRoute,
  goBack,
  goForward,
  go,
  isCurrentPath,
} from '@ereo/client'
```

## typedNavigate

Type-safe client-side navigation function.

### Signature

```ts
async function typedNavigate<Path extends TypedRoutes>(
  path: Path,
  options?: TypedNavigateOptions<Path>
): Promise<void>
```

### Options

```ts
type TypedNavigateOptions<Path> = {
  // Route params - required if route has params
  params?: RouteParamsFor<Path>

  // Search params - typed per route
  search?: Partial<SearchParamsFor<Path>>

  // Hash params - typed per route (Ereo exclusive)
  hash?: Partial<HashParamsFor<Path>>

  // Replace history instead of push
  replace?: boolean

  // State to pass to the location
  state?: unknown

  // Scroll to top after navigation (default: true)
  scroll?: boolean
}
```

### Examples

```ts
import { typedNavigate } from '@ereo/client'

// Navigate to a static route
await typedNavigate('/about')

// Navigate with params
await typedNavigate('/users/[id]', {
  params: { id: '123' },
})

// Navigate with search and hash params
await typedNavigate('/posts', {
  search: { page: 2, sort: 'newest' },
  hash: { section: 'comments' },
})

// Replace history entry
await typedNavigate('/step-2', { replace: true })

// Pass state to destination
await typedNavigate('/checkout', {
  state: { from: 'cart', itemCount: 3 },
})

// Prevent scroll reset
await typedNavigate('/posts/[slug]', {
  params: { slug: 'hello' },
  scroll: false,
})
```

### Compile-Time Validation

```ts
// Error: Route '/invalid' does not exist
await typedNavigate('/invalid')

// Error: Property 'id' is missing
await typedNavigate('/users/[id]')

// Error: Type 'number' is not assignable to type 'string'
await typedNavigate('/users/[id]', { params: { id: 123 } })
```

## useTypedNavigate

Hook that returns a type-safe navigate function for use in components.

### Signature

```ts
function useTypedNavigate(): TypedNavigateFunction

interface TypedNavigateFunction {
  // Navigate to a typed route
  <Path extends TypedRoutes>(
    path: Path,
    options?: TypedNavigateOptions<Path>
  ): Promise<void>

  // Navigate by delta (back/forward)
  (delta: number): void
}
```

### Example

```tsx
import { useTypedNavigate } from '@ereo/client'

function UserActions({ userId }: { userId: string }) {
  const navigate = useTypedNavigate()

  const handleView = () => {
    navigate('/users/[id]', { params: { id: userId } })
  }

  const handleEdit = () => {
    navigate('/users/[id]/edit', {
      params: { id: userId },
      state: { returnTo: '/users' },
    })
  }

  const handleBack = () => {
    navigate(-1)
  }

  return (
    <div>
      <button onClick={handleView}>View</button>
      <button onClick={handleEdit}>Edit</button>
      <button onClick={handleBack}>Back</button>
    </div>
  )
}
```

## typedRedirect

Type-safe server-side redirect that returns a Response object.

### Signature

```ts
function typedRedirect<Path extends TypedRoutes>(
  path: Path,
  options?: TypedRedirectOptions<Path>
): Response
```

### Options

```ts
type TypedRedirectOptions<Path> = {
  // Route params - required if route has params
  params?: RouteParamsFor<Path>

  // Search params
  search?: Partial<SearchParamsFor<Path>>

  // Hash params (Ereo exclusive)
  hash?: Partial<HashParamsFor<Path>>

  // HTTP status code (default: 302)
  status?: 301 | 302 | 303 | 307 | 308

  // Custom headers
  headers?: HeadersInit
}
```

### Examples

```ts
import { typedRedirect } from '@ereo/client'

// In a loader - redirect to login
export const loader = async ({ request, context }) => {
  const user = context.get('user')

  if (!user) {
    return typedRedirect('/login', {
      search: { returnTo: new URL(request.url).pathname },
    })
  }

  return { user }
}

// Redirect to a dynamic route
return typedRedirect('/users/[id]', {
  params: { id: user.id },
})

// Permanent redirect
return typedRedirect('/new-location', {
  status: 301,
})

// Redirect after POST (303 See Other)
return typedRedirect('/success', {
  status: 303,
})

// Redirect with custom headers
return typedRedirect('/dashboard', {
  headers: {
    'X-Redirect-Reason': 'post-action',
  },
})
```

### Status Code Reference

| Status | Name           | Use Case                                      |
|--------|----------------|-----------------------------------------------|
| 301    | Moved Permanently | Permanent URL change (SEO redirect)        |
| 302    | Found          | Temporary redirect (default)                  |
| 303    | See Other      | Redirect after POST to prevent resubmit       |
| 307    | Temporary Redirect | Preserve request method                    |
| 308    | Permanent Redirect | Like 301, but preserve method             |

## buildTypedUrl

Build URLs programmatically with type safety.

### Signature

```ts
function buildTypedUrl<Path extends TypedRoutes>(
  pattern: Path,
  options?: {
    params?: RouteParamsFor<Path>
    search?: Partial<SearchParamsFor<Path>>
    hash?: Partial<HashParamsFor<Path>>
  }
): string
```

### Examples

```ts
import { buildTypedUrl } from '@ereo/client'

// Simple static route
const url1 = buildTypedUrl('/about')
// '/about'

// With params
const url2 = buildTypedUrl('/users/[id]', {
  params: { id: '123' },
})
// '/users/123'

// With multiple params
const url3 = buildTypedUrl('/users/[id]/posts/[postId]', {
  params: { id: '123', postId: '456' },
})
// '/users/123/posts/456'

// With search params
const url4 = buildTypedUrl('/posts', {
  search: { page: 2, sort: 'newest' },
})
// '/posts?page=2&sort=newest'

// With hash params (Ereo exclusive)
const url5 = buildTypedUrl('/docs/[topic]', {
  params: { topic: 'routing' },
  hash: { section: 'params' },
})
// '/docs/routing#section=params'

// Full example
const url6 = buildTypedUrl('/posts/[slug]', {
  params: { slug: 'hello-world' },
  search: { showComments: true },
  hash: { comment: 'c123' },
})
// '/posts/hello-world?showComments=true#comment=c123'
```

## URL Parsing

### parseTypedSearchParams

Parse search params from a URL with type safety.

```ts
function parseTypedSearchParams<Path extends TypedRoutes>(
  url: URL | string
): Partial<SearchParamsFor<Path>>
```

```ts
import { parseTypedSearchParams } from '@ereo/client'

const url = new URL('https://example.com/posts?page=2&sort=newest')
const searchParams = parseTypedSearchParams<'/posts'>(url)
// { page: '2', sort: 'newest' }
```

### parseTypedHashParams (Ereo Exclusive)

Parse hash params from a URL with type safety. This feature is unique to Ereo.

```ts
function parseTypedHashParams<Path extends TypedRoutes>(
  url: URL | string
): Partial<HashParamsFor<Path>>
```

```ts
import { parseTypedHashParams } from '@ereo/client'

const url = new URL('https://example.com/docs/routing#section=params&line=42')
const hashParams = parseTypedHashParams<'/docs/[topic]'>(url)
// { section: 'params', line: '42' }
```

## Preloading

### preloadRoute

Preload a route's data before navigation for faster transitions.

```ts
async function preloadRoute<Path extends TypedRoutes>(
  path: Path,
  options?: {
    params?: RouteParamsFor<Path>
    search?: Partial<SearchParamsFor<Path>>
  }
): Promise<void>
```

```tsx
import { preloadRoute } from '@ereo/client'

function UserCard({ userId }: { userId: string }) {
  return (
    <div
      onMouseEnter={() => {
        // Preload on hover
        preloadRoute('/users/[id]', { params: { id: userId } })
      }}
    >
      <TypedLink to="/users/[id]" params={{ id: userId }}>
        View Profile
      </TypedLink>
    </div>
  )
}
```

## History Utilities

### goBack

Navigate back in history.

```ts
import { goBack } from '@ereo/client'

function BackButton() {
  return <button onClick={goBack}>Go Back</button>
}
```

### goForward

Navigate forward in history.

```ts
import { goForward } from '@ereo/client'

function ForwardButton() {
  return <button onClick={goForward}>Go Forward</button>
}
```

### go

Navigate to a specific history entry.

```ts
import { go } from '@ereo/client'

// Go back 2 entries
go(-2)

// Go forward 1 entry
go(1)
```

### isCurrentPath

Check if a path matches the current location.

```ts
function isCurrentPath<Path extends TypedRoutes>(
  path: Path,
  options?: {
    params?: RouteParamsFor<Path>
    exact?: boolean
  }
): boolean
```

```tsx
import { isCurrentPath } from '@ereo/client'

function Sidebar() {
  const isUsersSection = isCurrentPath('/users')
  const isSpecificUser = isCurrentPath('/users/[id]', {
    params: { id: '123' },
    exact: true,
  })

  return (
    <nav>
      <span className={isUsersSection ? 'active' : ''}>Users</span>
    </nav>
  )
}
```

## Patterns

### Protected Route Redirect

```ts
export const loader = async ({ request, context }) => {
  const user = await context.get<User>('user')

  if (!user) {
    return typedRedirect('/login', {
      search: { returnTo: new URL(request.url).pathname },
    })
  }

  if (!user.isAdmin) {
    return typedRedirect('/unauthorized')
  }

  return { user }
}
```

### Wizard Navigation

```tsx
function WizardStep({ step, data }: { step: number; data: FormData }) {
  const navigate = useTypedNavigate()

  const handleNext = () => {
    navigate('/wizard/[step]', {
      params: { step: String(step + 1) },
      state: { data },
      replace: true,
    })
  }

  const handleBack = () => {
    navigate('/wizard/[step]', {
      params: { step: String(step - 1) },
      state: { data },
      replace: true,
    })
  }

  return (
    <div>
      {step > 1 && <button onClick={handleBack}>Previous</button>}
      <button onClick={handleNext}>Next</button>
    </div>
  )
}
```

### Search Filter Navigation

```tsx
function Filters({ currentFilters }) {
  const navigate = useTypedNavigate()

  const updateFilter = (key: string, value: string) => {
    navigate('/products', {
      search: { ...currentFilters, [key]: value, page: 1 },
      replace: true,
    })
  }

  return (
    <select onChange={(e) => updateFilter('category', e.target.value)}>
      <option value="">All Categories</option>
      <option value="electronics">Electronics</option>
      <option value="clothing">Clothing</option>
    </select>
  )
}
```

### Deep Linking with Hash

```tsx
function TableOfContents({ sections }) {
  return (
    <nav>
      {sections.map((section) => (
        <TypedLink
          key={section.id}
          to="/docs/[topic]"
          params={{ topic: 'current' }}
          hash={{ section: section.id }}
        >
          {section.title}
        </TypedLink>
      ))}
    </nav>
  )
}
```

## TanStack Start Comparison

| Feature | TanStack Start | EreoJS |
|---------|---------------|--------|
| Type-safe navigate | Partial | Full |
| Search params typed | Limited | Full |
| Hash params typed | No | Yes |
| Preload route data | Yes | Yes |
| Server redirect | Yes | Yes |
| History utilities | Yes | Yes |

## Related

- [TypedLink Component](/api/client/typed-link) - Declarative navigation
- [Type-Safe Routing](/api/core/type-safe-routing) - Overview
- [defineRoute Builder](/api/data/define-route) - Route definitions
