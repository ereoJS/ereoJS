# Configuration

Tracer options, context integration, and production setup.

## Tracer Configuration

```ts
import { createTracer } from '@ereo/trace'

const tracer = createTracer({
  maxTraces: 200,
  maxSpansPerTrace: 500,
  minDuration: 0,
})
```

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `maxTraces` | `number` | `200` | Max completed traces stored in the ring buffer. When full, oldest traces are evicted (FIFO). |
| `maxSpansPerTrace` | `number` | `500` | Max spans per trace. Once reached, new spans in the same trace are silently dropped. |
| `minDuration` | `number` | `0` | Minimum trace duration in ms. Traces shorter than this are discarded on finalization. Useful for filtering out health checks or static assets. |

## Context Integration

The tracer and active span are stored on the request context so downstream instrumentors can access them without passing references manually.

```ts
import { setTracer, getTracer, setActiveSpan, getActiveSpan } from '@ereo/trace'
```

### Storing (in middleware)

`traceMiddleware` handles this automatically. For manual setup:

```ts
import { setTracer, setActiveSpan } from '@ereo/trace'

// In your middleware
setTracer(context, tracer)
setActiveSpan(context, rootSpan)
```

### Retrieving (in handlers)

```ts
import { getTracer, getActiveSpan } from '@ereo/trace'

// In any handler that has access to the request context
const tracer = getTracer(context)
const parentSpan = getActiveSpan(context)

if (parentSpan) {
  const span = parentSpan.child('my-work', 'custom')
  // ...
  span.end()
}
```

### Context Keys

The tracer is stored under `__ereo_tracer` and the active span under `__ereo_active_span` in the `AppContext` store. These are internal keys managed by `setTracer`/`getTracer`/`setActiveSpan`/`getActiveSpan`.

## Production Setup

In production, you don't want tracing overhead. Alias the main import to the no-op export:

### Using Bundler Aliases

```ts
// Bun build config
{
  alias: {
    '@ereo/trace': '@ereo/trace/noop',
  }
}
```

### Using Conditional Imports

```ts
const { createTracer } = process.env.NODE_ENV === 'production'
  ? await import('@ereo/trace/noop')
  : await import('@ereo/trace')
```

### No-Op Guarantees

The `@ereo/trace/noop` export (~592 bytes) provides:

- All `Tracer` methods return immediately (no spans created, no storage)
- `startTrace` / `startSpan` return a singleton `noopSpan`
- `withSpan` still **executes your function** but the span is a no-op
- `getTraces()` returns `[]`
- `subscribe()` returns a no-op unsubscribe function
- `mergeClientSpans()` does nothing

```ts
import { noopTracer, noopSpan } from '@ereo/trace/noop'

noopTracer.startTrace('test', 'request')  // returns noopSpan
noopSpan.setAttribute('key', 'value')      // no-op
noopSpan.child('x', 'data')               // returns noopSpan
noopSpan.end()                             // no-op
```

## Full Server Setup Example

```ts
import { createTracer, traceMiddleware, createCLIReporter,
         createTraceWebSocket, createViewerHandler, createTracesAPIHandler } from '@ereo/trace'

// Create tracer
const tracer = createTracer({ maxTraces: 500 })

// CLI output
createCLIReporter(tracer, { minDuration: 1 })

// WebSocket for live streaming
const traceWs = createTraceWebSocket(tracer)

// Route handlers
const viewerHandler = createViewerHandler(tracer)
const apiHandler = createTracesAPIHandler(tracer)

// In your server setup
server.use(traceMiddleware(tracer)) // Must be first middleware

// In your request handler
if (url.pathname === '/__ereo/traces') return viewerHandler(request)
if (url.pathname === '/__devtools/api/traces') return apiHandler(request)
if (traceWs.upgrade(request)) return // WebSocket upgrade

// Your normal routes...
```

## Enabling via CLI

When using the EreoJS CLI, tracing can be enabled with the `--trace` flag:

```bash
ereo dev --trace
```

This automatically:
1. Creates a tracer
2. Adds `traceMiddleware` as the first middleware
3. Starts the CLI reporter
4. Sets up the WebSocket and viewer endpoints
