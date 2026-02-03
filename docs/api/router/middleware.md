# Router Middleware

Middleware for processing requests before they reach route handlers.

## Import

```ts
import {
  registerMiddleware,
  getMiddleware,
  hasMiddleware,
  unregisterMiddleware,
  clearMiddlewareRegistry,
  composeMiddleware,
  when,
  method,
  path,
  createLoggerMiddleware,
  createCorsMiddleware,
  createRateLimitMiddleware
} from '@ereo/router'
```

## registerMiddleware

Registers named middleware globally.

```ts
registerMiddleware('auth', async (request, next) => {
  const user = await getUser(request)
  if (!user) return Response.redirect('/login')
  return next()
})

registerMiddleware('admin', async (request, next, context) => {
  const user = context.get('user')
  if (!user?.isAdmin) {
    return new Response('Forbidden', { status: 403 })
  }
  return next()
})
```

## Using Named Middleware

Reference in route config:

```tsx
// routes/admin/index.tsx
export const config = {
  middleware: ['auth', 'admin']
}
```

Or in middleware files:

```tsx
// routes/admin/_middleware.ts
export const middleware = ['auth', 'admin']
```

## composeMiddleware

Combines multiple middleware into one:

```ts
const combined = composeMiddleware(
  loggingMiddleware,
  authMiddleware,
  rateLimitMiddleware
)

export const middleware = combined
```

## Conditional Middleware

### when

Apply middleware conditionally:

```ts
const middleware = when(
  (request) => request.method === 'POST',
  csrfMiddleware
)
```

### method

Apply middleware for specific HTTP methods:

```ts
const middleware = method(['POST', 'PUT', 'DELETE'], csrfMiddleware)
```

### path

Apply middleware for specific paths:

```ts
const middleware = path('/api/*', apiMiddleware)
```

## Built-in Middleware

### Logger

```ts
import { createLoggerMiddleware } from '@ereo/router'

const logger = createLoggerMiddleware()
registerMiddleware('logger', logger)
```

### CORS

```ts
import { createCorsMiddleware } from '@ereo/router'

const cors = createCorsMiddleware({
  origin: ['https://example.com'],
  methods: ['GET', 'POST'],
  credentials: true
})
registerMiddleware('cors', cors)
```

### Rate Limiting

```ts
import { createRateLimitMiddleware } from '@ereo/router'

const rateLimit = createRateLimitMiddleware({
  windowMs: 60000,  // 1 minute
  max: 100,         // 100 requests per minute
  keyGenerator: (req) => req.headers.get('X-Forwarded-For') || 'anonymous'
})
registerMiddleware('rateLimit', rateLimit)
```

## Middleware Signature

```ts
type MiddlewareHandler = (
  request: Request,
  next: () => Promise<Response>,
  context: RequestContext
) => Response | Promise<Response>
```

## Example Middleware

### Authentication

```ts
registerMiddleware('auth', async (request, next, context) => {
  const token = request.headers.get('Authorization')?.replace('Bearer ', '')

  if (!token) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const user = await verifyToken(token)
  context.set('user', user)

  return next()
})
```

### Request Timing

```ts
registerMiddleware('timing', async (request, next) => {
  const start = Date.now()
  const response = await next()
  const duration = Date.now() - start

  response.headers.set('X-Response-Time', `${duration}ms`)
  return response
})
```

## Related

- [Middleware Concepts](/core-concepts/middleware)
- [RequestContext](/api/core/context)
