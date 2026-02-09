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
  context: AppContext,
  next: NextFunction
) => Promise<Response> | Response
```

## Parameters

| Name | Type | Description |
|------|------|-------------|
| request | `Request` | The incoming HTTP request |
| context | `AppContext` | Shared request context for storing data (implemented by `RequestContext`) |
| next | `NextFunction` | Call to continue to next middleware/handler |

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

### CorsOptions

```ts
interface CorsOptions {
  /** Allowed origins - string, array, or function for dynamic validation */
  origin?: string | string[] | ((origin: string) => boolean)
  /** Allowed HTTP methods (default: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS']) */
  methods?: string[]
  /** Allowed request headers (default: ['Content-Type', 'Authorization']) */
  allowedHeaders?: string[]
  /** Headers exposed to the client */
  exposedHeaders?: string[]
  /** Allow credentials (default: false) */
  credentials?: boolean
  /** Preflight cache max age in seconds (default: 86400) */
  maxAge?: number
}
```

#### Dynamic Origin Validation

```ts
cors({
  origin: (requestOrigin) => {
    // Allow any subdomain of example.com
    return requestOrigin.endsWith('.example.com')
  },
  credentials: true
})
```

### Compression Middleware

Uses Bun's built-in gzip compression for text-based content (HTML, JSON, JavaScript, CSS).

```ts
import { compress } from '@ereo/server'

export default defineConfig({
  middleware: [
    compress()
  ]
})
```

The middleware automatically compresses responses when:
- The client accepts gzip encoding (`Accept-Encoding: gzip`)
- The content type is text-based (`text/*`, `application/json`, `application/javascript`)

### Rate Limiting

```ts
import { rateLimit } from '@ereo/server'

export default defineConfig({
  middleware: [
    rateLimit({
      windowMs: 60 * 1000,  // 1 minute window (default: 60000)
      max: 100,              // Max requests per window (default: 100)
      keyGenerator: (request) => {
        // Custom key for rate limiting (default: X-Forwarded-For IP)
        return request.headers.get('X-API-Key') || 'anonymous'
      }
    })
  ]
})
```

### RateLimitOptions

```ts
interface RateLimitOptions {
  /** Time window in milliseconds (default: 60000) */
  windowMs?: number
  /** Max requests per window (default: 100) */
  max?: number
  /** Custom function to generate rate limit key from request */
  keyGenerator?: (request: Request) => string
}
```

When rate limited, returns a `429 Too Many Requests` response with:
- `Retry-After` header indicating seconds until reset
- `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset` headers

### Security Headers

```ts
import { securityHeaders } from '@ereo/server'

export default defineConfig({
  middleware: [
    securityHeaders({
      // CSP as a string (default: "default-src 'self'")
      contentSecurityPolicy: "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'",
      // Or disable CSP
      // contentSecurityPolicy: false,
      xFrameOptions: 'DENY',           // 'DENY' | 'SAMEORIGIN' | false (default: 'SAMEORIGIN')
      xContentTypeOptions: true,        // Adds 'nosniff' (default: true)
      referrerPolicy: 'strict-origin-when-cross-origin',  // Or false to disable
      permissionsPolicy: 'camera=(), microphone=()'       // Or false to disable
    })
  ]
})
```

### SecurityHeadersOptions

```ts
interface SecurityHeadersOptions {
  /** Content-Security-Policy header value (string) or false to disable */
  contentSecurityPolicy?: string | false
  /** X-Frame-Options: 'DENY', 'SAMEORIGIN', or false (default: 'SAMEORIGIN') */
  xFrameOptions?: 'DENY' | 'SAMEORIGIN' | false
  /** Add X-Content-Type-Options: nosniff (default: true) */
  xContentTypeOptions?: boolean
  /** Referrer-Policy header value or false to disable */
  referrerPolicy?: string | false
  /** Permissions-Policy header value or false to disable */
  permissionsPolicy?: string | false
}
```

## Custom Middleware

### Logging Middleware

```ts
const loggingMiddleware: MiddlewareHandler = async (request, context, next) => {
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
const authMiddleware: MiddlewareHandler = async (request, context, next) => {
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
const errorMiddleware: MiddlewareHandler = async (request, context, next) => {
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
const timingMiddleware: MiddlewareHandler = async (request, context, next) => {
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

const requireAdmin: MiddlewareHandler = async (request, context, next) => {
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

  return async (request, context, next) => {
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

- [Middleware Concepts](/concepts/middleware)
- [RequestContext](/api/core/context)
- [Authentication Guide](/guides/authentication)
