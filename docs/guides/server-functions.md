# Server Functions

`server$` and `createServerBlock` provide a declarative way to create server functions with built-in rate limiting, authentication, CORS, and caching. Instead of manually composing middleware, you describe what you want in a config object and the framework compiles it into an optimized middleware chain.

## When to Use Server Functions

EreoJS offers two ways to write server-side RPC:

| Approach | Best For |
|----------|----------|
| **Procedures + Router** | Full-featured API with nested namespaces, WebSocket subscriptions, typed client proxy |
| **`server$` / `createServerBlock`** | Quick server operations with declarative middleware — rate limiting, auth, caching in one config |

Use `server$` when you need a standalone server function with config. Use `createServerBlock` when you have a group of related functions that share config (e.g. all endpoints for "users" share rate limiting and auth).

## `server$` — Single Functions

Wrap any async function with `server$` to get a callable server function with optional declarative config:

```ts
// app/lib/api.ts
import { server$ } from '@ereo/rpc'
import { db } from './db'

// Basic — no config
export const getHealth = server$(async () => {
  return { status: 'ok', time: Date.now() }
})

// With rate limiting and caching
export const getMetrics = server$(async (timeRange: string) => {
  return db.metrics.findMany({ where: { range: timeRange } })
}, {
  rateLimit: { max: 30, window: '1m' },
  cache: { maxAge: 60 },
})
```

Call them like regular functions from your route loaders and actions:

```ts
// app/routes/dashboard.tsx
import { getMetrics } from '~/lib/api'

export async function loader() {
  const metrics = await getMetrics('7d')
  return { metrics }
}

export default function Dashboard({ loaderData }: { loaderData: { metrics: any } }) {
  return <pre>{JSON.stringify(loaderData.metrics, null, 2)}</pre>
}
```

The rate limiting and cache headers run automatically when the function is called — no manual middleware wiring needed.

## `createServerBlock` — Grouped Functions

When multiple functions share the same config, group them into a block:

```ts
// app/lib/todos-api.ts
import { createServerBlock } from '@ereo/rpc'
import { getAllTodos, addTodo, toggleTodo, deleteTodo, getTodoStats } from './db'

export const todosApi = createServerBlock(
  {
    // Shared: all functions get 60 req/min rate limit
    rateLimit: { max: 60, window: '1m' },
  },
  {
    // List and stats use the shared rate limit
    list: async () => getAllTodos(),
    stats: async () => getTodoStats(),

    // Create validates the title
    create: async (title: string) => {
      if (!title?.trim()) throw new Error('Title is required')
      return addTodo(title.trim())
    },

    // Toggle just needs an ID
    toggle: async (id: number) => {
      const todo = toggleTodo(id)
      if (!todo) throw new Error('Todo not found')
      return todo
    },

    // Delete gets a stricter rate limit (overrides the block-level config)
    delete: {
      handler: async (id: number) => {
        const ok = deleteTodo(id)
        if (!ok) throw new Error('Todo not found')
        return { deleted: true }
      },
      rateLimit: { max: 10, window: '1m' },
    },
  }
)
```

Use individual functions from the block in your routes:

```ts
// app/routes/index.tsx
import { todosApi } from '~/lib/todos-api'

export async function loader() {
  const [todos, stats] = await Promise.all([
    todosApi.list(),
    todosApi.stats(),
  ])
  return { todos, stats }
}

export async function action({ request }: { request: Request }) {
  const form = await request.formData()
  const intent = form.get('_intent') as string

  if (intent === 'create') {
    await todosApi.create(form.get('title') as string)
  } else if (intent === 'toggle') {
    await todosApi.toggle(Number(form.get('id')))
  } else if (intent === 'delete') {
    await todosApi.delete(Number(form.get('id')))
  }

  return new Response(null, { status: 303, headers: { Location: '/' } })
}
```

## Config Options

The `ServerFnConfig` object supports:

### Rate Limiting

Limit how many requests a client can make within a time window:

```ts
server$(handler, {
  rateLimit: {
    max: 30,         // Max requests per window
    window: '1m',    // Duration: '30s', '1m', '5m', '1h', '1d'
  },
})
```

Each function gets its own isolated counter. Two functions with the same window duration do **not** share rate limit state.

You can customize the key function to rate limit by user instead of IP:

```ts
server$(handler, {
  rateLimit: {
    max: 100,
    window: '1h',
    keyFn: (ctx) => ctx.request.headers.get('x-user-id') ?? 'anonymous',
  },
})
```

### Authentication

Require authentication before the handler runs:

```ts
server$(handler, {
  auth: {
    getUser: async (ctx) => {
      const token = ctx.request.headers.get('Authorization')
      return token ? verifyToken(token) : null
    },
    message: 'Please log in first',
  },
})
```

If `getUser` returns `null` or `undefined`, the request is rejected with a 401 error before the handler executes.

### CORS

Set cross-origin headers for functions called from different domains:

```ts
server$(handler, {
  cors: {
    origins: ['https://app.example.com', 'https://admin.example.com'],
    credentials: true,
    methods: ['GET', 'POST'],
    headers: ['Content-Type', 'Authorization'],
    maxAge: 3600,
  },
})
```

Use `origins: '*'` for public APIs.

### Caching

Add `Cache-Control` headers to responses:

```ts
server$(handler, {
  cache: {
    maxAge: 60,                  // Cache for 60 seconds
    public: true,                // CDN-cacheable (default: private)
    staleWhileRevalidate: 300,   // Serve stale for 5min while revalidating
  },
})
```

