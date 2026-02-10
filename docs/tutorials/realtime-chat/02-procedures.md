# Chat Tutorial: Procedures

Now that the skeleton is in place, let's build the real chat procedures. You'll create queries to fetch messages and room info, mutations to send messages and manage presence, and — most importantly — a subscription that streams chat events in real time over WebSockets.

## The Chat Event System

Before writing procedures, we need an event emitter. When a user sends a message, joins a room, or starts typing, we emit an event. Subscriptions listen for these events and forward them to connected clients.

```ts
// app/lib/events.ts

export type ChatEvent =
  | { type: 'message'; roomId: string; message: { id: string; username: string; content: string; timestamp: number } }
  | { type: 'user_joined'; roomId: string; username: string }
  | { type: 'user_left'; roomId: string; username: string }
  | { type: 'typing'; roomId: string; username: string }
  | { type: 'stop_typing'; roomId: string; username: string }

const listeners = new Set<(event: ChatEvent) => void>()

export function emit(event: ChatEvent) {
  for (const listener of listeners) {
    listener(event)
  }
}

export function subscribe(roomId: string): AsyncGenerator<ChatEvent, void, unknown> {
  const queue: ChatEvent[] = []
  let resolve: (() => void) | null = null
  let done = false

  const listener = (event: ChatEvent) => {
    if (event.roomId !== roomId) return
    queue.push(event)
    resolve?.()
  }

  listeners.add(listener)

  return {
    async next() {
      if (done) return { value: undefined, done: true }
      while (queue.length === 0) {
        await new Promise<void>((r) => { resolve = r })
        resolve = null
        if (done) return { value: undefined, done: true }
      }
      return { value: queue.shift()!, done: false }
    },
    async return() {
      done = true
      listeners.delete(listener)
      resolve?.()
      return { value: undefined, done: true }
    },
    async throw() {
      done = true
      listeners.delete(listener)
      resolve?.()
      return { value: undefined, done: true }
    },
    [Symbol.asyncIterator]() { return this },
  }
}
```

This is a simple pub/sub pattern. Each subscription creates an async generator that yields events for a specific room. When the client disconnects, `return()` is called and the listener is cleaned up.

## Complete Procedures

Now build all the chat procedures:

```ts
// app/rpc/procedures.ts
import { procedure } from '@ereo/rpc'
import { store } from '~/lib/store'
import { emit, subscribe as subscribeToRoom } from '~/lib/events'
import type { ChatEvent } from '~/lib/events'

const pub = procedure

// --- Queries ---

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

export const getRoom = pub.query(
  { parse: (data: unknown) => data as { roomId: string } },
  ({ input }) => {
    const room = store.getRoom(input.roomId)
    if (!room) throw new Error('Room not found')
    return {
      ...room,
      online: store.getOnlineUsers(room.id),
      messages: store.getMessages(room.id, 50),
    }
  }
)

export const getMessages = pub.query(
  { parse: (data: unknown) => data as { roomId: string; limit?: number } },
  ({ input }) => {
    return store.getMessages(input.roomId, input.limit || 50)
  }
)

// --- Mutations ---

export const sendMessage = pub.mutation(
  { parse: (data: unknown) => data as { roomId: string; username: string; content: string } },
  ({ input }) => {
    const { roomId, username, content } = input

    if (!content.trim()) {
      return { ok: false, error: { code: 'INVALID_INPUT', message: 'Message cannot be empty' } }
    }

    if (content.length > 1000) {
      return { ok: false, error: { code: 'INVALID_INPUT', message: 'Message too long (max 1000 chars)' } }
    }

    const message = store.addMessage(roomId, username, content.trim())

    // Clear typing indicator
    store.clearTyping(roomId, username)

    // Broadcast to subscribers
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

export const joinRoom = pub.mutation(
  { parse: (data: unknown) => data as { roomId: string; username: string } },
  ({ input }) => {
    const { roomId, username } = input

    if (!store.getRoom(roomId)) {
      return { ok: false, error: { code: 'NOT_FOUND', message: 'Room not found' } }
    }

    store.joinRoom(roomId, username)
    emit({ type: 'user_joined', roomId, username })

    return { online: store.getOnlineUsers(roomId) }
  }
)

export const leaveRoom = pub.mutation(
  { parse: (data: unknown) => data as { roomId: string; username: string } },
  ({ input }) => {
    store.leaveRoom(input.roomId, input.username)
    store.clearTyping(input.roomId, input.username)

    emit({ type: 'user_left', roomId: input.roomId, username: input.username })
    emit({ type: 'stop_typing', roomId: input.roomId, username: input.username })

    return { success: true }
  }
)

export const setTyping = pub.mutation(
  { parse: (data: unknown) => data as { roomId: string; username: string } },
  ({ input }) => {
    store.setTyping(input.roomId, input.username)
    emit({ type: 'typing', roomId: input.roomId, username: input.username })
    return { success: true }
  }
)

export const stopTyping = pub.mutation(
  { parse: (data: unknown) => data as { roomId: string; username: string } },
  ({ input }) => {
    store.clearTyping(input.roomId, input.username)
    emit({ type: 'stop_typing', roomId: input.roomId, username: input.username })
    return { success: true }
  }
)

// --- Subscription ---

export const roomEvents = pub.subscription(
  { parse: (data: unknown) => data as { roomId: string } },
  async function* ({ input }): AsyncGenerator<ChatEvent> {
    yield* subscribeToRoom(input.roomId)
  }
)
```

