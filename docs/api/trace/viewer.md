# Viewer & Transport

Standalone HTML trace viewer, WebSocket streaming, and HTTP API for trace data.

## Standalone Viewer

A self-contained HTML page with a waterfall chart, filtering, and span detail inspection.

### createViewerHandler

Creates an HTTP handler that serves the viewer at any path (typically `/__ereo/traces`).

```ts
import { createViewerHandler } from '@ereo/trace'

const handler = createViewerHandler(tracer)

// In your server
if (url.pathname === '/__ereo/traces') {
  return handler(request)
}
```

### generateViewerHTML

Generate the viewer HTML directly (for embedding or custom serving).

```ts
import { generateViewerHTML } from '@ereo/trace'

const html = generateViewerHTML(tracer.getTraces())
```

### exportTracesHTML

Export traces as a standalone HTML file. Useful for sharing or bug reports.

```ts
import { exportTracesHTML } from '@ereo/trace'

const html = exportTracesHTML(tracer)
Bun.write('traces.html', html)
```

### Viewer Features

- **Trace list** - Left panel with method, path, status code, and duration
- **Waterfall chart** - Right panel showing span timeline bars
- **Span detail** - Click any span to see attributes and events
- **Filtering** - Filter by HTTP method, path, or status code range
- **Live updates** - New traces appear automatically via WebSocket
- **Color-coded** - Span bars colored by layer, durations by threshold
- **XSS-safe** - All user data is HTML-escaped

## WebSocket Transport

Real-time trace streaming to connected clients (DevTools, viewer, CLI).

### createTraceWebSocket

Creates a WebSocket handler for the `/__ereo/trace-ws` endpoint.

```ts
import { createTraceWebSocket } from '@ereo/trace'

const traceWs = createTraceWebSocket(tracer)
```

### Returns

```ts
{
  upgrade(request: Request): boolean
  websocket: {
    open(ws): void
    close(ws): void
    message(ws, message): void
  }
  close(): void
}
```

### Behavior

**On connect:**
1. Sends all existing traces as an `initial` message
2. Starts broadcasting trace events to all connected clients

**On message:**
- Receives `client:spans` messages from the browser client
- Calls `tracer.mergeClientSpans()` to stitch browser spans into server traces

**On disconnect:**
- Removes client from broadcast list
- Unsubscribes from tracer events when last client disconnects

### Wire Protocol

**Server to Client:**

```ts
// Initial state on connect
{ type: 'initial', traces: SerializedTraceData[] }

// Live events
{ type: 'trace:start', trace: SerializedTraceData }
{ type: 'trace:end', trace: SerializedTraceData }
{ type: 'span:start', span: SpanData }
{ type: 'span:end', span: SpanData }
{ type: 'span:event', spanId: string, event: SpanEvent }
```

**Client to Server:**

```ts
// Submit browser spans
{ type: 'client:spans', traceId: string, spans: SpanData[] }
```

## HTTP API

### createTracesAPIHandler

Creates an HTTP endpoint for querying traces.

```ts
import { createTracesAPIHandler } from '@ereo/trace'

const apiHandler = createTracesAPIHandler(tracer)

// In your server
if (url.pathname === '/__devtools/api/traces') {
  return apiHandler(request)
}
```

### Endpoints

**Get all traces:**
```
GET /__devtools/api/traces
→ { traces: SerializedTraceData[] }
```

**Get single trace:**
```
GET /__devtools/api/traces?id={traceId}
→ SerializedTraceData
→ 404 { error: 'Trace not found' }
```

## Serialization

Traces use `Map<SpanId, SpanData>` internally but need `Record<string, SpanData>` for JSON transport.

```ts
import { serializeTrace, deserializeTrace, serializeEvent } from '@ereo/trace'

// Trace serialization
const json = serializeTrace(trace)       // Map → Record
const trace = deserializeTrace(json)     // Record → Map

// Event serialization (for trace:start/end which contain TraceData)
const wsEvent = serializeEvent(event)
```

## Collector

Thin wrapper for merging client spans and querying unified traces.

```ts
import { createCollector } from '@ereo/trace'

const collector = createCollector(tracer)

// Merge browser spans into a server trace
collector.mergeClientSpans(traceId, clientSpans)

// Get the merged trace
const unified = collector.getUnifiedTrace(traceId)
```
