# Server Functions (`server$` & `createServerBlock`)

Higher-level wrappers around `createServerFn` with declarative config for rate limiting, CORS, authentication, and caching.

## Import

```ts
import {
  server$,
  createServerBlock,
  parseWindow,
  buildRateLimitMiddleware,
  buildCacheMiddleware,
  buildCorsMiddleware,
  buildAuthMiddleware,
  compileConfigMiddleware,
  clearServerFnRateLimitStore,
} from '@ereo/rpc'

import type {
  ServerFnConfig,
  ServerFnRateLimitConfig,
  ServerFnCacheConfig,
  ServerFnCorsConfig,
  ServerFnAuthConfig,
} from '@ereo/rpc'
```

## `server$`

Create a single server function with optional declarative config.

### Signature

```ts
function server$<TInput = void, TOutput = unknown>(
  handler: (input: TInput, ctx: ServerFnContext) => Promise<TOutput> | TOutput,
  config?: ServerFnConfig
): ServerFn<TInput, TOutput>
```

### Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `handler` | `Function` | The server function handler |
| `config` | `ServerFnConfig` | Optional declarative configuration |

### Examples

#### Basic Server Function

```ts
const getMetrics = server$(async (timeRange: string, ctx) => {
  return db.metrics.findMany({ where: { range: timeRange } })
})

// Call it directly
const metrics = await getMetrics('7d')
```

#### With Rate Limiting and Caching

```ts
const getMetrics = server$(async (timeRange: string, ctx) => {
  return db.metrics.findMany({ where: { range: timeRange } })
}, {
  rateLimit: { max: 30, window: '1m' },
  cache: { maxAge: 60 },
})
```

#### With Authentication

```ts
const getProfile = server$(async (userId: string, ctx) => {
  return db.users.findById(userId)
}, {
  auth: {
    getUser: async (ctx) => {
      const token = ctx.request.headers.get('Authorization')
      return token ? verifyToken(token) : null
    },
    message: 'Must be logged in',
  },
})
```

#### With CORS

```ts
const publicApi = server$(async (query: string, ctx) => {
  return db.search(query)
}, {
  cors: {
    origins: ['https://app.example.com', 'https://admin.example.com'],
    credentials: true,
    maxAge: 3600,
  },
})
```

#### With Explicit ID

```ts
const getUser = server$(async (id: string) => {
  return db.users.find(id)
}, {
  id: 'users.getById',
})
```

## `createServerBlock`

Group related server functions with shared configuration. Per-function overrides replace block-level config; middleware arrays concatenate.

### Signature

```ts
function createServerBlock<T extends BlockFnMap>(
  blockConfig: ServerFnConfig,
  fns: T
): BlockResult<T>
```

### Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `blockConfig` | `ServerFnConfig` | Shared configuration for all functions in the block |
| `fns` | `BlockFnMap` | Map of function names to handlers or `{ handler, ...overrides }` |

### Examples

#### Basic Block

```ts
const usersApi = createServerBlock({
  rateLimit: { max: 60, window: '1m' },
  auth: { getUser: verifyAuth },
}, {
  getById: async (id: string) => db.users.find(id),
  list: async () => db.users.findMany(),
})

// Call individual functions
const user = await usersApi.getById('user-123')
const allUsers = await usersApi.list()
```

#### Per-Function Overrides

```ts
const usersApi = createServerBlock({
  rateLimit: { max: 60, window: '1m' },
  auth: { getUser: verifyAuth },
}, {
  // Inherits block config
  getById: async (id: string) => db.users.find(id),

  // Override rate limit (stricter)
  delete: {
    handler: async (id: string) => db.users.delete(id),
    rateLimit: { max: 5, window: '1m' },
  },

  // Remove auth for public endpoint
  publicProfile: {
    handler: async (id: string) => db.users.getPublicProfile(id),
    auth: undefined,
  },
})
```

#### With Additional Middleware

