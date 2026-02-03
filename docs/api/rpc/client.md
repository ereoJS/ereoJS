# Client

The RPC client provides a type-safe proxy for calling server procedures with automatic type inference.

## Import

```ts
import { createClient } from '@ereo/rpc/client'
import type { RPCClientOptions, RPCClientError } from '@ereo/rpc/client'
```

## createClient

Creates a typed client proxy from a router type.

### Signature

```ts
function createClient<T extends Router<RouterDef>>(
  optionsOrEndpoint: string | RPCClientOptions
): InferClient<T['_def']>
```

### Type Definitions

```ts
interface RPCClientOptions {
  /** HTTP endpoint for queries/mutations (e.g., '/api/rpc') */
  httpEndpoint: string

  /** WebSocket endpoint for subscriptions (e.g., 'ws://localhost:3000/api/rpc') */
  wsEndpoint?: string

  /** Custom fetch function */
  fetch?: typeof fetch

  /** Custom headers (static or dynamic) */
  headers?: Record<string, string> | (() => Record<string, string>)

  /** WebSocket reconnect options */
  reconnect?: {
    enabled?: boolean      // Default: true
    maxAttempts?: number   // Default: 10
    delayMs?: number       // Default: 1000
    maxDelayMs?: number    // Default: 30000
  }

  /** Use POST for all requests instead of GET for queries */
  usePostForQueries?: boolean

  /** WebSocket heartbeat interval in milliseconds (default: 30000) */
  heartbeatInterval?: number

  /** Enable WebSocket heartbeat (default: true) */
  heartbeatEnabled?: boolean
}
```

### Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `optionsOrEndpoint` | `string \| RPCClientOptions` | Endpoint URL string or full options object |

### Returns

A typed proxy object that mirrors the router structure with `query()`, `mutate()`, and `subscribe()` methods.

### Examples

#### Minimal Setup

```ts
import { createClient } from '@ereo/rpc/client'
import type { Api } from './api/router'

// Simple string endpoint (HTTP only, no subscriptions)
const rpc = createClient<Api>('/api/rpc')
```

#### Full Configuration

```ts
const rpc = createClient<Api>({
  httpEndpoint: '/api/rpc',
  wsEndpoint: 'ws://localhost:3000/api/rpc',

  // Dynamic headers for auth
  headers: () => ({
    Authorization: `Bearer ${getAuthToken()}`,
  }),

  // Reconnection settings
  reconnect: {
    enabled: true,
    maxAttempts: 15,
    delayMs: 500,
    maxDelayMs: 60000,
  },

  // Heartbeat settings
  heartbeatEnabled: true,
  heartbeatInterval: 30000,
})
```

#### Production Setup

```ts
const rpc = createClient<Api>({
  httpEndpoint: '/api/rpc',
  wsEndpoint: typeof window !== 'undefined'
    ? `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/api/rpc`
    : undefined,

  headers: () => {
    const token = localStorage.getItem('auth_token')
    return token ? { Authorization: `Bearer ${token}` } : {}
  },

  reconnect: {
    enabled: true,
    maxAttempts: 20,
    delayMs: 1000,
    maxDelayMs: 30000,
  },
})
```

## Client Methods

### query()

Executes a query procedure. Uses HTTP GET by default (cacheable).

#### Signature

```ts
// Without input
query(): Promise<TOutput>

// With input
query(input: TInput): Promise<TOutput>
```

#### Examples

```ts
// No input
const health = await rpc.health.query()
// health is typed as { status: string; timestamp: number }

// With input
const user = await rpc.users.get.query({ id: '123' })
// user is typed as User | null

// Nested path
const stats = await rpc.v1.admin.analytics.daily.query()
```

### mutate()

Executes a mutation procedure. Always uses HTTP POST.

#### Signature

```ts
// Without input
mutate(): Promise<TOutput>

// With input
mutate(input: TInput): Promise<TOutput>
```

#### Examples

```ts
// No input
const result = await rpc.auth.logout.mutate()
// result is typed as { success: boolean }

// With input
const newPost = await rpc.posts.create.mutate({
  title: 'Hello World',
  content: 'My first post',
})
// newPost is typed as Post

// Nested path
await rpc.v1.admin.users.ban.mutate({ userId: '123' })
```

### subscribe()

Subscribes to a subscription procedure via WebSocket.

#### Signature

```ts
// Without input
subscribe(callbacks: SubscriptionCallbacks<TOutput>): Unsubscribe

// With input
subscribe(input: TInput, callbacks: SubscriptionCallbacks<TOutput>): Unsubscribe
```

#### Type Definitions

