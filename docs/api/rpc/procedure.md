# Procedure Builder

The procedure builder is the foundation of `@ereo/rpc`. It provides a chainable API for creating typed procedures with middleware.

## Import

```ts
import { procedure } from '@ereo/rpc'
import type { ProcedureBuilder } from '@ereo/rpc'
```

## procedure

The base procedure builder instance. This is the starting point for creating all procedures.

```ts
const procedure: ProcedureBuilder<BaseContext>
```

### Type Parameters

The `ProcedureBuilder` interface tracks the current context type through middleware chains:

```ts
interface ProcedureBuilder<TContext extends BaseContext> {
  use<TNewContext extends BaseContext>(
    middleware: MiddlewareFn<TContext, TNewContext>
  ): ProcedureBuilder<TNewContext>

  query<TOutput>(
    handler: (ctx: TContext) => TOutput | Promise<TOutput>
  ): QueryProcedure<TContext, void, Awaited<TOutput>>

  query<TInput, TOutput>(
    schema: Schema<TInput>,
    handler: (ctx: TContext & { input: TInput }) => TOutput | Promise<TOutput>
  ): QueryProcedure<TContext, TInput, Awaited<TOutput>>

  mutation<TOutput>(
    handler: (ctx: TContext) => TOutput | Promise<TOutput>
  ): MutationProcedure<TContext, void, Awaited<TOutput>>

  mutation<TInput, TOutput>(
    schema: Schema<TInput>,
    handler: (ctx: TContext & { input: TInput }) => TOutput | Promise<TOutput>
  ): MutationProcedure<TContext, TInput, Awaited<TOutput>>

  subscription<TOutput>(
    handler: (ctx: TContext) => SubscriptionYield<TOutput>
  ): SubscriptionProcedure<TContext, void, TOutput>

  subscription<TInput, TOutput>(
    schema: Schema<TInput>,
    handler: (ctx: TContext & { input: TInput }) => SubscriptionYield<TOutput>
  ): SubscriptionProcedure<TContext, TInput, TOutput>
}
```

## Methods

### use()

Adds middleware to the procedure pipeline. Returns a new `ProcedureBuilder` with the extended context type.

#### Signature

```ts
use<TNewContext extends BaseContext>(
  middleware: MiddlewareFn<TContext, TNewContext>
): ProcedureBuilder<TNewContext>
```

#### Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `middleware` | `MiddlewareFn<TContext, TNewContext>` | Middleware function to add to the chain |

#### Returns

A new `ProcedureBuilder` with the extended context type.

#### Middleware Function Signature

```ts
type MiddlewareFn<TContextIn, TContextOut> = (opts: {
  ctx: TContextIn
  next: <T>(ctx: T) => MiddlewareResult<T>
}) => MiddlewareResult<TContextOut> | Promise<MiddlewareResult<TContextOut>>

type MiddlewareResult<TContext> =
  | { ok: true; ctx: TContext }
  | { ok: false; error: RPCErrorShape }
```

#### Examples

##### Basic Middleware

```ts
const loggedProcedure = procedure.use(async ({ ctx, next }) => {
  console.log('Request started')
  const result = await next(ctx)
  console.log('Request ended')
  return result
})
```

##### Context Extension

```ts
interface User {
  id: string
  name: string
  role: 'user' | 'admin'
}

const authedProcedure = procedure.use(async ({ ctx, next }) => {
  const token = ctx.request.headers.get('Authorization')
  const user = await verifyToken(token)

  if (!user) {
    return {
      ok: false,
      error: { code: 'UNAUTHORIZED', message: 'Invalid token' },
    }
  }

  // Extend context with user - now typed!
  return next({ ...ctx, user })
})

// Now `user` is available and typed in handlers
const me = authedProcedure.query(({ user }) => user)
```

##### Middleware Chaining

```ts
// Compose multiple middleware
const adminProcedure = procedure
  .use(loggingMiddleware)
  .use(authMiddleware)
  .use(async ({ ctx, next }) => {
    if (ctx.user.role !== 'admin') {
      return {
        ok: false,
        error: { code: 'FORBIDDEN', message: 'Admin access required' },
      }
    }
    return next(ctx)
  })
```

### query()

