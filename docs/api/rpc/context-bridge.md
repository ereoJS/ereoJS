# Context Bridge

Shared context between RPC procedures and route loaders/actions, enabling seamless state sharing across different API patterns.

## Import

```ts
import {
  setContextProvider,
  getContextProvider,
  clearContextProvider,
  createSharedContext,
  createContextProvider,
  withSharedContext,
  useSharedContext,
} from '@ereo/rpc'

import type {
  ContextProvider,
  RouterWithContextOptions,
  ContextBridgeConfig,
} from '@ereo/rpc'
```

## Overview

The context bridge allows you to share state (authentication, database connections, configuration) between:
- RPC procedure handlers
- Route loaders
- Route actions
- React components (via hydration)

This eliminates duplication and ensures consistency across your API surface.

## ContextProvider Type

```ts
type ContextProvider<TContext = any> = (request: Request) => TContext | Promise<TContext>
```

A function that creates context from an HTTP request. Called for each request to provide fresh context.

## setContextProvider

Registers a global context provider.

### Signature

```ts
function setContextProvider<TContext>(provider: ContextProvider<TContext>): void
```

### Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `provider` | `ContextProvider<TContext>` | Function that creates context from request |

### Example

```ts
import { setContextProvider } from '@ereo/rpc'
import { getSession } from './auth'
import { createDbConnection } from './db'

// Register at app startup
setContextProvider(async (request) => {
  const session = await getSession(request)
  const db = createDbConnection()

  return {
    session,
    db,
    user: session?.user ?? null,
    isAuthenticated: !!session?.user,
  }
})
```

## getContextProvider

Retrieves the current global context provider.

### Signature

```ts
function getContextProvider(): ContextProvider | null
```

### Returns

The registered context provider, or `null` if none is set.

### Example

```ts
import { getContextProvider } from '@ereo/rpc'

const provider = getContextProvider()
if (provider) {
  const ctx = await provider(request)
  console.log('Context:', ctx)
}
```

## clearContextProvider

Clears the global context provider. Useful for testing.

### Signature

```ts
function clearContextProvider(): void
```

### Example

```ts
import { clearContextProvider, setContextProvider } from '@ereo/rpc'

// In test setup
beforeEach(() => {
  clearContextProvider()
})

afterEach(() => {
  clearContextProvider()
})

test('with mock context', async () => {
  setContextProvider(() => ({
    user: { id: 'test-user', role: 'admin' },
    db: mockDb,
  }))

  // Test code...
})
```

## createSharedContext

Creates context from a request using the global provider.

### Signature

```ts
async function createSharedContext(request: Request): Promise<any>
```

### Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `request` | `Request` | The HTTP request |

### Returns

The context object created by the provider, or an empty object if no provider is set.

### Example

```ts
import { createSharedContext } from '@ereo/rpc'

// In a request handler
async function handleRequest(request: Request) {
  const ctx = await createSharedContext(request)

  if (!ctx.isAuthenticated) {
    return new Response('Unauthorized', { status: 401 })
  }

  // Use ctx.user, ctx.db, etc.
}
```

## createContextProvider

Helper to create a typed context provider with better TypeScript inference.

### Signature

```ts
function createContextProvider<TContext>(
  provider: ContextProvider<TContext>
): ContextProvider<TContext>
```

### Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `provider` | `ContextProvider<TContext>` | The context provider function |

### Returns

The same provider with improved type inference.

### Example

```ts
import { createContextProvider, setContextProvider } from '@ereo/rpc'

interface AppContext {
  user: User | null
  db: Database
  config: AppConfig
}

// Create typed provider
const contextProvider = createContextProvider<AppContext>(async (request) => {
  const user = await getUserFromRequest(request)
  return {
    user,
    db: getDatabase(),
    config: getAppConfig(),
  }
})

// Register it
setContextProvider(contextProvider)
```

## withSharedContext