### Combining Config

All config options can be combined. The middleware executes in this order:

1. **CORS** — sets headers first so errors also include CORS headers
2. **Rate Limit** — rejects excess requests early
3. **Auth** — verifies identity before hitting the handler
4. **Cache** — sets cache headers after successful response
5. **Custom middleware** — any additional middleware from the `middleware` array

```ts
export const getAnalytics = server$(
  async (range: string) => db.analytics.query(range),
  {
    cors: { origins: 'https://dashboard.example.com' },
    rateLimit: { max: 30, window: '1m' },
    auth: { getUser: verifyAuth },
    cache: { maxAge: 60, public: false },
    middleware: [customLogging],
  }
)
```

## Block Config Merging

In `createServerBlock`, per-function config **replaces** the block-level config for that key. Middleware arrays **concatenate** (block first, then per-function):

```ts
const api = createServerBlock(
  {
    rateLimit: { max: 60, window: '1m' },
    auth: { getUser: verifyAuth },
    middleware: [loggingMiddleware],
  },
  {
    // Gets: rateLimit(60/1m) + auth + loggingMiddleware
    list: async () => db.items.findMany(),

    // Gets: rateLimit(5/1m) + auth + loggingMiddleware
    // (rateLimit is replaced, auth and middleware are inherited)
    delete: {
      handler: async (id: number) => db.items.delete(id),
      rateLimit: { max: 5, window: '1m' },
    },

    // Gets: rateLimit(60/1m) + loggingMiddleware + auditMiddleware
    // (auth is removed by setting to undefined, audit middleware added)
    publicSearch: {
      handler: async (query: string) => db.items.search(query),
      auth: undefined,
      middleware: [auditMiddleware],
    },
  }
)
```

Setting a config key to `undefined` explicitly clears the block-level value for that function.

## Window Duration Format

Rate limit windows use a compact string format:

| Format | Duration |
|--------|----------|
| `'30s'` | 30 seconds |
| `'1m'` | 1 minute |
| `'5m'` | 5 minutes |
| `'1h'` | 1 hour |
| `'1d'` | 1 day |

## Using with SQLite

Server blocks pair well with Bun's built-in SQLite for a zero-dependency backend:

```ts
// app/lib/db.ts
import { Database } from 'bun:sqlite'

const db = new Database('data/app.db', { create: true })
db.exec('PRAGMA journal_mode = WAL')
db.exec('PRAGMA synchronous = NORMAL')

db.exec(`
  CREATE TABLE IF NOT EXISTS todos (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    title      TEXT    NOT NULL,
    completed  INTEGER NOT NULL DEFAULT 0,
    created_at TEXT    NOT NULL DEFAULT (datetime('now'))
  )
`)

export function getAllTodos() {
  return db.prepare('SELECT * FROM todos ORDER BY completed ASC, created_at DESC').all()
}

export function addTodo(title: string) {
  return db.prepare('INSERT INTO todos (title) VALUES (?) RETURNING *').get(title)
}

export function toggleTodo(id: number) {
  return db.prepare('UPDATE todos SET completed = 1 - completed WHERE id = ? RETURNING *').get(id)
}

export function deleteTodo(id: number) {
  return db.prepare('DELETE FROM todos WHERE id = ?').run(id).changes > 0
}
```

```ts
// app/lib/api.ts
import { createServerBlock } from '@ereo/rpc'
import { getAllTodos, addTodo, toggleTodo, deleteTodo } from './db'

export const todosApi = createServerBlock(
  { rateLimit: { max: 60, window: '1m' } },
  {
    list: async () => getAllTodos(),
    create: async (title: string) => addTodo(title),
    toggle: async (id: number) => toggleTodo(id),
    delete: {
      handler: async (id: number) => deleteTodo(id),
      rateLimit: { max: 10, window: '1m' },
    },
  }
)
```

This gives you a complete API layer in two small files — with rate limiting built in and no additional dependencies.

## HTTP Dispatch

Server functions created with `server$` and `createServerBlock` are automatically registered and can be dispatched over HTTP using `createServerFnHandler`:

```ts
// server.ts or ereo.config.ts
import { createServerFnHandler } from '@ereo/rpc'

const handler = createServerFnHandler()

// In your server fetch handler:
if (url.pathname.startsWith('/_server-fn/')) {
  return handler(request)
}
```

This enables calling server functions from the client over HTTP. On the server, they execute directly without the network round-trip.

## Testing

Use `clearServerFnRateLimitStore` to reset rate limit state between tests:

```ts
import { describe, test, expect, beforeEach } from 'bun:test'
import { clearServerFnRateLimitStore } from '@ereo/rpc'
import { todosApi } from '../app/lib/api'

beforeEach(() => {
  clearServerFnRateLimitStore()
})

test('creates a todo', async () => {
  const todo = await todosApi.create('Test todo')
  expect(todo.title).toBe('Test todo')
})

test('enforces rate limits', async () => {
  // With max: 10, the 11th call should fail
  for (let i = 0; i < 10; i++) {
    await todosApi.delete(i)
  }
  await expect(todosApi.delete(11)).rejects.toThrow('RATE_LIMITED')
})
```

## Related

- [Server Functions API Reference](/api/rpc/server-block) — Full type definitions and config options
- [RPC Guide](/guides/rpc) — Typed procedures and router-based RPC
- [Middleware API](/api/rpc/middleware) — Built-in procedure middleware
- [Database Guide](/guides/database) — Database integration patterns
- [API Routes Guide](/guides/api-routes) — REST-style API routes
