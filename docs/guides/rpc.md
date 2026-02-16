# RPC

`@ereo/rpc` provides type-safe remote procedure calls between your server and client. Define procedures once on the server and get full TypeScript inference on the client -- no code generation or manual type syncing required.

## Installation

```bash
bun add @ereo/rpc
```

## Defining Procedures

A procedure is a server function that clients can call. Use `procedure` to create a base, then chain `.query()` for reads or `.mutation()` for writes.

### Queries

Queries are read operations. They use HTTP GET and are cacheable:

```ts
// api/procedures.ts
import { procedure } from '@ereo/rpc'

export const publicProcedure = procedure

// A simple query with no input
export const healthCheck = publicProcedure.query(() => {
  return { status: 'ok', time: Date.now() }
})
```

### Mutations

Mutations are write operations. They use HTTP POST:

```ts
import { procedure } from '@ereo/rpc'
import { z } from 'zod'

export const publicProcedure = procedure

export const createPost = publicProcedure.mutation(
  z.object({
    title: z.string().min(1),
    content: z.string(),
  }),
  async ({ input }) => {
    const post = await db.posts.create({ data: input })
    return post
  }
)
```

The first argument to `.mutation()` is a Zod-compatible schema for input validation. If validation fails, the client receives a structured error -- no invalid data reaches your handler.

### Input Validation

Both queries and mutations accept an input schema:

```ts
export const getPost = publicProcedure.query(
  z.object({ id: z.string() }),
  async ({ input }) => {
    const post = await db.posts.find(input.id)
    if (!post) {
      throw new RPCError('NOT_FOUND', 'Post not found')
    }
    return post
  }
)
```

## Creating Routers

Group related procedures into a router. Routers can be nested:

```ts
// api/router.ts
import { createRouter, RPCError } from '@ereo/rpc'
import { z } from 'zod'
import { publicProcedure, protectedProcedure } from './procedures'

export const api = createRouter({
  health: publicProcedure.query(() => ({ status: 'ok' })),

  posts: {
    list: publicProcedure.query(async () => {
      return db.posts.findMany({ orderBy: { createdAt: 'desc' } })
    }),

    byId: publicProcedure.query(
      z.object({ id: z.string() }),
      async ({ input }) => {
        const post = await db.posts.find(input.id)
        if (!post) throw new RPCError('NOT_FOUND', 'Post not found')
        return post
      }
    ),

    create: protectedProcedure.mutation(
      z.object({ title: z.string().min(1), content: z.string() }),
      async ({ input, user }) => {
        return db.posts.create({ data: { ...input, authorId: user.id } })
      }
    ),

    delete: protectedProcedure.mutation(
      z.object({ id: z.string() }),
      async ({ input, user }) => {
        const post = await db.posts.find(input.id)
        if (post?.authorId !== user.id) {
          throw new RPCError('FORBIDDEN', 'Not your post')
        }
        await db.posts.delete({ where: { id: input.id } })
        return { success: true }
      }
    ),
  },

  users: {
    me: protectedProcedure.query(({ user }) => user),
  },
})

// Export the type for the client
export type Api = typeof api
```

## Server Setup

Register the RPC router with the EreoJS plugin:

```ts
// ereo.config.ts
import { defineConfig } from '@ereo/core'
import { rpcPlugin } from '@ereo/rpc'
import { api } from './api/router'

export default defineConfig({
  plugins: [
    rpcPlugin({
      router: api,
      endpoint: '/api/rpc',
    }),
  ],
})
```

Or mount manually with `Bun.serve`:

```ts
import { rpcPlugin } from '@ereo/rpc'
import { api } from './api/router'

const rpc = rpcPlugin({ router: api, endpoint: '/api/rpc' })

Bun.serve({
  port: 3000,
  fetch(request) {
    const url = new URL(request.url)
    if (url.pathname === '/api/rpc') {
      return api.handler(request)
    }
    return new Response('Not Found', { status: 404 })
  },
})
```

## Client-Side Usage

Create a typed client and call procedures like local functions:

```ts
// lib/rpc.ts
import { createClient } from '@ereo/rpc/client'
import type { Api } from '../api/router'

export const rpc = createClient<Api>({
  httpEndpoint: '/api/rpc',
})
```

```ts
// Usage
import { rpc } from './lib/rpc'

// Queries
const health = await rpc.health.query()
const posts = await rpc.posts.list.query()
const post = await rpc.posts.byId.query({ id: '123' })

// Mutations
const newPost = await rpc.posts.create.mutate({
  title: 'Hello World',
  content: 'My first post',
})
```

Every call is fully typed. Autocomplete shows available procedures, and TypeScript catches input errors at compile time.

## React Hooks

Use the built-in React hooks for data fetching and mutations:

```tsx
import { useQuery, useMutation } from '@ereo/rpc/client'
import { rpc } from '../lib/rpc'

function PostList() {
  const {
    data: posts,
    isLoading,
    error,
    refetch,
  } = useQuery(rpc.posts.list, {
    refetchInterval: 30000, // Refetch every 30 seconds
  })

  const { mutate: createPost, isPending } = useMutation(rpc.posts.create, {
    onSuccess: () => refetch(),
    onError: (err) => console.error('Failed:', err),
  })

  if (isLoading) return <div>Loading...</div>
  if (error) return <div>Error: {error.message}</div>

  return (
    <div>
      <button
        onClick={() => createPost({ title: 'New Post', content: '...' })}
        disabled={isPending}
      >
        {isPending ? 'Creating...' : 'Create Post'}
      </button>

      <ul>
        {posts?.map((post) => (
          <li key={post.id}>{post.title}</li>
        ))}
      </ul>
    </div>
  )
}
```

### useQuery Options

```ts
const { data, isLoading, error, refetch } = useQuery(rpc.posts.list, {
  // Auto-refetch on interval (milliseconds)
  refetchInterval: 30000,

  // Whether the query should execute
  enabled: true,
})
```

### useMutation Options

```ts
const { mutate, mutateAsync, isPending, error, data } = useMutation(rpc.posts.create, {
  onSuccess: (data) => { /* handle success */ },
  onError: (error) => { /* handle error */ },
  onSettled: () => { /* runs after success or error */ },
})
```

Use `mutateAsync` when you need a promise (e.g. inside an async handler).

## Middleware

Build reusable middleware pipelines by chaining `.use()`:

```ts
// api/procedures.ts
import { procedure } from '@ereo/rpc'

// Public -- no middleware
export const publicProcedure = procedure

// Authenticated -- requires a logged-in user
export const protectedProcedure = procedure.use(async ({ ctx, next }) => {
  const user = ctx.ctx?.user
  if (!user) {
    return {
      ok: false,
      error: { code: 'UNAUTHORIZED', message: 'Must be logged in' },
    }
  }
  return next({ ...ctx, user })
})

// Admin -- extends protectedProcedure with a role check
export const adminProcedure = protectedProcedure.use(async ({ ctx, next }) => {
  if (ctx.user.role !== 'admin') {
    return {
      ok: false,
      error: { code: 'FORBIDDEN', message: 'Admin access required' },
    }
  }
  return next(ctx)
})
```

Each `.use()` call returns a new procedure. The middleware chain runs in order, and each step can extend the context that downstream handlers receive.

### Built-in Middleware

`@ereo/rpc` ships with common middleware:

```ts
import { logging, rateLimit, timing } from '@ereo/rpc'

const loggedProcedure = procedure.use(logging())
const limitedProcedure = procedure.use(rateLimit({ max: 100, windowMs: 60000 }))
const timedProcedure = procedure.use(timing())
```

## Context Bridge

Share context between RPC procedures and EreoJS loaders using the context bridge. This lets RPC handlers access the same user session, database connection, and other context values set by your application middleware:

```ts
// server.ts
import { setContextProvider } from '@ereo/rpc'

setContextProvider((request) => {
  return {
    user: getUserFromRequest(request),
    db: getDatabase(),
  }
})
```

The provider runs once per request. Its return value is available as `ctx.ctx` inside procedures.

## Error Handling

Use `RPCError` for structured errors that the client can handle:

```ts
import { RPCError } from '@ereo/rpc'

export const getPost = publicProcedure.query(
  z.object({ id: z.string() }),
  async ({ input }) => {
    const post = await db.posts.find(input.id)
    if (!post) {
      throw new RPCError('NOT_FOUND', 'Post not found')
    }
    return post
  }
)
```

On the client, errors include the code and message:

```ts
try {
  const post = await rpc.posts.byId.query({ id: 'nonexistent' })
} catch (err) {
  if (err.code === 'NOT_FOUND') {
    // Handle not found
  }
}
```

Error codes include `UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`, `BAD_REQUEST`, `PARSE_ERROR`, and `VALIDATION_ERROR`.

## Server Functions

For standalone server operations that don't need a full router, use `server$` and `createServerBlock`. They add declarative rate limiting, auth, CORS, and caching with a simple config object:

```ts
import { server$, createServerBlock } from '@ereo/rpc'

// Single function with rate limiting
const getMetrics = server$(async (range: string) => {
  return db.metrics.query(range)
}, {
  rateLimit: { max: 30, window: '1m' },
  cache: { maxAge: 60 },
})

// Grouped functions with shared config
const usersApi = createServerBlock({
  rateLimit: { max: 60, window: '1m' },
  auth: { getUser: verifyAuth },
}, {
  list: async () => db.users.findMany(),
  delete: {
    handler: async (id: string) => db.users.delete(id),
    rateLimit: { max: 5, window: '1m' },
  },
})
```

See the [Server Functions guide](/guides/server-functions) for the full walkthrough.

## Related

- [@ereo/rpc API Reference](/api/rpc/) — Full API documentation
- [Procedure Builder](/api/rpc/procedure) — Creating typed procedures
- [Router](/api/rpc/router) — Combining procedures into an API
- [React Hooks](/api/rpc/hooks) — useQuery, useMutation, useSubscription
- [Context Bridge](/api/rpc/context-bridge) — Shared context between RPC and loaders
- [Server Functions](/guides/server-functions) — Declarative server functions with `server$` and `createServerBlock`
- [Server Functions API](/api/rpc/server-block) — Config types and middleware builders
