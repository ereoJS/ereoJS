# Chat Tutorial: Polish & Deploy

The chat works, but it has no security. Anyone can impersonate any username by crafting their own RPC calls, and a single client could flood the server with messages. In this final chapter, you'll add authentication middleware to procedures, rate limiting, error handling, and deploy the app.

## Auth Middleware

Right now the procedures trust whatever `username` the client sends. Let's enforce that the username comes from the server-side cookie instead.

Create an auth middleware that extracts the username from the request:

```ts
// app/rpc/middleware.ts
import { procedure, RPCError } from '@ereo/rpc'
import type { BaseContext } from '@ereo/rpc'

// Extract username from cookie and add to context
export const authed = procedure.use(async ({ ctx, next }) => {
  const request = ctx.request
  const cookieHeader = request?.headers?.get('Cookie') || ''
  const match = cookieHeader.match(/username=([^;]+)/)
  const username = match ? decodeURIComponent(match[1]) : null

  if (!username) {
    return {
      ok: false,
      error: { code: 'UNAUTHORIZED', message: 'Must be logged in to chat' },
    }
  }

  return next({ ...ctx, username })
})
```

## Rate Limiting

Add rate limiting to prevent message spam. `@ereo/rpc` includes a built-in rate limiter:

```ts
// app/rpc/middleware.ts (continued)
import { rateLimit } from '@ereo/rpc/middleware'

// 30 messages per minute per user
export const messageRateLimit = rateLimit({
  limit: 30,
  windowMs: 60 * 1000,
  keyFn: (ctx) => {
    // Rate limit by username from cookie
    const cookieHeader = ctx.request?.headers?.get('Cookie') || ''
    const match = cookieHeader.match(/username=([^;]+)/)
    return match ? decodeURIComponent(match[1]) : 'anonymous'
  },
  message: 'Slow down! You can send 30 messages per minute.',
})

// 10 typing events per 10 seconds
export const typingRateLimit = rateLimit({
  limit: 10,
  windowMs: 10 * 1000,
  keyFn: (ctx) => {
    const cookieHeader = ctx.request?.headers?.get('Cookie') || ''
    const match = cookieHeader.match(/username=([^;]+)/)
    return match ? `typing:${decodeURIComponent(match[1] || 'anon')}` : 'typing:anon'
  },
  message: 'Typing indicator rate limited.',
})
```

## Update Procedures with Middleware

Refactor the procedures to use the auth middleware. The username now comes from `ctx.username` instead of `input.username`:

