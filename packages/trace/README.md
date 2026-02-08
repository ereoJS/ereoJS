# @ereo/trace

Full-stack developer observability for the EreoJS framework. Traces requests across all 11 framework layers with zero-config instrumentation, a CLI reporter, standalone viewer, and client-side span correlation.

## Installation

```bash
bun add @ereo/trace
```

## Quick Start

```typescript
import { createTracer, traceMiddleware, createCLIReporter } from '@ereo/trace';

// 1. Create a tracer
const tracer = createTracer();

// 2. Add trace middleware (must be first)
server.use(traceMiddleware(tracer));

// 3. See traces in your terminal
createCLIReporter(tracer);
```

Terminal output:

```
  GET    /api/users  200  45.2ms
  |-- routing          1.2ms   matched /api/users
  |-- auth             3.1ms   jwt -> ok
  |-- data             38.4ms
  |   |-- user         12.1ms  db
  |   `-- posts        18.3ms  db
  `-- render           2.5ms
```

## Key Features

- **11 Framework Layers** - Request, routing, data, forms, signals, RPC, database, auth, islands, build, errors
- **Zero-Config Middleware** - Single middleware instruments the full request lifecycle
- **CLI Reporter** - Color-coded tree output with duration highlighting
- **Standalone Viewer** - Self-contained HTML waterfall chart at `/__ereo/traces`
- **Client Correlation** - Browser spans merge into server traces via WebSocket
- **Production No-Op** - 592B tree-shakeable import drops all tracing code
- **Live Streaming** - Real-time trace events via WebSocket to DevTools and CLI

## Concepts

A **trace** represents one complete operation (usually an HTTP request). Each trace contains **spans** — timed segments of work organized by **layer** (routing, data, auth, etc.). Spans form a tree: the root span wraps the request, child spans represent sub-operations.

```
Trace: GET /api/users
├── Span: request        (root)
│   ├── Span: routing    (child)
│   ├── Span: auth       (child)
│   └── Span: data       (child)
│       ├── Span: db.query  (grandchild)
│       └── Span: db.query  (grandchild)
```

## Trace Middleware

The request middleware creates the root trace span and propagates context to all downstream instrumentors. It must be the **first** middleware in your stack.

```typescript
import { traceMiddleware } from '@ereo/trace';

server.use(traceMiddleware(tracer, {
  // Paths to skip (defaults shown)
  exclude: ['/_ereo/', '/__ereo/', '/favicon.ico'],
  // Record request headers (default: false)
  recordHeaders: false,
}));
```

The middleware:
- Creates a root span with method, pathname, and status code
- Attaches the tracer and active span to request context
- Reads/writes `X-Ereo-Trace-Id` headers for client correlation
- Records errors and sets status to 500 on uncaught exceptions

## Instrumentors

Every instrumentor takes a parent span and creates either a child span (for timed operations) or an event (for lightweight annotations).

### Routing (Layer 2)

```typescript
import { traceRouteMatch, recordRouteMatch } from '@ereo/trace';

// Option A: Wrap route matching (creates child span)
const match = traceRouteMatch(rootSpan, () => {
  return router.match(pathname);
});

// Option B: Record match as event on existing span (lighter)
recordRouteMatch(rootSpan, match);
```

### Data / Loaders (Layer 3)

```typescript
import { traceLoader, recordLoaderMetrics, traceCacheOperation } from '@ereo/trace';

// Trace a single loader
const users = await traceLoader(rootSpan, 'users', async () => {
  return db.user.findMany();
});

// Record metrics from pipeline execution
recordLoaderMetrics(rootSpan, [
  { key: 'user', duration: 12.1, cacheHit: false, source: 'db' },
  { key: 'posts', duration: 18.3, cacheHit: true },
]);

// Record cache events
traceCacheOperation(rootSpan, 'get', 'user:123', true);
traceCacheOperation(rootSpan, 'set', 'user:123');
```

### Forms (Layer 4)

```typescript
import { traceFormSubmit, recordFormValidation } from '@ereo/trace';

// Trace form submission
const result = await traceFormSubmit(rootSpan, 'checkout', async () => {
  return processOrder(formData);
}, { fieldCount: 8 });

// Record validation timing
recordFormValidation(rootSpan, 'checkout', {
  errorCount: 2,
  validationMs: 5.3,
  errorSources: ['sync', 'schema'],
});
```

### Signals (Layer 5)

