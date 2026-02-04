# Route Matching

How EreoJS matches URLs to route handlers.

## Import

```ts
import {
  // Factory and class
  createMatcher,
  RouteMatcher,

  // Matching functions
  matchRoute,
  matchWithLayouts,

  // Utilities
  parsePathSegments,
  calculateRouteScore,
  patternToRegex
} from '@ereo/router'
```

## createMatcher

Factory function to create a route matcher from routes.

```ts
function createMatcher(routes: Route[]): RouteMatcher
```

```ts
const routes = await router.getRoutes()
const matcher = createMatcher(routes)

const match = matcher.match('/posts/123')
```

## RouteMatcher Class

Pre-compiles routes for efficient matching.

### Constructor

```ts
const matcher = new RouteMatcher(routes)
```

### Methods

#### match()

Match a URL pathname against compiled routes. Returns the first matching route.

```ts
match(pathname: string): RouteMatch | null
```

```ts
const match = matcher.match('/posts/hello-world')

if (match) {
  console.log(match.route)    // Route object
  console.log(match.params)   // { slug: 'hello-world' }
  console.log(match.pathname) // '/posts/hello-world'
}
```

#### getRoutes()

Get all routes in the matcher.

```ts
getRoutes(): Route[]
```

```ts
const allRoutes = matcher.getRoutes()
console.log(`Matcher has ${allRoutes.length} routes`)
```

#### addRoute()

Add a route dynamically. Maintains sorted order by score.

```ts
addRoute(route: Route): void
```

```ts
matcher.addRoute({
  id: '/api/custom',
  path: '/api/custom',
  file: '/path/to/handler.ts'
})
```

#### removeRoute()

Remove a route by ID.

```ts
removeRoute(routeId: string): boolean
```

```ts
const removed = matcher.removeRoute('/api/custom')
console.log('Removed:', removed)  // true if found and removed
```

## matchRoute

Match a URL path against a single route with pre-parsed segments.

```ts
function matchRoute(
  pathname: string,
  route: Route,
  segments: RouteSegment[]
): RouteMatch | null
```

```ts
const segments = parsePathSegments('/posts/[slug]')
const match = matchRoute('/posts/hello-world', route, segments)
```

## matchWithLayouts

Match with layout resolution. Returns all matching layouts from root to the matched route.

```ts
function matchWithLayouts(
  pathname: string,
  routes: Route[]
): MatchResult | null
```

```ts
interface MatchResult {
  route: Route
  params: RouteParams
  pathname: string
  layouts: Route[]  // From outermost to innermost
}
```

```ts
const result = matchWithLayouts('/blog/posts/hello', routes)

if (result) {
  console.log(result.route)    // The matched route
  console.log(result.params)   // { slug: 'hello' }
  console.log(result.layouts)  // [rootLayout, blogLayout]
}
```

## Utility Functions

### parsePathSegments

Parse a path pattern into segments for analysis.

```ts
function parsePathSegments(path: string): RouteSegment[]
```

```ts
interface RouteSegment {
  raw: string
  type: 'static' | 'dynamic' | 'catchAll' | 'optional'
  paramName?: string
}
```

```ts
const segments = parsePathSegments('/posts/[slug]/comments')
// [
//   { raw: 'posts', type: 'static' },
//   { raw: '[slug]', type: 'dynamic', paramName: 'slug' },
//   { raw: 'comments', type: 'static' }
// ]

const catchAll = parsePathSegments('/docs/[...path]')
// [
//   { raw: 'docs', type: 'static' },
//   { raw: '[...path]', type: 'catchAll', paramName: 'path' }
// ]

const optional = parsePathSegments('/posts/[[page]]')
// [
//   { raw: 'posts', type: 'static' },
//   { raw: '[[page]]', type: 'optional', paramName: 'page' }
// ]
```

### calculateRouteScore

Calculate route score for sorting. Higher scores are matched first (more specific routes).

```ts
function calculateRouteScore(segments: RouteSegment[]): number
```

```ts
const staticScore = calculateRouteScore(parsePathSegments('/about'))
const dynamicScore = calculateRouteScore(parsePathSegments('/posts/[id]'))
const catchAllScore = calculateRouteScore(parsePathSegments('/docs/[...path]'))

// staticScore > dynamicScore > catchAllScore
```

Route scores by segment type:
- Static: 100 points
- Dynamic: 50 points
- Optional: 30 points
- Catch-all: 10 points

Earlier segments have more weight (multiplier decreases with position).

### patternToRegex

Convert route pattern segments to a regular expression.

```ts
function patternToRegex(segments: RouteSegment[]): RegExp
```

```ts
const segments = parsePathSegments('/posts/[slug]')
const regex = patternToRegex(segments)

regex.test('/posts/hello')  // true
regex.test('/posts/')       // false
regex.test('/posts/a/b')    // false
```

## Matching Order

Routes are matched in this order:

1. **Static routes** - Exact path matches
2. **Dynamic routes** - Single parameter segments
3. **Optional routes** - Optional parameter segments
4. **Catch-all routes** - Rest parameters

```
/posts              -> routes/posts/index.tsx (static)
/posts/hello-world  -> routes/posts/[slug].tsx (dynamic)
/docs/a/b/c         -> routes/docs/[...path].tsx (catch-all)
```

## Pattern Types

### Static Segments

```
routes/about.tsx        -> /about
routes/blog/index.tsx   -> /blog
routes/api/health.tsx   -> /api/health
```

### Dynamic Segments

Single parameter in brackets:

```
routes/users/[id].tsx           -> /users/123
routes/posts/[slug].tsx         -> /posts/hello-world
routes/[category]/[product].tsx -> /electronics/laptop
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
routes/posts/[[page]].tsx -> /posts or /posts/2
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
routes/docs/[...path].tsx -> /docs/getting-started
                          -> /docs/api/core/create-app
                          -> /docs/a/b/c/d
```

```ts
export const loader = createLoader(async ({ params }) => {
  const { path } = params  // ['getting-started'] or ['api', 'core', 'create-app']
  return { doc: await loadDoc(path) }
})
```

## Route Groups

Parentheses create route groups without affecting the URL:

```
routes/
  (marketing)/
    about.tsx       -> /about
    pricing.tsx     -> /pricing
  (app)/
    dashboard.tsx   -> /dashboard
    settings.tsx    -> /settings
```

Groups are useful for:
- Organizing related routes
- Applying different layouts to groups

## Route Specificity

When multiple routes could match, the most specific wins:

```
/posts/new      -> routes/posts/new.tsx (static wins)
/posts/hello    -> routes/posts/[slug].tsx (dynamic)
```

Specificity rules:
1. More static segments = higher priority
2. Dynamic segments beat catch-all
3. Earlier position has more weight

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

## Related

- [File Router](./file-router.md)
- [Route Tree](./route-tree.md)
- [Validators](./validators.md)
- [Routing Concepts](/core-concepts/routing)
