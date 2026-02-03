# Middleware Helpers

Built-in middleware functions for common use cases like authentication, rate limiting, logging, and more.

## Import

```ts
import {
  logging,
  rateLimit,
  clearRateLimitStore,
  createAuthMiddleware,
  requireRoles,
  validate,
  extend,
  timing,
  catchErrors,
} from '@ereo/rpc'

import type {
  LoggingOptions,
  RateLimitOptions,
  TimingContext,
} from '@ereo/rpc'
```

## logging

Logs RPC calls with optional timing information.

### Signature

```ts
function logging(options?: LoggingOptions): MiddlewareFn<BaseContext, BaseContext>
```

### Type Definitions

```ts
interface LoggingOptions {
  /** Log function (default: console.log) */
  log?: (...args: unknown[]) => void
  /** Include timing information (default: true) */
  timing?: boolean
}
```

### Parameters

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `log` | `Function` | `console.log` | Custom logging function |
| `timing` | `boolean` | `true` | Include request duration |

### Examples

#### Basic Logging

```ts
const loggedProcedure = procedure.use(logging())

// Output: [RPC] 42.35ms
```

#### Custom Logger

```ts
const loggedProcedure = procedure.use(logging({
  log: (msg) => logger.info(msg),
  timing: true,
}))
```

#### Without Timing

```ts
const loggedProcedure = procedure.use(logging({
  timing: false,
}))

// Output: [RPC] Request completed
```

#### Structured Logging

```ts
const loggedProcedure = procedure.use(logging({
  log: (...args) => {
    console.log(JSON.stringify({
      type: 'rpc',
      message: args[0],
      timestamp: new Date().toISOString(),
    }))
  },
}))
```

## rateLimit

Simple in-memory rate limiting middleware.

### Signature

```ts
function rateLimit(options: RateLimitOptions): MiddlewareFn<BaseContext, BaseContext>
```

### Type Definitions

```ts
interface RateLimitOptions {
  /** Max requests per window */
  limit: number
  /** Window size in milliseconds */
  windowMs: number
  /** Key function to identify clients (default: IP address) */
  keyFn?: (ctx: BaseContext) => string
  /** Error message */
  message?: string
}
```

### Parameters

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `limit` | `number` | Required | Maximum requests per window |
| `windowMs` | `number` | Required | Time window in milliseconds |
| `keyFn` | `Function` | IP-based | Function to identify clients |
| `message` | `string` | `'Too many requests'` | Error message |

### Examples

#### Basic Rate Limiting

```ts
// 100 requests per minute
const rateLimitedProcedure = procedure.use(rateLimit({
  limit: 100,
  windowMs: 60 * 1000,
}))
```

#### Per-User Rate Limiting

```ts
const userRateLimited = authedProcedure.use(rateLimit({
  limit: 50,
  windowMs: 60 * 1000,
  keyFn: (ctx) => ctx.user.id,  // Use user ID instead of IP
  message: 'You have exceeded your request limit',
}))
```

#### Strict Rate Limiting

```ts
// 5 login attempts per 15 minutes
const loginProcedure = procedure.use(rateLimit({
  limit: 5,
  windowMs: 15 * 60 * 1000,
  keyFn: (ctx) => ctx.request.headers.get('x-forwarded-for') ?? 'unknown',
  message: 'Too many login attempts. Please try again later.',
}))
```

#### Different Limits per Endpoint

```ts
// Expensive operations: 10 per hour
const expensiveProcedure = procedure.use(rateLimit({
  limit: 10,
  windowMs: 60 * 60 * 1000,
}))

// Normal operations: 1000 per hour
const normalProcedure = procedure.use(rateLimit({
  limit: 1000,
  windowMs: 60 * 60 * 1000,
}))
```

### Notes

- Uses a module-level singleton store for shared state across procedures
- Automatically cleans up expired entries every 60 seconds
- For production with multiple servers, use Redis or similar

## clearRateLimitStore

Clears the global rate limit store. Useful for testing.

### Signature

