# Middleware

Middleware lets you run code before a request is handled by your route. Use it for authentication, logging, rate limiting, headers manipulation, and other cross-cutting concerns.

## Basic Middleware

Middleware is a function that receives a request and a `next` function:

```tsx
import type { MiddlewareHandler } from '@ereo/router'

export const middleware: MiddlewareHandler = async (request, next) => {
  console.log(`${request.method} ${request.url}`)

  // Call next() to continue to the route handler
  const response = await next()

  console.log(`Response: ${response.status}`)
  return response
}
```

## Route-Level Middleware

Add middleware to specific routes with a `_middleware.ts` file:

```
routes/
├── _middleware.ts        # Applies to all routes
├── index.tsx
├── dashboard/
│   ├── _middleware.ts    # Applies to /dashboard/*
│   └── index.tsx
└── api/
    ├── _middleware.ts    # Applies to /api/*
    └── users.ts
```

```tsx
// routes/dashboard/_middleware.ts
import type { MiddlewareHandler } from '@ereo/router'

export const middleware: MiddlewareHandler = async (request, next) => {
  const user = await getUser(request)

  if (!user) {
    return Response.redirect('/login')
  }

  return next()
}
```

## Named Middleware

Register middleware globally and reference by name:

```tsx
// src/middleware/index.ts
import { registerMiddleware } from '@ereo/router'

registerMiddleware('auth', async (request, next) => {
  const user = await getUser(request)
  if (!user) return Response.redirect('/login')
  return next()
})

registerMiddleware('admin', async (request, next) => {
  const user = await getUser(request)
  if (!user?.isAdmin) return new Response('Forbidden', { status: 403 })
  return next()
})

registerMiddleware('logger', async (request, next) => {
  const start = Date.now()
  const response = await next()
  console.log(`${request.method} ${request.url} - ${Date.now() - start}ms`)
  return response
})
```

Use in route config:

```tsx
// routes/admin/index.tsx
export const config = {
  middleware: ['auth', 'admin', 'logger']
}

export default function AdminDashboard() {
  return <h1>Admin Dashboard</h1>
}
```

## Composing Middleware

Combine multiple middleware handlers:

```tsx
import { composeMiddleware } from '@ereo/router'

const withAuth = async (request, next) => {
  const user = await getUser(request)
  if (!user) return Response.redirect('/login')
  return next()
}

const withLogging = async (request, next) => {
  console.log(`${request.method} ${request.url}`)
  return next()
}

// Combine into a single middleware
export const middleware = composeMiddleware(withLogging, withAuth)
```

## Conditional Middleware

Apply middleware based on conditions:

```tsx
import { when, method, path } from '@ereo/router'

// Only run for POST requests
export const middleware = method('POST', async (request, next) => {
  // Validate CSRF token
  const token = request.headers.get('X-CSRF-Token')
  if (!validateCsrf(token)) {
    return new Response('Invalid CSRF token', { status: 403 })
  }
  return next()
})

// Only run for specific paths
export const apiMiddleware = path('/api/*', async (request, next) => {
  // Add CORS headers
  const response = await next()
  response.headers.set('Access-Control-Allow-Origin', '*')
  return response
})

// Conditional based on request
export const conditionalMiddleware = when(
  (request) => request.headers.get('X-Api-Key') !== null,
  async (request, next) => {
    // API key authentication
    return next()
  }
)
```

## Built-In Middleware

EreoJS provides common middleware out of the box:

### CORS

```tsx
import { createCorsMiddleware } from '@ereo/router'

export const middleware = createCorsMiddleware({
  origin: ['https://example.com', 'https://app.example.com'],
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
  maxAge: 86400
})
```

### Rate Limiting

```tsx
import { createRateLimitMiddleware } from '@ereo/router'

export const middleware = createRateLimitMiddleware({
  windowMs: 60 * 1000,  // 1 minute
  max: 100,             // 100 requests per minute
  keyGenerator: (request) => {
    // Rate limit by IP or user
    return request.headers.get('X-Forwarded-For') || 'anonymous'
  },
  handler: (request) => {
    return new Response('Too many requests', { status: 429 })
  }
})
```

### Logging

```tsx
import { createLoggerMiddleware } from '@ereo/router'

export const middleware = createLoggerMiddleware({
  format: ':method :url :status :response-time ms',
  skip: (request) => request.url.includes('/health')
})
```