```ts
interface SubscriptionCallbacks<T> {
  onData: (data: T) => void
  onError?: (error: Error) => void
  onComplete?: () => void
}

type Unsubscribe = () => void
```

#### Examples

##### Basic Subscription

```ts
const unsubscribe = rpc.posts.onCreated.subscribe({
  onData: (post) => {
    console.log('New post:', post.title)
    addToList(post)
  },
  onError: (error) => {
    console.error('Subscription error:', error)
    showNotification('Connection lost')
  },
  onComplete: () => {
    console.log('Subscription ended')
  },
})

// Later: cleanup
unsubscribe()
```

##### Subscription with Input

```ts
const unsubscribe = rpc.chat.messages.subscribe(
  { roomId: 'general' },
  {
    onData: (message) => {
      appendMessage(message)
    },
    onError: (error) => {
      console.error('Chat error:', error)
    },
  }
)
```

##### Multiple Subscriptions

```ts
// Subscribe to multiple streams
const unsub1 = rpc.notifications.onNew.subscribe({
  onData: (notification) => showNotification(notification),
})

const unsub2 = rpc.presence.onlineUsers.subscribe({
  onData: (users) => updateOnlineUsers(users),
})

// Cleanup all
function cleanup() {
  unsub1()
  unsub2()
}
```

## Auto-Reconnection

The client automatically reconnects WebSocket connections when they drop.

### Behavior

1. On connection loss, waits for `delayMs` before first retry
2. Each subsequent retry doubles the delay (exponential backoff)
3. Delay is capped at `maxDelayMs`
4. After `maxAttempts`, stops retrying and calls `onError` for all subscriptions
5. On successful reconnect, automatically resubscribes to all active subscriptions

### Configuration

```ts
const rpc = createClient<Api>({
  httpEndpoint: '/api/rpc',
  wsEndpoint: 'ws://localhost:3000/api/rpc',
  reconnect: {
    enabled: true,      // Enable auto-reconnect
    maxAttempts: 10,    // Max retry attempts
    delayMs: 1000,      // Initial delay (1 second)
    maxDelayMs: 30000,  // Max delay (30 seconds)
  },
})
```

### Reconnection Timeline Example

```
Connection lost
├── Wait 1s   → Attempt 1
├── Wait 2s   → Attempt 2
├── Wait 4s   → Attempt 3
├── Wait 8s   → Attempt 4
├── Wait 16s  → Attempt 5
├── Wait 30s  → Attempt 6 (capped)
├── Wait 30s  → Attempt 7
├── Wait 30s  → Attempt 8
├── Wait 30s  → Attempt 9
└── Wait 30s  → Attempt 10 (final)
```

## Heartbeat (Ping/Pong)

The client maintains connection health using heartbeat messages.

### Behavior

1. Client sends `ping` messages at `heartbeatInterval` (default: 30s)
2. Server responds with `pong`
3. If 2 consecutive pongs are missed, connection is considered dead
4. Client closes the connection and triggers reconnection

### Configuration

```ts
const rpc = createClient<Api>({
  httpEndpoint: '/api/rpc',
  wsEndpoint: 'ws://localhost:3000/api/rpc',
  heartbeatEnabled: true,     // Enable heartbeat (default)
  heartbeatInterval: 30000,   // 30 seconds
})
```

### Disabling Heartbeat

```ts
const rpc = createClient<Api>({
  httpEndpoint: '/api/rpc',
  wsEndpoint: 'ws://localhost:3000/api/rpc',
  heartbeatEnabled: false,  // Disable heartbeat
})
```

## Custom Headers

Headers can be static or dynamic (useful for auth tokens).

### Static Headers

```ts
const rpc = createClient<Api>({
  httpEndpoint: '/api/rpc',
  headers: {
    'X-API-Key': 'my-api-key',
    'X-Client-Version': '1.0.0',
  },
})
```

### Dynamic Headers

```ts
const rpc = createClient<Api>({
  httpEndpoint: '/api/rpc',
  headers: () => ({
    Authorization: `Bearer ${getAuthToken()}`,
    'X-Request-ID': generateRequestId(),
  }),
})
```

### Auth Token Pattern

```ts
let authToken: string | null = null

export function setAuthToken(token: string | null) {
  authToken = token
}

export const rpc = createClient<Api>({
  httpEndpoint: '/api/rpc',
  wsEndpoint: 'ws://localhost:3000/api/rpc',
  headers: () => {
    const headers: Record<string, string> = {}
    if (authToken) {
      headers.Authorization = `Bearer ${authToken}`
    }
    return headers
  },
})

// Usage
setAuthToken(await login(email, password))
const user = await rpc.users.me.query()
```

## Custom Fetch

Replace the built-in fetch for testing or custom networking.

