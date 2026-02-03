# Router

The router combines procedures into a typed API with HTTP and WebSocket handlers.

## Import

```ts
import { createRouter, RPCError, errors } from '@ereo/rpc'
import type { Router, BunWebSocketHandler } from '@ereo/rpc'
```

## createRouter

Creates a router from a definition object containing procedures and nested routers.

### Signature

```ts
function createRouter<T extends RouterDef>(def: T): Router<T>
```

### Type Definitions

```ts
type RouterDef = {
  [key: string]: AnyProcedure | RouterDef
}

interface Router<T extends RouterDef> {
  _def: T
  handler: (request: Request, ctx: any) => Promise<Response>
  websocket: BunWebSocketHandler<WSConnectionData>
}

interface BunWebSocketHandler<T> {
  message: (ws: BunServerWebSocket<T>, message: string | Buffer) => void | Promise<void>
  open?: (ws: BunServerWebSocket<T>) => void | Promise<void>
  close?: (ws: BunServerWebSocket<T>) => void | Promise<void>
  drain?: (ws: BunServerWebSocket<T>) => void
}
```

### Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `def` | `RouterDef` | Object containing procedures and nested routers |

### Returns

A `Router` instance with:
- `_def` - The original definition (used for type inference)
- `handler` - HTTP request handler for queries and mutations
- `websocket` - WebSocket handler configuration for Bun

### Examples

#### Flat Router

```ts
const api = createRouter({
  health: procedure.query(() => ({ status: 'ok' })),

  getUser: procedure.query(
    z.object({ id: z.string() }),
    async ({ input }) => db.users.findUnique({ where: { id: input.id } })
  ),

  createUser: procedure.mutation(
    z.object({ name: z.string(), email: z.string().email() }),
    async ({ input }) => db.users.create({ data: input })
  ),
})
```

#### Nested Router

```ts
const api = createRouter({
  health: procedure.query(() => ({ status: 'ok' })),

  users: {
    list: procedure.query(async () => db.users.findMany()),

    get: procedure.query(
      z.object({ id: z.string() }),
      async ({ input }) => db.users.findUnique({ where: { id: input.id } })
    ),

    create: adminProcedure.mutation(
      z.object({ name: z.string(), email: z.string().email() }),
      async ({ input }) => db.users.create({ data: input })
    ),

    update: authedProcedure.mutation(
      z.object({
        id: z.string(),
        name: z.string().optional(),
        email: z.string().email().optional(),
      }),
      async ({ input, user }) => {
        // Only allow users to update their own profile
        if (input.id !== user.id) throw errors.forbidden()
        return db.users.update({ where: { id: input.id }, data: input })
      }
    ),
  },

  posts: {
    list: procedure.query(async () => db.posts.findMany({ orderBy: { createdAt: 'desc' } })),

    create: authedProcedure.mutation(
      z.object({ title: z.string(), content: z.string() }),
      async ({ input, user }) => db.posts.create({ data: { ...input, authorId: user.id } })
    ),

    // Real-time subscription
    onCreated: authedProcedure.subscription(async function* () {
      for await (const post of postEvents.on('created')) {
        yield post
      }
    }),
  },
})

export type Api = typeof api
```

#### Deeply Nested Router

```ts
const api = createRouter({
  v1: {
    public: {
      health: procedure.query(() => ({ status: 'ok', version: '1.0.0' })),
    },

    admin: {
      users: {
        list: adminProcedure.query(async () => db.users.findMany()),
        ban: superAdminProcedure.mutation(
          z.object({ userId: z.string() }),
          async ({ input }) => db.users.update({
            where: { id: input.userId },
            data: { banned: true },
          })
        ),
      },

      analytics: {
        daily: adminProcedure.query(async () => getAnalytics('daily')),
        weekly: adminProcedure.query(async () => getAnalytics('weekly')),
      },
    },
  },
})

// Client usage: rpc.v1.admin.users.list.query()
```

## Router.handler

The HTTP request handler for queries and mutations.

### Signature

```ts
handler: (request: Request, ctx: any) => Promise<Response>
```

### Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `request` | `Request` | The incoming HTTP request |
| `ctx` | `any` | Application context (from `@ereo/core`) |

