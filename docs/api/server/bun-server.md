# BunServer

The HTTP server implementation built on Bun.

## Import

```ts
import { BunServer, createServer, serve } from '@ereo/server'
```

## createServer

Creates a new server instance.

### Signature

```ts
function createServer(options?: ServerOptions): BunServer
```

### Options

```ts
interface ServerOptions {
  /** Port to listen on (default: 3000) */
  port?: number
  /** Hostname to bind to (default: 'localhost') */
  hostname?: string
  /** Development mode (default: NODE_ENV !== 'production') */
  development?: boolean
  /** Static file serving options */
  static?: StaticOptions
  /** Enable request logging (default: true) */
  logging?: boolean
  /** Enable CORS - boolean or CorsOptions */
  cors?: boolean | CorsOptions
  /** Enable security headers - boolean or SecurityHeadersOptions */
  security?: boolean | SecurityHeadersOptions
  /** Custom request handler */
  handler?: (request: Request) => Response | Promise<Response>
  /** WebSocket handler */
  websocket?: WebSocketHandler
  /** TLS/HTTPS options */
  tls?: {
    cert: string
    key: string
  }
  /** Render mode: 'streaming' (default) or 'string' */
  renderMode?: 'streaming' | 'string'
  /** Base path for client assets (default: '/_ereo') */
  assetsPath?: string
  /** Client entry script path (default: '/_ereo/client.js') */
  clientEntry?: string
  /** Default shell template for SSR */
  shell?: ShellTemplate
}
```

### Example

```ts
import { createServer } from '@ereo/server'

const server = createServer({
  port: 3000,
  hostname: 'localhost',
  development: true,
})

await server.start()
```

## serve

Shorthand to create and start a server.

```ts
import { serve } from '@ereo/server'

const server = await serve({ port: 3000 })
// Server is running at http://localhost:3000
```

## BunServer Class

### Methods

| Method | Description |
|--------|-------------|
| `start()` | Start the server. Returns `Promise<Server>` |
| `stop()` | Stop the server |
| `reload()` | Reload server (for HMR in development) |
| `use(handler)` | Add middleware |
| `use(path, handler)` | Add middleware for specific path |
| `setApp(app)` | Set the EreoJS app instance |
| `setRouter(router)` | Set the file router |
| `getServer()` | Get the underlying Bun server instance |
| `getInfo()` | Get server info (port, hostname, development) |

### Example

```ts
const server = createServer({ port: 3000 })

await server.start()
console.log('Server running on port 3000')

// Later...
server.stop()
```

## HTTPS/TLS

```ts
const server = createServer({
  port: 443,
  hostname: 'localhost',
  tls: {
    key: './certs/key.pem',
    cert: './certs/cert.pem'
  }
})

await server.start()
// Server running at https://localhost:443
```

## Server Middleware

Add middleware at the server level:

```ts
import { createServer, logger, cors, securityHeaders } from '@ereo/server'

const server = createServer({ port: 3000 })

server.use(logger())
server.use(cors({ origin: '*' }))
server.use(securityHeaders())

// Path-specific middleware
server.use('/api/*', rateLimit({ max: 100 }))

await server.start()
```

## Static Files

Use `staticMiddleware` for serving static files as middleware:

```ts
import { createServer, staticMiddleware } from '@ereo/server'

const server = createServer({ port: 3000 })

server.use(staticMiddleware({
  root: './public',
  maxAge: 86400,
  index: 'index.html',
  // SPA fallback for client-side routing
  fallback: 'index.html',
}))

await server.start()
```

### StaticOptions

```ts
interface StaticOptions {
  /** Root directory for static files */
  root: string
  /** URL prefix (default: '/') */
  prefix?: string
  /** Max age for cache-control in seconds (default: 0 in dev, 31536000 in prod) */
  maxAge?: number
  /** Enable immutable caching for fingerprinted files (default: true) */
  immutable?: boolean
  /** Index file (default: 'index.html') */
  index?: string
  /** Enable directory listing (default: false) */
  listing?: boolean
  /** Fallback file for SPA routing */
  fallback?: string
  /** Enable image format negotiation (WebP/AVIF) based on Accept header (default: true) */
  negotiateImageFormat?: boolean
}
```

Alternatively, use `serveStatic` directly in server options:

```ts
const server = createServer({
  port: 3000,
  static: {
    root: './public',
    maxAge: 86400,
  }
})
```

## Related

- [Middleware](/api/server/middleware)
- [Streaming](/api/server/streaming)
- [Deployment](/deployment/bun)