Creates a query procedure. Queries are read-only operations that use HTTP GET by default.

#### Signatures

```ts
// Without input
query<TOutput>(
  handler: (ctx: TContext) => TOutput | Promise<TOutput>
): QueryProcedure<TContext, void, Awaited<TOutput>>

// With validated input
query<TInput, TOutput>(
  schema: Schema<TInput>,
  handler: (ctx: TContext & { input: TInput }) => TOutput | Promise<TOutput>
): QueryProcedure<TContext, TInput, Awaited<TOutput>>
```

#### Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `schema` | `Schema<TInput>` | Optional Zod-compatible schema for input validation |
| `handler` | `Function` | Handler function that receives context and returns data |

#### Examples

##### Simple Query

```ts
const healthCheck = procedure.query(() => ({
  status: 'ok',
  timestamp: Date.now(),
}))
```

##### Query with Context

```ts
const getCurrentUser = authedProcedure.query(({ user, request }) => ({
  user,
  ip: request.headers.get('x-forwarded-for'),
}))
```

##### Query with Input Validation

```ts
import { z } from 'zod'

const getPost = procedure.query(
  z.object({
    id: z.string().uuid(),
    includeComments: z.boolean().optional(),
  }),
  async ({ input }) => {
    const post = await db.posts.findUnique({
      where: { id: input.id },
      include: { comments: input.includeComments },
    })
    if (!post) throw errors.notFound('Post not found')
    return post
  }
)
```

##### Async Query

```ts
const listPosts = procedure.query(async ({ ctx }) => {
  const posts = await db.posts.findMany({
    orderBy: { createdAt: 'desc' },
    take: 20,
  })
  return posts
})
```

### mutation()

Creates a mutation procedure. Mutations are state-changing operations that always use HTTP POST.

#### Signatures

```ts
// Without input
mutation<TOutput>(
  handler: (ctx: TContext) => TOutput | Promise<TOutput>
): MutationProcedure<TContext, void, Awaited<TOutput>>

// With validated input
mutation<TInput, TOutput>(
  schema: Schema<TInput>,
  handler: (ctx: TContext & { input: TInput }) => TOutput | Promise<TOutput>
): MutationProcedure<TContext, TInput, Awaited<TOutput>>
```

#### Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `schema` | `Schema<TInput>` | Optional Zod-compatible schema for input validation |
| `handler` | `Function` | Handler function that receives context and returns data |

#### Examples

##### Simple Mutation

```ts
const logout = authedProcedure.mutation(async ({ user }) => {
  await invalidateSession(user.id)
  return { success: true }
})
```

##### Mutation with Input

```ts
import { z } from 'zod'

const createPost = authedProcedure.mutation(
  z.object({
    title: z.string().min(1).max(200),
    content: z.string().min(1),
    published: z.boolean().default(false),
  }),
  async ({ input, user }) => {
    const post = await db.posts.create({
      data: {
        ...input,
        authorId: user.id,
      },
    })

    // Emit event for subscribers
    postEvents.emit('created', post)

    return post
  }
)
```

##### Mutation with Complex Validation

```ts
const updateProfile = authedProcedure.mutation(
  z.object({
    name: z.string().min(2).max(100).optional(),
    email: z.string().email().optional(),
    avatar: z.string().url().optional(),
  }).refine(
    (data) => Object.keys(data).length > 0,
    { message: 'At least one field must be provided' }
  ),
  async ({ input, user }) => {
    return db.users.update({
      where: { id: user.id },
      data: input,
    })
  }
)
```

### subscription()

Creates a subscription procedure. Subscriptions use WebSocket for real-time data streaming via async generators.

#### Signatures

```ts
// Without input
subscription<TOutput>(
  handler: (ctx: TContext) => SubscriptionYield<TOutput>
): SubscriptionProcedure<TContext, void, TOutput>

// With validated input
subscription<TInput, TOutput>(
  schema: Schema<TInput>,
  handler: (ctx: TContext & { input: TInput }) => SubscriptionYield<TOutput>
): SubscriptionProcedure<TContext, TInput, TOutput>
```

#### Type Definitions

```ts
type SubscriptionYield<T> = AsyncGenerator<T, void, unknown>
```

#### Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `schema` | `Schema<TInput>` | Optional Zod-compatible schema for input validation |
| `handler` | `Function` | Async generator function that yields values over time |

#### Examples

##### Simple Subscription

```ts
const onlineUsers = procedure.subscription(async function* () {
  while (true) {
    const users = await getOnlineUsers()
    yield users
    await sleep(5000) // Update every 5 seconds
  }
})
```

##### Event-based Subscription

```ts
const onPostCreated = authedProcedure.subscription(async function* ({ user }) {
  console.log(`User ${user.id} subscribed to post updates`)

  // Use an event emitter or pub/sub system
  for await (const post of postEvents.on('created')) {
    yield post
  }
})
```

##### Subscription with Input

```ts
import { z } from 'zod'

const countdown = procedure.subscription(
  z.object({
    from: z.number().int().min(1).max(100),
    intervalMs: z.number().int().min(100).default(1000),
  }),
  async function* ({ input }) {
    for (let i = input.from; i >= 0; i--) {
      yield { count: i }
      await new Promise((r) => setTimeout(r, input.intervalMs))
    }
  }
)
```

##### Subscription with Cleanup

```ts
const notifications = authedProcedure.subscription(async function* ({ user }) {
  const channel = pubsub.subscribe(`user:${user.id}:notifications`)

  try {
    for await (const notification of channel) {
      yield notification
    }
  } finally {
    // Cleanup when subscription ends
    channel.unsubscribe()
    console.log(`User ${user.id} unsubscribed from notifications`)
  }
})
```

##### Database Change Subscription

```ts
const onUserActivity = adminProcedure.subscription(async function* () {
  // Listen to database changes (e.g., Prisma Pulse, Supabase Realtime)
  const subscription = prisma.$subscribe.user.create()

  for await (const event of subscription) {
    yield {
      type: 'user_created',
      user: event.created,
      timestamp: new Date(),
    }
  }
})
```

## Creating Procedure Hierarchies

A common pattern is to create a hierarchy of procedures with increasing privileges:

```ts
// api/procedures.ts
import { procedure, createAuthMiddleware, requireRoles } from '@ereo/rpc'

// Level 1: Public - no authentication required
export const publicProcedure = procedure

// Level 2: Authenticated - requires valid session
export const authedProcedure = procedure.use(
  createAuthMiddleware(async (ctx) => {
    const token = ctx.request.headers.get('Authorization')?.replace('Bearer ', '')
    return token ? await verifyJWT(token) : null
  })
)

// Level 3: Email verified - requires verified email
export const verifiedProcedure = authedProcedure.use(async ({ ctx, next }) => {
  if (!ctx.user.emailVerified) {
    return {
      ok: false,
      error: { code: 'EMAIL_NOT_VERIFIED', message: 'Please verify your email' },
    }
  }
  return next(ctx)
})

// Level 4: Admin - requires admin role
export const adminProcedure = verifiedProcedure.use(requireRoles(['admin']))

// Level 5: Super Admin - requires super_admin role
export const superAdminProcedure = verifiedProcedure.use(requireRoles(['super_admin']))
```

## executeMiddleware

Executes a middleware chain and returns the final context. Useful for testing middleware in isolation.

### Signature

```ts
async function executeMiddleware<TContext extends BaseContext>(
  middlewares: MiddlewareDef<any, any>[],
  initialCtx: BaseContext
): Promise<MiddlewareResult<TContext>>
```

### Type Definitions

```ts
interface MiddlewareDef<TIn, TOut> {
  fn: MiddlewareFn<TIn, TOut>
}

type MiddlewareResult<TContext> =
  | { ok: true; ctx: TContext }
  | { ok: false; error: { code: string; message: string } }
```

### Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `middlewares` | `MiddlewareDef[]` | Array of middleware definitions to execute |
| `initialCtx` | `BaseContext` | Initial context (must have `ctx` and `request` properties) |

### Returns

A `MiddlewareResult` that is either:
- `{ ok: true, ctx: TContext }` - All middleware passed, final context returned
- `{ ok: false, error: { code, message } }` - A middleware short-circuited with an error

### Example: Testing Middleware