```typescript
import { recordSignalUpdate, recordSignalBatch } from '@ereo/trace';

// Record individual signal update
recordSignalUpdate(span, 'count', { subscriberCount: 3, batched: false });

// Record batched updates
recordSignalBatch(span, ['count', 'total', 'items'], { subscriberCount: 8 });
```

### RPC (Layer 6)

```typescript
import { traceRPCCall, recordRPCValidation } from '@ereo/trace';

// Trace an RPC procedure call
const result = await traceRPCCall(rootSpan, 'users.list', 'query', async () => {
  return db.user.findMany();
});

// Record input validation timing
recordRPCValidation(rootSpan, 'users.create', 1.5, true);
```

### Database (Layer 7)

```typescript
import { tracedAdapter, traceQuery } from '@ereo/trace';

// Option A: Wrap entire adapter with proxy (auto-instruments query/execute/get/all/run)
const db = tracedAdapter(rawAdapter, () => getActiveSpan(ctx));

const users = await db.query('SELECT * FROM users WHERE role = ?', ['admin']);
// Automatically records: db.operation, db.statement, db.param_count, db.row_count

// Option B: Manual instrumentation for individual queries
const posts = await traceQuery(rootSpan, 'select', 'SELECT * FROM posts', async () => {
  return rawAdapter.query('SELECT * FROM posts');
});
```

### Auth (Layer 8)

```typescript
import { traceAuthCheck } from '@ereo/trace';

// Trace auth checks (sync or async)
const session = await traceAuthCheck(rootSpan, 'requireAuth', async () => {
  return verifySession(request);
}, { provider: 'jwt', roles: ['admin'] });
// Records: auth.operation, auth.provider, auth.roles, auth.result ('ok' or 'denied')
```

### Islands / Hydration (Layer 9)

```typescript
import { traceHydration, recordHydration } from '@ereo/trace';

// Option A: Wrap hydration (creates child span)
await traceHydration(rootSpan, 'Counter', 'idle', async () => {
  await hydrateComponent(Counter, props);
}, { propsSize: 256 });

// Option B: Record hydration as event (lighter)
recordHydration(rootSpan, 'Sidebar', 'visible', 25.5);
```

### Build (Layer 10)

```typescript
import { traceBuild, traceBuildStage } from '@ereo/trace';

// Create a build trace
const buildSpan = traceBuild(tracer, 'production build');

// Trace individual stages
await traceBuildStage(buildSpan, 'route-discovery', async () => {
  return discoverRoutes('./src/routes');
}, { filesCount: 42 });

await traceBuildStage(buildSpan, 'bundle', async () => {
  return bundle({ target: 'browser' });
});

buildSpan.end();
```

### Errors (Layer 11)

```typescript
import { traceError, withErrorCapture } from '@ereo/trace';

// Record an error on a span
traceError(rootSpan, error, 'loader');
// Records: error.message, error.class, error.phase, error.stack (truncated to 500 chars)

// Wrap a function with automatic error capture
const html = await withErrorCapture(rootSpan, 'render', async () => {
  return renderToString(<App />);
});
// Catches errors, records them on the span, then rethrows
```

## Working with Spans Directly

All instrumentors use the `Span` interface under the hood. You can create custom spans for any operation:

```typescript
// Create child spans from any parent
const span = parentSpan.child('my-operation', 'custom');
span.setAttribute('key', 'value');
span.event('checkpoint', { detail: 'info' });
span.end();

// Auto-managed spans
const result = tracer.withSpan('compute', 'custom', (span) => {
  span.setAttribute('items', 1000);
  return heavyComputation();
});
// Span ends automatically, errors are captured
```

## CLI Reporter

```typescript
import { createCLIReporter } from '@ereo/trace';

const unsubscribe = createCLIReporter(tracer, {
  colors: true,          // ANSI colors (default: true)
  layers: ['data', 'database'],  // Show only specific layers (default: all)
  minDuration: 1,        // Hide spans under 1ms (default: 0)
  verbose: false,        // Show span attributes (default: false)
});

// Stop reporting
unsubscribe();
```

## Standalone Viewer

A self-contained HTML page with a waterfall chart, filtering, and span detail inspection.

```typescript
import { createViewerHandler, createTraceWebSocket } from '@ereo/trace';

// Serve the viewer at /__ereo/traces
const viewerHandler = createViewerHandler(tracer);

// WebSocket for live updates
const traceWs = createTraceWebSocket(tracer);
```

### Traces API

```typescript
import { createTracesAPIHandler } from '@ereo/trace';

const apiHandler = createTracesAPIHandler(tracer);
// GET /__devtools/api/traces        → all traces
// GET /__devtools/api/traces?id=xxx → single trace
```

