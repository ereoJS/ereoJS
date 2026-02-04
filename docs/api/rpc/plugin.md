# EreoJS Plugin

Integration plugin for EreoJS framework with automatic routing and WebSocket support.

## Import

```ts
import { rpcPlugin } from '@ereo/rpc'
import type {
  RPCPluginOptions,
  RPCPluginResult,
  BunWebSocketConfig,
  RPCPlugin,
} from '@ereo/rpc'
```

## rpcPlugin

Creates an EreoJS plugin for RPC integration.

### Signature

```ts
function rpcPlugin<T extends RouterDef>(
  options: RPCPluginOptions<T>
): RPCPluginResult
```

### Type Definitions

```ts
interface RPCPluginOptions<T extends RouterDef = RouterDef> {
  /** The router instance */
  router: Router<T>
  /** Endpoint path for HTTP and WebSocket (default: '/api/rpc') */
  endpoint?: string
}

interface RPCPluginResult extends RPCPlugin {
  /** Get WebSocket handler config for Bun.serve() */
  getWebSocketConfig(): BunWebSocketConfig<WSConnectionData>
  /** Upgrade a request to WebSocket */
  upgradeToWebSocket(server: any, request: Request, ctx: any): boolean
}

interface RPCPlugin {
  name: string
  runtimeMiddleware?: Array<
    (request: Request, context: any, next: () => Promise<Response>) => Response | Promise<Response>
  >
  virtualModules?: Record<string, string>
}
```

### Parameters

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `router` | `Router<T>` | Required | The RPC router instance |
| `endpoint` | `string` | `'/api/rpc'` | URL path for RPC requests |

### Returns

An `RPCPluginResult` with:
- `name` - Plugin name (`'@ereo/rpc'`)
- `runtimeMiddleware` - Middleware for HTTP request handling
- `virtualModules` - Virtual module for typed client
- `getWebSocketConfig()` - WebSocket handler configuration
- `upgradeToWebSocket()` - WebSocket upgrade helper

### Examples

#### Basic Setup

```ts
import { createRouter, rpcPlugin } from '@ereo/rpc'
import { createContext } from '@ereo/core'

const api = createRouter({
  health: procedure.query(() => ({ status: 'ok' })),
})

const rpc = rpcPlugin({
  router: api,
  endpoint: '/api/rpc',
})

Bun.serve({
  port: 3000,

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

#### With EreoJS Config

```ts
// ereo.config.ts
import { defineConfig } from '@ereo/core'
import { rpcPlugin } from '@ereo/rpc'
import { api } from './api/router'

export default defineConfig({
  plugins: [
    rpcPlugin({
      router: api,
      endpoint: '/api/rpc',
    }),
  ],
})
```

#### Custom Endpoint

```ts
const rpc = rpcPlugin({
  router: api,
  endpoint: '/rpc/v1',
})

// Requests go to /rpc/v1
// WebSocket upgrades at ws://host/rpc/v1
```

## getWebSocketConfig

Returns the WebSocket handler configuration for Bun.serve().

### Signature

```ts
getWebSocketConfig(): BunWebSocketConfig<WSConnectionData>
```

### Type Definitions

```ts
interface BunWebSocketConfig<T> {
  message: (ws: any, message: string | Buffer) => void | Promise<void>
  open?: (ws: any) => void | Promise<void>
  close?: (ws: any) => void | Promise<void>
  drain?: (ws: any) => void
}

interface WSConnectionData {
  subscriptions: Map<string, AbortController>
  ctx: any
  originalRequest?: Request
}
```

### Returns

WebSocket handler object with:
- `message` - Handles incoming messages (subscribe/unsubscribe/ping)
- `open` - Initializes subscription tracking on connect
- `close` - Cleans up subscriptions on disconnect

### Example

```ts
const rpc = rpcPlugin({ router: api })