```ts
const api = createServerBlock({
  rateLimit: { max: 100, window: '1m' },
  middleware: [loggingMiddleware],
}, {
  // Gets: rateLimit + loggingMiddleware + auditMiddleware
  sensitive: {
    handler: async (data: string) => processSensitive(data),
    middleware: [auditMiddleware],
  },
})
```

### Config Merge Rules

| Config Key | Merge Behavior |
|------------|----------------|
| `rateLimit` | Per-fn **replaces** block-level |
| `cache` | Per-fn **replaces** block-level |
| `cors` | Per-fn **replaces** block-level |
| `auth` | Per-fn **replaces** block-level |
| `method` | Per-fn **replaces** block-level |
| `input` | Per-fn **replaces** block-level |
| `allowPublic` | Per-fn **replaces** block-level |
| `middleware` | Block first, then per-fn (**concatenated**) |
| `id` | Per-fn id or auto-generated from function name |

Setting a config key to `undefined` in a per-function override clears the block-level config for that key.

## `ServerFnConfig`

Declarative configuration object used by both `server$` and `createServerBlock`.

### Type Definition

```ts
interface ServerFnConfig {
  rateLimit?: ServerFnRateLimitConfig
  method?: 'GET' | 'POST'
  cache?: ServerFnCacheConfig
  cors?: ServerFnCorsConfig
  auth?: ServerFnAuthConfig
  middleware?: ServerFnMiddleware[]
  input?: Schema<any>
  allowPublic?: boolean
  id?: string
}
```

### Fields

| Field | Type | Description |
|-------|------|-------------|
| `rateLimit` | `ServerFnRateLimitConfig` | Rate limiting configuration |
| `method` | `'GET' \| 'POST'` | HTTP method hint (Phase 2) |
| `cache` | `ServerFnCacheConfig` | Cache-Control header configuration |
| `cors` | `ServerFnCorsConfig` | CORS header configuration |
| `auth` | `ServerFnAuthConfig` | Authentication configuration |
| `middleware` | `ServerFnMiddleware[]` | Additional middleware (runs after config-generated middleware) |
| `input` | `Schema<any>` | Input validation schema |
| `allowPublic` | `boolean` | Skip default middleware |
| `id` | `string` | Explicit ID override (default: auto-generated) |

## Config Types

### `ServerFnRateLimitConfig`

```ts
interface ServerFnRateLimitConfig {
  /** Max requests per window */
  max: number
  /** Window duration: '30s', '1m', '5m', '1h', '1d' */
  window: string
  /** Custom key function (default: x-forwarded-for header) */
  keyFn?: (ctx: ServerFnContext) => string
}
```

Each server function gets its own isolated rate limit store. Two functions with the same window duration do **not** share counters.

### `ServerFnCacheConfig`

```ts
interface ServerFnCacheConfig {
  /** Cache-Control max-age in seconds */
  maxAge: number
  /** Whether the cache is public (default: false → private) */
  public?: boolean
  /** stale-while-revalidate duration in seconds */
  staleWhileRevalidate?: number
}
```

### `ServerFnCorsConfig`

```ts
interface ServerFnCorsConfig {
  /** Allowed origins: '*' for wildcard, or an array of specific origins */
  origins: string | string[]
  /** Allow credentials (default: false) */
  credentials?: boolean
  /** Allowed methods (default: ['GET', 'POST']) */
  methods?: string[]
  /** Allowed headers (default: ['Content-Type', 'Authorization', 'X-Ereo-RPC']) */
  headers?: string[]
  /** Max age for preflight cache in seconds */
  maxAge?: number
}
```

### `ServerFnAuthConfig`

```ts
interface ServerFnAuthConfig {
  /** Function to extract user from context. Return null to deny. */
  getUser: (ctx: ServerFnContext) => unknown | null | Promise<unknown | null>
  /** Custom error message (default: 'Unauthorized') */
  message?: string
}
```

## Middleware Compilation Order

Config is compiled into middleware in this order:

1. **CORS** — sets `Access-Control-*` headers
2. **Rate Limit** — enforces request limits per client
3. **Auth** — validates user identity
4. **Cache** — sets `Cache-Control` header after handler succeeds
5. **User Middleware** — any additional middleware from the `middleware` array

