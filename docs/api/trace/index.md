# @ereo/trace

Full-stack developer observability for EreoJS. Traces requests across all 11 framework layers with zero-config instrumentation, a CLI reporter, standalone viewer, and client-side span correlation.

## Import

### Server-side

```ts
import {
  // Core
  createTracer,
  TracerImpl,

  // Span utilities
  SpanImpl,
  generateSpanId,
  generateTraceId,

  // Context integration
  setTracer,
  getTracer,
  setActiveSpan,
  getActiveSpan,

  // No-op (production)
  noopTracer,
  noopSpan,

  // CLI Reporter
  createCLIReporter,

  // Transport
  createTraceWebSocket,
  createTracesAPIHandler,
  serializeTrace,
  deserializeTrace,

  // Collector
  createCollector,

  // Viewer
  createViewerHandler,
  exportTracesHTML,
  generateViewerHTML,

  // Instrumentors (all 11 layers)
  traceMiddleware,
  traceRouteMatch,
  recordRouteMatch,
  traceLoader,
  recordLoaderMetrics,
  traceCacheOperation,
  traceFormSubmit,
  recordFormValidation,
  recordSignalUpdate,
  recordSignalBatch,
  traceRPCCall,
  recordRPCValidation,
  tracedAdapter,
  traceQuery,
  traceAuthCheck,
  traceHydration,
  recordHydration,
  traceBuildStage,
  traceBuild,
  traceError,
  withErrorCapture,
} from '@ereo/trace'
```

### Client-side

```ts
import {
  getClientTracer,
  initClientTracing,
  ClientTracer,
  ClientSpan,
} from '@ereo/trace/client'
```

### Production no-op

```ts
import { noopTracer, noopSpan, NoopTracer } from '@ereo/trace/noop'
```

## Overview

`@ereo/trace` instruments every layer of your EreoJS application during development. A single middleware creates a root trace per request, and built-in instrumentors create child spans for routing, data loading, auth, database queries, RPC calls, form submissions, island hydration, signal updates, build stages, and error handling.

Completed traces are stored in a fixed-capacity ring buffer and streamed in real-time to:

- **CLI** - Color-coded tree output in your terminal
- **DevTools** - Traces tab in the Ereo DevTools panel
- **Standalone viewer** - Self-contained HTML waterfall chart at `/__ereo/traces`

For production builds, alias `@ereo/trace` to `@ereo/trace/noop` (~592 bytes) to eliminate all tracing overhead.

## Features

- **11 Framework Layers** - Request, routing, data, forms, signals, RPC, database, auth, islands, build, errors
- **Zero-Config Middleware** - Single middleware instruments the full request lifecycle
- **CLI Reporter** - Color-coded tree output with duration highlighting
- **Standalone Viewer** - Self-contained HTML waterfall at `/__ereo/traces`
- **Client Correlation** - Browser spans merge into server traces via WebSocket
- **Production No-Op** - ~592B tree-shakeable import drops all tracing code
- **Live Streaming** - Real-time trace events via WebSocket to DevTools and CLI
- **Concurrent Request Isolation** - Per-trace span stacks prevent cross-request corruption

## Quick Start

```ts
import { createTracer, traceMiddleware, createCLIReporter } from '@ereo/trace'

// 1. Create a tracer
const tracer = createTracer()

// 2. Add trace middleware (must be first)
server.use(traceMiddleware(tracer))

// 3. See traces in your terminal
createCLIReporter(tracer)
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

## Concepts

A **trace** represents one complete operation (usually an HTTP request). Each trace contains **spans** - timed segments of work organized by **layer**. Spans form a parent-child tree: the root span wraps the request, child spans represent sub-operations.

```
Trace: GET /api/users
+-- Span: request        (root)
|   +-- Span: routing    (child)
|   +-- Span: auth       (child)
|   +-- Span: data       (child)
|       +-- Span: db.query  (grandchild)
|       +-- Span: db.query  (grandchild)
```

### Layers

Every span belongs to one of 12 layers:

| Layer | Description | Example Spans |
|-------|-------------|---------------|
| `request` | HTTP request lifecycle | `GET /api/users` |
| `routing` | Route matching | `route.match` |
| `data` | Data loading / caching | `loader:users`, `cache.get` |
| `forms` | Form submission / validation | `form:checkout` |
| `signals` | Signal updates | `signal.update`, `signal.batch` |
| `rpc` | RPC procedure calls | `rpc:users.list` |
| `database` | Database queries | `db.query`, `db.execute` |
| `auth` | Authentication / authorization | `auth:requireAuth` |
| `islands` | Island hydration | `hydrate:Counter` |
| `build` | Build pipeline stages | `build:bundle` |
| `errors` | Error recording | Error events on any span |
| `custom` | User-defined spans | Any custom operation |

## Exports

| Export | Description |
|--------|-------------|
| `createTracer()` | Create a new Tracer instance |
| `traceMiddleware()` | Request lifecycle middleware |
| `createCLIReporter()` | Terminal trace reporter |
| `createTraceWebSocket()` | WebSocket handler for live streaming |
| `createTracesAPIHandler()` | HTTP API endpoint for traces |
| `createViewerHandler()` | Standalone HTML viewer handler |
| `createCollector()` | Server + client span merger |
| `exportTracesHTML()` | Export traces as standalone HTML |
| `noopTracer` / `noopSpan` | Zero-cost production stubs |

## API Reference

- [Tracer](/api/trace/tracer) - Core tracer and span API
- [Instrumentors](/api/trace/instrumentors) - All 11 built-in instrumentors
- [CLI Reporter](/api/trace/cli-reporter) - Terminal output configuration
- [Viewer & Transport](/api/trace/viewer) - Standalone viewer, WebSocket, and HTTP API
- [Client Tracing](/api/trace/client) - Browser-side span creation and correlation
- [Configuration](/api/trace/configuration) - Tracer options, context integration, and production setup

## Related

- [DevTools Panel](/api/dev-inspector/) - Traces tab in the Ereo DevTools
- [CLI `ereo dev`](/api/cli/dev) - `--trace` flag to enable tracing
- [Middleware](/concepts/middleware) - Middleware concepts
- [Data Loading](/concepts/data-loading) - Loader instrumentation