## Middleware Chain Execution

Middleware executes in order, wrapping around the route handler:

```
Request
    │
    ▼
┌─────────────┐
│ Middleware 1│ ─┐
└─────────────┘  │
    │            │
    ▼            │
┌─────────────┐  │
│ Middleware 2│ ─┤
└─────────────┘  │
    │            │
    ▼            │
┌─────────────┐  │
│ Route       │  │
│ Handler     │  │
└─────────────┘  │
    │            │
    ▼            │
  Response ◄─────┘
```

```tsx
// Middleware 1
const first: MiddlewareHandler = async (request, next) => {
  console.log('1. Before')
  const response = await next()
  console.log('4. After')
  return response
}

// Middleware 2
const second: MiddlewareHandler = async (request, next) => {
  console.log('2. Before')
  const response = await next()
  console.log('3. After')
  return response
}

// Output:
// 1. Before
// 2. Before
// [Route Handler]
// 3. After
// 4. After
```

## Passing Data to Routes

Use the request context to pass data from middleware to routes:

```tsx
// Middleware
export const middleware: MiddlewareHandler = async (request, next, context) => {
  const user = await getUser(request)
  context.set('user', user)
  return next()
}

// Route
export const loader = createLoader(async ({ context }) => {
  const user = context.get('user')
  return { user }
})
```

## Modifying Responses

Middleware can modify responses:

```tsx
export const middleware: MiddlewareHandler = async (request, next) => {
  const response = await next()

  // Add security headers
  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set('X-Frame-Options', 'DENY')
  response.headers.set('X-XSS-Protection', '1; mode=block')

  return response
}
```

## Short-Circuiting

Return a response directly to skip remaining middleware and the route:

```tsx
export const middleware: MiddlewareHandler = async (request, next) => {
  // Maintenance mode
  if (process.env.MAINTENANCE_MODE === 'true') {
    return new Response('Site under maintenance', {
      status: 503,
      headers: { 'Retry-After': '3600' }
    })
  }

  return next()
}
```

## Error Handling

Handle errors in middleware:

```tsx
export const middleware: MiddlewareHandler = async (request, next) => {
  try {
    return await next()
  } catch (error) {
    console.error('Route error:', error)

    if (error instanceof Response) {
      return error
    }

    return new Response('Internal Server Error', { status: 500 })
  }
}
```

## Type-Safe Middleware

Use typed middleware for better type safety:

```tsx
import { createMiddleware } from '@ereo/router'

interface AuthContext {
  user: { id: string; email: string }
}

export const authMiddleware = createMiddleware<AuthContext>(
  async (request, next, context) => {
    const user = await getUser(request)
    if (!user) return Response.redirect('/login')

    context.set('user', user)
    return next()
  }
)
```

## Server Middleware

Apply middleware at the server level for all routes:

```tsx
// src/index.ts
import { createApp } from '@ereo/core'
import { createServer, logger, cors, securityHeaders } from '@ereo/server'

const app = createApp()

app.middleware(logger())
app.middleware(cors({ origin: '*' }))
app.middleware(securityHeaders())

const server = createServer(app)
```

## Common Patterns

### Authentication

```tsx
export const middleware: MiddlewareHandler = async (request, next, context) => {
  const token = request.headers.get('Authorization')?.replace('Bearer ', '')

  if (!token) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const user = await verifyToken(token)
    context.set('user', user)
    return next()
  } catch {
    return Response.json({ error: 'Invalid token' }, { status: 401 })
  }
}
```

### Request Validation

```tsx
export const middleware: MiddlewareHandler = async (request, next) => {
  if (request.method === 'POST') {
    const contentType = request.headers.get('Content-Type')

    if (!contentType?.includes('application/json')) {
      return Response.json(
        { error: 'Content-Type must be application/json' },
        { status: 415 }
      )
    }
  }

  return next()
}
```

### Caching

```tsx
export const middleware: MiddlewareHandler = async (request, next) => {
  // Only cache GET requests
  if (request.method !== 'GET') {
    return next()
  }

  const cacheKey = request.url
  const cached = await cache.get(cacheKey)

  if (cached) {
    return new Response(cached.body, cached.init)
  }

  const response = await next()

  // Cache successful responses
  if (response.status === 200) {
    const body = await response.clone().text()
    await cache.set(cacheKey, { body, init: { headers: response.headers } })
  }

  return response
}
```
