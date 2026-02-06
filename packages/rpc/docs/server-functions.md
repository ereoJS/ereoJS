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

## Best Practices

**Use descriptive, namespaced IDs:**
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

**Use middleware for cross-cutting concerns:**
```ts
const protectedFn = (id: string, handler: Function) =>
  createServerFn({
    id,
    middleware: [authMiddleware, rateLimitMiddleware],
    handler,
  });
```

**Throw `ServerFnError` for expected errors:**
```ts
// Good — client receives structured error
throw new ServerFnError('NOT_FOUND', 'User not found', { statusCode: 404 });

// Avoid — client receives generic "Internal server error"
throw new Error('User not found');
```
