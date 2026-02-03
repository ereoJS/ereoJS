# Server Middleware

Middleware for the EreoJS server.

## Import

```ts
import type { MiddlewareHandler } from '@ereo/core'
```

## Signature

```ts
type MiddlewareHandler = (
  request: Request,
  next: () => Promise<Response>,
  context: RequestContext
) => Promise<Response> | Response
```

## Parameters

| Name | Type | Description |
|------|------|-------------|
| request | `Request` | The incoming HTTP request |
| next | `() => Promise<Response>` | Call to continue to next middleware/handler |
| context | `RequestContext` | Shared request context for storing data |

## Built-in Middleware

### CORS Middleware

```ts
import { cors } from '@ereo/server'

export default defineConfig({
  middleware: [
    cors({
      origin: ['https://example.com', 'https://app.example.com'],
      methods: ['GET', 'POST', 'PUT', 'DELETE'],
      credentials: true,
      maxAge: 86400
    })
  ]
})
```

### Compression Middleware

```ts
import { compression } from '@ereo/server'

export default defineConfig({
  middleware: [
    compression({
      threshold: 1024,  // Minimum size to compress
      level: 6          // Compression level (1-9)
    })
  ]
})
```

### Rate Limiting

```ts
import { rateLimit } from '@ereo/server'

export default defineConfig({
  middleware: [
    rateLimit({
      windowMs: 60 * 1000,  // 1 minute
      max: 100,              // 100 requests per window
      message: 'Too many requests'
    })
  ]
})
```

### Security Headers

```ts
import { securityHeaders } from '@ereo/server'

export default defineConfig({
  middleware: [
    securityHeaders({
      contentSecurityPolicy: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'"]
      },
      xFrameOptions: 'DENY',
      xContentTypeOptions: 'nosniff',
      referrerPolicy: 'strict-origin-when-cross-origin'
    })
  ]
})
```

## Custom Middleware

### Logging Middleware

```ts
const loggingMiddleware: MiddlewareHandler = async (request, next, context) => {
  const start = performance.now()
  const requestId = crypto.randomUUID()

  context.set('requestId', requestId)

  console.log(`→ ${request.method} ${request.url}`)

  const response = await next()

  const duration = performance.now() - start
  console.log(`← ${response.status} ${duration.toFixed(2)}ms`)

  return response
}
```

### Authentication Middleware

```ts
const authMiddleware: MiddlewareHandler = async (request, next, context) => {
  const token = request.headers.get('Authorization')?.replace('Bearer ', '')

  if (token) {
    try {
      const user = await verifyToken(token)
      context.set('user', user)
    } catch {
      // Invalid token - continue without user
    }
  }

  return next()
}
```

### Error Handling Middleware

```ts
const errorMiddleware: MiddlewareHandler = async (request, next, context) => {
  try {
    return await next()
  } catch (error) {
    console.error('Unhandled error:', error)

    if (error instanceof Response) {
      return error
    }

    return new Response('Internal Server Error', { status: 500 })
  }
}
```

### Request Timing

```ts
const timingMiddleware: MiddlewareHandler = async (request, next) => {
  const start = performance.now()
  const response = await next()
  const duration = performance.now() - start

  // Clone response to add header
  const newHeaders = new Headers(response.headers)
  newHeaders.set('Server-Timing', `total;dur=${duration.toFixed(2)}`)

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: newHeaders
  })
}
```

## Middleware Order

Middleware executes in order. Place error handling first:

```ts
export default defineConfig({
  middleware: [
    errorMiddleware,      // Catches errors from all below
    loggingMiddleware,    // Logs requests
    securityHeaders(),    // Adds security headers
    cors(),               // Handles CORS
    authMiddleware,       // Authenticates user
    rateLimit()           // Rate limits requests
  ]
})
```

## Route-Level Middleware

Apply middleware to specific routes:

```ts
// routes/api/admin/index.tsx
export const config = {
  middleware: [requireAdmin]
}

const requireAdmin: MiddlewareHandler = async (request, next, context) => {
  const user = context.get('user')

  if (!user || user.role !== 'admin') {
    return new Response('Forbidden', { status: 403 })
  }

  return next()
}
```

## Middleware Factories

Create configurable middleware:

```ts
function apiKey(options: { header?: string; keys: string[] }): MiddlewareHandler {
  const { header = 'X-API-Key', keys } = options

  return async (request, next) => {
    const key = request.headers.get(header)

    if (!key || !keys.includes(key)) {
      return Response.json(
        { error: 'Invalid API key' },
        { status: 401 }
      )
    }

    return next()
  }
}

// Usage
export const config = {
  middleware: [
    apiKey({ keys: [process.env.API_KEY!] })
  ]
}
```

## Related

- [Middleware Concepts](/core-concepts/middleware)
- [RequestContext](/api/core/context)
- [Authentication Guide](/guides/authentication)
