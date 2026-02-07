# Client Tracing

Browser-side span creation for client-server trace correlation. Client spans are sent to the server via WebSocket and merged into the corresponding server trace.

## Setup

```ts
// In your client entry point
import { initClientTracing } from '@ereo/trace/client'

initClientTracing()
```

This:
1. Reads `window.__EREO_TRACE_ID__` (injected by the server during SSR)
2. Connects to `/__ereo/trace-ws` via WebSocket
3. Patches `window.fetch` to propagate `X-Ereo-Trace-Id` headers
4. Updates the current trace ID from server response headers

::: tip
`initClientTracing()` is a no-op in non-browser environments (`typeof window === 'undefined'`), so it's safe to call in SSR code paths.
:::

## Creating Spans

```ts
import { getClientTracer } from '@ereo/trace/client'

const tracer = getClientTracer()

// Create a span
const span = tracer.startSpan('page-render', 'islands')
span.setAttribute('component', 'Dashboard')
span.event('dom-ready', { nodeCount: 42 })
span.end()

// Submit to server
tracer.submitSpan(span)
```

### With Parent Span

```ts
const parent = tracer.startSpan('hydration', 'islands')
const child = tracer.startSpan('fetch-data', 'data', parent.id)
child.end()
parent.addChild(child.id)
parent.end()

tracer.submitSpan(child)
tracer.submitSpan(parent)
```

## ClientTracer API

### startSpan

Create a client-side span.

```ts
startSpan(name: string, layer: SpanLayer, parentId?: SpanId): ClientSpan
```

Uses the current trace ID if set, otherwise generates a random 32-char ID.

### submitSpan

Submit a completed span to the server. Spans are buffered and flushed when the WebSocket is connected.

```ts
submitSpan(span: ClientSpan): void
```

Spans are grouped by `traceId` and sent as `client:spans` messages.

### setTraceId / getTraceId

Manually set or get the current trace ID. Useful after SPA navigation.

```ts
tracer.setTraceId(newTraceId)
const id = tracer.getTraceId()  // string | null
```

### destroy

Disconnect and clean up.

```ts
tracer.destroy()
```

## ClientSpan API

`ClientSpan` mirrors the server-side `Span` interface:

```ts
class ClientSpan {
  readonly id: SpanId
  readonly traceId: TraceId
  readonly parentId: SpanId | null

  setAttribute(key: string, value: string | number | boolean): void
  event(name: string, attrs?: Record<string, string | number | boolean>): void
  end(): void
  error(err: unknown): void
  addChild(childId: SpanId): void
  toData(): SpanData
}
```

All mutating methods (`setAttribute`, `event`, `error`) are no-ops after `end()` is called.

## Fetch Interception

After `initClientTracing()`, all `window.fetch` calls automatically:

1. Add `X-Ereo-Trace-Id` header with the current trace ID
2. Read `X-Ereo-Trace-Id` from the response to update the current trace ID

This ensures that client-initiated fetches (API calls, SPA navigations) are correlated with their server-side traces.

## How Correlation Works

```
Browser                          Server
  |                                |
  |  GET /page                     |
  |  X-Ereo-Trace-Id: abc123      |
  | -----------------------------> |
  |                                |  Creates trace abc123
  |                                |  Processes request
  |  <html>                        |
  |  X-Ereo-Trace-Id: abc123      |
  | <-----------------------------  |
  |                                |
  |  window.__EREO_TRACE_ID__      |
  |  = 'abc123'                    |
  |                                |
  |  [hydration spans]             |
  |  WebSocket: client:spans       |
  | -----------------------------> |
  |                                |  mergeClientSpans(abc123, spans)
  |                                |  Unified trace visible in viewer
```

## Singleton Access

```ts
import { getClientTracer } from '@ereo/trace/client'

// Returns the same instance every time
const tracer = getClientTracer()
```
