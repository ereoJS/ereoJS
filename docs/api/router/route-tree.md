# Route Tree

Build and manage hierarchical route trees from file paths.

## Import

```ts
import {
  RouteTree,
  createRouteTree,
  buildRouteTree,
  filePathToUrlPath
} from '@ereo/router'
```

## createRouteTree

Factory function to create an empty route tree.

```ts
function createRouteTree(): RouteTree
```

```ts
const tree = createRouteTree()
tree.addRoute('/about', '/about', '/app/routes/about.tsx')
```

## buildRouteTree

Build a route tree from file paths. This is the primary way to create a populated route tree.

```ts
function buildRouteTree(
  files: Array<{ relativePath: string; absolutePath: string }>,
  routesDir: string
): RouteTree
```

```ts
const files = [
  { relativePath: '/index.tsx', absolutePath: '/app/routes/index.tsx' },
  { relativePath: '/about.tsx', absolutePath: '/app/routes/about.tsx' },
  { relativePath: '/posts/[slug].tsx', absolutePath: '/app/routes/posts/[slug].tsx' },
  { relativePath: '/posts/_layout.tsx', absolutePath: '/app/routes/posts/_layout.tsx' }
]

const tree = buildRouteTree(files, '')
const routes = tree.toRoutes()
```

## RouteTree Class

Manages a hierarchical route tree structure.

### Constructor

```ts
const tree = new RouteTree()
```

Creates a new tree with an empty root node.

### Methods

#### addRoute()

Add a route to the tree.

```ts
addRoute(
  id: string,
  path: string,
  file: string,
  options?: { index?: boolean; layout?: boolean }
): RouteNode
```

```ts
// Add a regular route
tree.addRoute('/about', '/about', '/app/routes/about.tsx')

// Add an index route
tree.addRoute('/posts/index', '/posts', '/app/routes/posts/index.tsx', {
  index: true
})

// Add a layout route
tree.addRoute('/posts/_layout', '/posts', '/app/routes/posts/_layout.tsx', {
  layout: true
})
```

#### getRoot()

Get the root node of the tree.

```ts
getRoot(): RouteNode
```

```ts
const root = tree.getRoot()
console.log(root.children.length)
```

#### toRoutes()

Convert tree to a flat Route array suitable for the router.

```ts
toRoutes(): Route[]
```

```ts
const routes = tree.toRoutes()
app.setRoutes(routes)
```

#### findByPath()

Find a node by its URL path.

```ts
findByPath(path: string): RouteNode | null
```

```ts
const node = tree.findByPath('/posts')
if (node) {
  console.log(node.file)  // '/app/routes/posts/index.tsx'
}
```

#### findById()

Find a node by its ID.

```ts
findById(id: string): RouteNode | null
```

```ts
const node = tree.findById('/posts/[slug]')
if (node) {
  console.log(node.path)  // '/posts/[slug]'
}
```

#### removeById()

Remove a route by ID.

```ts
removeById(id: string): boolean
```

```ts
const removed = tree.removeById('/posts/draft')
console.log('Removed:', removed)
```

#### flatten()

Get all routes as a flat array of RouteNodes.

```ts
flatten(): RouteNode[]
```

```ts
const allNodes = tree.flatten()
allNodes.forEach(node => {
  console.log(node.id, node.path, node.layout ? '(layout)' : '')
})
```

#### getLayouts()

Get all layout routes.

```ts
getLayouts(): RouteNode[]
```

```ts
const layouts = tree.getLayouts()
console.log('Layout routes:', layouts.map(l => l.path))
```

#### getLayoutChain()

Get the layout chain for a specific route (from outermost to innermost).

```ts
getLayoutChain(routeId: string): RouteNode[]
```

```ts
// For a route at /blog/posts/[slug]
const chain = tree.getLayoutChain('/blog/posts/[slug]')
// Returns: [rootLayout, blogLayout, postsLayout] (if they exist)

chain.forEach(layout => {
  console.log('Layout:', layout.path)
})
```

## RouteNode Interface

```ts
interface RouteNode {
  /** Route ID (unique identifier) */
  id: string

  /** URL path pattern */
  path: string

  /** Parsed path segments */
  segments: RouteSegment[]

  /** File path */
  file: string

  /** Is this an index route? */
  index: boolean

  /** Is this a layout? */
  layout: boolean

  /** Child routes */
  children: RouteNode[]

  /** Parent route (for layout resolution) */
  parent?: RouteNode

  /** Loaded module */
  module?: RouteModule

  /** Score for sorting (more specific routes first) */
  score: number
}
```

## filePathToUrlPath

Convert a file path to a URL path with metadata.

```ts
function filePathToUrlPath(
  filePath: string,
  routesDir: string
): { path: string; index: boolean; layout: boolean }
```

```ts
filePathToUrlPath('/app/routes/about.tsx', '/app/routes')
// { path: '/about', index: false, layout: false }

filePathToUrlPath('/app/routes/posts/index.tsx', '/app/routes')
// { path: '/posts', index: true, layout: false }

filePathToUrlPath('/app/routes/posts/_layout.tsx', '/app/routes')
// { path: '/posts', index: false, layout: true }

filePathToUrlPath('/app/routes/(marketing)/about.tsx', '/app/routes')
// { path: '/about', index: false, layout: false }
// Route groups are removed from URL
```

## File to URL Mapping

| File Path | URL Path | Type |
|-----------|----------|------|
| `index.tsx` | `/` | index |
| `about.tsx` | `/about` | page |
| `posts/index.tsx` | `/posts` | index |
| `posts/[slug].tsx` | `/posts/[slug]` | dynamic |
| `posts/[...path].tsx` | `/posts/[...path]` | catch-all |
| `posts/[[page]].tsx` | `/posts/[[page]]` | optional |
| `posts/_layout.tsx` | `/posts` | layout |
| `(marketing)/about.tsx` | `/about` | page (group) |

## Special Files

The route tree recognizes these special file names:

```ts
const SPECIAL_FILES = {
  LAYOUT: '_layout',
  ERROR: '_error',
  LOADING: '_loading',
  NOT_FOUND: '_404'
}
```

## Example: Building a Complete Route Tree

```ts
import { buildRouteTree } from '@ereo/router'

// Simulating file discovery
const files = [
  { relativePath: '/index.tsx', absolutePath: '/app/routes/index.tsx' },
  { relativePath: '/_layout.tsx', absolutePath: '/app/routes/_layout.tsx' },
  { relativePath: '/about.tsx', absolutePath: '/app/routes/about.tsx' },
  { relativePath: '/blog/_layout.tsx', absolutePath: '/app/routes/blog/_layout.tsx' },
  { relativePath: '/blog/index.tsx', absolutePath: '/app/routes/blog/index.tsx' },
  { relativePath: '/blog/[slug].tsx', absolutePath: '/app/routes/blog/[slug].tsx' },
  { relativePath: '/docs/[...path].tsx', absolutePath: '/app/routes/docs/[...path].tsx' }
]

const tree = buildRouteTree(files, '')

// Get all routes
const routes = tree.toRoutes()

// Find layouts for a specific route
const layoutChain = tree.getLayoutChain('/blog/[slug]')
// Returns [rootLayout, blogLayout]

// Check if a path exists
const blogIndex = tree.findByPath('/blog')
console.log(blogIndex?.index)  // true
```

## Related

- [File Router](./file-router.md)
- [Route Matching](./matching.md)
- [Routing Concepts](/concepts/routing)