Middleware that injects shared context into RPC procedure context.

### Signature

```ts
function withSharedContext(): MiddlewareFn<BaseContext, BaseContext>
```

### Returns

A middleware function that merges shared context into `ctx.ctx`.

### Example

```ts
import { procedure, withSharedContext } from '@ereo/rpc'

// Create procedure with shared context
const contextProcedure = procedure.use(withSharedContext())

// Now handlers have access to shared context
const getUser = contextProcedure.query(({ ctx }) => {
  // ctx.ctx contains the shared context
  return ctx.ctx.user
})
```

### How It Works

```ts
// Before: ctx.ctx = { /* app context from @ereo/core */ }
// After:  ctx.ctx = { ...ctx.ctx, ...sharedContext }

const withSharedContext = () => async ({ ctx, next }) => {
  const sharedCtx = await createSharedContext(ctx.request)
  return next({
    ...ctx,
    ctx: { ...ctx.ctx, ...sharedCtx },
  })
}
```

## useSharedContext

React hook to access shared context on the client (via hydration).

### Signature

```ts
function useSharedContext<T>(): T | null
```

### Returns

The shared context if available on the client, or `null`.

### Current Implementation

**Important:** `useSharedContext` is currently a placeholder implementation. It simply reads from `window.__EREO_SHARED_CONTEXT__` and does not integrate with React Context or provide reactivity.

```ts
// Actual implementation
export function useSharedContext<T>(): T | null {
  if (typeof window !== 'undefined') {
    return window.__EREO_SHARED_CONTEXT__ ?? null
  }
  return null
}
```

This means:
- It only works on the client side
- Changes to the context after initial load are not tracked
- It returns `null` during SSR (server-side rendering)

### Example

```tsx
import { useSharedContext } from '@ereo/rpc'

interface SharedContext {
  user: User | null
  config: AppConfig
}

function UserMenu() {
  const ctx = useSharedContext<SharedContext>()

  if (!ctx?.user) {
    return <LoginButton />
  }

  return (
    <div>
      <span>Welcome, {ctx.user.name}!</span>
      <LogoutButton />
    </div>
  )
}
```

### Required Server-Side Hydration Setup

For `useSharedContext` to work, **you must hydrate the context from the server**. This involves injecting a script tag that sets `window.__EREO_SHARED_CONTEXT__` before your React app hydrates.

```tsx
// In your server rendering (e.g., entry-server.tsx)
import { renderToString } from 'react-dom/server'
import { createSharedContext } from '@ereo/rpc'

export async function render(request: Request) {
  const ctx = await createSharedContext(request)

  // IMPORTANT: Only serialize safe, non-sensitive data
  const safeCtx = {
    user: ctx.user ? { id: ctx.user.id, name: ctx.user.name } : null,
    config: ctx.config,
    // Do NOT include: tokens, passwords, internal IDs, etc.
  }

  const html = renderToString(
    <html>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `window.__EREO_SHARED_CONTEXT__ = ${JSON.stringify(safeCtx)}`
          }}
        />
      </head>
      <body>
        <App />
      </body>
    </html>
  )

  return html
}
```

### Security Warning

**Never serialize sensitive data** into `window.__EREO_SHARED_CONTEXT__`:

```ts
// DANGEROUS - Never do this!
const ctx = await createSharedContext(request)
const html = `window.__EREO_SHARED_CONTEXT__ = ${JSON.stringify(ctx)}`
// This might expose: session tokens, API keys, database connections, etc.

// SAFE - Only include what the client needs
const safeCtx = {
  user: ctx.user ? {
    id: ctx.user.id,
    name: ctx.user.name,
    role: ctx.user.role,
  } : null,
  features: ctx.features,
  publicConfig: ctx.config.public,
}
const html = `window.__EREO_SHARED_CONTEXT__ = ${JSON.stringify(safeCtx)}`
```

