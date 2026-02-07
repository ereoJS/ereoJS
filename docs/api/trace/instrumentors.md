# Instrumentors

Built-in instrumentors for all 11 framework layers. Each instrumentor creates either a **child span** (for timed operations) or an **event** (for lightweight annotations).

## Request (Layer 1)

The request middleware creates the root trace span wrapping the entire request lifecycle. It must be the **first** middleware in your stack.

```ts
import { traceMiddleware } from '@ereo/trace'

server.use(traceMiddleware(tracer, {
  exclude: ['/_ereo/', '/__ereo/', '/favicon.ico'],
  recordHeaders: false,
}))
```

### Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `exclude` | `string[]` | `['/_ereo/', '/__ereo/', '/favicon.ico']` | Path prefixes to skip |
| `recordHeaders` | `boolean` | `false` | Record request headers (skips cookie/authorization) |

### Behavior

- Creates root span: `{method} {pathname}` (layer: `request`)
- Sets attributes: `http.method`, `http.pathname`, `http.search`, `http.status_code`
- Attaches tracer + active span to request context via `setTracer()` / `setActiveSpan()`
- Reads `X-Ereo-Trace-Id` from request headers (client correlation)
- Injects `X-Ereo-Trace-Id` into response headers
- On error: records error, sets `http.status_code = 500`, re-throws

## Routing (Layer 2)

```ts
import { traceRouteMatch, recordRouteMatch } from '@ereo/trace'
```

### traceRouteMatch

Wraps route matching in a child span. Records route pattern, ID, params, and layouts.

```ts
const match = traceRouteMatch(rootSpan, () => {
  return router.match(pathname)
})
```

If the match function returns `null` or an object without a `route` property, records a `404` event.

### recordRouteMatch

Lighter-weight alternative that records a match as an event on the parent span.

```ts
// Matched route
recordRouteMatch(rootSpan, {
  route: { id: 'blog-slug', path: '/blog/[slug]' },
  params: { slug: 'hello' },
})

// No match (404)
recordRouteMatch(rootSpan, null)
```

## Data / Loaders (Layer 3)

```ts
import { traceLoader, recordLoaderMetrics, traceCacheOperation } from '@ereo/trace'
```

### traceLoader

Wraps a single loader in a child span. Handles sync and async functions.

```ts
const users = await traceLoader(rootSpan, 'users', async () => {
  return db.user.findMany()
})
```

Creates span: `loader:{key}` with attribute `loader.key`.

### recordLoaderMetrics

Creates child spans from pipeline execution metrics. Call after `pipeline.execute()`.

```ts
recordLoaderMetrics(rootSpan, [
  { key: 'user', duration: 12.1, cacheHit: false, source: 'db' },
  { key: 'posts', duration: 18.3, cacheHit: true },
  { key: 'comments', duration: 8.0, error: 'timeout' },
])
```

### LoaderTraceInfo

```ts
interface LoaderTraceInfo {
  key: string
  duration: number
  cacheHit?: boolean
  source?: string
  waitingFor?: string[]
  error?: string
}
```

### traceCacheOperation

Records a cache event on the parent span.

```ts
traceCacheOperation(rootSpan, 'get', 'user:123', true)   // cache hit
traceCacheOperation(rootSpan, 'set', 'user:123')          // cache write
traceCacheOperation(rootSpan, 'invalidate', 'user:*')     // cache invalidation
```

Keys longer than 100 characters are truncated.

## Forms (Layer 4)

```ts
import { traceFormSubmit, recordFormValidation } from '@ereo/trace'
```

### traceFormSubmit

Wraps form submission in a child span. Handles sync and async.

```ts
const result = await traceFormSubmit(rootSpan, 'checkout', async () => {
  return processOrder(formData)
}, { fieldCount: 8 })
```

Creates span: `form:{name}` with attributes `form.name` and optional `form.field_count`.

### recordFormValidation

Records validation timing as an event.

```ts
recordFormValidation(rootSpan, 'checkout', {
  errorCount: 2,
  validationMs: 5.3,
  errorSources: ['sync', 'schema'],
})
```

## Signals (Layer 5)

```ts
import { recordSignalUpdate, recordSignalBatch } from '@ereo/trace'
```

### recordSignalUpdate

Records a signal update event on the active span.

```ts
recordSignalUpdate(span, 'count', { subscriberCount: 3, batched: false })
```

### recordSignalBatch

Records a batch of signal updates.

```ts
recordSignalBatch(span, ['count', 'total', 'items'], { subscriberCount: 8 })
```

