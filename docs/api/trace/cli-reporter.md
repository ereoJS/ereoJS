# CLI Reporter

Subscribes to the tracer and prints color-coded trace trees to your terminal as requests complete.

## createCLIReporter

```ts
import { createCLIReporter } from '@ereo/trace'

const unsubscribe = createCLIReporter(tracer, {
  colors: true,
  layers: [],
  minDuration: 0,
  verbose: false,
})
```

### Parameters

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `colors` | `boolean` | `true` | Enable ANSI color codes in output |
| `layers` | `SpanLayer[]` | `[]` (all) | Filter to show only specific layers |
| `minDuration` | `number` | `0` | Hide spans shorter than this (ms) |
| `verbose` | `boolean` | `false` | Show span attributes in output |

### Returns

`() => void` - Unsubscribe function that stops all output.

## Output Format

```
  GET    /api/users  200  45.2ms
  |-- routing          1.2ms   matched /api/users
  |-- auth             3.1ms   jwt -> ok
  |-- data             38.4ms
  |   |-- user         12.1ms  db
  |   |-- posts        18.3ms  db (parallel)
  |   `-- comments     8.0ms   cache hit
  `-- render           2.5ms   streaming
```

### Color Coding

**Duration thresholds:**
- Green: < 50ms
- Yellow: 50-200ms
- Red: > 200ms

**Status codes:**
- Green: 2xx
- Cyan: 3xx
- Yellow: 4xx
- Red: 5xx

**Layer colors:**
- White: request
- Cyan: routing, rpc
- Blue: data, build
- Magenta: database, islands
- Yellow: auth
- Green: forms, signals
- Red: errors
- Gray: custom

### Span Summaries

The reporter automatically extracts summaries from span attributes:

| Attribute | Summary |
|-----------|---------|
| `route.pattern` | `matched /api/users/[id]` |
| `cache.hit = true` | `cache hit` |
| `db.system` | Database system name |
| `auth.result` | `jwt -> ok` or `auth -> denied` |
| `rpc.procedure` | RPC type |
| `error.message` | Error description |
| `db.statement` | SQL (first 50 chars) |

## Examples

### Show only data and database spans

```ts
createCLIReporter(tracer, {
  layers: ['data', 'database'],
})
```

### Hide fast spans

```ts
createCLIReporter(tracer, {
  minDuration: 5, // Only show spans that took >= 5ms
})
```

### Disable colors (CI/logs)

```ts
createCLIReporter(tracer, {
  colors: false,
})
```
