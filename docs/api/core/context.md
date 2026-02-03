# RequestContext

The `RequestContext` provides a way to pass data through the request lifecycle. It's available in loaders, actions, and middleware.

## Import

```ts
import {
  createContext,
  RequestContext,
  getContext,
  attachContext,
  isRequestContext
} from '@ereo/core'
```

## createContext

Creates a new request context.

### Signature

```ts
function createContext(request: Request): RequestContext
```

### Parameters

| Name | Type | Description |
|------|------|-------------|
| `request` | `Request` | The incoming HTTP request |

### Returns

Returns a `RequestContext` instance.

## RequestContext Methods

### get

Retrieves a value from the context.

```ts
get<T>(key: string): T | undefined
```

```ts
const user = context.get<User>('user')
```

### set

Stores a value in the context.

```ts
set<T>(key: string, value: T): void
```

```ts
context.set('user', { id: 1, name: 'Alice' })
```

### has

Checks if a key exists in the context.

```ts
has(key: string): boolean
```

```ts
if (context.has('user')) {
  // User is authenticated
}
```

### delete

Removes a value from the context.

```ts
delete(key: string): boolean
```

```ts
context.delete('temporaryData')
```

## Properties

### cache

Access cache control for the current request.

```ts
interface CacheControl {
  set(options: CacheOptions): void
  get(): CacheOptions | undefined
}
```

```ts
// Set cache headers
context.cache.set({
  maxAge: 3600,
  tags: ['posts']
})

// Get current cache settings
const cacheOptions = context.cache.get()
```

### responseHeaders

Access response headers.

```ts
responseHeaders: Headers
```

```ts
context.responseHeaders.set('X-Custom-Header', 'value')
context.responseHeaders.append('Set-Cookie', 'session=abc123')
```

## Helper Functions

### attachContext

Attaches a context to a request for later retrieval.

```ts
function attachContext(request: Request, context: RequestContext): void
```

```ts
const context = createContext(request)
context.set('user', user)
attachContext(request, context)
```

### getContext

Retrieves the context attached to a request.

```ts
function getContext(request: Request): RequestContext | undefined
```

```ts
const context = getContext(request)
if (context) {
  const user = context.get('user')
}
```

### isRequestContext

Type guard for RequestContext.

```ts
function isRequestContext(value: unknown): value is RequestContext
```

```ts
if (isRequestContext(maybeContext)) {
  const data = maybeContext.get('data')
}
```

## Examples

### Using Context in Middleware

```ts
// routes/_middleware.ts
export const middleware = async (request, next, context) => {
  // Authenticate user
  const token = request.headers.get('Authorization')?.replace('Bearer ', '')

  if (token) {
    const user = await verifyToken(token)
    context.set('user', user)
  }

  return next()
}
```

### Accessing Context in Loaders

```ts
// routes/dashboard.tsx
export const loader = createLoader(async ({ context }) => {
  const user = context.get('user')

  if (!user) {
    throw new Response('Unauthorized', { status: 401 })
  }

  const dashboardData = await getDashboardData(user.id)
  return { user, dashboardData }
})
```

### Setting Response Headers

```ts
export const loader = createLoader(async ({ context }) => {
  // Set custom headers
  context.responseHeaders.set('X-Request-Id', crypto.randomUUID())

  // Set cookies
  context.responseHeaders.append('Set-Cookie', 'viewed=true; Path=/')

  return { data: 'example' }
})
```

### Cache Control via Context

```ts
export const loader = createLoader(async ({ params, context }) => {
  const post = await db.posts.find(params.id)

  // Dynamic cache based on content
  if (post.isStatic) {
    context.cache.set({
      maxAge: 86400, // 24 hours
      tags: ['posts', `post-${post.id}`]
    })
  } else {
    context.cache.set({
      maxAge: 60, // 1 minute
      private: true
    })
  }

  return { post }
})
```

### Passing Data Between Middleware

```ts
// First middleware
const timingMiddleware = async (request, next, context) => {
  const start = Date.now()
  context.set('requestStart', start)

  const response = await next()

  const duration = Date.now() - start
  response.headers.set('X-Response-Time', `${duration}ms`)

  return response
}

// Second middleware
const loggingMiddleware = async (request, next, context) => {
  const response = await next()

  const start = context.get('requestStart')
  console.log(`${request.method} ${request.url} - ${Date.now() - start}ms`)

  return response
}
```

## Type Safety

Define typed context keys:

```ts
// types/context.ts
declare module '@ereo/core' {
  interface ContextTypes {
    user: User | null
    session: Session
    requestId: string
  }
}

// Now context.get('user') returns User | null
const user = context.get('user')
```

## Related

- [Middleware](/core-concepts/middleware)
- [Data Loading](/core-concepts/data-loading)
- [createApp](/api/core/create-app)
