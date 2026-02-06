# Type-Safe Middleware

Create middleware with compile-time type safety for context values.

## Import

```ts
import {
  createMiddleware,
  chainMiddleware,
  validateMiddlewareChain,
  registerTypedMiddleware,
  getTypedMiddleware
} from '@ereo/router'

import type {
  TypedMiddlewareContext,
  TypedMiddlewareHandler,
  TypedMiddleware,
  MiddlewareChainOptions
} from '@ereo/router'
```

## Overview

The typed middleware system extends the base middleware with generic type parameters for compile-time context type checking. It remains fully compatible with the core middleware system.

```ts
// Base type from @ereo/core:
type MiddlewareHandler = (
  request: Request,
  context: AppContext,
  next: NextFunction
) => Response | Promise<Response>

// Typed version (compatible with base):
type TypedMiddlewareHandler<TProvides, TRequires> = (
  request: Request,
  context: AppContext & TRequires,
  next: NextFunction
) => Response | Promise<Response>
```

## createMiddleware

Create a typed middleware with context type safety.

```ts
function createMiddleware<
  TProvides extends TypedMiddlewareContext = {},
  TRequires extends TypedMiddlewareContext = {}
>(
  config: TypedMiddleware<TProvides, TRequires>
): TypedMiddleware<TProvides, TRequires> & { register: () => void }
```

### Basic Usage

```ts
interface User {
  id: string
  name: string
  role: 'user' | 'admin'
}

const authMiddleware = createMiddleware<{ user: User }>({
  name: 'auth',
  provides: ['user'],
  handler: async (request, context, next) => {
    const token = request.headers.get('Authorization')?.replace('Bearer ', '')

    if (!token) {
      return new Response('Unauthorized', { status: 401 })
    }

    const user = await verifyToken(token)
    context.set('user', user)  // TypeScript knows 'user' is valid

    return next()
  }
})

// Register the middleware
authMiddleware.register()
```

### With Requirements

```ts
// This middleware requires 'user' to be set by a previous middleware
const adminMiddleware = createMiddleware<
  { isAdmin: boolean },  // Provides
  { user: User }         // Requires
>({
  name: 'admin',
  provides: ['isAdmin'],
  requires: ['user'],
  handler: async (request, context, next) => {
    const user = context.get('user')  // TypeScript knows this exists

    if (user.role !== 'admin') {
      return new Response('Forbidden', { status: 403 })
    }

    context.set('isAdmin', true)
    return next()
  }
})
```

## chainMiddleware

Chain multiple typed middleware together with type inference.

```ts
function chainMiddleware<M1, M2>(m1: M1, m2: M2): TypedMiddleware
function chainMiddleware<M1, M2, M3>(m1: M1, m2: M2, m3: M3): TypedMiddleware
function chainMiddleware(...middlewares: TypedMiddleware[]): TypedMiddleware
```

```ts
// Chain middleware together
const protectedRoute = chainMiddleware(
  authMiddleware,     // provides: { user: User }
  adminMiddleware,    // requires: { user: User }, provides: { isAdmin: boolean }
  rateLimitMiddleware
)

// The combined middleware provides all context values
// { user: User, isAdmin: boolean }
```

### Using Chained Middleware

```ts
// In route config
export const config = {
  middleware: [protectedRoute.name]  // 'auth+admin+rateLimit'
}

// Or register the chain
registerMiddleware(protectedRoute.name, protectedRoute.handler)
```

## validateMiddlewareChain

Validate that a middleware chain has all required context values provided by preceding middleware.

```ts
function validateMiddlewareChain(names: string[]): {
  valid: boolean
  errors: string[]
}
```

```ts
// Valid chain: auth provides 'user', admin requires 'user'
const result1 = validateMiddlewareChain(['auth', 'admin'])
// { valid: true, errors: [] }

// Invalid chain: admin requires 'user' but it's not provided
const result2 = validateMiddlewareChain(['admin', 'auth'])
// {
//   valid: false,
//   errors: ["Middleware 'admin' requires 'user' but it's not provided by preceding middleware"]
// }
```

### Build-Time Validation

```ts
// In your build script or tests
const routes = await router.getRoutesWithConfig()

for (const route of routes) {
  if (route.config?.middleware) {
    const middlewareNames = route.config.middleware
      .filter((m): m is string => typeof m === 'string')

    const { valid, errors } = validateMiddlewareChain(middlewareNames)

    if (!valid) {
      console.error(`Invalid middleware chain for ${route.path}:`)
      errors.forEach(err => console.error(`  - ${err}`))
    }
  }
}
```

