# @ereo/rpc

Typed RPC layer for EreoJS with chainable middleware and Bun WebSocket subscriptions.

## Features

- **End-to-end type inference** - Define once on server, get types on client
- **Chainable middleware** - Build reusable procedure pipelines (`procedure.use(auth).use(logging)`)
- **WebSocket subscriptions** - Real-time data with Bun's native WebSocket support
- **Auto-reconnect** - Client automatically reconnects with exponential backoff
- **React hooks** - `useQuery`, `useMutation`, `useSubscription`
- **`server$` & `createServerBlock`** - Declarative server functions with built-in rate limiting, auth, CORS, and caching

## Quick Start

### 1. Define procedures with middleware

```typescript
// api/procedures.ts
import { procedure, errors } from '@ereo/rpc';

// Base procedure - no middleware
export const publicProcedure = procedure;

// Protected procedure - requires authentication
export const protectedProcedure = procedure.use(async ({ ctx, next }) => {
  const user = ctx.ctx.user;
  if (!user) {
    return {
      ok: false,
      error: { code: 'UNAUTHORIZED', message: 'Must be logged in' },
    };
  }
  // Extend context with user
  return next({ ...ctx, user });
});

// Admin procedure - requires admin role
export const adminProcedure = protectedProcedure.use(async ({ ctx, next }) => {
  if (ctx.user.role !== 'admin') {
    return {
      ok: false,
      error: { code: 'FORBIDDEN', message: 'Admin access required' },
    };
  }
  return next(ctx);
});
```

### 2. Create router

```typescript
// api/router.ts
import { createRouter } from '@ereo/rpc';
import { z } from 'zod';
import { publicProcedure, protectedProcedure, adminProcedure } from './procedures';
import { db, postEvents } from './db';

export const api = createRouter({
  health: publicProcedure.query(() => ({ status: 'ok', time: Date.now() })),

  users: {
    me: protectedProcedure.query(({ user }) => user),

    list: adminProcedure.query(async () => {
      return db.user.findMany();
    }),
  },

  posts: {
    list: publicProcedure.query(async () => {
      return db.post.findMany({ orderBy: { createdAt: 'desc' } });
    }),

    create: protectedProcedure.mutation(
      z.object({ title: z.string().min(1), content: z.string() }),
      async ({ input, user }) => {
        const post = await db.post.create({
          data: { ...input, authorId: user.id },
        });
        postEvents.emit('created', post);
        return post;
      }
    ),

    // Real-time subscription
    onCreated: protectedProcedure.subscription(async function* ({ user }) {
      console.log(`User ${user.id} subscribed to post updates`);

      for await (const post of postEvents.on('created')) {
        yield post;
      }
    }),
  },
});

export type Api = typeof api;
```

### 3. Configure server

```typescript
// server.ts
import { createContext } from '@ereo/core';
import { rpcPlugin } from '@ereo/rpc';
import { api } from './api/router';

const rpc = rpcPlugin({ router: api, endpoint: '/api/rpc' });

Bun.serve({
  port: 3000,

  fetch(request, server) {
    const ctx = createContext(request);

    // Handle WebSocket upgrade for subscriptions
    if (rpc.upgradeToWebSocket(server, request, ctx)) {
      return; // Upgraded to WebSocket
    }

    // Handle HTTP requests
    const url = new URL(request.url);
    if (url.pathname === '/api/rpc') {
      return api.handler(request, ctx);
    }

    return new Response('Not Found', { status: 404 });
  },

  // WebSocket handlers from RPC plugin
  websocket: rpc.getWebSocketConfig(),
});
```

### 4. Use on client

```typescript
// client.ts
import { createClient } from '@ereo/rpc/client';
import type { Api } from './api/router';

export const rpc = createClient<Api>({
  httpEndpoint: '/api/rpc',
  wsEndpoint: 'ws://localhost:3000/api/rpc',
  reconnect: {
    enabled: true,
    maxAttempts: 10,
    delayMs: 1000,
  },
});

// Queries (GET, cacheable)
const health = await rpc.health.query();
const me = await rpc.users.me.query();
const posts = await rpc.posts.list.query();

// Mutations (POST)
const newPost = await rpc.posts.create.mutate({
  title: 'Hello World',
  content: 'My first post',
});

// Subscriptions (WebSocket with auto-reconnect)
const unsubscribe = rpc.posts.onCreated.subscribe({
  onData: (post) => console.log('New post:', post),
  onError: (err) => console.error('Subscription error:', err),
  onComplete: () => console.log('Subscription ended'),
});

// Later: unsubscribe()
```

### 5. React hooks

```tsx
import { useQuery, useMutation, useSubscription } from '@ereo/rpc/client';
import { rpc } from './client';

function PostList() {
  // Query with auto-refetch
  const { data: posts, isLoading, refetch } = useQuery(rpc.posts.list, {
    refetchInterval: 30000, // Refetch every 30s
  });

  // Mutation with optimistic updates
  const { mutate: createPost, isPending } = useMutation(rpc.posts.create, {
    onSuccess: () => refetch(),
  });

  // Real-time subscription
  const { data: latestPost, status } = useSubscription(rpc.posts.onCreated);

  if (isLoading) return <div>Loading...</div>;

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
  );
}
```

