# Server Functions

Server functions let you define functions that **run on the server** but can be **called from the client** like regular async functions. No manual API routes, no fetch boilerplate — just import and call.

```ts
// server-fns/users.ts
import { createServerFn } from '@ereo/rpc';

export const getUser = createServerFn('getUser', async (id: string) => {
  return db.users.findUnique({ where: { id } });
});

// components/UserProfile.tsx
import { getUser } from '../server-fns/users';

const user = await getUser('123'); // POSTs to /_server-fn/getUser
```

## When to Use Server Functions vs RPC Procedures

| | Server Functions | RPC Procedures |
|---|---|---|
| **Best for** | One-off operations, component-scoped logic | Structured API surfaces |
| **Setup** | Single `createServerFn()` call | Router + procedures + client |
| **Calling** | Direct function call | `rpc.users.get.query(id)` |
| **Subscriptions** | Not supported | WebSocket subscriptions |
| **Type safety** | Inferred from function signature | Inferred from router definition |

Use server functions when you need a quick server operation tied to a specific component. Use RPC procedures when building a shared API consumed by multiple clients.

## API Reference

### `createServerFn(id, handler)`

The simple form — just an ID and a handler function.

```ts
import { createServerFn } from '@ereo/rpc';

export const greet = createServerFn(
  'greet',
  async (name: string, ctx) => {
    return `Hello, ${name}!`;
  }
);
```

**Parameters:**

- `id` (string) — Unique identifier. Used as the URL path segment: `/_server-fn/{id}`
- `handler` (function) — `(input: TInput, ctx: ServerFnContext) => Promise<TOutput>`

**Returns:** A `ServerFn<TInput, TOutput>` — a callable function with metadata:

- `fn(input)` — Call the function (direct on server, HTTP POST on client)
- `fn._id` — The unique function ID
- `fn._url` — The HTTP endpoint URL

### `createServerFn(options)`

The full form with validation, middleware, and more.

```ts
import { createServerFn } from '@ereo/rpc';
import { z } from 'zod';

export const createPost = createServerFn({
  id: 'createPost',
  input: z.object({
    title: z.string().min(1).max(200),
    content: z.string(),
    tags: z.array(z.string()).optional(),
  }),
  middleware: [authMiddleware],
  handler: async (input, ctx) => {
    const userId = (ctx.appContext as any).userId;
    return db.posts.create({
      data: { ...input, authorId: userId },
    });
  },
});
```

**Options:**

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `id` | `string` | Yes | Unique function identifier |
| `handler` | `(input, ctx) => Promise<T>` | Yes | The server-side implementation |
| `input` | `Schema<T>` | No | Zod-compatible input validation schema |
| `middleware` | `ServerFnMiddleware[]` | No | Middleware to run before the handler |

### `ServerFnContext`

The context object passed to handlers and middleware:

```ts
interface ServerFnContext {
  request: Request;            // The original HTTP request
  responseHeaders: Headers;    // Set these to add headers to the response
  appContext: unknown;         // Application context (user, db, etc.)
}
```

Setting response headers from a handler:

```ts
export const getConfig = createServerFn('getConfig', async (_input: void, ctx) => {
  ctx.responseHeaders.set('Cache-Control', 'max-age=300');
  return { theme: 'dark', locale: 'en' };
});
```

### `ServerFnError`

Throw structured errors from handlers with HTTP status codes:

```ts
import { ServerFnError } from '@ereo/rpc';

export const deleteUser = createServerFn('deleteUser', async (id: string, ctx) => {
  const user = await db.users.findUnique({ where: { id } });

  if (!user) {
    throw new ServerFnError('NOT_FOUND', 'User not found', {
      statusCode: 404,
    });
  }

  if (user.role === 'admin') {
    throw new ServerFnError('FORBIDDEN', 'Cannot delete admin users', {
      statusCode: 403,
      details: { userId: id, role: user.role },
    });
  }

  await db.users.delete({ where: { id } });
  return { success: true };
});
```

**Constructor:** `new ServerFnError(code, message, options?)`

| Parameter | Type | Description |
|-----------|------|-------------|
| `code` | `string` | Machine-readable error code (e.g., `'NOT_FOUND'`) |
| `message` | `string` | Human-readable error message |
| `options.statusCode` | `number` | HTTP status code (default: `400`) |
| `options.details` | `Record<string, unknown>` | Additional error context sent to client |

## Middleware

Server function middleware runs before the handler. It receives the context and a `next` function.