### Export Traces

```typescript
import { exportTracesHTML } from '@ereo/trace';

// Export as standalone HTML file
const html = exportTracesHTML(tracer);
Bun.write('traces.html', html);
```

## Client-Side Tracing

Browser spans are created on the client and merged into server traces via WebSocket.

```typescript
// In your client entry point
import { initClientTracing, getClientTracer } from '@ereo/trace/client';

// Initialize (reads trace ID from server, patches fetch, connects WebSocket)
initClientTracing();

// Create browser-side spans
const tracer = getClientTracer();
const span = tracer.startSpan('page-render', 'islands');
span.setAttribute('component', 'Dashboard');
// ... do work ...
span.end();
tracer.submitSpan(span);
```

The client tracer automatically:
- Reads `__EREO_TRACE_ID__` from `window` (injected by server during SSR)
- Patches `window.fetch` to propagate `X-Ereo-Trace-Id` headers
- Connects to `/__ereo/trace-ws` for span submission
- Batches spans by trace ID for efficient transport
- Updates the current trace ID from server response headers

## Context Integration

Instrumentors retrieve the tracer and active span from request context:

```typescript
import { setTracer, getTracer, setActiveSpan, getActiveSpan } from '@ereo/trace';

// In middleware (done automatically by traceMiddleware)
setTracer(context, tracer);
setActiveSpan(context, rootSpan);

// In downstream handlers
const tracer = getTracer(context);
const parentSpan = getActiveSpan(context);
const child = parentSpan?.child('my-work', 'custom');
```

## Production: No-Op Tracer

In production builds, alias `@ereo/trace` to `@ereo/trace/noop` to eliminate all tracing overhead. The no-op export is ~592 bytes and all methods are empty stubs.

```typescript
import { noopTracer, noopSpan } from '@ereo/trace/noop';

// All methods are no-ops
noopTracer.startTrace('test', 'request');  // returns noopSpan
noopSpan.setAttribute('key', 'value');      // no-op
noopSpan.end();                             // no-op

// withSpan still runs your function
noopTracer.withSpan('op', 'data', (span) => {
  return computeResult();  // executes normally, span is no-op
});
```

Build configuration example:

```typescript
// In your bundler config
{
  alias: {
    '@ereo/trace': '@ereo/trace/noop',
  }
}
```

## Configuration

```typescript
const tracer = createTracer({
  maxTraces: 200,           // Max completed traces in ring buffer (default: 200)
  maxSpansPerTrace: 500,    // Max spans per trace before capping (default: 500)
  minDuration: 0,           // Drop traces shorter than this (ms, default: 0)
});
```

## Event Streaming

Subscribe to real-time trace lifecycle events:

```typescript
const unsubscribe = tracer.subscribe((event) => {
  switch (event.type) {
    case 'trace:start': // New trace begun
    case 'trace:end':   // Trace finalized
    case 'span:start':  // Span created
    case 'span:end':    // Span ended
    case 'span:event':  // Event recorded on a span
  }
});
```

## Serialization

For WebSocket and API transport, traces are serialized (Map to Record) and deserialized:

```typescript
import { serializeTrace, deserializeTrace, serializeEvent } from '@ereo/trace';

const json = serializeTrace(trace);     // Map<SpanId, SpanData> → Record<string, SpanData>
const trace = deserializeTrace(json);   // Record → Map
const wsEvent = serializeEvent(event);  // Serializes trace:start/end events
```

## Design Decisions

| Decision | Rationale |
|----------|-----------|
| Per-trace span stacks | Isolates concurrent requests on the same tracer instance |
| Closure-based child factory | `span.child()` always creates spans in the correct trace |
| Ring buffer storage | FIFO eviction keeps memory bounded without manual cleanup |
| Event-level annotations | `recordSignalUpdate` / `traceCacheOperation` avoid span overhead for frequent operations |
| Separate client entry | `@ereo/trace/client` keeps browser code out of server bundles |
| No-op export | Production builds pay zero cost — all tracing code is eliminated |
| `performance.now()` timing | Sub-millisecond precision for measuring spans within a process |

## Documentation

For full documentation, visit [https://ereojs.dev/docs/trace](https://ereojs.dev/docs/trace)

## Part of EreoJS

This package is part of the [EreoJS](https://github.com/ereoJS/ereoJS) monorepo - a modern full-stack framework built for Bun.

## License

MIT