Bun.serve({
  fetch(request, server) { /* ... */ },

  // Pass WebSocket config directly to Bun
  websocket: rpc.getWebSocketConfig(),
})
```

## upgradeToWebSocket

Upgrades an HTTP request to a WebSocket connection for subscriptions.

### Signature

```ts
upgradeToWebSocket(server: any, request: Request, ctx: any): boolean
```

### Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `server` | `any` | Bun server instance |
| `request` | `Request` | Incoming HTTP request |
| `ctx` | `any` | Application context |

### Returns

`true` if the request was upgraded to WebSocket, `false` otherwise.

### Behavior

1. Checks if request path matches the configured endpoint
2. Checks for `Upgrade: websocket` header
3. Creates `WSConnectionData` with context and empty subscription map
4. Calls `server.upgrade(request, { data })` to upgrade the connection
5. Returns `true` if upgrade was successful

### Example

```ts
const rpc = rpcPlugin({ router: api, endpoint: '/api/rpc' })

Bun.serve({
  fetch(request, server) {
    const ctx = createContext(request)

    // Check for WebSocket upgrade first
    if (rpc.upgradeToWebSocket(server, request, ctx)) {
      return undefined // Request was upgraded, no response needed
    }

    // Handle normal HTTP requests
    return handleRequest(request, ctx)
  },

  websocket: rpc.getWebSocketConfig(),
})
```

### WebSocket Authentication Pattern

When upgrading to WebSocket, the original HTTP request is preserved in `ws.data.originalRequest`. This enables authentication in subscription middleware.

#### How It Works

```ts
// During upgrade, the original request is stored
const data: WSConnectionData = {
  subscriptions: new Map(),
  ctx,
  originalRequest: request,  // Preserved for middleware access
}

server.upgrade(request, { data })
```

#### Accessing Auth in Subscriptions

Subscription middleware receives the original request, allowing access to cookies and auth headers:

```ts
// Session-based auth middleware
const sessionAuth = createAuthMiddleware(async (ctx) => {
  // ctx.request is the original HTTP upgrade request
  const cookies = ctx.request.headers.get('Cookie')
  const sessionId = cookies?.match(/session=([^;]+)/)?.[1]

  if (!sessionId) return null

  const session = await db.sessions.findUnique({
    where: { id: sessionId },
    include: { user: true },
  })

  if (!session || session.expiresAt < new Date()) return null
  return session.user
})

// Use in subscription
const protectedSubscription = procedure
  .use(sessionAuth)
  .subscription(async function* ({ user }) {
    // user is authenticated via session cookie
    for await (const event of userEvents.on(user.id)) {
      yield event
    }
  })
```

#### Cookie Behavior

**Same-origin requests:** Cookies are automatically included in WebSocket upgrade requests when:
- The WebSocket URL has the same origin as the page
- Cookies are set with appropriate `SameSite` policy

**Cross-origin requests:** Require explicit credential handling:

```ts
// Client-side: Include credentials
const ws = new WebSocket(wsUrl)
// Note: WebSocket API doesn't support credentials option directly
// Use the same origin or token-based auth for cross-origin

// Alternative: Token-based auth
const wsUrl = `wss://api.example.com/rpc?token=${authToken}`
```

#### Example: Token-Based Auth for WebSocket

```ts
// Server middleware
const tokenAuth = createAuthMiddleware(async (ctx) => {
  // Check Authorization header first (HTTP requests)
  let token = ctx.request.headers.get('Authorization')?.replace('Bearer ', '')

  // Fall back to query parameter (WebSocket upgrade)
  if (!token) {
    const url = new URL(ctx.request.url)
    token = url.searchParams.get('token')
  }

  if (!token) return null
  return verifyJWT(token)
})
```

### Manual WebSocket Upgrade

For more control, you can handle upgrades manually:

```ts
Bun.serve({
  fetch(request, server) {
    const url = new URL(request.url)
    const ctx = createContext(request)

    // Manual WebSocket handling
    if (
      url.pathname === '/api/rpc' &&
      request.headers.get('Upgrade')?.toLowerCase() === 'websocket'
    ) {
      const success = server.upgrade(request, {
        data: {
          subscriptions: new Map(),
          ctx,
          originalRequest: request,
        },
      })

      if (success) return undefined
      return new Response('WebSocket upgrade failed', { status: 500 })
    }

    // HTTP handling
    if (url.pathname === '/api/rpc') {
      return api.handler(request, ctx)
    }

    return new Response('Not Found', { status: 404 })
  },

  websocket: api.websocket,
})
```

## Virtual Modules

The plugin provides a virtual module for automatic client configuration.

### Module: `virtual:ereo-rpc-client`

```ts
// Generated virtual module content
import { createClient } from '@ereo/rpc/client'

