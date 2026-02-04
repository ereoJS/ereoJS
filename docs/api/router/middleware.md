# Router Middleware

Middleware for processing requests before they reach route handlers.

## Import

```ts
import {
  // Registry functions
  registerMiddleware,
  getMiddleware,
  hasMiddleware,
  unregisterMiddleware,
  clearMiddlewareRegistry,
  resolveMiddleware,

  // Execution
  executeMiddlewareChain,
  createMiddlewareExecutor,
  composeMiddleware,

  // Conditional middleware
  when,
  method,
  path,
  globToRegex,

  // Built-in middleware
  createLoggerMiddleware,
  createCorsMiddleware,
  createRateLimitMiddleware
} from '@ereo/router'
```

## Middleware Signature

```ts
type MiddlewareHandler = (
  request: Request,
  context: AppContext,
  next: NextFunction
) => Response | Promise<Response>
```

Note: The signature is `(request, context, next)` - context comes before next.

## registerMiddleware

Registers a named middleware in the global registry.

```ts
function registerMiddleware(name: string, handler: MiddlewareHandler): void
```

```ts
registerMiddleware('auth', async (request, context, next) => {
  const user = await getUser(request)
  if (!user) {
    return new Response('Unauthorized', { status: 401 })
  }
  context.set('user', user)
  return next()
})

registerMiddleware('admin', async (request, context, next) => {
  const user = context.get('user')
  if (!user?.isAdmin) {
    return new Response('Forbidden', { status: 403 })
  }
  return next()
})
```

## getMiddleware

Get a named middleware from the registry.

```ts
function getMiddleware(name: string): MiddlewareHandler | undefined
```

```ts
const authMiddleware = getMiddleware('auth')
if (authMiddleware) {
  // Use the middleware
}
```

## hasMiddleware

Check if a named middleware exists in the registry.

```ts
function hasMiddleware(name: string): boolean
```

```ts
if (hasMiddleware('auth')) {
  console.log('Auth middleware is registered')
}
```

## unregisterMiddleware

Remove a named middleware from the registry.

```ts
function unregisterMiddleware(name: string): boolean
```

```ts
const removed = unregisterMiddleware('auth')
console.log('Removed:', removed)  // true if existed
```

## clearMiddlewareRegistry

Clear all named middleware from the registry.

```ts
function clearMiddlewareRegistry(): void
```

```ts
// Useful for testing
clearMiddlewareRegistry()
```

## resolveMiddleware

Resolve a middleware reference to a handler function. String references are looked up in the registry.

```ts
function resolveMiddleware(
  reference: MiddlewareReference
): MiddlewareHandler | undefined
```

```ts
// Resolves string reference from registry
const handler1 = resolveMiddleware('auth')

// Returns function as-is
const handler2 = resolveMiddleware(myMiddleware)
```

## executeMiddlewareChain

Execute a middleware chain with the given options.

```ts
interface MiddlewareChainOptions {
  request: Request
  context: AppContext
  finalHandler: NextFunction
  onError?: (error: Error) => Response | Promise<Response>
}

async function executeMiddlewareChain(
  middleware: MiddlewareReference[],
  options: MiddlewareChainOptions
): Promise<Response>
```

```ts
const response = await executeMiddlewareChain(
  ['csrf', 'auth', customMiddleware],
  {
    request,
    context,
    finalHandler: async () => {
      return renderRoute()
    },
    onError: (error) => {
      return new Response(error.message, { status: 500 })
    }
  }
)
```

## createMiddlewareExecutor

Create a middleware chain executor bound to a route config.

```ts
function createMiddlewareExecutor(config: RouteConfig): (
  options: MiddlewareChainOptions
) => Promise<Response>
```

```ts
const executor = createMiddlewareExecutor(routeConfig)
const response = await executor({
  request,
  context,
  finalHandler: () => renderRoute()
})
```

## composeMiddleware

Combines multiple middleware handlers into a single handler.

```ts
function composeMiddleware(...handlers: MiddlewareHandler[]): MiddlewareHandler
```

```ts
const combined = composeMiddleware(
  loggingMiddleware,
  authMiddleware,
  rateLimitMiddleware
)

registerMiddleware('protected', combined)
```

## Conditional Middleware

### when

Apply middleware conditionally based on a predicate.

```ts
function when(
  predicate: (request: Request, context: AppContext) => boolean | Promise<boolean>,
  middleware: MiddlewareHandler
): MiddlewareHandler
```

```ts
const csrfProtection = when(
  (request) => request.method === 'POST',
  csrfMiddleware
)

// Async predicates are supported
const adminOnly = when(
  async (request, context) => {
    const user = context.get('user')
    return user?.role === 'admin'
  },
  adminMiddleware
)
```