```ts
function clearRateLimitStore(): void
```

### Example

```ts
import { clearRateLimitStore } from '@ereo/rpc'

beforeEach(() => {
  clearRateLimitStore()
})

test('rate limiting works', async () => {
  // Test rate limiting behavior
})
```

## createAuthMiddleware

Creates an authentication middleware that extracts and validates users.

### Signature

```ts
function createAuthMiddleware<TUser>(
  getUser: (ctx: BaseContext) => TUser | null | Promise<TUser | null>,
  options?: { message?: string }
): MiddlewareFn<BaseContext, BaseContext & { user: TUser }>
```

### Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `getUser` | `Function` | Function to extract user from context |
| `options.message` | `string` | Custom error message (default: `'Unauthorized'`) |

### Examples

#### JWT Authentication

```ts
import { createAuthMiddleware } from '@ereo/rpc'
import { verifyJWT } from './auth'

const authMiddleware = createAuthMiddleware(async (ctx) => {
  const token = ctx.request.headers.get('Authorization')?.replace('Bearer ', '')
  if (!token) return null

  try {
    const payload = await verifyJWT(token)
    return {
      id: payload.sub,
      email: payload.email,
      role: payload.role,
    }
  } catch {
    return null
  }
})

const authedProcedure = procedure.use(authMiddleware)
```

#### Session-based Authentication

```ts
const authMiddleware = createAuthMiddleware(async (ctx) => {
  const sessionId = ctx.request.headers.get('Cookie')?.match(/session=([^;]+)/)?.[1]
  if (!sessionId) return null

  const session = await db.sessions.findUnique({
    where: { id: sessionId },
    include: { user: true },
  })

  if (!session || session.expiresAt < new Date()) return null

  return session.user
})
```

#### Custom Error Message

```ts
const authMiddleware = createAuthMiddleware(
  async (ctx) => getUser(ctx),
  { message: 'Please log in to continue' }
)
```

#### API Key Authentication

```ts
const apiKeyAuth = createAuthMiddleware(async (ctx) => {
  const apiKey = ctx.request.headers.get('X-API-Key')
  if (!apiKey) return null

  const key = await db.apiKeys.findUnique({
    where: { key: apiKey },
    include: { user: true },
  })

  if (!key || key.revokedAt) return null

  // Update last used
  await db.apiKeys.update({
    where: { id: key.id },
    data: { lastUsedAt: new Date() },
  })

  return key.user
})
```

## requireRoles

Requires specific user roles for access.

### Signature

```ts
function requireRoles<TContext extends BaseContext & { user: { role?: string } }>(
  roles: string[],
  options?: { message?: string }
): MiddlewareFn<TContext, TContext>
```

### Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `roles` | `string[]` | Array of allowed roles |
| `options.message` | `string` | Custom error message (default: `'Insufficient permissions'`) |

### Examples

#### Admin Only

```ts
const adminProcedure = authedProcedure.use(requireRoles(['admin']))
```

#### Multiple Roles

```ts
const moderatorProcedure = authedProcedure.use(
  requireRoles(['admin', 'moderator'])
)
```

#### Custom Message

```ts
const adminProcedure = authedProcedure.use(
  requireRoles(['admin'], { message: 'Admin access required' })
)
```

#### Complete Example

```ts
interface User {
  id: string
  email: string
  role: 'user' | 'moderator' | 'admin'
}

const authMiddleware = createAuthMiddleware<User>(async (ctx) => {
  // Get user from token...
  return user
})

const authedProcedure = procedure.use(authMiddleware)
const adminProcedure = authedProcedure.use(requireRoles(['admin']))
const modProcedure = authedProcedure.use(requireRoles(['admin', 'moderator']))

// Router
const api = createRouter({
  users: {
    me: authedProcedure.query(({ user }) => user),
    list: adminProcedure.query(async () => db.users.findMany()),
    ban: modProcedure.mutation(
      z.object({ userId: z.string() }),
      async ({ input }) => db.users.update({
        where: { id: input.userId },
        data: { banned: true },
      })
    ),
  },
})
```