## Middleware

Middleware functions can:
1. **Transform context** - Add data for downstream procedures
2. **Short-circuit** - Return an error to stop execution
3. **Chain** - Compose multiple middleware together

```typescript
import { procedure, type MiddlewareFn, type BaseContext } from '@ereo/rpc';

// Type-safe middleware that adds `user` to context
type AuthContext = BaseContext & { user: User };

const authMiddleware: MiddlewareFn<BaseContext, AuthContext> = async ({ ctx, next }) => {
  const token = ctx.request.headers.get('Authorization');
  const user = await verifyToken(token);

  if (!user) {
    return { ok: false, error: { code: 'UNAUTHORIZED', message: 'Invalid token' } };
  }

  return next({ ...ctx, user });
};

// Logging middleware
const logMiddleware: MiddlewareFn<BaseContext, BaseContext> = async ({ ctx, next }) => {
  const start = performance.now();
  const result = await next(ctx);
  console.log(`Request took ${performance.now() - start}ms`);
  return result;
};

// Compose middleware
const protectedProcedure = procedure
  .use(logMiddleware)
  .use(authMiddleware);

// Now all procedures using `protectedProcedure` have `user` in context
const api = createRouter({
  me: protectedProcedure.query(({ user }) => user), // `user` is typed!
});
```

## Subscriptions

Subscriptions use async generators and Bun's native WebSocket:

```typescript
// Server: Define subscription
const api = createRouter({
  countdown: procedure.subscription(
    z.object({ from: z.number() }),
    async function* ({ input }) {
      for (let i = input.from; i >= 0; i--) {
        yield { count: i };
        await new Promise((r) => setTimeout(r, 1000));
      }
    }
  ),

  // Event-based subscription
  notifications: protectedProcedure.subscription(async function* ({ user }) {
    const channel = pubsub.subscribe(`user:${user.id}:notifications`);
    try {
      for await (const notification of channel) {
        yield notification;
      }
    } finally {
      channel.unsubscribe();
    }
  }),
});

// Client: Subscribe with input
const unsub = rpc.countdown.subscribe(
  { from: 10 },
  {
    onData: ({ count }) => console.log(count),
    onComplete: () => console.log('Done!'),
  }
);
```

## Error Handling

```typescript
import { errors, RPCError } from '@ereo/rpc';

// Built-in errors
throw errors.unauthorized('Must be logged in');
throw errors.forbidden('Admin only');
throw errors.notFound('Post not found');
throw errors.badRequest('Invalid input');

// Custom errors
throw new RPCError('RATE_LIMITED', 'Too many requests', 429);

// Client-side
try {
  await rpc.posts.create.mutate({ title: '' });
} catch (error) {
  if (error.code === 'VALIDATION_ERROR') {
    // Handle validation error
  }
}
```

## Protocol

### HTTP (Queries & Mutations)

```
GET  /api/rpc?path=posts.list&input={"limit":10}
POST /api/rpc { "path": ["posts", "create"], "type": "mutation", "input": {...} }
```

### WebSocket (Subscriptions)

```typescript
// Client → Server
{ "type": "subscribe", "id": "sub_1", "path": ["posts", "onCreated"], "input": {} }
{ "type": "unsubscribe", "id": "sub_1" }

// Server → Client
{ "type": "data", "id": "sub_1", "data": { "id": "1", "title": "..." } }
{ "type": "error", "id": "sub_1", "error": { "code": "...", "message": "..." } }
{ "type": "complete", "id": "sub_1" }
```

## Server Functions (`server$` & `createServerBlock`)

For quick server operations that don't need a full router setup, use `server$` with declarative config:

```typescript
import { server$, createServerBlock } from '@ereo/rpc';

// Single function with rate limiting and caching
export const getMetrics = server$(async (timeRange: string, ctx) => {
  return db.metrics.findMany({ where: { range: timeRange } });
}, {
  rateLimit: { max: 30, window: '1m' },
  cache: { maxAge: 60 },
  auth: { getUser: verifyAuth },
});

// Group related functions with shared config
const usersApi = createServerBlock({
  rateLimit: { max: 60, window: '1m' },
  auth: { getUser: verifyAuth },
}, {
  getById: async (id: string) => db.users.find(id),
  list: async () => db.users.findMany(),
  delete: {
    handler: async (id: string) => db.users.delete(id),
    rateLimit: { max: 5, window: '1m' }, // stricter limit
  },
});
```

See [Server Functions docs](./docs/server-functions.md) for the full API reference.

## Design Decisions

| Decision | Rationale |
|----------|-----------|
| Bun WebSocket | Native performance, no external dependencies |
| Async generators | Clean subscription API, automatic cleanup |
| Chainable middleware | Composable, type-safe context extension |
| GET for queries | Browser/CDN cacheable |
| Separate client entry | Tree-shaking keeps server code out |
| Auto-reconnect | Production-ready subscriptions out of the box |
| Per-instance rate limit stores | `server$` functions get isolated counters — no cross-contamination |
| Config compiles to middleware | Declarative config is sugar over `ServerFnMiddleware` arrays |