Data that should **never** be serialized:
- Session tokens or JWTs
- API keys or secrets
- Database connection strings
- Internal user IDs that shouldn't be exposed
- Password hashes or security-related data
- Server-only configuration

## Complete Example

### Context Provider Setup

```ts
// context/provider.ts
import { createContextProvider, setContextProvider } from '@ereo/rpc'
import { getSession } from './auth'
import { prisma } from './db'

export interface AppContext {
  user: {
    id: string
    email: string
    role: 'user' | 'admin'
  } | null
  db: typeof prisma
  request: Request
}

const contextProvider = createContextProvider<AppContext>(async (request) => {
  const session = await getSession(request)

  return {
    user: session?.user ?? null,
    db: prisma,
    request,
  }
})

export function initializeContext() {
  setContextProvider(contextProvider)
}
```

### RPC Router with Shared Context

```ts
// api/router.ts
import { createRouter, procedure, withSharedContext } from '@ereo/rpc'
import type { AppContext } from '../context/provider'

// Base procedure with shared context
const baseProcedure = procedure.use(withSharedContext())

// Auth procedure that requires user
const authedProcedure = baseProcedure.use(async ({ ctx, next }) => {
  const appCtx = ctx.ctx as AppContext

  if (!appCtx.user) {
    return {
      ok: false,
      error: { code: 'UNAUTHORIZED', message: 'Please log in' },
    }
  }

  return next({ ...ctx, user: appCtx.user })
})

export const api = createRouter({
  // Public - uses shared context
  config: baseProcedure.query(({ ctx }) => {
    const appCtx = ctx.ctx as AppContext
    return {
      isLoggedIn: !!appCtx.user,
      features: getFeatures(appCtx.user),
    }
  }),

  // Protected - has typed user
  me: authedProcedure.query(({ user, ctx }) => {
    const appCtx = ctx.ctx as AppContext
    return appCtx.db.user.findUnique({ where: { id: user.id } })
  }),
})
```

### Route Loader with Shared Context

```ts
// routes/dashboard.loader.ts
import { createLoader } from '@ereo/data'
import { createSharedContext } from '@ereo/rpc'
import type { AppContext } from '../context/provider'

export const loader = createLoader(async ({ request }) => {
  const ctx = await createSharedContext(request) as AppContext

  if (!ctx.user) {
    throw redirect('/login')
  }

  const [stats, recentActivity] = await Promise.all([
    ctx.db.stats.findFirst({ where: { userId: ctx.user.id } }),
    ctx.db.activity.findMany({
      where: { userId: ctx.user.id },
      take: 10,
      orderBy: { createdAt: 'desc' },
    }),
  ])

  return { stats, recentActivity }
})
```

### Server Entry

```ts
// server.ts
import { initializeContext } from './context/provider'
import { api } from './api/router'
import { rpcPlugin } from '@ereo/rpc'

// Initialize context provider before server starts
initializeContext()

const rpc = rpcPlugin({ router: api })

Bun.serve({
  port: 3000,
  fetch(request, server) {
    // Context is automatically available in RPC handlers
    // and can be accessed in loaders via createSharedContext
    if (rpc.upgradeToWebSocket(server, request, ctx)) {
      return undefined
    }

    // ... rest of server setup
  },
  websocket: rpc.getWebSocketConfig(),
})
```

## Best Practices

1. **Initialize early** - Call `setContextProvider` before server starts
2. **Type your context** - Use `createContextProvider<T>` for type safety
3. **Keep context lightweight** - Only include what's needed across requests
4. **Clear in tests** - Use `clearContextProvider()` in test setup/teardown
5. **Don't store request-specific data** - Context is shared, use per-request data in handlers

## Related

- [Middleware](/api/rpc/middleware) - Built-in middleware helpers
- [Procedure Builder](/api/rpc/procedure) - Creating procedures
- [Data Loaders](/api/data/loaders) - Route loaders
