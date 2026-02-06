# Route Configuration Reference

Complete reference for all route-level exports and configuration options.

## Route Exports

Every route file can export these named exports:

### default (Component)

The React component that renders for this route.

```tsx
export default function Page({ loaderData, params }) {
  return <div>{loaderData.title}</div>
}
```

**Props:**
| Prop | Type | Description |
|------|------|-------------|
| `loaderData` | `T` | Data returned from the loader |
| `params` | `Record<string, string>` | URL parameters |

### loader

Server-side data fetching function.

```tsx
import { createLoader } from '@ereo/data'

export const loader = createLoader(async ({ request, params, context }) => {
  const post = await db.posts.find(params.id)
  return { post }
})
```

**Args:**
| Arg | Type | Description |
|-----|------|-------------|
| `request` | `Request` | The incoming HTTP request |
| `params` | `Record<string, string>` | URL parameters |
| `context` | `RequestContext` | Shared request context |

### action

Server-side mutation handler for form submissions.

```tsx
import { createAction } from '@ereo/data'

export const action = createAction(async ({ request, params, context }) => {
  const formData = await request.formData()
  // Handle mutation...
  return { success: true }
})
```

### meta

Generate document metadata (title, meta tags, etc.).

```tsx
import type { MetaFunction } from '@ereo/core'

export const meta: MetaFunction = ({ data, params }) => {
  return [
    { title: data.post.title },
    { name: 'description', content: data.post.excerpt },
    { property: 'og:title', content: data.post.title },
    { property: 'og:image', content: data.post.image }
  ]
}
```

**Args:**
| Arg | Type | Description |
|-----|------|-------------|
| `data` | `T` | Loader data |
| `params` | `Record<string, string>` | URL parameters |
| `matches` | `RouteMatch[]` | All matched routes |

### headers

Set HTTP response headers.

```tsx
import type { HeadersFunction } from '@ereo/core'

export const headers: HeadersFunction = ({ loaderHeaders, actionHeaders, parentHeaders }) => {
  return {
    'Cache-Control': loaderHeaders.get('Cache-Control') || 'max-age=300',
    'X-Custom-Header': 'value'
  }
}
```

**Args:**
| Arg | Type | Description |
|-----|------|-------------|
| `loaderHeaders` | `Headers` | Headers from loader response |
| `actionHeaders` | `Headers` | Headers from action response |
| `parentHeaders` | `Headers` | Headers from parent route |

### handle

Custom route metadata accessible via route matching.

```tsx
export const handle = {
  breadcrumb: 'Blog Post',
  showSidebar: true,
  permissions: ['read:posts']
}
```

Access in layouts:

```tsx
import { useMatches } from '@ereo/client'

export default function Layout({ children }) {
  const matches = useMatches()
  const breadcrumbs = matches
    .filter(m => m.handle?.breadcrumb)
    .map(m => m.handle.breadcrumb)

  return (
    <div>
      <Breadcrumbs items={breadcrumbs} />
      {children}
    </div>
  )
}
```

### ErrorBoundary

Error boundary component for this route.

```tsx
import { useRouteError, isRouteErrorResponse } from '@ereo/client'

export function ErrorBoundary() {
  const error = useRouteError()

  if (isRouteErrorResponse(error)) {
    return (
      <div>
        <h1>{error.status} {error.statusText}</h1>
        <p>{error.data}</p>
      </div>
    )
  }

  return <h1>Something went wrong</h1>
}
```

### params (Validation)

Validate and transform URL parameters.

```tsx
export const params = {
  id: {
    parse: (value: string) => {
      const num = parseInt(value, 10)
      if (isNaN(num) || num <= 0) throw new Error('Invalid ID')
      return num
    }
  },
  slug: {
    parse: (value: string) => value.toLowerCase(),
    optional: false
  }
}
```

### searchParams (Validation)

Validate and transform query string parameters.

```tsx
export const searchParams = {
  page: {
    default: 1,
    validator: {
      parse: (value: string) => Math.max(1, parseInt(value, 10) || 1)
    }
  },
  sort: {
    default: 'date',
    validator: {
      parse: (value: string) => {
        const allowed = ['date', 'title', 'views']
        return allowed.includes(value) ? value : 'date'
      }
    }
  }
}
```

---

## Route Configuration (`config`)

Export a `config` object to configure route behavior:

```tsx
export const config = {
  // All options documented below
}
```

### render

Configure rendering mode and strategy.

```tsx
export const config = {
  render: 'ssr'  // Shorthand for { mode: 'ssr' }
}
```

Or with full options:

```tsx
export const config = {
  render: {
    mode: 'ssg',  // 'ssr' | 'ssg' | 'csr' | 'streaming' | 'json' | 'xml' | 'rsc'

    // SSG options
    prerender: {
      enabled: true,
      paths: async () => {
        const posts = await db.posts.findAll()
        return posts.map(p => `/posts/${p.slug}`)
      },
      revalidate: 3600,  // ISR: revalidate every hour
      tags: ['posts'],   // Cache tags for on-demand invalidation
      fallback: 'blocking'  // 'blocking' | 'static' | '404'
    },

    // Streaming options
    streaming: {
      enabled: true,
      suspenseBoundaries: ['comments', 'related']
    },

    // CSR options
    csr: {
      enabled: true,
      clientLoader: async (params) => {
        const res = await fetch(`/api/posts/${params.id}`)
        return res.json()
      }
    }
  }
}
```

**Render Modes:**
| Mode | Description |
|------|-------------|
| `'ssr'` | Server-side rendering (default) |
| `'ssg'` | Static site generation at build time |
| `'csr'` | Client-side rendering only |
| `'streaming'` | SSR with streaming for deferred data |
| `'json'` | JSON API response |
| `'xml'` | XML response |
| `'rsc'` | React Server Component |

### middleware

Route-specific middleware chain.

```tsx
export const config = {
  middleware: ['auth', 'rateLimit', customMiddleware]
}
```

Middleware runs in order before the loader/action.

### cache

Multi-level caching configuration.

```tsx
export const config = {
  cache: {
    // Edge/CDN cache
    edge: {
      maxAge: 3600,
      staleWhileRevalidate: 86400,
      vary: ['Accept-Language', 'Accept-Encoding'],
      keyGenerator: ({ request, params }) => {
        return `${request.url}:${params.locale}`
      }
    },

    // Browser cache
    browser: {
      maxAge: 300,
      private: true  // User-specific content
    },

    // Framework data cache
    data: {
      key: (params) => `post:${params.id}`,
      tags: (params) => ['posts', `post:${params.id}`]
    }
  }
}
```

Shorthand:

```tsx
export const config = {
  cache: {
    maxAge: 3600,
    staleWhileRevalidate: 86400,
    tags: ['posts']
  }
}
```

### islands

Selective hydration configuration.

```tsx
export const config = {
  islands: {
    // Default strategy for all islands in this route
    defaultStrategy: 'visible',  // 'load' | 'idle' | 'visible' | 'media' | 'none'

    // Per-component overrides
    components: [
      { component: 'CommentForm', strategy: 'load' },
      { component: 'RelatedPosts', strategy: 'idle' },
      { component: 'MobileMenu', strategy: 'media', mediaQuery: '(max-width: 768px)' }
    ],

    // Disable all hydration (fully static page)
    disabled: false
  }
}
```

**Hydration Strategies:**
| Strategy | Description |
|----------|-------------|
| `'load'` | Hydrate immediately on page load |
| `'idle'` | Hydrate during browser idle time |
| `'visible'` | Hydrate when scrolled into viewport |
| `'media'` | Hydrate when media query matches |
| `'none'` | Never hydrate (static only) |

### progressive

Progressive enhancement settings.

```tsx
export const config = {
  progressive: {
    // Form behavior
    forms: {
      fallback: 'server',  // 'server' | 'spa'
      redirect: 'follow'   // 'follow' | 'manual'
    },

    // Link prefetching
    prefetch: {
      trigger: 'hover',  // 'hover' | 'visible' | 'intent' | 'never'
      data: true,        // Also prefetch loader data
      ttl: 60000         // Prefetch cache TTL in ms
    }
  }
}
```

### auth

Authentication and authorization settings.

```tsx
export const config = {
  auth: {
    required: true,
    roles: ['admin', 'editor'],
    permissions: ['posts:write'],
    check: async ({ request, context, params }) => {
      const user = context.get('user')
      const post = await db.posts.find(params.id)
      return post.authorId === user.id
    },
    redirect: '/login?redirect={pathname}',
    unauthorized: {
      status: 403,
      body: { error: 'Forbidden' }
    }
  }
}
```

### route

Layout and composition configuration.

```tsx
export const config = {
  route: {
    // Layout chain
    layouts: ['root', 'dashboard'],

    // Inherit from parent
    inherit: {
      middleware: true,
      meta: 'merge'  // 'merge' | 'replace' | false
    },

    // Error boundary config
    errorBoundary: {
      capture: 'all'  // 'all' | 'loader' | 'render'
    },

    // Loading UI config
    loading: {
      delay: 200,    // Show loading after 200ms
      timeout: 5000  // Show timeout UI after 5s
    }
  }
}
```

### error

Error recovery and resilience.