### Returns

A `Response` with JSON body.

### Example

```ts
const api = createRouter({ /* ... */ })

Bun.serve({
  fetch(request, server) {
    const ctx = createContext(request)
    const url = new URL(request.url)

    if (url.pathname === '/api/rpc') {
      return api.handler(request, ctx)
    }

    return new Response('Not Found', { status: 404 })
  },
})
```

### Request Formats

#### GET Request (Queries)

```
GET /api/rpc?path=users.get&input={"id":"123"}
```

Query parameters:
- `path` - Dot-separated procedure path
- `input` - JSON-encoded input (optional)

#### POST Request (Queries and Mutations)

```
POST /api/rpc
Content-Type: application/json

{
  "path": ["users", "create"],
  "type": "mutation",
  "input": { "name": "Alice", "email": "alice@example.com" }
}
```

Body fields:
- `path` - Array of path segments
- `type` - `"query"` or `"mutation"`
- `input` - Input data (optional)

### Response Format

```ts
// Success
{ "ok": true, "data": { /* procedure result */ } }

// Error
{ "ok": false, "error": { "code": "ERROR_CODE", "message": "Error message", "details": { /* optional */ } } }
```

## Router.websocket

The WebSocket handler configuration for subscriptions.

### Type Definition

```ts
websocket: BunWebSocketHandler<WSConnectionData>

interface WSConnectionData {
  subscriptions: Map<string, AbortController>
  ctx: any
  originalRequest?: Request
}
```

### Example

```ts
const api = createRouter({ /* ... */ })

Bun.serve({
  fetch(request, server) {
    // WebSocket upgrade
    if (request.headers.get('Upgrade') === 'websocket') {
      const ctx = createContext(request)
      const success = server.upgrade(request, {
        data: {
          subscriptions: new Map(),
          ctx,
          originalRequest: request,
        },
      })
      if (success) return undefined
    }

    // HTTP handling...
  },

  websocket: api.websocket,
})
```

## RPCError

Custom error class for throwing typed errors from procedures.

### Signature

```ts
class RPCError extends Error {
  constructor(
    public code: string,
    message: string,
    public status: number = 400
  )
}
```

### Properties

| Property | Type | Description |
|----------|------|-------------|
| `code` | `string` | Machine-readable error code |
| `message` | `string` | Human-readable error message |
| `status` | `number` | HTTP status code (default: 400) |

### Example

```ts
import { RPCError } from '@ereo/rpc'

const getPost = procedure.query(
  z.object({ id: z.string() }),
  async ({ input }) => {
    const post = await db.posts.findUnique({ where: { id: input.id } })

    if (!post) {
      throw new RPCError('POST_NOT_FOUND', `Post with ID ${input.id} not found`, 404)
    }

    return post
  }
)
```

## errors

Factory functions for common error types.

### Signature

```ts
const errors: {
  unauthorized: (message?: string) => RPCError
  forbidden: (message?: string) => RPCError
  notFound: (message?: string) => RPCError
  badRequest: (message: string) => RPCError
}
```

### Methods

#### errors.unauthorized()

Creates a 401 Unauthorized error.

```ts
errors.unauthorized(message = 'Unauthorized'): RPCError
```

```ts
if (!user) {
  throw errors.unauthorized('Please log in to continue')
}
```

#### errors.forbidden()

Creates a 403 Forbidden error.

```ts
errors.forbidden(message = 'Forbidden'): RPCError
```

```ts
if (user.role !== 'admin') {
  throw errors.forbidden('Admin access required')
}
```

#### errors.notFound()

Creates a 404 Not Found error.

```ts
errors.notFound(message = 'Not found'): RPCError
```

```ts
const post = await db.posts.findUnique({ where: { id } })
if (!post) {
  throw errors.notFound('Post not found')
}
```

#### errors.badRequest()

Creates a 400 Bad Request error.

```ts
errors.badRequest(message: string): RPCError
```

```ts
if (endDate < startDate) {
  throw errors.badRequest('End date must be after start date')
}
```

### Custom Error Codes

For application-specific errors, use `RPCError` directly:

