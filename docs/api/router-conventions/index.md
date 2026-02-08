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
  generateRouteId,
  isApiRoute,
  isIslandComponent,
  getEffectiveRenderMode,
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
app/routes/
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
app/routes/
  index.tsx              # /
  about.tsx              # /about
  contact.tsx            # /contact
```

### Nested Routes

```
app/routes/
  blog/
    index.tsx            # /blog
    [slug].tsx           # /blog/:slug
    categories/
      index.tsx          # /blog/categories
      [category].tsx     # /blog/categories/:category
```

### Dynamic Routes

```
app/routes/
  posts/
    [id].tsx             # /posts/:id (single param)
    [id]/
      comments.tsx       # /posts/:id/comments
  docs/
    [...slug].tsx        # /docs/* (catch-all)
```

## Special File Types

### Layout Files

Layout files wrap child routes with shared UI:

```
app/routes/
  _layout.tsx            # Root layout
  dashboard/
    _layout.tsx          # Dashboard-specific layout
    index.tsx            # Wrapped by dashboard layout
    settings.tsx         # Also wrapped by dashboard layout
```

```tsx
// app/routes/dashboard/_layout.tsx
export default function DashboardLayout({ children }) {
  return (
    <div className="dashboard">
      <Sidebar />
      <main>{children}</main>
    </div>
  )
}
```

### Island Components

Components in `_islands` directories are automatically extracted as interactive islands:

```
app/routes/
  _islands/
    Counter.tsx          # Auto-extracted island
    SearchBar.tsx        # Auto-extracted island
  blog/
    _islands/
      CommentForm.tsx    # Blog-specific island
```

## Features Handled by @ereo/router

The following file patterns and conventions are NOT handled by `@ereo/router-conventions`. They are implemented in `@ereo/router`:

- **Error Boundaries** (`_error.tsx`) - Error files that catch and display errors for their route segment
- **Loading States** (`_loading.tsx`) - Loading files shown during route transitions
- **Middleware Files** (`_middleware.ts`) - Middleware files that run before route handlers
- **Route Groups** (`(marketing)/`) - Organizational folders that don't affect URL structure
- **Parallel Routes** (`@analytics/`) - Multiple pages rendered simultaneously in the same layout

See the [@ereo/router documentation](/api/router/file-router) for details on these features.

## Convention Detection Rules

### Suffix Matching Behavior

Convention suffixes are matched against the filename (without extension) at the end of the name:

- **First match wins**: The parser iterates through suffixes and uses the first match. Suffix stacking (e.g., `.ssg.server.tsx`) is not supported.
- **Case sensitive**: Suffixes must be lowercase. `.SSG.tsx` or `.Ssg.tsx` will NOT be recognized.
- **Extension agnostic**: Conventions work with `.tsx`, `.ts`, `.jsx`, and `.js` files.

### Island Detection

A file is detected as an island component if:
- The path contains `/_islands/` (e.g., `blog/_islands/Counter.tsx`)
- The path starts with `_islands/` (e.g., `_islands/Counter.tsx`)

### Layout Detection

A file is detected as a layout if the filename (without extension):
- Ends with `/_layout` (e.g., `dashboard/_layout`)
- Equals `_layout` (e.g., `_layout`)

## Edge Cases

### Multiple Dots in Filename

Files with multiple dots are handled correctly. The convention suffix is identified by checking if the filename (minus the final extension) ends with a known suffix:

```
my.component.name.ssg.tsx  -> renderMode: 'ssg', basePath: 'my.component.name'
some.api.service.api.tsx   -> isApi: true, basePath: 'some.api.service'
```

### Files Without Extensions

Files without extensions are parsed without error. The entire filename is treated as the name to check for convention suffixes.

### Streaming Auto-Enabled for Server Routes

When using `.server.tsx` convention, streaming is automatically enabled:

```ts
// page.server.tsx generates:
{
  render: {
    mode: 'ssr',
    streaming: { enabled: true }
  },
  islands: { disabled: true, defaultStrategy: 'none' }
}
```

### Islands Disabled for Server-Only Routes

Routes using `.server.tsx` convention automatically have islands disabled since server-only routes don't include client JavaScript.

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

Applies convention-based configuration to a route. Explicit config **replaces** convention config at the top level for `render`, `islands`, and `cache` properties (no deep merging).

#### Signature

```ts
function applyConventionConfig(
  routePath: string,
  explicitConfig?: Partial<RouteConfig>
): Partial<RouteConfig>
```

#### Merge Behavior

**Important**: This function performs **top-level replacement**, NOT deep merging:

```ts
// If convention provides:
{ render: { mode: 'ssg', streaming: { enabled: false } } }