```ts
import type { ServerFnMiddleware } from '@ereo/rpc';

// Auth middleware
const authMiddleware: ServerFnMiddleware = async (ctx, next) => {
  const token = ctx.request.headers.get('Authorization');
  if (!token) {
    throw new ServerFnError('UNAUTHORIZED', 'Authentication required', {
      statusCode: 401,
    });
  }

  const user = await verifyToken(token);
  (ctx as any).user = user;
  return next();
};

// Logging middleware
const logMiddleware: ServerFnMiddleware = async (ctx, next) => {
  const start = performance.now();
  const result = await next();
  console.log(`Server fn took ${(performance.now() - start).toFixed(1)}ms`);
  return result;
};
```

Middleware executes in order. Each middleware wraps the next:

```
globalMw1 → globalMw2 → fnMw1 → fnMw2 → handler
```

## Server Integration

### `createServerFnHandler(options?)`

Creates an HTTP handler that dispatches requests to registered server functions.

```ts
import { createServerFnHandler } from '@ereo/rpc';

const serverFnHandler = createServerFnHandler({
  // Optional: custom base path (default: '/_server-fn')
  basePath: '/_server-fn',

  // Optional: global middleware for all server functions
  middleware: [logMiddleware],

  // Optional: create app context from each request
  createContext: async (request) => {
    const session = await getSession(request);
    return { userId: session?.userId, db };
  },

  // Optional: error reporting
  onError: (error, fnId) => {
    errorTracker.capture(error, { fnId });
  },
});
```

### With BunServer

```ts
import { BunServer } from '@ereo/server';
import { createServerFnHandler } from '@ereo/rpc';

// Import server functions to register them
import './server-fns/users';
import './server-fns/posts';

const serverFnHandler = createServerFnHandler({
  createContext: async (request) => ({
    db: getDb(),
    user: await getUser(request),
  }),
});

const server = new BunServer({
  port: 3000,
  async fetch(request) {
    // Try server functions first
    const fnResponse = await serverFnHandler(request);
    if (fnResponse) return fnResponse;

    // Fall through to normal route handling...
  },
});
```

### Protocol

Server functions communicate over a simple JSON protocol:

**Request:** `POST /_server-fn/{id}`
```json
{
  "input": <any JSON value>
}
```

**Success Response:** `200`
```json
{
  "ok": true,
  "data": <return value>
}
```

**Error Response:** `4xx/5xx`
```json
{
  "ok": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "User not found",
    "details": { ... }
  }
}
```

## React Hook: `useServerFn`

For React components, `useServerFn` provides loading/error state management:

```tsx
import { useServerFn } from '@ereo/rpc/client';
import { getUser } from '../server-fns/users';

function UserProfile({ userId }: { userId: string }) {
  const { execute, data, isPending, error, reset } = useServerFn(getUser);

  useEffect(() => {
    execute(userId);
  }, [userId, execute]);

  if (isPending) return <Skeleton />;
  if (error) return <ErrorMessage code={error.code} message={error.message} />;
  if (!data) return null;

  return <Profile user={data} />;
}
```

### Hook Options

```ts
const { execute, data, isPending, error, isSuccess, isError, reset } = useServerFn(fn, {
  onSuccess: (data) => { /* called on success */ },
  onError: (error) => { /* called on error */ },
  onSettled: () => { /* called after success or error */ },
});
```

### Return Value

| Property | Type | Description |
|----------|------|-------------|
| `execute` | `(input: TInput) => Promise<TOutput>` | Call the server function |
| `data` | `TOutput \| undefined` | Most recent successful result |
| `error` | `ServerFnErrorShape \| undefined` | Most recent error |
| `isPending` | `boolean` | Whether a call is in flight |
| `isSuccess` | `boolean` | Whether last call succeeded |
| `isError` | `boolean` | Whether last call errored |
| `reset` | `() => void` | Reset all state to initial |

### Stale Request Handling

The hook implements **last-write-wins** — if you call `execute()` while a previous call is still in flight, the previous result is discarded:

```tsx
// Typing in a search box
const handleSearch = (query: string) => {
  execute(query); // Previous in-flight request is automatically superseded
};
```

## Type Inference

Types flow automatically from the handler signature:

```ts
const getUser = createServerFn('getUser', async (id: string) => {
  return { id, name: 'Alice', age: 30 }; // Return type inferred
});

// Type helpers
type Input = InferServerFnInput<typeof getUser>;   // string
type Output = InferServerFnOutput<typeof getUser>;  // { id: string; name: string; age: number }
```

With validated input, types flow from the schema:

```ts
const createPost = createServerFn({
  id: 'createPost',
  input: z.object({ title: z.string(), body: z.string() }),
  handler: async (input) => {
    // input is { title: string; body: string } — inferred from schema
    return db.posts.create({ data: input });
  },
});
```

## How It Works

`createServerFn` is **isomorphic** — it behaves differently based on the runtime:

**On the server (Bun):**
1. Registers the handler in a global registry
2. Returns a callable that executes the handler directly (no HTTP round-trip)

**On the client (browser):**
1. Returns a proxy function that POSTs to `/_server-fn/{id}`
2. The handler code is never executed on the client

**Flow on client-side call:**
```
Component calls getUser('123')
  → Proxy sends POST /_server-fn/getUser with { input: '123' }
    → Server handler receives request
      → Runs global middleware
      → Runs function middleware
      → Validates input (if schema provided)
      → Executes handler
    → Returns { ok: true, data: { ... } }
  → Proxy returns the data
```

## `server$` — Declarative Server Functions

`server$` is a higher-level wrapper around `createServerFn` that adds declarative config for rate limiting, CORS, auth, and caching. IDs are auto-generated.

```ts
import { server$ } from '@ereo/rpc';

export const getMetrics = server$(async (timeRange: string, ctx) => {
  return db.metrics.findMany({ where: { range: timeRange } });
}, {
  rateLimit: { max: 30, window: '1m' },
  cache: { maxAge: 60 },
});

// Call it the same way as createServerFn:
const data = await getMetrics('7d');
```

### `ServerFnConfig`

All config keys are optional:

| Property | Type | Description |
|----------|------|-------------|
| `rateLimit` | `{ max: number, window: string, keyFn? }` | In-memory rate limiting per client IP |
| `cache` | `{ maxAge: number, public?: boolean, staleWhileRevalidate?: number }` | Sets `Cache-Control` header on success |
| `cors` | `{ origins: string \| string[], credentials?, methods?, headers?, maxAge? }` | Sets `Access-Control-*` headers |
| `auth` | `{ getUser: (ctx) => user \| null, message? }` | Throws 401 if `getUser` returns null |
| `middleware` | `ServerFnMiddleware[]` | Additional middleware (runs after config-generated middleware) |
| `input` | `Schema<T>` | Zod-compatible input validation schema |
| `allowPublic` | `boolean` | Skip `defaultMiddleware` from the handler |
| `id` | `string` | Explicit ID override (default: auto-generated `server$_{name}_{counter}`) |
| `method` | `'GET' \| 'POST'` | Method hint (accepted but not yet wired — Phase 2) |

### Window Format

The `window` field in `rateLimit` accepts duration strings:

- `'30s'` — 30 seconds
- `'1m'` — 1 minute
- `'5m'` — 5 minutes
- `'1h'` — 1 hour
- `'1d'` — 1 day

### Config Middleware Order

When config is compiled to middleware, it runs in this order:

```
CORS → Rate Limit → Auth → Cache → User Middleware → Handler
```

### Rate Limiting

Each `server$` function gets its own isolated rate limit store. Two functions with identical rate limit config do **not** share counters — Function A's traffic never affects Function B.

```ts
// These have independent rate limits:
const fnA = server$(async () => 'a', { rateLimit: { max: 10, window: '1m' } });
const fnB = server$(async () => 'b', { rateLimit: { max: 10, window: '1m' } });
```

Rate limiting uses `x-forwarded-for` by default. Provide a custom `keyFn` to change the key:

```ts
const fn = server$(handler, {
  rateLimit: {
    max: 100,
    window: '1h',
    keyFn: (ctx) => ctx.request.headers.get('X-Api-Key') ?? 'anonymous',
  },
});
```

When exceeded, throws `ServerFnError('RATE_LIMITED', 'Too many requests', { statusCode: 429 })`.

### Auth

```ts
const fn = server$(handler, {
  auth: {
    getUser: async (ctx) => {
      const token = ctx.request.headers.get('Authorization');
      return token ? verifyToken(token) : null;
    },
    message: 'Please log in first', // optional, default: 'Unauthorized'
  },
});
```

When `getUser` returns `null` or `undefined`, throws `ServerFnError('UNAUTHORIZED', message, { statusCode: 401 })`.

### Caching

Sets `Cache-Control` on the response after the handler succeeds. Does **not** set the header on error responses.

```ts
const fn = server$(handler, {
  cache: {
    maxAge: 300,                // max-age=300
    public: true,               // public (default: private)
    staleWhileRevalidate: 60,   // stale-while-revalidate=60
  },
});
// Produces: Cache-Control: public, max-age=300, stale-while-revalidate=60
```