### method

Apply middleware for specific HTTP methods.

```ts
function method(
  methods: string | string[],
  middleware: MiddlewareHandler
): MiddlewareHandler
```

```ts
const writeProtection = method(
  ['POST', 'PUT', 'DELETE'],
  csrfMiddleware
)
```

### path

Apply middleware for specific path patterns. Supports strings, globs, and RegExp.

```ts
function path(
  patterns: string | string[] | RegExp | RegExp[],
  middleware: MiddlewareHandler
): MiddlewareHandler
```

```ts
// Exact path match
const adminMiddleware = path('/admin', adminAuthMiddleware)

// Glob pattern (/* matches any single segment)
const apiMiddleware = path('/api/*', apiAuthMiddleware)

// Multiple patterns
const protectedMiddleware = path(
  ['/admin/*', '/dashboard/*'],
  authMiddleware
)

// RegExp pattern
const dynamicMiddleware = path(
  /^\/users\/\d+$/,
  userMiddleware
)

// Mixed patterns
const mixedMiddleware = path(
  ['/api/*', /^\/v\d+\//],
  versionMiddleware
)
```

### globToRegex

Convert a glob pattern to a RegExp. Supports `*` (match anything except `/`) and `**` (match anything including `/`).

```ts
function globToRegex(glob: string): RegExp
```

```ts
const regex = globToRegex('/api/**')
regex.test('/api/users')     // true
regex.test('/api/users/123') // true
```

## Built-in Middleware

### createLoggerMiddleware

Create a logging middleware.

```ts
function createLoggerMiddleware(options?: {
  includeBody?: boolean
  includeHeaders?: string[]
}): MiddlewareHandler
```

```ts
const logger = createLoggerMiddleware({
  includeHeaders: ['User-Agent', 'Authorization']
})

registerMiddleware('logger', logger)
```

### createCorsMiddleware

Create a CORS middleware.

```ts
function createCorsMiddleware(options?: {
  origin?: string | string[] | ((origin: string) => boolean)
  methods?: string[]
  headers?: string[]
  credentials?: boolean
  maxAge?: number
}): MiddlewareHandler
```

#### Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `origin` | `string \| string[] \| ((origin: string) => boolean)` | `'*'` | Allowed origins |
| `methods` | `string[]` | `['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE']` | Allowed HTTP methods |
| `headers` | `string[]` | `[]` | Allowed headers |
| `credentials` | `boolean` | `false` | Allow credentials |
| `maxAge` | `number` | `86400` | Preflight cache max age in seconds |

```ts
const cors = createCorsMiddleware({
  origin: ['https://example.com', 'https://app.example.com'],
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  headers: ['Content-Type', 'Authorization'],
  credentials: true,
  maxAge: 3600
})

registerMiddleware('cors', cors)
```

```ts
// Dynamic origin validation
const dynamicCors = createCorsMiddleware({
  origin: (origin) => origin.endsWith('.example.com')
})
```

### createRateLimitMiddleware

Create a rate limiting middleware.

```ts
function createRateLimitMiddleware(options?: {
  windowMs?: number
  maxRequests?: number
  keyGenerator?: (request: Request) => string
  skipSuccessfulRequests?: boolean
}): MiddlewareHandler
```

#### Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `windowMs` | `number` | `60000` | Time window in milliseconds |
| `maxRequests` | `number` | `100` | Maximum requests per window |
| `keyGenerator` | `(request: Request) => string` | IP-based | Function to generate rate limit key |
| `skipSuccessfulRequests` | `boolean` | `false` | Don't count successful requests |

```ts
const rateLimit = createRateLimitMiddleware({
  windowMs: 60000,       // 1 minute
  maxRequests: 100,      // 100 requests per minute
  keyGenerator: (req) => req.headers.get('X-Forwarded-For') || 'anonymous',
  skipSuccessfulRequests: false
})

registerMiddleware('rateLimit', rateLimit)
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

## Example Middleware

### Authentication

```ts
registerMiddleware('auth', async (request, context, next) => {
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
registerMiddleware('timing', async (request, context, next) => {
  const start = Date.now()
  const response = await next()
  const duration = Date.now() - start

  const newResponse = new Response(response.body, {
    status: response.status,
    headers: response.headers
  })
  newResponse.headers.set('X-Response-Time', `${duration}ms`)

  return newResponse
})
```

### Error Handling

```ts
registerMiddleware('errorHandler', async (request, context, next) => {
  try {
    return await next()
  } catch (error) {
    console.error('Request error:', error)
    return Response.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    )
  }
})
```

## Related

- [Type-Safe Middleware](/api/router/typed-middleware)
- [Middleware Concepts](/core-concepts/middleware)
- [RequestContext](/api/core/context)