## validate

Adds custom validation logic to a procedure.

### Signature

```ts
function validate<TContext extends BaseContext>(
  validator: (ctx: TContext) => Promise<
    | { ok: true }
    | { ok: false; error: { code: string; message: string } }
  >
): MiddlewareFn<TContext, TContext>
```

### Examples

#### Maintenance Mode Check

```ts
const maintenanceCheck = validate(async (ctx) => {
  if (ctx.ctx.maintenanceMode) {
    return {
      ok: false,
      error: { code: 'MAINTENANCE', message: 'System is under maintenance' },
    }
  }
  return { ok: true }
})

const normalProcedure = procedure.use(maintenanceCheck)
```

#### Feature Flag Check

```ts
const requireFeature = (feature: string) => validate(async (ctx) => {
  const enabled = await isFeatureEnabled(feature, ctx.user?.id)
  if (!enabled) {
    return {
      ok: false,
      error: { code: 'FEATURE_DISABLED', message: `${feature} is not enabled` },
    }
  }
  return { ok: true }
})

const betaProcedure = authedProcedure.use(requireFeature('beta'))
```

#### Subscription Check

```ts
const requireSubscription = validate<AuthedContext>(async (ctx) => {
  const subscription = await getSubscription(ctx.user.id)
  if (!subscription || subscription.status !== 'active') {
    return {
      ok: false,
      error: { code: 'SUBSCRIPTION_REQUIRED', message: 'Active subscription required' },
    }
  }
  return { ok: true }
})

const premiumProcedure = authedProcedure.use(requireSubscription)
```

## extend

Extends context with additional data.

### Signature

```ts
function extend<TContext extends BaseContext, TExtension extends object>(
  extender: (ctx: TContext) => TExtension | Promise<TExtension>
): MiddlewareFn<TContext, TContext & TExtension>
```

### Examples

#### Add Database Connection

```ts
const withDb = extend(async (ctx) => ({
  db: createDbConnection(),
}))

const dbProcedure = procedure.use(withDb)

const getUsers = dbProcedure.query(async ({ db }) => {
  return db.users.findMany()
})
```

#### Add Request Metadata

```ts
const withMetadata = extend((ctx) => ({
  requestId: crypto.randomUUID(),
  clientIp: ctx.request.headers.get('x-forwarded-for') ?? 'unknown',
  userAgent: ctx.request.headers.get('user-agent') ?? 'unknown',
}))

const trackedProcedure = procedure.use(withMetadata)
```

#### Add Services

```ts
const withServices = extend(async (ctx) => ({
  emailService: new EmailService(),
  paymentService: new PaymentService(),
  analyticsService: new AnalyticsService(),
}))

const serviceProcedure = procedure.use(withServices)
```

#### Conditional Extension

```ts
const withOptionalUser = extend(async (ctx) => {
  const token = ctx.request.headers.get('Authorization')
  return {
    maybeUser: token ? await verifyToken(token) : null,
  }
})

// User may or may not be authenticated
const optionalAuthProcedure = procedure.use(withOptionalUser)
```

## timing

Adds timing information to the context for measuring performance.

### Signature

```ts
function timing<TContext extends BaseContext>(): MiddlewareFn<TContext, TContext & TimingContext>
```

### Type Definitions

```ts
interface TimingContext {
  timing: {
    start: number
    getDuration: () => number
  }
}
```

### Examples

#### Basic Timing

```ts
const timedProcedure = procedure.use(timing())

const slowQuery = timedProcedure.query(async ({ timing }) => {
  const result = await expensiveOperation()

  console.log(`Operation took ${timing.getDuration()}ms`)

  return result
})
```

#### Performance Logging

```ts
const timedProcedure = procedure
  .use(timing())
  .use(async ({ ctx, next }) => {
    const result = await next(ctx)

    // Log slow requests
    const duration = ctx.timing.getDuration()
    if (duration > 1000) {
      console.warn(`Slow request: ${duration}ms`)
    }

    return result
  })
```

