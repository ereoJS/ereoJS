# Tracer & Span

The core tracing primitives. A `Tracer` creates and manages traces; a `Span` represents a timed segment of work within a trace.

## createTracer

Create a new tracer instance.

```ts
import { createTracer } from '@ereo/trace'

const tracer = createTracer({
  maxTraces: 200,           // Completed traces to keep (ring buffer, FIFO eviction)
  maxSpansPerTrace: 500,    // Max spans before capping
  minDuration: 0,           // Drop traces shorter than this (ms)
})
```

### Parameters

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `maxTraces` | `number` | `200` | Ring buffer capacity for completed traces |
| `maxSpansPerTrace` | `number` | `500` | Max spans per trace before new spans are dropped |
| `minDuration` | `number` | `0` | Traces shorter than this (ms) are discarded on finalization |

### Returns

`Tracer` - The tracer instance.

## Tracer Interface

```ts
interface Tracer {
  startTrace(name: string, layer: SpanLayer, metadata?: Partial<TraceMetadata>): Span
  startSpan(name: string, layer: SpanLayer): Span
  activeSpan(): Span | null
  withSpan<T>(name: string, layer: SpanLayer, fn: (span: Span) => T | Promise<T>): T | Promise<T>
  getTraces(): TraceData[]
  getTrace(id: TraceId): TraceData | undefined
  subscribe(cb: (event: TraceStreamEvent) => void): () => void
  mergeClientSpans(traceId: TraceId, spans: SpanData[]): void
}
```

### startTrace

Create a new trace with a root span. This is the entry point for request tracing.

```ts
const rootSpan = tracer.startTrace('GET /api/users', 'request', {
  origin: 'server',
  method: 'GET',
  pathname: '/api/users',
})

// ... handle request ...

rootSpan.end()
```

### startSpan

Create a child span of the current active span. If no trace is active, creates an orphan trace.

```ts
// Automatically attaches to the most recently started trace
const span = tracer.startSpan('db.query', 'database')
span.setAttribute('db.statement', 'SELECT * FROM users')
span.end()
```

::: tip
Prefer `parentSpan.child()` over `tracer.startSpan()` when you have access to the parent span. The `child()` method uses closures to guarantee correct trace context, while `startSpan()` is best-effort and picks the most recently started trace.
:::

### withSpan

Execute a function within a span. The span is automatically ended on completion or error.

```ts
// Sync
const result = tracer.withSpan('compute', 'custom', (span) => {
  span.setAttribute('items', 1000)
  return heavyComputation()
})

// Async
const data = await tracer.withSpan('fetch-data', 'data', async (span) => {
  const res = await fetch('/api/data')
  return res.json()
})
```

Errors are recorded on the span and re-thrown.

### getTraces / getTrace

Retrieve completed traces from the ring buffer.

```ts
const allTraces = tracer.getTraces()    // TraceData[] (oldest first)
const trace = tracer.getTrace(traceId)  // TraceData | undefined
```

### subscribe

Subscribe to real-time trace lifecycle events. Returns an unsubscribe function.

```ts
const unsubscribe = tracer.subscribe((event) => {
  switch (event.type) {
    case 'trace:start':  // New trace begun
    case 'trace:end':    // Trace finalized (all spans ended)
    case 'span:start':   // Span created
    case 'span:end':     // Span ended
    case 'span:event':   // Event recorded on a span
  }
})

// Later
unsubscribe()
```

### mergeClientSpans

Merge browser-side spans into a completed server trace. Called automatically by the WebSocket transport when the client submits spans.

```ts
tracer.mergeClientSpans(traceId, clientSpans)
```

## Span Interface

```ts
interface Span {
  readonly id: SpanId
  readonly traceId: TraceId
  setAttribute(key: string, value: string | number | boolean): void
  event(name: string, attributes?: Record<string, string | number | boolean>): void
  end(): void
  error(err: unknown): void
  child(name: string, layer: SpanLayer): Span
}
```

### setAttribute

Set a key-value attribute on the span. No-op after `end()`.

```ts
span.setAttribute('http.method', 'GET')
span.setAttribute('db.row_count', 42)
span.setAttribute('cache.hit', true)
```

### event

Record a timestamped event within the span. No-op after `end()`.

```ts
span.event('cache.get', { key: 'user:123', hit: true })
span.event('route.matched', { pattern: '/api/users/[id]' })
```

### end

End the span and record the end time. Idempotent (calling multiple times has no effect).

```ts
span.end()
span.end() // no-op, safe to call again
```

When all spans in a trace have ended, the trace is finalized and stored in the ring buffer.

### error

Record an error on the span and set status to `'error'`. Extracts `message`, `name`, and `stack` (truncated to 500 chars) from Error instances. For non-Error values, records `String(err)` as the message.

```ts
span.error(new Error('Connection refused'))
// Sets: error.message, error.name, error.stack, status = 'error'

span.error('string error')
// Sets: error.message = 'string error', status = 'error'
```

### child

Create a child span in the same trace. The child inherits the trace ID via closure, ensuring correct context even with concurrent requests.

```ts
const dataSpan = rootSpan.child('data-loading', 'data')
const dbSpan = dataSpan.child('db.query', 'database')
dbSpan.end()
dataSpan.end()
```

## Types

### TraceData

```ts
interface TraceData {
  id: TraceId                        // 32-char hex string
  rootSpanId: SpanId                 // ID of the root span
  startTime: number                  // performance.now() timestamp
  endTime: number
  duration: number                   // endTime - startTime (ms)
  spans: Map<SpanId, SpanData>       // All spans in this trace
  metadata: TraceMetadata
}
```

### SpanData

```ts
interface SpanData {
  id: SpanId                         // 16-char hex string
  traceId: TraceId
  parentId: SpanId | null            // null for root spans
  name: string
  layer: SpanLayer
  status: SpanStatus                 // 'ok' | 'error' | 'timeout'
  startTime: number
  endTime: number
  duration: number
  attributes: Record<string, string | number | boolean>
  events: SpanEvent[]
  children: SpanId[]
}
```

### TraceMetadata

```ts
interface TraceMetadata {
  origin: 'server' | 'client'
  method?: string                    // HTTP method
  pathname?: string                  // URL pathname
  statusCode?: number                // HTTP status code
  routePattern?: string              // Matched route pattern
}
```

### TraceStreamEvent

```ts
type TraceStreamEvent =
  | { type: 'trace:start'; trace: TraceData }
  | { type: 'trace:end'; trace: TraceData }
  | { type: 'span:start'; span: SpanData }
  | { type: 'span:end'; span: SpanData }
  | { type: 'span:event'; spanId: SpanId; event: SpanEvent }
```