## registerTypedMiddleware

Register a typed middleware with full metadata.

```ts
function registerTypedMiddleware<TProvides, TRequires>(
  middleware: TypedMiddleware<TProvides, TRequires>
): void
```

```ts
registerTypedMiddleware(authMiddleware)
registerTypedMiddleware(adminMiddleware)
```

## getTypedMiddleware

Get typed middleware metadata by name.

```ts
function getTypedMiddleware(name: string): TypedMiddleware<any, any> | undefined
```

```ts
const auth = getTypedMiddleware('auth')
if (auth) {
  console.log('Provides:', auth.provides)  // ['user']
  console.log('Requires:', auth.requires)  // []
}
```

## Types

### TypedMiddlewareContext

Base type for context values.

```ts
interface TypedMiddlewareContext {
  [key: string]: unknown
}
```

### TypedMiddlewareHandler

Typed middleware handler function.

```ts
type TypedMiddlewareHandler<
  TProvides extends TypedMiddlewareContext = {},
  TRequires extends TypedMiddlewareContext = {}
> = (
  request: Request,
  context: AppContext & TRequires,
  next: NextFunction
) => Response | Promise<Response>
```

### TypedMiddleware

Typed middleware definition with metadata.

```ts
interface TypedMiddleware<
  TProvides extends TypedMiddlewareContext = {},
  TRequires extends TypedMiddlewareContext = {}
> {
  name: string
  handler: TypedMiddlewareHandler<TProvides, TRequires>
  /** Keys this middleware provides to the context */
  provides?: (keyof TProvides)[]
  /** Keys this middleware requires from the context */
  requires?: (keyof TRequires)[]
}
```

### MiddlewareChainOptions

Options for executing a middleware chain.

```ts
interface MiddlewareChainOptions {
  /** Request object */
  request: Request
  /** Application context */
  context: AppContext
  /** Final handler to call when chain completes */
  finalHandler: NextFunction
  /** Error handler for middleware errors */
  onError?: (error: Error) => Response | Promise<Response>
}
```

## Complete Example

```ts
import { createMiddleware, chainMiddleware, validateMiddlewareChain } from '@ereo/router'

// Define types
interface User {
  id: string
  name: string
  role: 'user' | 'admin'
}

interface Session {
  userId: string
  expiresAt: Date
}

// Session middleware
const sessionMiddleware = createMiddleware<{ session: Session }>({
  name: 'session',
  provides: ['session'],
  handler: async (request, context, next) => {
    const sessionId = request.headers.get('X-Session-Id')

    if (!sessionId) {
      return next()  // No session, continue without
    }

    const session = await getSession(sessionId)
    if (session && session.expiresAt > new Date()) {
      context.set('session', session)
    }

    return next()
  }
})

// Auth middleware (requires session)
const authMiddleware = createMiddleware<
  { user: User },
  { session: Session }
>({
  name: 'auth',
  provides: ['user'],
  requires: ['session'],
  handler: async (request, context, next) => {
    const session = context.get('session')

    if (!session) {
      return new Response('Unauthorized', { status: 401 })
    }

    const user = await getUserById(session.userId)
    context.set('user', user)

    return next()
  }
})

// Admin middleware (requires user)
const adminMiddleware = createMiddleware<
  { isAdmin: boolean },
  { user: User }
>({
  name: 'admin',
  provides: ['isAdmin'],
  requires: ['user'],
  handler: async (request, context, next) => {
    const user = context.get('user')

    if (user.role !== 'admin') {
      return new Response('Forbidden', { status: 403 })
    }

    context.set('isAdmin', true)
    return next()
  }
})

// Register all middleware
sessionMiddleware.register()
authMiddleware.register()
adminMiddleware.register()

// Validate a chain
const { valid, errors } = validateMiddlewareChain(['session', 'auth', 'admin'])
console.log('Chain valid:', valid)  // true

// Create a combined middleware for protected admin routes
const adminProtection = chainMiddleware(
  sessionMiddleware,
  authMiddleware,
  adminMiddleware
)

// Use in route config
export const config = {
  middleware: ['session', 'auth', 'admin']
}

// Access typed context in loader
export const loader = createLoader(async ({ context }) => {
  const user = context.get<User>('user')
  const isAdmin = context.get<boolean>('isAdmin')

  return { user, isAdmin }
})
```

## Related

- [Middleware](./middleware.md)
- [Middleware Concepts](/concepts/middleware)
- [RequestContext](/api/core/context)