```ts
// This config:
server$(handler, {
  cors: { origins: '*' },
  rateLimit: { max: 10, window: '1m' },
  auth: { getUser: verifyAuth },
  cache: { maxAge: 60 },
  middleware: [customMiddleware],
})

// Compiles to middleware chain:
// CORS → rateLimit → auth → handler → cache headers → customMiddleware
```

## `parseWindow`

Convert a duration string to milliseconds.

### Signature

```ts
function parseWindow(str: string): number
```

### Supported Formats

| Format | Example | Result |
|--------|---------|--------|
| Seconds | `'30s'` | `30000` |
| Minutes | `'5m'` | `300000` |
| Hours | `'1h'` | `3600000` |
| Days | `'1d'` | `86400000` |

Throws an error for invalid formats or non-positive values.

## Standalone Middleware Builders

These functions are used internally by `compileConfigMiddleware` but are exported for advanced use cases.

### `buildRateLimitMiddleware`

```ts
function buildRateLimitMiddleware(config: ServerFnRateLimitConfig): ServerFnMiddleware
```

Creates a rate limiting middleware with its own isolated store. Throws `ServerFnError('RATE_LIMITED')` with status 429 when the limit is exceeded. Includes memory protection that cleans up expired entries when the store exceeds 10,000 entries.

### `buildCacheMiddleware`

```ts
function buildCacheMiddleware(config: ServerFnCacheConfig): ServerFnMiddleware
```

Sets `Cache-Control` header on `ctx.responseHeaders` after the handler succeeds. Supports `public`/`private`, `max-age`, and `stale-while-revalidate` directives.

### `buildCorsMiddleware`

```ts
function buildCorsMiddleware(config: ServerFnCorsConfig): ServerFnMiddleware
```

Sets CORS headers (`Access-Control-Allow-Origin`, `Allow-Methods`, `Allow-Headers`, `Allow-Credentials`, `Max-Age`) on `ctx.responseHeaders`. Supports wildcard (`'*'`) and allowlist origins.

### `buildAuthMiddleware`

```ts
function buildAuthMiddleware(config: ServerFnAuthConfig): ServerFnMiddleware
```

Calls `getUser(ctx)` and throws `ServerFnError('UNAUTHORIZED')` with status 401 if it returns `null` or `undefined`.

### `compileConfigMiddleware`

```ts
function compileConfigMiddleware(config: ServerFnConfig): ServerFnMiddleware[]
```

Converts a `ServerFnConfig` into an ordered array of middleware. Used internally by `server$` and `createServerBlock`.

### `clearServerFnRateLimitStore`

```ts
function clearServerFnRateLimitStore(): void
```

Clears all server function rate limit stores. Useful for testing.

## ID Generation

In Phase 1, IDs are generated as `server$_{fnName}_{counter}`. These are counter-based and not stable across server restarts. Use the `id` config option for stable IDs:

```ts
const fn = server$(handler, { id: 'my-stable-id' })
```

## Integration with Server Function Handler

Server functions created with `server$` and `createServerBlock` are automatically registered and can be dispatched via `createServerFnHandler`:

```ts
import { createServerFnHandler } from '@ereo/rpc'

const handler = createServerFnHandler()

// In your server:
if (url.pathname.startsWith('/_server/')) {
  return handler(request)
}
```

## Design Decisions

| Decision | Rationale |
|----------|-----------|
| Per-instance rate limit stores | Functions get isolated counters — no cross-contamination |
| Config compiles to middleware | Declarative config is sugar over `ServerFnMiddleware` arrays |
| Full replacement semantics | Per-fn config replaces block-level (simpler mental model) |
| `'key' in` detection | Explicit `undefined` can clear block-level config |
| Middleware concatenation | Block middleware runs first, then per-fn (additive, not replacement) |
| Counter-based IDs (Phase 1) | Simple; Phase 2 bundler will inject stable file+name IDs |