const wsProtocol = typeof window !== 'undefined' && window.location.protocol === 'https:' ? 'wss:' : 'ws:'
const wsEndpoint = typeof window !== 'undefined'
  ? wsProtocol + '//' + window.location.host + '/api/rpc'
  : 'ws://localhost:3000/api/rpc'

export const rpc = createClient({
  httpEndpoint: '/api/rpc',
  wsEndpoint,
})
```

### Usage

```ts
// In your client code
import { rpc } from 'virtual:ereo-rpc-client'

// Fully configured client with automatic endpoint detection
const user = await rpc.users.me.query()
```

### TypeScript Support

For type safety, augment the virtual module:

```ts
// vite-env.d.ts or types.d.ts
declare module 'virtual:ereo-rpc-client' {
  import type { InferClient } from '@ereo/rpc'
  import type { Api } from './api/router'

  export const rpc: InferClient<Api['_def']>
}
```

## Runtime Middleware

The plugin includes runtime middleware for request routing.

### Behavior

1. Checks if request path matches the endpoint
2. For WebSocket upgrades, returns a 101 response with special header
3. For HTTP requests, delegates to the router handler
4. For non-matching requests, calls `next()` to continue

### Integration with EreoJS

```ts
// The middleware is automatically registered when using the plugin
const rpc = rpcPlugin({ router: api })

// Middleware function signature:
async function rpcMiddleware(
  request: Request,
  context: any,
  next: () => Promise<Response>
): Promise<Response> {
  const url = new URL(request.url)

  if (url.pathname === endpoint) {
    // Handle WebSocket upgrade request
    if (request.headers.get('Upgrade')?.toLowerCase() === 'websocket') {
      return new Response(null, {
        status: 101,
        headers: { 'X-Ereo-RPC-Upgrade': 'websocket' },
      })
    }

    // Handle HTTP request
    return router.handler(request, context)
  }

  return next()
}
```

## Complete Server Example

```ts
// server.ts
import { createContext } from '@ereo/core'
import { createRouter, rpcPlugin, procedure } from '@ereo/rpc'
import { z } from 'zod'

// Define router
const api = createRouter({
  health: procedure.query(() => ({ status: 'ok', time: Date.now() })),

  users: {
    me: authedProcedure.query(({ user }) => user),
    list: adminProcedure.query(async () => db.users.findMany()),
  },

  notifications: {
    onNew: authedProcedure.subscription(async function* ({ user }) {
      for await (const notification of notificationEvents.on(user.id)) {
        yield notification
      }
    }),
  },
})

export type Api = typeof api

// Create plugin
const rpc = rpcPlugin({
  router: api,
  endpoint: '/api/rpc',
})

// Start server
Bun.serve({
  port: process.env.PORT ?? 3000,

  fetch(request, server) {
    const ctx = createContext(request)

    // 1. Try WebSocket upgrade
    if (rpc.upgradeToWebSocket(server, request, ctx)) {
      return undefined
    }

    const url = new URL(request.url)

    // 2. Handle RPC endpoint
    if (url.pathname === '/api/rpc') {
      return api.handler(request, ctx)
    }

    // 3. Serve static files or other routes
    return serveStatic(request) ?? new Response('Not Found', { status: 404 })
  },

  websocket: rpc.getWebSocketConfig(),
})

console.log('Server running on http://localhost:3000')
```

## Related

- [Router](/api/rpc/router) - Creating routers
- [Client](/api/rpc/client) - Client proxy creation
- [Protocol](/api/rpc/protocol) - HTTP and WebSocket protocol
