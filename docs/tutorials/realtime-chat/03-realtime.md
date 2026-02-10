# Chat Tutorial: Real-time

Queries and mutations work over HTTP, but subscriptions need a persistent connection. In this chapter, you'll understand how `@ereo/rpc` uses Bun's native WebSocket support to stream events from server to client, and how the client handles reconnection when the connection drops.

## How WebSockets Work in @ereo/rpc

The RPC plugin automatically handles WebSocket upgrades. When a client connects to the RPC endpoint with a WebSocket, the plugin:

1. **Upgrades** the HTTP connection to a WebSocket
2. **Authenticates** using the same middleware chain as HTTP procedures
3. **Manages subscriptions** — clients can subscribe to multiple topics on a single connection
4. **Heartbeats** — pings every 30 seconds to keep the connection alive
5. **Cleanup** — when the connection closes, all subscriptions are canceled

The protocol is simple JSON messages:

```
Client → Server:
  { type: 'subscribe', id: 'sub_1', path: ['events'], input: { roomId: 'general' } }
  { type: 'unsubscribe', id: 'sub_1' }
  { type: 'ping' }

Server → Client:
  { type: 'data', id: 'sub_1', data: { type: 'message', ... } }
  { type: 'error', id: 'sub_1', error: { code: 'NOT_FOUND', message: '...' } }
  { type: 'complete', id: 'sub_1' }
  { type: 'pong' }
```

Each subscription has a unique `id` that the client generates. The server sends `data` messages with matching `id` fields. When a subscription ends (the generator returns), the server sends `complete`.

## The WebSocket Lifecycle

```
1. Client opens WebSocket connection
   │
2. Server runs middleware chain (auth, rate limit, etc.)
   │
3. Client sends { type: 'subscribe', id: 'sub_1', path: ['events'], input: { roomId: 'general' } }
   │
4. Server looks up the 'events' procedure → calls async generator function
   │
5. Generator starts → waits for events
   │     │
   │     ├── Event arrives → yield event → Server sends { type: 'data', id: 'sub_1', data: event }
   │     ├── Event arrives → yield event → Server sends { type: 'data', id: 'sub_1', data: event }
   │     └── ...continues until client disconnects
   │
6. Client sends { type: 'unsubscribe', id: 'sub_1' }
   │   OR client disconnects
   │
7. Server calls generator.return() → cleanup runs (listener removed from Set)
```

## Client Connection Setup

Create a shared RPC client module that the chat islands will import:

```ts
// app/lib/rpc-client.ts
import { createClient } from '@ereo/rpc/client'
import type { AppRouter } from '~/rpc/router'

function getWsEndpoint() {
  if (typeof window === 'undefined') return 'ws://localhost:3000/api/rpc'
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  return `${protocol}//${window.location.host}/api/rpc`
}

export const rpc = createClient<AppRouter>({
  httpEndpoint: '/api/rpc',
  wsEndpoint: getWsEndpoint(),
  reconnect: {
    enabled: true,
    maxAttempts: 10,
    delayMs: 1000,
    maxDelayMs: 30000,
  },
  heartbeatEnabled: true,
  heartbeatInterval: 30000,
})
```

The `reconnect` config handles dropped connections automatically:

| Option | Default | Purpose |
|--------|---------|---------|
| `enabled` | `true` | Auto-reconnect on disconnect |
| `maxAttempts` | `10` | Give up after N failures |
| `delayMs` | `1000` | Initial retry delay |
| `maxDelayMs` | `30000` | Max delay (exponential backoff) |

When the WebSocket disconnects, the client waits `delayMs`, then doubles the delay on each retry up to `maxDelayMs`. After reconnecting, all active subscriptions are automatically re-established.

## Multiple Subscriptions on One Connection

A single WebSocket connection can handle multiple subscriptions. This is important for the chat app — a user might be subscribed to room events and also listening for typing indicators:

```ts
// Both subscriptions share the same WebSocket connection
const unsub1 = rpc.events.subscribe(
  { roomId: 'general' },
  { onData: (event) => console.log('Room event:', event) }
)

// The client multiplexes via subscription IDs
// Server sees: { type: 'subscribe', id: 'sub_1', path: ['events'], input: { roomId: 'general' } }
```

The client generates unique IDs for each subscription and routes incoming `data` messages to the correct callback based on the `id` field.

## Connection State Management

Create a signal to track connection state across islands:

```ts
// app/lib/connection-state.ts
import { signal } from '@ereo/state'

export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'error'

export const connectionStatus = signal<ConnectionStatus>('connecting')
export const lastError = signal<string | null>(null)
```

## Testing WebSockets Locally

You can test the WebSocket connection using `websocat` (install with `brew install websocat` or `cargo install websocat`):

```bash
# Connect to the RPC WebSocket
websocat ws://localhost:3000/api/rpc

# Subscribe to room events (paste this line):
{"type":"subscribe","id":"test_1","path":["events"],"input":{"roomId":"general"}}

# In another terminal, send a message via HTTP:
curl -X POST http://localhost:3000/api/rpc \
  -H "Content-Type: application/json" \
  -d '{"path":["messages","send"],"type":"mutation","input":{"roomId":"general","username":"alice","content":"Hello WebSocket!"}}'

# Back in websocat, you should see:
# {"type":"data","id":"test_1","data":{"type":"message","roomId":"general","message":{"id":"msg_...","username":"alice","content":"Hello WebSocket!","timestamp":...}}}
```

This confirms that:
1. The WebSocket connection works
2. Subscriptions receive events
3. Mutations broadcast to subscribers

## What We've Done

- Understood the WebSocket protocol used by `@ereo/rpc`
- Learned how subscriptions are managed (subscribe/unsubscribe/cleanup)
- Created a shared RPC client with automatic reconnection
- Set up connection state tracking with signals
- Tested the full real-time pipeline: mutation → event → subscription → client

## Next Step

The real-time infrastructure is ready. In the next chapter, we'll build the React UI — a chat room island with `useSubscription`, a message input with `useMutation`, and a room list with `useQuery`.

[← Previous: Procedures](/tutorials/realtime-chat/02-procedures) | [Continue to Chapter 4: Client UI →](/tutorials/realtime-chat/04-client)