## Update the Router

Add all procedures to the router:

```ts
// app/rpc/router.ts
import { createRouter } from '@ereo/rpc'
import {
  health,
  listRooms,
  getRoom,
  getMessages,
  sendMessage,
  joinRoom,
  leaveRoom,
  setTyping,
  stopTyping,
  roomEvents,
} from './procedures'

export const router = createRouter({
  health,
  rooms: {
    list: listRooms,
    get: getRoom,
    join: joinRoom,
    leave: leaveRoom,
  },
  messages: {
    list: getMessages,
    send: sendMessage,
  },
  typing: {
    start: setTyping,
    stop: stopTyping,
  },
  events: roomEvents,
})

export type AppRouter = typeof router
```

## Understanding the Procedure Types

Let's break down how each procedure type works:

### Queries (read-only)

```ts
// No input — just returns data
export const health = pub.query(() => ({ status: 'ok' }))

// With input — first arg is a schema, second is the handler
export const getRoom = pub.query(
  { parse: (data: unknown) => data as { roomId: string } },
  ({ input }) => { /* input is typed as { roomId: string } */ }
)
```

Queries are idempotent. They can be cached, retried, and called via GET or POST.

### Mutations (write operations)

```ts
export const sendMessage = pub.mutation(
  { parse: (data: unknown) => data as { roomId: string; username: string; content: string } },
  ({ input }) => {
    // Side effects: write to store, emit events
    const message = store.addMessage(input.roomId, input.username, input.content)
    emit({ type: 'message', roomId: input.roomId, message })
    return message
  }
)
```

Mutations have side effects. They always use POST and should not be retried automatically.

### Subscriptions (streaming)

```ts
export const roomEvents = pub.subscription(
  { parse: (data: unknown) => data as { roomId: string } },
  async function* ({ input }) {
    yield* subscribeToRoom(input.roomId)
  }
)
```

Subscriptions use `async function*` (async generators). They yield values over time through a WebSocket connection. When the client unsubscribes or disconnects, the generator's `return()` method is called for cleanup.

## The Event Flow

Here's how sending a message flows through the system:

```
Client A sends "Hello"
  │
  ▼
rpc.messages.send.mutate({ roomId: 'general', username: 'alice', content: 'Hello' })
  │
  ▼
Server: sendMessage mutation
  ├── store.addMessage() → saves to in-memory array
  ├── store.clearTyping() → clears typing indicator
  ├── emit({ type: 'message', ... }) → broadcasts to all listeners
  │   │
  │   ├── Client A's subscription listener → queue.push(event) → yields to generator
  │   ├── Client B's subscription listener → queue.push(event) → yields to generator
  │   └── Client C's subscription listener → queue.push(event) → yields to generator
  │
  └── returns message object to Client A
```

The mutation returns immediately to the caller. The subscription delivers the event asynchronously to all connected clients (including the sender).

## Test the Procedures

Test with curl:

```bash
# List rooms
curl -X POST http://localhost:3000/api/rpc \
  -H "Content-Type: application/json" \
  -d '{"path":["rooms","list"],"type":"query"}'

# Get a room
curl -X POST http://localhost:3000/api/rpc \
  -H "Content-Type: application/json" \
  -d '{"path":["rooms","get"],"type":"query","input":{"roomId":"general"}}'

# Send a message
curl -X POST http://localhost:3000/api/rpc \
  -H "Content-Type: application/json" \
  -d '{"path":["messages","send"],"type":"mutation","input":{"roomId":"general","username":"test","content":"Hello from curl!"}}'

# Get messages
curl -X POST http://localhost:3000/api/rpc \
  -H "Content-Type: application/json" \
  -d '{"path":["messages","list"],"type":"query","input":{"roomId":"general"}}'
```

The last call should return the message you just sent.

## What We've Done

- Built an event emitter for real-time broadcasting
- Created 9 RPC procedures covering all chat operations
- Organized procedures into a nested router (rooms, messages, typing, events)
- Implemented an async generator subscription for room events
- Understood the three procedure types: query, mutation, subscription
- Tested all procedures via curl

## Next Step

The procedures work over HTTP but the subscription needs a WebSocket connection. In the next chapter, we'll set up WebSocket handling and connect the real-time event stream.

[← Previous: Setup](/tutorials/realtime-chat/01-setup) | [Continue to Chapter 3: Real-time →](/tutorials/realtime-chat/03-realtime)