#### With Metrics

```ts
const metricsMiddleware = procedure
  .use(timing())
  .use(async ({ ctx, next }) => {
    const result = await next(ctx)

    metrics.histogram('rpc_duration', ctx.timing.getDuration(), {
      path: ctx.request.url,
    })

    return result
  })
```

## catchErrors

Catches and transforms errors thrown in handlers.

### Signature

```ts
function catchErrors<TContext extends BaseContext>(
  handler: (error: unknown) => { code: string; message: string } | never
): MiddlewareFn<TContext, TContext>
```

### Examples

#### Generic Error Handler

```ts
const withErrorHandling = catchErrors((error) => {
  console.error('Handler error:', error)

  if (error instanceof ValidationError) {
    return { code: 'VALIDATION_ERROR', message: error.message }
  }

  if (error instanceof DatabaseError) {
    return { code: 'DATABASE_ERROR', message: 'Database operation failed' }
  }

  // Re-throw unknown errors
  throw error
})

const safeProcedure = procedure.use(withErrorHandling)
```

#### External Service Errors

```ts
const withExternalServiceHandler = catchErrors((error) => {
  if (error instanceof StripeError) {
    console.error('Stripe error:', error)
    return { code: 'PAYMENT_ERROR', message: 'Payment processing failed' }
  }

  if (error instanceof SendGridError) {
    console.error('SendGrid error:', error)
    return { code: 'EMAIL_ERROR', message: 'Failed to send email' }
  }

  throw error
})
```

#### Sanitizing Errors

```ts
const productionErrorHandler = catchErrors((error) => {
  // Log full error internally
  logger.error('Unhandled error', { error, stack: error.stack })

  // Return sanitized error to client
  return {
    code: 'INTERNAL_ERROR',
    message: process.env.NODE_ENV === 'production'
      ? 'An unexpected error occurred'
      : error.message,
  }
})
```

## Middleware Composition

Combine multiple middleware for complex scenarios:

```ts
import {
  logging,
  rateLimit,
  createAuthMiddleware,
  requireRoles,
  timing,
  catchErrors,
} from '@ereo/rpc'

// Production-ready procedure stack
const productionProcedure = procedure
  .use(logging({ log: logger.info }))
  .use(timing())
  .use(catchErrors((error) => {
    logger.error('RPC error', { error })
    return { code: 'INTERNAL_ERROR', message: 'Something went wrong' }
  }))
  .use(rateLimit({ limit: 100, windowMs: 60000 }))

// Authenticated procedure
const authedProcedure = productionProcedure
  .use(createAuthMiddleware(getUser))

// Admin procedure
const adminProcedure = authedProcedure
  .use(requireRoles(['admin']))
  .use(rateLimit({ limit: 50, windowMs: 60000 })) // Stricter limit for admin
```

## Custom Middleware

Create your own middleware following the pattern:

```ts
import type { MiddlewareFn, BaseContext } from '@ereo/rpc'

// Simple middleware
const myMiddleware: MiddlewareFn<BaseContext, BaseContext> = async ({ ctx, next }) => {
  // Pre-processing
  console.log('Before handler')

  // Continue to next middleware/handler
  const result = await next(ctx)

  // Post-processing
  console.log('After handler')

  return result
}

// Context-extending middleware
interface MyContext extends BaseContext {
  myData: string
}

const myExtendingMiddleware: MiddlewareFn<BaseContext, MyContext> = async ({ ctx, next }) => {
  return next({
    ...ctx,
    myData: 'hello',
  })
}

// Error-returning middleware
const myGuardMiddleware: MiddlewareFn<BaseContext, BaseContext> = async ({ ctx, next }) => {
  if (someCondition) {
    return {
      ok: false,
      error: { code: 'CUSTOM_ERROR', message: 'Custom error message' },
    }
  }
  return next(ctx)
}
```

## Related

- [Procedure Builder](/api/rpc/procedure) - Creating typed procedures
- [Types](/api/rpc/types) - TypeScript type definitions