## RPC (Layer 6)

```ts
import { traceRPCCall, recordRPCValidation } from '@ereo/trace'
```

### traceRPCCall

Wraps an RPC procedure call in a child span.

```ts
const result = await traceRPCCall(rootSpan, 'users.list', 'query', async () => {
  return db.user.findMany()
})
```

Creates span: `rpc:{procedure}` with attributes `rpc.procedure` and `rpc.type`.

### recordRPCValidation

Records input validation timing as an event.

```ts
recordRPCValidation(rootSpan, 'users.create', 1.5, true)
```

## Database (Layer 7)

```ts
import { tracedAdapter, traceQuery } from '@ereo/trace'
```

### tracedAdapter

Wraps a database adapter using a Proxy. Instruments `query`, `execute`, `get`, `all`, and `run` methods with automatic span creation.

```ts
const db = tracedAdapter(rawAdapter, () => getActiveSpan(ctx))

// All query methods are now instrumented
const users = await db.query('SELECT * FROM users WHERE role = ?', ['admin'])
```

Each instrumented call creates span: `db.{method}` with attributes:
- `db.operation` - Method name
- `db.statement` - SQL (first 200 chars)
- `db.param_count` - Number of parameters
- `db.row_count` - Result array length (if applicable)

Non-database methods pass through untouched. If `getSpan()` returns `undefined`, the original method is called without tracing.

### traceQuery

Manual instrumentation for individual queries.

```ts
const posts = await traceQuery(rootSpan, 'select', 'SELECT * FROM posts', async () => {
  return rawAdapter.query('SELECT * FROM posts')
})
```

## Auth (Layer 8)

```ts
import { traceAuthCheck } from '@ereo/trace'
```

### traceAuthCheck

Wraps an auth check in a child span. Records success/failure.

```ts
const session = await traceAuthCheck(rootSpan, 'requireAuth', async () => {
  return verifySession(request)
}, { provider: 'jwt', roles: ['admin'] })
```

Creates span: `auth:{operation}` with attributes:
- `auth.operation` - `'requireAuth'` | `'optionalAuth'` | `'requireRoles'` | `'custom'`
- `auth.provider` - Auth provider name
- `auth.roles` - Required roles (comma-separated)
- `auth.result` - `'ok'` or `'denied'`
- `auth.redirect` - Redirect URL (if error is a Response with Location header)

## Islands / Hydration (Layer 9)

```ts
import { traceHydration, recordHydration } from '@ereo/trace'
```

### traceHydration

Wraps island hydration in a child span.

```ts
await traceHydration(rootSpan, 'Counter', 'idle', async () => {
  await hydrateComponent(Counter, props)
}, { propsSize: 256 })
```

Creates span: `hydrate:{component}` with attributes `island.component`, `island.strategy`, and optional `island.props_size`.

Strategies: `'load'` | `'idle'` | `'visible'` | `'media'` | `'none'`

### recordHydration

Lighter-weight event recording.

```ts
recordHydration(rootSpan, 'Sidebar', 'visible', 25.5)
```

## Build (Layer 10)

```ts
import { traceBuild, traceBuildStage } from '@ereo/trace'
```

### traceBuild

Creates a root trace for the build process.

```ts
const buildSpan = traceBuild(tracer, 'production build')
```

### traceBuildStage

Wraps a build stage in a child span.

```ts
await traceBuildStage(buildSpan, 'route-discovery', async () => {
  return discoverRoutes('./src/routes')
}, { filesCount: 42 })

await traceBuildStage(buildSpan, 'bundle', async () => {
  return bundle({ target: 'browser' })
})

buildSpan.end()
```

## Errors (Layer 11)

```ts
import { traceError, withErrorCapture } from '@ereo/trace'
```

### traceError

Records an error on a span with phase information.

```ts
traceError(span, error, 'loader')
```

Records:
- Calls `span.error(err)` (sets status, error.message, error.name, error.stack)
- Sets `error.phase` attribute
- For Error instances: sets `error.class` and emits an `'error'` event

Phases: `'middleware'` | `'loader'` | `'action'` | `'render'` | `'rpc'` | `'unknown'`

### withErrorCapture

Wraps a function with automatic error capture. Errors are recorded on the span and re-thrown.

```ts
// Sync
const html = withErrorCapture(span, 'render', () => {
  return renderToString(<App />)
})

// Async
const data = await withErrorCapture(span, 'loader', async () => {
  return fetchData()
})
```