```ts
// Rate limited
throw new RPCError('RATE_LIMITED', 'Too many requests. Please try again later.', 429)

// Payment required
throw new RPCError('PAYMENT_REQUIRED', 'Subscription required for this feature', 402)

// Conflict
throw new RPCError('EMAIL_TAKEN', 'This email address is already registered', 409)

// Unprocessable
throw new RPCError('INVALID_FILE_TYPE', 'Only PNG and JPG files are allowed', 422)

// Service unavailable
throw new RPCError('SERVICE_UNAVAILABLE', 'Database is temporarily unavailable', 503)
```

## Error Codes

The router uses these built-in error codes:

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `PARSE_ERROR` | 400 | Invalid JSON in request |
| `NOT_FOUND` | 404 | Procedure not found |
| `METHOD_NOT_ALLOWED` | 400 | Subscription via HTTP |
| `METHOD_MISMATCH` | 400 | Query/mutation type mismatch |
| `VALIDATION_ERROR` | 400 | Input validation failed |
| `INTERNAL_ERROR` | 500 | Unexpected server error |
| `UNAUTHORIZED` | 401 | Authentication required |
| `FORBIDDEN` | 403 | Insufficient permissions |
| `RATE_LIMITED` | 429 | Too many requests |
| `SUBSCRIPTION_ERROR` | 400 | Subscription-related error |
| `DUPLICATE_ID` | 400 | Subscription ID already in use |

## Error Handling in Handlers

```ts
const riskyOperation = procedure.mutation(async () => {
  try {
    await externalService.call()
    return { success: true }
  } catch (error) {
    // Log the full error internally
    console.error('External service failed:', error)

    // Return a safe error to the client
    throw new RPCError(
      'SERVICE_ERROR',
      'An external service is currently unavailable',
      503
    )
  }
})
```

## Server Integration

### Basic Bun Server

```ts
import { createRouter } from '@ereo/rpc'
import { createContext } from '@ereo/core'

const api = createRouter({ /* ... */ })

Bun.serve({
  port: 3000,

  fetch(request, server) {
    const url = new URL(request.url)
    const ctx = createContext(request)

    // Handle WebSocket upgrade
    if (url.pathname === '/api/rpc' && request.headers.get('Upgrade') === 'websocket') {
      const success = server.upgrade(request, {
        data: { subscriptions: new Map(), ctx, originalRequest: request },
      })
      if (success) return undefined
    }

    // Handle RPC requests
    if (url.pathname === '/api/rpc') {
      return api.handler(request, ctx)
    }

    return new Response('Not Found', { status: 404 })
  },

  websocket: api.websocket,
})
```

### With EreoJS Plugin

```ts
import { rpcPlugin } from '@ereo/rpc'

const rpc = rpcPlugin({ router: api, endpoint: '/api/rpc' })

Bun.serve({
  fetch(request, server) {
    const ctx = createContext(request)

    // Handle WebSocket upgrade
    if (rpc.upgradeToWebSocket(server, request, ctx)) {
      return undefined
    }

    // Handle HTTP
    const url = new URL(request.url)
    if (url.pathname === '/api/rpc') {
      return api.handler(request, ctx)
    }

    return new Response('Not Found', { status: 404 })
  },

  websocket: rpc.getWebSocketConfig(),
})
```

## Type Inference

The router preserves full type information for client inference:

```ts
// server
export const api = createRouter({
  users: {
    get: procedure.query(
      z.object({ id: z.string() }),
      async ({ input }): Promise<User | null> => {
        return db.users.findUnique({ where: { id: input.id } })
      }
    ),
  },
})

export type Api = typeof api

// client
import type { Api } from './server'
const rpc = createClient<Api>({ httpEndpoint: '/api/rpc' })

// Fully typed!
const user = await rpc.users.get.query({ id: '123' })
// user is typed as User | null
```

## Related

- [Procedure Builder](/api/rpc/procedure) - Creating typed procedures
- [Client](/api/rpc/client) - Type-safe client proxy
- [Plugin](/api/rpc/plugin) - EreoJS plugin integration
- [Protocol](/api/rpc/protocol) - HTTP and WebSocket protocol specification
