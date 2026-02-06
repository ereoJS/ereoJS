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

Creates a file router instance without initializing it.

### Signature

```ts
function createFileRouter(options?: RouterOptions): FileRouter
```

### Options

```ts
interface RouterOptions {
  // Directory containing route files
  routesDir?: string  // default: 'app/routes'

  // File extensions to consider as routes
  extensions?: string[]  // default: ['.tsx', '.ts', '.jsx', '.js']

  // Base path for all routes
  basePath?: string  // default: ''

  // Whether to watch for file changes (dev mode)
  watch?: boolean  // default: false
}
```

### Example

```ts
import { createFileRouter } from '@ereo/router'

const router = createFileRouter({
  routesDir: 'app/routes',
  extensions: ['.tsx', '.ts'],
  basePath: '/app',
  watch: process.env.NODE_ENV === 'development'
})
```

## initFileRouter

Creates and initializes a file router with automatic route discovery.

### Signature

```ts
async function initFileRouter(options?: RouterOptions): Promise<FileRouter>
```

### Example

```ts
const router = await initFileRouter({
  routesDir: 'app/routes',
  watch: true
})

// Routes are discovered and ready
const routes = router.getRoutes()
```

## FileRouter Class

### Constructor

```ts
const router = new FileRouter(options?: RouterOptions)
```

### Methods

#### init()

Initialize the router by discovering routes. Starts file watching if `watch` option is enabled.

```ts
async init(): Promise<void>
```

```ts
const router = new FileRouter({ routesDir: 'app/routes' })
await router.init()
```

#### discoverRoutes()

Discover all routes from the filesystem. Can be called to manually refresh routes.

```ts
async discoverRoutes(): Promise<Route[]>
```

```ts
const routes = await router.discoverRoutes()
console.log(`Found ${routes.length} routes`)
```

#### getRoutes()

Returns all discovered routes.

```ts
getRoutes(): Route[]
```

```ts
const routes = router.getRoutes()
routes.forEach(route => {
  console.log(route.path, route.file)
})
```

#### getTree()

Returns the route tree structure.

```ts
getTree(): RouteTree | null
```

```ts
const tree = router.getTree()
const layouts = tree?.getLayouts()
```

#### getMatcher()

Returns the route matcher for URL matching.

```ts
getMatcher(): RouteMatcher | null
```

```ts
const matcher = router.getMatcher()
const match = matcher?.match('/posts/123')
```

#### match()

Match a URL pathname to a route.

```ts
match(pathname: string): RouteMatch | null
```

```ts
const match = router.match('/posts/123')
if (match) {
  console.log(match.route.path)  // '/posts/[id]'
  console.log(match.params)      // { id: '123' }
}
```

#### on()

Register an event handler for router events.

```ts
on<K extends keyof RouterEvents>(event: K, handler: RouterEvents[K]): void
```

```ts
router.on('reload', (routes) => {
  console.log('Routes reloaded:', routes.length)
})

router.on('change', (route) => {
  console.log('Route changed:', route.path)
})

router.on('remove', (routeId) => {
  console.log('Route removed:', routeId)
})

router.on('add', (route) => {
  console.log('Route added:', route.path)
})
```

#### stopWatching()

Stop watching for file changes.

```ts
stopWatching(): void
```

```ts
// Stop watching when shutting down
process.on('SIGTERM', () => {
  router.stopWatching()
})
```

#### loadModule()

Load a route module and parse its configuration.

```ts
async loadModule(route: Route): Promise<void>
```

```ts
const routes = router.getRoutes()
for (const route of routes) {
  await router.loadModule(route)
  console.log(route.module)  // The loaded module
  console.log(route.config)  // Parsed route config
}
```

#### getRouteConfig()

Get route configuration, loading the module if needed.

```ts
async getRouteConfig(route: Route): Promise<RouteConfig | undefined>
```

```ts
const match = router.match('/admin/dashboard')
if (match) {
  const config = await router.getRouteConfig(match.route)
  console.log(config?.auth?.required)  // true
}
```

#### getRoutesWithConfig()

Get all routes with their configurations loaded.

```ts
async getRoutesWithConfig(): Promise<Route[]>
```

```ts
const routes = await router.getRoutesWithConfig()
routes.forEach(route => {
  console.log(route.path, route.config?.render?.mode)
})
```

#### findRoutesByRenderMode()

Find routes by their render mode (ssg, ssr, csr, json, xml).

```ts
async findRoutesByRenderMode(
  mode: 'ssg' | 'ssr' | 'csr' | 'json' | 'xml'
): Promise<Route[]>
```

```ts
// Find all static routes for pre-rendering
const staticRoutes = await router.findRoutesByRenderMode('ssg')
console.log('Static routes:', staticRoutes.map(r => r.path))
```

#### findProtectedRoutes()

Find routes that require authentication.

```ts
async findProtectedRoutes(): Promise<Route[]>
```

```ts
const protectedRoutes = await router.findProtectedRoutes()
console.log('Protected routes:', protectedRoutes.map(r => r.path))
```

#### getPrerenderPaths()

Get all prerender paths from routes with SSG config.

```ts
async getPrerenderPaths(): Promise<string[]>
```

```ts
const paths = await router.getPrerenderPaths()
// Returns: ['/about', '/posts/1', '/posts/2', ...]
```

#### loadAllModules()

Load all route modules recursively.

```ts
async loadAllModules(): Promise<void>
```

```ts
// Useful for build-time analysis
await router.loadAllModules()
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
| `_404.tsx` | Not found page |

## Router Events

```ts
interface RouterEvents {
  add: (route: Route) => void
  remove: (routeId: string) => void
  change: (route: Route) => void
  reload: (routes: Route[]) => void
}
```

## Integration with App

```ts
import { createApp } from '@ereo/core'
import { initFileRouter } from '@ereo/router'
import { createServer } from '@ereo/server'

const app = createApp()
const router = await initFileRouter({
  routesDir: 'app/routes',
  watch: process.env.NODE_ENV === 'development'
})

app.setRoutes(router.getRoutes())
app.setRouteMatcher((pathname) => router.match(pathname))

const server = createServer(app)
server.listen(3000)
```

## Related

- [Routing Concepts](/concepts/routing)
- [Route Matching](/api/router/matching)
- [Route Tree](/api/router/route-tree)
- [Middleware](/api/router/middleware)
