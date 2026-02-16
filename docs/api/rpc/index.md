# @ereo/rpc

Typed RPC layer for EreoJS with chainable middleware and Bun WebSocket subscriptions.

## Overview

`@ereo/rpc` provides a type-safe remote procedure call system that enables seamless client-server communication with full TypeScript inference. Define procedures once on the server and get automatic type safety on the client.

## Features

- **End-to-end Type Inference** - Define procedures on the server, get types on the client automatically
- **Chainable Middleware** - Build reusable procedure pipelines with `procedure.use(auth).use(logging)`
- **WebSocket Subscriptions** - Real-time data streaming with Bun's native WebSocket support
- **Auto-reconnect** - Client automatically reconnects with exponential backoff
- **React Hooks** - `useQuery`, `useMutation`, `useSubscription` for seamless React integration
- **Input Validation** - Zod-compatible schema validation with secure error sanitization
- **Built-in Middleware** - Rate limiting, authentication, logging, and more
- **Server Functions** - `server$` and `createServerBlock` with declarative config for rate limiting, CORS, auth, and caching

## Installation

```bash
bun add @ereo/rpc
```

## Import

### Server-side

```ts
import {
  // Procedure builder
  procedure,

  // Router
  createRouter,
  RPCError,
  errors,

  // Plugin
  rpcPlugin,

  // Context bridge
  setContextProvider,
  createSharedContext,
  withSharedContext,

  // Middleware helpers
  logging,
  rateLimit,
  createAuthMiddleware,
  requireRoles,
  validate,
  extend,
  timing,
  catchErrors,

  // Server functions
  server$,
  createServerBlock,
} from '@ereo/rpc'
```

### Client-side

```ts
import {
  createClient,
  useQuery,
  useMutation,
  useSubscription,
} from '@ereo/rpc/client'
```

## Quick Start

### 1. Define Procedures with Middleware

```ts
// api/procedures.ts
import { procedure, errors } from '@ereo/rpc'

// Base procedure - no middleware
export const publicProcedure = procedure

// Protected procedure - requires authentication
export const protectedProcedure = procedure.use(async ({ ctx, next }) => {
  const user = ctx.ctx.user
  if (!user) {
    return {
      ok: false,
      error: { code: 'UNAUTHORIZED', message: 'Must be logged in' },
    }
  }
  // Extend context with user
  return next({ ...ctx, user })
})

// Admin procedure - requires admin role
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

### 2. Create Router

```ts
// api/router.ts
import { createRouter } from '@ereo/rpc'
import { z } from 'zod'
import { publicProcedure, protectedProcedure, adminProcedure } from './procedures'
import { db, postEvents } from './db'

export const api = createRouter({
  health: publicProcedure.query(() => ({ status: 'ok', time: Date.now() })),

  users: {
    me: protectedProcedure.query(({ user }) => user),

    list: adminProcedure.query(async () => {
      return db.user.findMany()
    }),
  },

  posts: {
    list: publicProcedure.query(async () => {
      return db.post.findMany({ orderBy: { createdAt: 'desc' } })
    }),

    create: protectedProcedure.mutation(
      z.object({ title: z.string().min(1), content: z.string() }),
      async ({ input, user }) => {
        const post = await db.post.create({
          data: { ...input, authorId: user.id },
        })
        postEvents.emit('created', post)
        return post
      }
    ),

    // Real-time subscription
    onCreated: protectedProcedure.subscription(async function* ({ user }) {
      console.log(`User ${user.id} subscribed to post updates`)

      for await (const post of postEvents.on('created')) {
        yield post
      }
    }),
  },
})

export type Api = typeof api
```

### 3. Configure Server

```ts
// server.ts
import { createContext } from '@ereo/core'
import { rpcPlugin } from '@ereo/rpc'
import { api } from './api/router'

const rpc = rpcPlugin({ router: api, endpoint: '/api/rpc' })

Bun.serve({
  port: 3000,

  fetch(request, server) {
    const ctx = createContext(request)

    // Handle WebSocket upgrade for subscriptions
    if (rpc.upgradeToWebSocket(server, request, ctx)) {
      return // Upgraded to WebSocket
    }

    // Handle HTTP requests
    const url = new URL(request.url)
    if (url.pathname === '/api/rpc') {
      return api.handler(request, ctx)
    }

    return new Response('Not Found', { status: 404 })
  },

  // WebSocket handlers from RPC plugin
  websocket: rpc.getWebSocketConfig(),
})
```

### 4. Use on Client

```ts
// client.ts
import { createClient } from '@ereo/rpc/client'
import type { Api } from './api/router'