```ts
const rpc = createClient<Api>({
  httpEndpoint: '/api/rpc',
  fetch: async (url, init) => {
    console.log('Fetching:', url)
    const response = await fetch(url, init)
    console.log('Response:', response.status)
    return response
  },
})
```

### Testing with Mock Fetch

```ts
const mockFetch = jest.fn().mockResolvedValue({
  json: () => Promise.resolve({ ok: true, data: { id: '1', name: 'Test' } }),
})

const rpc = createClient<Api>({
  httpEndpoint: '/api/rpc',
  fetch: mockFetch,
})

// Test
await rpc.users.get.query({ id: '1' })
expect(mockFetch).toHaveBeenCalledWith(
  expect.stringContaining('path=users.get'),
  expect.any(Object)
)
```

## POST for Queries

By default, queries use GET requests for cacheability. Enable POST for all requests:

```ts
const rpc = createClient<Api>({
  httpEndpoint: '/api/rpc',
  usePostForQueries: true,  // All requests use POST
})
```

**When to use POST for queries:**
- Input data is large (URL length limits)
- Sensitive data shouldn't appear in URLs/logs
- Server doesn't support GET with query params

## Error Handling

### RPCClientError

Errors thrown by the client include additional context:

```ts
interface RPCClientError extends Error {
  code: string        // Error code from server
  path: string        // Procedure path (e.g., "users.get")
  details?: unknown   // Additional error details
}
```

### Handling Errors

```ts
try {
  const user = await rpc.users.get.query({ id: 'invalid' })
} catch (error) {
  if (error.code === 'NOT_FOUND') {
    showMessage('User not found')
  } else if (error.code === 'UNAUTHORIZED') {
    redirectToLogin()
  } else if (error.code === 'VALIDATION_ERROR') {
    showValidationErrors(error.details)
  } else {
    showMessage('An error occurred')
    console.error('RPC Error:', error.path, error.code, error.message)
  }
}
```

### Error Handling Pattern

```ts
async function safeQuery<T>(
  fn: () => Promise<T>,
  fallback: T
): Promise<T> {
  try {
    return await fn()
  } catch (error) {
    console.error('Query failed:', error)
    return fallback
  }
}

// Usage
const posts = await safeQuery(
  () => rpc.posts.list.query(),
  []  // Fallback to empty array
)
```

## Type Inference

The client provides full type inference from the router:

```ts
// Server
const api = createRouter({
  users: {
    get: procedure.query(
      z.object({ id: z.string() }),
      async ({ input }): Promise<User | null> => {
        return db.users.findUnique({ where: { id: input.id } })
      }
    ),
    list: procedure.query(async (): Promise<User[]> => {
      return db.users.findMany()
    }),
  },
})

export type Api = typeof api

// Client
const rpc = createClient<Api>({ httpEndpoint: '/api/rpc' })

// All types are inferred:
const user = await rpc.users.get.query({ id: '123' })
//    ^? User | null

const users = await rpc.users.list.query()
//    ^? User[]

// TypeScript errors for wrong input:
await rpc.users.get.query({ id: 123 }) // Error: number not assignable to string
await rpc.users.get.query({})          // Error: missing required property 'id'
```

## Connection States

### WebSocket Lifecycle

```
┌─────────────────────────────────────────────────────────────┐
│                    Connection States                         │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  [Disconnected] ──subscribe()──> [Connecting]               │
│        ▲                              │                      │
│        │                              │ connected            │
│        │                              ▼                      │
│        │                         [Connected]                 │
│        │                              │                      │
│        │ all unsub'd                  │ connection lost      │
│        │                              ▼                      │
│        └──────────────────── [Reconnecting] ◄───┐            │
│                                       │         │            │
│                                       │ retry   │ fail       │
│                                       └─────────┘            │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Connection Behavior

- WebSocket connects lazily on first `subscribe()` call
- Connection closes automatically when all subscriptions are unsubscribed
- Reconnection only happens if there are active subscriptions
- Multiple `subscribe()` calls share the same WebSocket connection

## Best Practices

1. **Create a single client instance** - Reuse across your application
2. **Use dynamic headers for auth** - Tokens may change during session
3. **Handle errors gracefully** - Check error codes and show appropriate UI
4. **Clean up subscriptions** - Always call `unsubscribe()` when done
5. **Configure reconnection** - Adjust based on your use case
6. **Type your router** - Export `type Api = typeof api` for full inference

## Related

- [Router](/api/rpc/router) - Server-side router
- [React Hooks](/api/rpc/hooks) - useQuery, useMutation, useSubscription
- [Protocol](/api/rpc/protocol) - HTTP and WebSocket protocol specification