```ts
// app/rpc/procedures.ts (updated)
import { procedure } from '@ereo/rpc'
import { store } from '~/lib/store'
import { emit, subscribe as subscribeToRoom } from '~/lib/events'
import { authed, messageRateLimit, typingRateLimit } from './middleware'
import type { ChatEvent } from '~/lib/events'

const pub = procedure

// Public queries — no auth needed
export const health = pub.query(() => ({
  status: 'ok',
  rooms: store.getRooms().length,
  timestamp: Date.now(),
}))

export const listRooms = pub.query(() => {
  return store.getRooms().map((room) => ({
    ...room,
    online: store.getOnlineUsers(room.id).length,
  }))
})

// Authenticated queries
export const getRoom = authed.query(
  { parse: (data: unknown) => data as { roomId: string } },
  ({ input, username }) => {
    const room = store.getRoom(input.roomId)
    if (!room) throw new Error('Room not found')
    return {
      ...room,
      online: store.getOnlineUsers(room.id),
      messages: store.getMessages(room.id, 50),
    }
  }
)

export const getMessages = authed.query(
  { parse: (data: unknown) => data as { roomId: string; limit?: number } },
  ({ input }) => {
    return store.getMessages(input.roomId, input.limit || 50)
  }
)

// Authenticated + rate-limited mutations
const authedWithLimit = authed.use(messageRateLimit)

export const sendMessage = authedWithLimit.mutation(
  { parse: (data: unknown) => data as { roomId: string; content: string } },
  ({ input, username }) => {
    const { roomId, content } = input

    if (!content.trim()) {
      return { ok: false, error: { code: 'INVALID_INPUT', message: 'Message cannot be empty' } }
    }

    if (content.length > 1000) {
      return { ok: false, error: { code: 'INVALID_INPUT', message: 'Message too long (max 1000 chars)' } }
    }

    // Username comes from the auth middleware, not from client input
    const message = store.addMessage(roomId, username, content.trim())
    store.clearTyping(roomId, username)

    emit({
      type: 'message',
      roomId,
      message: {
        id: message.id,
        username: message.username,
        content: message.content,
        timestamp: message.timestamp,
      },
    })

    emit({ type: 'stop_typing', roomId, username })

    return message
  }
)

export const joinRoom = authed.mutation(
  { parse: (data: unknown) => data as { roomId: string } },
  ({ input, username }) => {
    if (!store.getRoom(input.roomId)) {
      return { ok: false, error: { code: 'NOT_FOUND', message: 'Room not found' } }
    }

    store.joinRoom(input.roomId, username)
    emit({ type: 'user_joined', roomId: input.roomId, username })
    return { online: store.getOnlineUsers(input.roomId) }
  }
)

export const leaveRoom = authed.mutation(
  { parse: (data: unknown) => data as { roomId: string } },
  ({ input, username }) => {
    store.leaveRoom(input.roomId, username)
    store.clearTyping(input.roomId, username)
    emit({ type: 'user_left', roomId: input.roomId, username })
    emit({ type: 'stop_typing', roomId: input.roomId, username })
    return { success: true }
  }
)

// Typing with separate rate limit
const authedWithTypingLimit = authed.use(typingRateLimit)

export const setTyping = authedWithTypingLimit.mutation(
  { parse: (data: unknown) => data as { roomId: string } },
  ({ input, username }) => {
    store.setTyping(input.roomId, username)
    emit({ type: 'typing', roomId: input.roomId, username })
    return { success: true }
  }
)

export const stopTyping = authed.mutation(
  { parse: (data: unknown) => data as { roomId: string } },
  ({ input, username }) => {
    store.clearTyping(input.roomId, username)
    emit({ type: 'stop_typing', roomId: input.roomId, username })
    return { success: true }
  }
)

// Authenticated subscription
export const roomEvents = authed.subscription(
  { parse: (data: unknown) => data as { roomId: string } },
  async function* ({ input }): AsyncGenerator<ChatEvent> {
    yield* subscribeToRoom(input.roomId)
  }
)
```

Notice the key changes:
- `sendMessage` no longer accepts `username` from client input — it uses `ctx.username` from the auth middleware
- `joinRoom` and `leaveRoom` also use the server-side username
- `sendMessage` has message rate limiting (30/min)
- `setTyping` has typing rate limiting (10/10s)
- Queries that access room data require authentication

## Update the Client Calls

Since `username` is no longer in the mutation input, update the ChatRoom island:

```tsx
// In app/components/ChatRoom.tsx, update the mutation calls:

// Before: rpc.messages.send.mutate({ roomId, username, content })
// After:
await sendMutation.mutateAsync({ roomId, content })

// Before: rpc.rooms.join.mutate({ roomId, username })
// After:
joinMutation.mutate({ roomId })

// Before: rpc.rooms.leave.mutate({ roomId, username })
// After:
leaveMutation.mutate({ roomId })

// Before: rpc.typing.start.mutate({ roomId, username })
// After:
typingMutation.mutate({ roomId })

// Before: rpc.typing.stop.mutate({ roomId, username })
// After:
stopTypingMutation.mutate({ roomId })
```

The server now trusts the cookie, not the client. If someone tries to send a message with a forged username via curl, the auth middleware will use the cookie value instead.

## Error Handling

Add error handling to the ChatRoom island for rate limit errors and disconnects:

```tsx
// Add to ChatRoom.tsx — inside the component, after the state declarations:

const [error, setError] = useState<string | null>(null)

// Update handleSend:
async function handleSend(e: React.FormEvent) {
  e.preventDefault()
  const content = inputValue.trim()
  if (!content) return

  setInputValue('')
  setError(null)
  clearTimeout(typingTimeoutRef.current)

  try {
    await sendMutation.mutateAsync({ roomId, content })
  } catch (err: any) {
    // Show rate limit errors to the user
    setError(err.message || 'Failed to send message')
    // Restore the input so they can retry
    setInputValue(content)
  }
}

// Add error display above the input:
{error && (
  <div className="px-4 py-2 bg-red-900/30 border-t border-red-800">
    <p className="text-sm text-red-400">{error}</p>
  </div>
)}
```

## The Middleware Chain

Here's how a `sendMessage` call flows through the middleware stack:

```
Client: rpc.messages.send.mutate({ roomId: 'general', content: 'Hello' })
  │
  ▼
HTTP POST /api/rpc
  │
  ▼
1. authed middleware
   ├── Read Cookie header → extract username
   ├── No username? → return { ok: false, error: 'UNAUTHORIZED' }
   └── Has username → next({ ...ctx, username: 'alice' })
       │
       ▼
2. messageRateLimit middleware
   ├── Check: has 'alice' sent < 30 messages in last 60s?
   ├── Over limit? → return { ok: false, error: 'RATE_LIMITED' }
   └── Under limit → next(ctx)
       │
       ▼
3. sendMessage handler
   ├── Validate content (not empty, not too long)
   ├── store.addMessage(roomId, ctx.username, content)
   ├── emit({ type: 'message', ... })
   └── return message
```

Middleware composes from left to right. Each `use()` call wraps the previous chain.

## Build and Deploy

### Build the App

```bash
bun run build
```

### Deploy with Docker

```dockerfile
FROM oven/bun:1 AS base
WORKDIR /app

COPY package.json bun.lockb ./
RUN bun install --frozen-lockfile --production

COPY . .
RUN bun run build

EXPOSE 3000
CMD ["bun", "run", "start"]
```

```bash
docker build -t chatterbox .
docker run -p 3000:3000 chatterbox
```

### Deploy to Fly.io

```bash
fly launch --name chatterbox
fly deploy
```

> **Note on scaling**: This tutorial uses an in-memory store, so messages are lost on restart and each server instance has its own message history. For a production chat app, you'd use Redis or a database for persistence and Redis pub/sub for cross-instance event broadcasting. The RPC procedures and subscription patterns remain the same — only the store implementation changes.

## What We've Built

Across these 5 chapters, you built a real-time chat app that demonstrates the full `@ereo/rpc` toolkit:

| Feature | RPC Concept |
|---------|-------------|
| Fetch rooms and messages | `query` procedures |
| Send messages, join/leave rooms | `mutation` procedures |
| Live message streaming | `subscription` (WebSocket) |
| Auth from cookies | Procedure middleware (`.use()`) |
| Spam prevention | Rate limiting middleware |
| Type-safe client | `createClient<AppRouter>()` inference |
| React integration | `useQuery`, `useMutation`, `useSubscription` |
| Reconnection | Client `reconnect` config |

## Key Takeaways

1. **Procedures are composable**: Stack middleware with `.use()` to build auth → rate limit → handler chains
2. **Subscriptions are async generators**: `yield` values to stream them to clients; `return()` handles cleanup
3. **One WebSocket, many subscriptions**: The client multiplexes subscriptions over a single connection
4. **Type inference is automatic**: Define the router type once, the client infers everything
5. **Optimistic UI + subscriptions**: Mutations update local state immediately; subscriptions sync with other clients

## Further Reading

- [Guide: RPC](/guides/rpc) — detailed guide covering advanced patterns
- [Guide: Real-time](/guides/real-time) — SSE and WebSocket patterns
- [API: RPC Procedures](/api/rpc/procedure) — full procedure API reference
- [API: RPC Middleware](/api/rpc/middleware) — all built-in middleware
- [API: RPC Client](/api/rpc/client) — client configuration and hooks
- [Tutorial: SaaS App](/tutorials/saas/) — uses RPC in a full-stack context with auth, database, and forms

[← Previous: Client UI](/tutorials/realtime-chat/04-client)