```ts
import { executeMiddleware, procedure } from '@ereo/rpc'

// Create test context
const mockRequest = new Request('http://localhost/api/rpc', {
  headers: { Authorization: 'Bearer valid-token' },
})

const initialCtx = {
  ctx: {},
  request: mockRequest,
}

// Define the middleware function directly (not via procedure.use())
const authMiddlewareFn = async ({ ctx, next }) => {
  const token = ctx.request.headers.get('Authorization')
  if (!token) {
    return { ok: false, error: { code: 'UNAUTHORIZED', message: 'No token' } }
  }
  return next({ ...ctx, user: { id: '123', name: 'Test User' } })
}

// Execute and verify
const result = await executeMiddleware(
  [{ fn: authMiddlewareFn }],
  initialCtx
)

if (result.ok) {
  console.log('User:', result.ctx.user)
  // { id: '123', name: 'Test User' }
} else {
  console.log('Error:', result.error)
}
```

### Example: Testing Middleware Chain

```ts
import { executeMiddleware } from '@ereo/rpc'
import { logging, timing, createAuthMiddleware } from '@ereo/rpc'

const middlewares = [
  { fn: logging() },
  { fn: timing() },
  { fn: createAuthMiddleware(async () => ({ id: '1', role: 'admin' })) },
]

const result = await executeMiddleware(middlewares, {
  ctx: {},
  request: new Request('http://localhost'),
})

expect(result.ok).toBe(true)
if (result.ok) {
  expect(result.ctx.user).toBeDefined()
  expect(result.ctx.timing).toBeDefined()
}
```

### Example: Testing Error Conditions

```ts
import { executeMiddleware, createAuthMiddleware } from '@ereo/rpc'

const authMiddleware = createAuthMiddleware(async () => null) // Always fails

const result = await executeMiddleware(
  [{ fn: authMiddleware }],
  { ctx: {}, request: new Request('http://localhost') }
)

expect(result.ok).toBe(false)
if (!result.ok) {
  expect(result.error.code).toBe('UNAUTHORIZED')
}
```

## Legacy API (Deprecated)

The following standalone functions are deprecated but kept for backwards compatibility:

```ts
import { query, mutation, subscription } from '@ereo/rpc'

// Deprecated - use procedure.query() instead
const legacyQuery = query(() => ({ status: 'ok' }))

// Deprecated - use procedure.mutation() instead
const legacyMutation = mutation(z.object({ id: z.string() }), ({ input }) => ({ deleted: input.id }))

// Deprecated - use procedure.subscription() instead
const legacySub = subscription(async function* () { yield 1 })
```

**Migration:** Replace with the chainable API:

```ts
// New API
const newQuery = procedure.query(() => ({ status: 'ok' }))
const newMutation = procedure.mutation(z.object({ id: z.string() }), ({ input }) => ({ deleted: input.id }))
const newSub = procedure.subscription(async function* () { yield 1 })
```

## Schema Interface

The schema parameter accepts any object implementing the `Schema<T>` interface:

```ts
interface Schema<T> {
  parse(data: unknown): T
  safeParse?(data: unknown): { success: true; data: T } | { success: false; error: unknown }
}
```

This is compatible with Zod and other validation libraries:

```ts
// Zod (recommended)
import { z } from 'zod'
const zodSchema = z.object({ name: z.string() })

// Yup
import * as yup from 'yup'
const yupSchema = {
  parse: (data: unknown) => yup.object({ name: yup.string().required() }).validateSync(data),
}

// Custom
const customSchema = {
  parse: (data: unknown) => {
    if (typeof data !== 'object' || !data || !('name' in data)) {
      throw new Error('Invalid input')
    }
    return data as { name: string }
  },
}
```

## Best Practices

1. **Create reusable procedure builders** - Define auth levels once, reuse everywhere
2. **Keep handlers focused** - One responsibility per procedure
3. **Validate all input** - Always use schemas for procedures that accept input
4. **Type your context extensions** - Define interfaces for middleware-added properties
5. **Use async generators for subscriptions** - They provide automatic cleanup on disconnect
6. **Chain middleware logically** - Order matters: logging → auth → rate limit → business logic

## Related

- [Router](/api/rpc/router) - Combining procedures into an API
- [Middleware](/api/rpc/middleware) - Built-in middleware helpers
- [Types](/api/rpc/types) - TypeScript type definitions