```tsx
export const config = {
  error: {
    // Auto-retry failed loaders
    retry: {
      count: 3,
      delay: 1000  // ms between retries
    },

    // Error handling strategy
    onError: 'boundary',  // 'boundary' | 'toast' | 'redirect' | 'silent'

    // Error reporting
    reportError: (error, context) => {
      console.error(`[${context.route}] ${context.phase}:`, error)
    }
  }
}
```

### runtime

Runtime environment configuration.

```tsx
export const config = {
  runtime: {
    runtime: 'edge',       // 'node' | 'edge' | 'auto'
    regions: ['iad1'],     // Edge regions
    memory: 256,           // Memory limit (MB)
    timeout: 30            // Timeout (seconds)
  }
}
```

### dev

Development mode configuration.

```tsx
export const config = {
  dev: {
    // Mock data for development
    mock: {
      enabled: true,
      data: {
        posts: [{ id: 1, title: 'Mock Post' }]
      }
    },

    // Artificial latency
    latency: 500,  // ms

    // Error injection rate (0-1)
    errorRate: 0.1
  }
}
```

### variants

Multiple URL patterns for the same component.

```tsx
export const config = {
  variants: [
    {
      path: '/blog/:slug',
      params: { slug: 'string' }
    },
    {
      path: '/articles/:id',
      params: { id: 'number' },
      config: {
        cache: { maxAge: 600 }
      }
    }
  ]
}
```

---

## File Naming Conventions

Special file extensions auto-configure render mode:

| Extension | Render Mode |
|-----------|-------------|
| `*.ssg.tsx` | Static Site Generation |
| `*.server.tsx` | Server-only (no client hydration) |
| `*.client.tsx` | Client-side rendering only |
| `*.api.tsx` | JSON API response |
| `*.rsc.tsx` | React Server Component |

Example: `routes/posts/[slug].ssg.tsx` is pre-rendered at build time.

## Special Files

| File | Purpose |
|------|---------|
| `_layout.tsx` | Layout wrapper for child routes |
| `_error.tsx` | Error boundary for child routes |
| `_loading.tsx` | Loading UI for child routes |
| `_middleware.ts` | Middleware for child routes |

---

## Complete Example

```tsx
// routes/posts/[slug].tsx
import { createLoader, createAction, defer } from '@ereo/data'
import type { MetaFunction, HeadersFunction } from '@ereo/core'

// Route configuration
export const config = {
  render: {
    mode: 'ssg',
    prerender: {
      paths: async () => {
        const posts = await db.posts.findPublished()
        return posts.map(p => `/posts/${p.slug}`)
      },
      revalidate: 3600,
      fallback: 'blocking'
    }
  },
  cache: {
    edge: { maxAge: 3600, vary: ['Accept-Language'] },
    data: { tags: (params) => ['posts', `post:${params.slug}`] }
  },
  islands: {
    defaultStrategy: 'visible',
    components: [
      { component: 'CommentForm', strategy: 'load' }
    ]
  },
  middleware: ['analytics']
}

// Parameter validation
export const params = {
  slug: {
    parse: (value) => value.toLowerCase().replace(/[^a-z0-9-]/g, '')
  }
}

// Search param validation
export const searchParams = {
  tab: { default: 'content' }
}

// Data loading
export const loader = createLoader(async ({ params, context }) => {
  const post = await db.posts.findBySlug(params.slug)
  if (!post) throw new Response('Not Found', { status: 404 })

  context.cache.addTags([`author:${post.authorId}`])

  return {
    post,
    comments: defer(db.comments.findByPost(post.id))
  }
})

// Form handling
export const action = createAction(async ({ request, params }) => {
  const formData = await request.formData()
  // Handle comment submission...
})

// Document metadata
export const meta: MetaFunction = ({ data }) => [
  { title: data.post.title },
  { name: 'description', content: data.post.excerpt }
]

// Response headers
export const headers: HeadersFunction = ({ loaderHeaders }) => ({
  'Cache-Control': loaderHeaders.get('Cache-Control') || 'public, max-age=3600'
})

// Route metadata
export const handle = {
  breadcrumb: (data) => data.post.title
}

// Component
export default function PostPage({ loaderData }) {
  return (
    <article>
      <h1>{loaderData.post.title}</h1>
      {/* ... */}
    </article>
  )
}

// Error boundary
export function ErrorBoundary() {
  const error = useRouteError()
  return <ErrorPage error={error} />
}
```

## Related

- [Routing Concepts](/concepts/routing)
- [File Router](/api/router/file-router)
- [Loaders](/api/data/loaders)
- [Actions](/api/data/actions)
- [Caching](/concepts/caching)
