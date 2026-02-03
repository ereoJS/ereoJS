# @ereo/router-conventions

File-based routing conventions for the EreoJS framework. This package provides automatic route configuration based on file naming patterns.

## Import

```ts
import {
  parseConvention,
  conventionToRouteConfig,
  hasConvention,
  stripConvention,
  applyConventionConfig,
  getConventionPatterns,
  integrateConventions,
  CONVENTION_SUFFIXES
} from '@ereo/router-conventions'
```

## Overview

The `@ereo/router-conventions` package enables convention-based routing configuration. Instead of manually configuring each route's render mode, you can use file naming conventions to automatically determine how routes should be rendered.

## File Naming Conventions

### Render Mode Suffixes

| Suffix | Render Mode | Description |
|--------|-------------|-------------|
| `.ssg.tsx` | SSG | Static Site Generation (pre-rendered at build) |
| `.server.tsx` | SSR | Server-side only (no client JavaScript) |
| `.client.tsx` | CSR | Client-side rendering only |
| `.api.tsx` | API | API endpoint (JSON response) |
| `.rsc.tsx` | RSC | React Server Component |

### Examples

```
src/routes/
  index.tsx           # Default SSR
  about.ssg.tsx       # Static generation
  dashboard.client.tsx # Client-only rendering
  api/
    users.api.tsx     # JSON API endpoint
  blog/
    [slug].ssg.tsx    # Dynamic SSG with params
    preview.server.tsx # Server-only, no JS bundle
```

## Directory Structure Patterns

### Standard Routes

```
src/routes/
  index.tsx              # /
  about.tsx              # /about
  contact.tsx            # /contact
```

### Nested Routes

```
src/routes/
  blog/
    index.tsx            # /blog
    [slug].tsx           # /blog/:slug
    categories/
      index.tsx          # /blog/categories
      [category].tsx     # /blog/categories/:category
```

### Dynamic Routes

```
src/routes/
  posts/
    [id].tsx             # /posts/:id (single param)
    [id]/
      comments.tsx       # /posts/:id/comments
  docs/
    [...slug].tsx        # /docs/* (catch-all)
```

### Route Groups

Route groups allow you to organize routes without affecting the URL structure:

```
src/routes/
  (marketing)/
    index.tsx            # /
    about.tsx            # /about
    pricing.tsx          # /pricing
  (dashboard)/
    dashboard.tsx        # /dashboard
    settings.tsx         # /settings
```

## Special File Types

### Layout Files

Layout files wrap child routes with shared UI:

```
src/routes/
  _layout.tsx            # Root layout
  dashboard/
    _layout.tsx          # Dashboard-specific layout
    index.tsx            # Wrapped by dashboard layout
    settings.tsx         # Also wrapped by dashboard layout
```

```tsx
// src/routes/dashboard/_layout.tsx
export default function DashboardLayout({ children }) {
  return (
    <div className="dashboard">
      <Sidebar />
      <main>{children}</main>
    </div>
  )
}
```

### Error Boundaries

Error files catch and display errors for their route segment:

```
src/routes/
  _error.tsx             # Global error boundary
  dashboard/
    _error.tsx           # Dashboard-specific errors
```

### Loading States

Loading files show during route transitions:

```
src/routes/
  _loading.tsx           # Global loading
  dashboard/
    _loading.tsx         # Dashboard loading state
```

### Middleware Files

Middleware files run before route handlers:

```
src/routes/
  _middleware.ts         # Global middleware
  api/
    _middleware.ts       # API-specific middleware
```

### Island Components

Components in `_islands` directories are automatically extracted as interactive islands:

```
src/routes/
  _islands/
    Counter.tsx          # Auto-extracted island
    SearchBar.tsx        # Auto-extracted island
  blog/
    _islands/
      CommentForm.tsx    # Blog-specific island
```

## API Reference

### parseConvention

Parses a filename to extract convention information.

#### Signature

```ts
function parseConvention(filename: string): ConventionInfo
```

#### Returns

```ts
interface ConventionInfo {
  basePath: string       // Path without convention suffix
  renderMode?: RenderMode // Detected render mode
  isApi: boolean         // Whether this is an API route
  isIsland: boolean      // Whether this is an island component
  isLayout: boolean      // Whether this is a layout file
  filename: string       // Original filename
  extension: string      // File extension
}
```

#### Example

```ts
import { parseConvention } from '@ereo/router-conventions'

const info = parseConvention('blog/[slug].ssg.tsx')
// {
//   basePath: 'blog/[slug]',
//   renderMode: 'ssg',
//   isApi: false,
//   isIsland: false,
//   isLayout: false,
//   filename: 'blog/[slug].ssg.tsx',
//   extension: '.tsx'
// }
```

### conventionToRouteConfig

Generates route configuration from convention info.

#### Signature

```ts
function conventionToRouteConfig(info: ConventionInfo): Partial<RouteConfig>
```