export const rpc = createClient<Api>({
  httpEndpoint: '/api/rpc',
  wsEndpoint: 'ws://localhost:3000/api/rpc',
  reconnect: {
    enabled: true,
    maxAttempts: 10,
    delayMs: 1000,
  },
})

// Queries (GET, cacheable)
const health = await rpc.health.query()
const me = await rpc.users.me.query()
const posts = await rpc.posts.list.query()

// Mutations (POST)
const newPost = await rpc.posts.create.mutate({
  title: 'Hello World',
  content: 'My first post',
})

// Subscriptions (WebSocket with auto-reconnect)
const unsubscribe = rpc.posts.onCreated.subscribe({
  onData: (post) => console.log('New post:', post),
  onError: (err) => console.error('Subscription error:', err),
  onComplete: () => console.log('Subscription ended'),
})

// Later: unsubscribe()
```

### 5. React Hooks

```tsx
import { useQuery, useMutation, useSubscription } from '@ereo/rpc/client'
import { rpc } from './client'

function PostList() {
  // Query with auto-refetch
  const { data: posts, isLoading, refetch } = useQuery(rpc.posts.list, {
    refetchInterval: 30000, // Refetch every 30s
  })

  // Mutation with optimistic updates
  const { mutate: createPost, isPending } = useMutation(rpc.posts.create, {
    onSuccess: () => refetch(),
  })

  // Real-time subscription
  const { data: latestPost, status } = useSubscription(rpc.posts.onCreated)

  if (isLoading) return <div>Loading...</div>

  return (
    <div>
      <button
        onClick={() => createPost({ title: 'New Post', content: '...' })}
        disabled={isPending}
      >
        Create Post
      </button>

      {latestPost && (
        <div className="notification">
          New post: {latestPost.title}
        </div>
      )}

      <ul>
        {posts?.map((post) => (
          <li key={post.id}>{post.title}</li>
        ))}
      </ul>
    </div>
  )
}
```

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Client                                   │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │
│  │ createClient│  │ React Hooks │  │ WebSocket Auto-Reconnect│  │
│  │  (Proxy)    │  │ useQuery    │  │ Heartbeat Ping/Pong     │  │
│  └──────┬──────┘  └──────┬──────┘  └────────────┬────────────┘  │
└─────────┼────────────────┼──────────────────────┼───────────────┘
          │                │                      │
          │ HTTP GET/POST  │                      │ WebSocket
          ▼                ▼                      ▼
┌─────────────────────────────────────────────────────────────────┐
│                         Server                                   │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │                      Router                                  ││
│  │  ┌─────────┐  ┌─────────────┐  ┌─────────────────────────┐  ││
│  │  │HTTP     │  │WebSocket    │  │Procedure Resolution     │  ││
│  │  │Handler  │  │Handler      │  │from Path                │  ││
│  │  └────┬────┘  └──────┬──────┘  └────────────┬────────────┘  ││
│  └───────┼──────────────┼──────────────────────┼───────────────┘│
│          │              │                      │                 │
│          ▼              ▼                      ▼                 │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │                   Procedure Execution                        ││
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  ││
│  │  │Middleware   │  │Input        │  │Handler              │  ││
│  │  │Chain        │→ │Validation   │→ │Execution            │  ││
│  │  └─────────────┘  └─────────────┘  └─────────────────────┘  ││
│  └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
```

## Design Decisions

| Decision | Rationale |
|----------|-----------|
| Bun WebSocket | Native performance, no external dependencies |
| Async generators | Clean subscription API, automatic cleanup |
| Chainable middleware | Composable, type-safe context extension |
| GET for queries | Browser/CDN cacheable |
| Separate client entry | Tree-shaking keeps server code out of client bundles |
| Auto-reconnect | Production-ready subscriptions out of the box |
| Zod-compatible schemas | Familiar validation API, not Zod-dependent |

## API Reference

- [Procedure Builder](/api/rpc/procedure) - Creating typed procedures
- [Router](/api/rpc/router) - Combining procedures into an API
- [Client](/api/rpc/client) - Type-safe client proxy
- [Middleware](/api/rpc/middleware) - Built-in middleware helpers
- [React Hooks](/api/rpc/hooks) - useQuery, useMutation, useSubscription
- [Plugin](/api/rpc/plugin) - EreoJS plugin integration
- [Context Bridge](/api/rpc/context-bridge) - Shared context between RPC and loaders
- [Types](/api/rpc/types) - TypeScript type definitions
- [Server Functions](/api/rpc/server-block) - `server$` and `createServerBlock` with declarative config
- [Protocol](/api/rpc/protocol) - HTTP and WebSocket protocol specification

## Related

- [Data Loaders](/api/data/loaders) - Server-side data loading
- [Actions](/api/data/actions) - Form actions
- [Context](/api/core/context) - Application context
