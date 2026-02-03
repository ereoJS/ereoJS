# FileRouter

The file-based router that maps your directory structure to URL routes.

## Import

```ts
import {
  FileRouter,
  createFileRouter,
  initFileRouter
} from '@ereo/router'
```

## createFileRouter

Creates and initializes a file router.

### Signature

```ts
function createFileRouter(options?: RouterOptions): FileRouter
```

### Options

```ts
interface RouterOptions {
  // Directory containing route files
  routesDir?: string  // default: './src/routes'

  // File extensions to consider as routes
  extensions?: string[]  // default: ['.tsx', '.ts', '.jsx', '.js']

  // Base path for all routes
  basePath?: string  // default: ''
}
```

### Example

```ts
import { createFileRouter } from '@ereo/router'

const router = createFileRouter({
  routesDir: './src/routes',
  extensions: ['.tsx', '.ts'],
  basePath: '/app'
})
```

## initFileRouter

Async initialization with automatic route discovery.

### Signature

```ts
async function initFileRouter(options?: RouterOptions): Promise<FileRouter>
```

### Example

```ts
const router = await initFileRouter({
  routesDir: './src/routes'
})

// Routes are discovered and ready
const routes = router.getRoutes()
```

## FileRouter Class

### Methods

| Method | Description |
|--------|-------------|
| `getRoutes()` | Returns all discovered routes |
| `getRoute(path)` | Gets a route by path |
| `match(pathname)` | Matches a pathname to a route |
| `addRoute(route)` | Adds a route manually |
| `removeRoute(path)` | Removes a route |
| `refresh()` | Re-scans for route files |

### Example

```ts
const router = await initFileRouter()

// Get all routes
const routes = router.getRoutes()

// Match a URL
const match = router.match('/posts/123')
if (match) {
  console.log(match.route.path)  // '/posts/[id]'
  console.log(match.params)      // { id: '123' }
}

// Add a route programmatically
router.addRoute({
  path: '/custom',
  component: CustomComponent,
  loader: customLoader
})
```

## Route Discovery

The router discovers routes based on file structure:

| File | URL |
|------|-----|
| `index.tsx` | `/` |
| `about.tsx` | `/about` |
| `posts/index.tsx` | `/posts` |
| `posts/[id].tsx` | `/posts/:id` |
| `posts/[...slug].tsx` | `/posts/*` |
| `(group)/page.tsx` | `/page` |

## Special Files

| File | Purpose |
|------|---------|
| `_layout.tsx` | Layout wrapper |
| `_error.tsx` | Error boundary |
| `_loading.tsx` | Loading state |
| `_middleware.ts` | Route middleware |

## Integration with App

```ts
import { createApp } from '@ereo/core'
import { createFileRouter } from '@ereo/router'
import { createServer } from '@ereo/server'

const app = createApp()
const router = await initFileRouter()

app.setRoutes(router.getRoutes())
app.setRouteMatcher((pathname) => router.match(pathname))

const server = createServer(app)
server.listen(3000)
```

## Related

- [Routing Concepts](/core-concepts/routing)
- [Route Matching](/api/router/matching)
- [Middleware](/api/router/middleware)