#### Example

```ts
import { parseConvention, conventionToRouteConfig } from '@ereo/router-conventions'

const info = parseConvention('posts/[id].ssg.tsx')
const config = conventionToRouteConfig(info)
// {
//   render: {
//     mode: 'ssg',
//     streaming: { enabled: false },
//     prerender: { enabled: true, fallback: 'blocking' }
//   }
// }
```

### hasConvention

Checks if a filename uses any convention pattern.

#### Signature

```ts
function hasConvention(filename: string): boolean
```

#### Example

```ts
import { hasConvention } from '@ereo/router-conventions'

hasConvention('page.ssg.tsx')  // true
hasConvention('page.tsx')      // false
hasConvention('_islands/Button.tsx') // true
```

### stripConvention

Removes convention suffix from a route path.

#### Signature

```ts
function stripConvention(routePath: string): string
```

#### Example

```ts
import { stripConvention } from '@ereo/router-conventions'

stripConvention('blog/[slug].ssg')  // 'blog/[slug]'
stripConvention('api/users.api')    // 'api/users'
```

### applyConventionConfig

Merges convention-based config with explicit config exports.

#### Signature

```ts
function applyConventionConfig(
  routePath: string,
  explicitConfig?: Partial<RouteConfig>
): Partial<RouteConfig>
```

#### Example

```ts
import { applyConventionConfig } from '@ereo/router-conventions'

// Convention provides defaults, explicit config overrides
const config = applyConventionConfig('posts/[id].ssg.tsx', {
  render: { prerender: { paths: ['/posts/1', '/posts/2'] } }
})
```

### getConventionPatterns

Returns all supported convention patterns (useful for documentation).

#### Signature

```ts
function getConventionPatterns(): string[]
```

#### Example

```ts
import { getConventionPatterns } from '@ereo/router-conventions'

const patterns = getConventionPatterns()
// [
//   '*.ssg.tsx - Static Site Generation (pre-rendered at build)',
//   '*.server.tsx - Server-side only (no client JavaScript)',
//   '*.client.tsx - Client-side rendering only',
//   '*.api.tsx - API endpoint (JSON response)',
//   '*.rsc.tsx - React Server Component',
//   '_islands/*.tsx - Auto-extracted island components',
//   '_layout.tsx - Nested layout wrapper'
// ]
```

### integrateConventions

Integrates conventions with discovered routes from the file router.

#### Signature

```ts
function integrateConventions(
  routes: Route[],
  options?: ConventionIntegrationOptions
): Route[]
```

#### Options

```ts
interface ConventionIntegrationOptions {
  enabled?: boolean              // Enable convention parsing (default: true)
  customSuffixes?: Record<string, string> // Custom convention suffixes
  islandDirs?: string[]          // Directories to scan for islands
}
```

#### Example

```ts
import { createFileRouter } from '@ereo/router'
import { integrateConventions } from '@ereo/router-conventions'

const router = await createFileRouter()
const routes = router.getRoutes()

// Apply conventions to all routes
const configuredRoutes = integrateConventions(routes, {
  enabled: true,
  islandDirs: ['_islands', 'components/_islands']
})
```

## Parallel Routes

Parallel routes allow multiple pages to be rendered simultaneously in the same layout:

```
src/routes/
  dashboard/
    _layout.tsx
    @analytics/
      page.tsx           # Rendered in analytics slot
    @notifications/
      page.tsx           # Rendered in notifications slot
    page.tsx             # Main content
```

```tsx
// src/routes/dashboard/_layout.tsx
export default function DashboardLayout({
  children,
  analytics,
  notifications
}) {
  return (
    <div className="dashboard">
      <main>{children}</main>
      <aside className="sidebar">
        {analytics}
        {notifications}
      </aside>
    </div>
  )
}
```

## Route Configuration Override

Explicit configuration in route files takes precedence over conventions:

```tsx
// src/routes/posts/[id].ssg.tsx

// Convention says SSG, but explicit config can override
export const config = {
  render: {
    mode: 'ssg',
    prerender: {
      paths: async () => {
        const posts = await getPosts()
        return posts.map(p => `/posts/${p.id}`)
      }
    }
  }
}

export async function loader({ params }) {
  return { post: await getPost(params.id) }
}

export default function PostPage({ data }) {
  return <article>{data.post.content}</article>
}
```

## CONVENTION_SUFFIXES

The mapping of file suffixes to render modes:

```ts
const CONVENTION_SUFFIXES = {
  '.ssg': 'ssg',
  '.server': 'ssr',
  '.client': 'csr',
  '.api': 'api',
  '.rsc': 'rsc',
}
```

## Related

- [FileRouter](/api/router/file-router)
- [Route Configuration](/api/router/route-config)
- [Route Matching](/api/router/matching)
- [Middleware](/api/router/middleware)
