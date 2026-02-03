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
function createServer(app: EreoApp, options?: ServerOptions): BunServer
```

### Options

```ts
interface ServerOptions {
  port?: number
  host?: string
  https?: {
    key: string
    cert: string
  }
}
```

### Example

```ts
import { createApp } from '@ereo/core'
import { createServer } from '@ereo/server'

const app = createApp()
// ... configure app

const server = createServer(app, {
  port: 3000,
  host: 'localhost'
})

server.listen()
```

## serve

Shorthand to create and start a server.

```ts
import { serve } from '@ereo/server'

await serve(app, { port: 3000 })
// Server is running
```

## BunServer Class

### Methods

| Method | Description |
|--------|-------------|
| `listen(port?, callback?)` | Start listening |
| `close()` | Stop the server |
| `reload()` | Reload server (dev) |

### Example

```ts
const server = createServer(app)

server.listen(3000, () => {
  console.log('Server running on port 3000')
})

// Later...
server.close()
```

## HTTPS

```ts
const server = createServer(app, {
  port: 443,
  https: {
    key: './certs/key.pem',
    cert: './certs/cert.pem'
  }
})
```

## Server Middleware

Add middleware at the server level:

```ts
import { createServer, logger, cors, securityHeaders } from '@ereo/server'

const server = createServer(app)

server.use(logger())
server.use(cors({ origin: '*' }))
server.use(securityHeaders())
```

## Static Files

```ts
import { serveStatic } from '@ereo/server'

server.use(serveStatic('./public', {
  maxAge: 86400,
  index: 'index.html'
}))
```

## Related

- [Middleware](/api/server/middleware)
- [Streaming](/api/server/streaming)
- [Deployment](/deployment/bun)