### CORS

```ts
const fn = server$(handler, {
  cors: {
    origins: ['https://app.com', 'https://admin.com'], // or '*' for wildcard
    credentials: true,
    methods: ['GET', 'POST'],                          // default: ['GET', 'POST']
    headers: ['Content-Type', 'Authorization'],        // default includes X-Ereo-RPC
    maxAge: 3600,                                      // preflight cache
  },
});
```

For non-wildcard origins, the middleware checks the `Origin` request header against the allowlist.

## `createServerBlock` — Grouped Functions

`createServerBlock` creates multiple server functions that share config. Useful for building API modules.

```ts
import { createServerBlock } from '@ereo/rpc';

const api = createServerBlock({
  rateLimit: { max: 30, window: '1m' },
  middleware: [authMiddleware],
}, {
  getMetrics: async (timeRange: string, ctx) => {
    return db.metrics.findMany({ where: { range: timeRange } });
  },

  deleteUser: {
    handler: async (userId: string, ctx) => {
      return db.users.delete({ where: { id: userId } });
    },
    rateLimit: { max: 5, window: '1m' }, // overrides block's rate limit
  },
});

await api.getMetrics('7d');
await api.deleteUser('user-123');
```

### Config Merge Rules

- **Config objects** (`rateLimit`, `cache`, `cors`, `auth`) — per-function overrides **replace** the block-level value entirely. Set to `undefined` to remove a block-level config.
- **Middleware arrays** — **concatenated**: block middleware runs first, then per-function middleware.
- **IDs** — auto-generated from the function key name (`server$_{keyName}_{counter}`), or set an explicit `id` per function.

```ts
const api = createServerBlock(
  { auth: { getUser: checkAuth } },
  {
    // Inherits auth from block
    secret: async () => 'protected',

    // Removes auth — this function is public
    health: {
      handler: async () => ({ ok: true }),
      auth: undefined,
    },
  }
);
```

## Standalone Middleware Builders

The individual middleware builders are exported for advanced use:

```ts
import {
  buildRateLimitMiddleware,
  buildCacheMiddleware,
  buildCorsMiddleware,
  buildAuthMiddleware,
  compileConfigMiddleware,
  parseWindow,
} from '@ereo/rpc';
```

- `parseWindow(str)` — converts `'30s'`, `'1m'`, `'1h'`, `'1d'` to milliseconds
- `buildRateLimitMiddleware(config)` — returns a `ServerFnMiddleware`
- `buildCacheMiddleware(config)` — returns a `ServerFnMiddleware`
- `buildCorsMiddleware(config)` — returns a `ServerFnMiddleware`
- `buildAuthMiddleware(config)` — returns a `ServerFnMiddleware`
- `compileConfigMiddleware(config)` — converts a full `ServerFnConfig` to an ordered middleware array

## Best Practices

**Use `server$` for most cases, `createServerFn` when you need explicit IDs:**
```ts
// server$ — auto-generated ID, declarative config
const getUser = server$(async (id: string) => db.users.find(id), {
  rateLimit: { max: 100, window: '1m' },
});

// createServerFn — explicit ID, manual middleware
const getUser = createServerFn('users.getById', async (id: string) => {
  return db.users.find(id);
});
```

**Use `createServerBlock` to group related functions:**
```ts
const usersApi = createServerBlock({
  auth: { getUser: verifyAuth },
  rateLimit: { max: 60, window: '1m' },
}, {
  getById: async (id: string) => db.users.find(id),
  list: async () => db.users.findMany(),
  delete: {
    handler: async (id: string) => db.users.delete(id),
    rateLimit: { max: 5, window: '1m' }, // stricter limit for destructive ops
  },
});
```

**Use descriptive, namespaced IDs (with `createServerFn`):**
```ts
// Good
createServerFn('users.getById', ...)
createServerFn('posts.create', ...)
createServerFn('auth.verifyEmail', ...)

// Avoid
createServerFn('fn1', ...)
createServerFn('get', ...)
```

**Keep server functions in dedicated files:**
```
app/
  server-fns/
    users.ts      # User-related server functions
    posts.ts      # Post-related server functions
    auth.ts       # Auth server functions
  components/
    UserProfile.tsx
```

**Throw `ServerFnError` for expected errors:**
```ts
// Good — client receives structured error
throw new ServerFnError('NOT_FOUND', 'User not found', { statusCode: 404 });

// Avoid — client receives generic "Internal server error"
throw new Error('User not found');
```