// And explicit config provides:
{ render: { prerender: { paths: ['/a', '/b'] } } }

// Result is (explicit REPLACES convention for 'render'):
{ render: { prerender: { paths: ['/a', '/b'] } } }
// Note: mode and streaming are LOST because the entire render object was replaced
```

The replacement logic:
```ts
render: explicitConfig?.render ?? conventionConfig.render,
islands: explicitConfig?.islands ?? conventionConfig.islands,
cache: explicitConfig?.cache ?? conventionConfig.cache,
```

If you need to preserve convention defaults while adding explicit config, you must include all properties in your explicit config.

#### Example

```ts
import { applyConventionConfig } from '@ereo/router-conventions'

// Explicit config completely replaces convention config for 'render'
const config = applyConventionConfig('posts/[id].ssg.tsx', {
  render: {
    mode: 'ssg',  // Must re-specify if you want to keep it
    prerender: {
      enabled: true,
      paths: ['/posts/1', '/posts/2']
    }
  }
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

#### customSuffixes Example

Add custom convention suffixes for your project:

```ts
const configuredRoutes = integrateConventions(routes, {
  customSuffixes: {
    '.static': 'ssg',      // .static.tsx treated as SSG
    '.dynamic': 'ssr',     // .dynamic.tsx treated as SSR
    '.edge': 'edge',       // .edge.tsx for edge runtime
  }
})
```

#### islandDirs Example

Specify multiple directories to scan for island components:

```ts
const configuredRoutes = integrateConventions(routes, {
  islandDirs: [
    '_islands',                    // Default location
    'components/_islands',         // Shared components
    'features/dashboard/_islands', // Feature-specific islands
  ]
})
```

### generateRouteId

Strips convention suffixes from file paths to generate clean route IDs.

#### Signature

```ts
function generateRouteId(filePath: string): string
```

#### Example

```ts
import { generateRouteId } from '@ereo/router-conventions'

generateRouteId('blog/[slug].ssg.tsx')  // 'blog/[slug]'
generateRouteId('api/users.api.tsx')    // 'api/users'
generateRouteId('page.tsx')             // 'page'
```

### isApiRoute

Checks if a file path represents an API route.

#### Signature

```ts
function isApiRoute(filePath: string): boolean
```

#### Example

```ts
import { isApiRoute } from '@ereo/router-conventions'

isApiRoute('api/users.api.tsx')  // true
isApiRoute('api/users.tsx')      // false
isApiRoute('page.ssg.tsx')       // false
```

### isIslandComponent

Checks if a file path is an island component.

#### Signature

```ts
function isIslandComponent(filePath: string): boolean
```

#### Example

```ts
import { isIslandComponent } from '@ereo/router-conventions'

isIslandComponent('_islands/Counter.tsx')       // true
isIslandComponent('blog/_islands/Comments.tsx') // true
isIslandComponent('components/Button.tsx')      // false
```

### getEffectiveRenderMode

Determines the effective render mode for a route. Priority: explicit mode > convention > default ('ssr').

#### Signature

```ts
function getEffectiveRenderMode(
  filePath: string,
  explicitMode?: string
): string
```

#### Example

```ts
import { getEffectiveRenderMode } from '@ereo/router-conventions'

// Convention-based
getEffectiveRenderMode('page.ssg.tsx')         // 'ssg'
getEffectiveRenderMode('api/users.api.tsx')    // 'json'

// Explicit mode takes priority
getEffectiveRenderMode('page.tsx', 'ssg')      // 'ssg'
getEffectiveRenderMode('page.ssg.tsx', 'csr')  // 'csr' (explicit overrides)

// Default fallback
getEffectiveRenderMode('page.tsx')             // 'ssr'
```

## Route Configuration Override

Explicit configuration in route files takes precedence over conventions:

```tsx
// app/routes/posts/[id].ssg.tsx

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
