# Real-Time

EreoJS runs on Bun, which has native support for both Server-Sent Events (SSE) and WebSockets. This guide covers patterns for adding real-time features to your application.

## Server-Sent Events (SSE)

SSE is the simplest way to push data from server to client. It works over HTTP, supports automatic reconnection, and is ideal for one-way data streams like notifications, live feeds, or progress updates.

### SSE API Route

```ts
// routes/api/events.ts
import type { LoaderArgs } from '@ereo/core'

export async function GET({ request, context }: LoaderArgs) {
  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder()

      // Send an event every 2 seconds
      const interval = setInterval(() => {
        const data = JSON.stringify({
          time: new Date().toISOString(),
          message: 'Server tick',
        })
        controller.enqueue(encoder.encode(`data: ${data}\n\n`))
      }, 2000)

      // Clean up when the client disconnects
      request.signal.addEventListener('abort', () => {
        clearInterval(interval)
        controller.close()
      })
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  })
}
```

### Client-Side SSE

```tsx
import { useState, useEffect } from 'react'

function LiveFeed() {
  const [events, setEvents] = useState<string[]>([])

  useEffect(() => {
    const source = new EventSource('/api/events')

    source.onmessage = (event) => {
      const data = JSON.parse(event.data)
      setEvents((prev) => [...prev, data.message])
    }

    source.onerror = () => {
      // EventSource reconnects automatically
      console.log('SSE connection lost, reconnecting...')
    }

    return () => source.close()
  }, [])

  return (
    <ul>
      {events.map((msg, i) => (
        <li key={i}>{msg}</li>
      ))}
    </ul>
  )
}
```

### Named Events

Send different event types to let the client handle them separately:

```ts
// Server
const event = `event: notification\ndata: ${JSON.stringify(payload)}\n\n`
controller.enqueue(encoder.encode(event))

const chat = `event: chat\ndata: ${JSON.stringify(message)}\n\n`
controller.enqueue(encoder.encode(chat))
```

```ts
// Client
const source = new EventSource('/api/events')

source.addEventListener('notification', (event) => {
  showNotification(JSON.parse(event.data))
})

source.addEventListener('chat', (event) => {
  addMessage(JSON.parse(event.data))
})
```

## WebSocket Routes

For bidirectional communication, use Bun's native WebSocket support. Define a WebSocket handler alongside your HTTP routes:

```ts
// routes/api/ws.ts
import type { ServerWebSocket } from 'bun'

const clients = new Set<ServerWebSocket<{ userId: string }>>()

export function GET({ request, context }) {
  const server = context.get('server')
  const userId = context.get('user')?.id || 'anonymous'

  const upgraded = server.upgrade(request, {
    data: { userId },
  })

  if (!upgraded) {
    return new Response('WebSocket upgrade failed', { status: 400 })
  }
}

export const websocket = {
  open(ws: ServerWebSocket<{ userId: string }>) {
    clients.add(ws)
    broadcast({ type: 'user_joined', userId: ws.data.userId })
  },

  message(ws: ServerWebSocket<{ userId: string }>, message: string) {
    const data = JSON.parse(message)

    // Echo back to sender
    ws.send(JSON.stringify({ type: 'ack', id: data.id }))

    // Broadcast to all other clients
    broadcast({ type: 'message', userId: ws.data.userId, ...data }, ws)
  },

  close(ws: ServerWebSocket<{ userId: string }>) {
    clients.delete(ws)
    broadcast({ type: 'user_left', userId: ws.data.userId })
  },
}

function broadcast(data: unknown, exclude?: ServerWebSocket) {
  const message = JSON.stringify(data)
  for (const client of clients) {
    if (client !== exclude && client.readyState === 1) {
      client.send(message)
    }
  }
}
```

### Client-Side WebSocket with Reconnection

```tsx
import { useState, useEffect, useRef, useCallback } from 'react'

function useWebSocket(url: string) {
  const [messages, setMessages] = useState<unknown[]>([])
  const [status, setStatus] = useState<'connecting' | 'open' | 'closed'>('connecting')
  const wsRef = useRef<WebSocket | null>(null)
  const retriesRef = useRef(0)

  const connect = useCallback(() => {
    const ws = new WebSocket(url)
    wsRef.current = ws

    ws.onopen = () => {
      setStatus('open')
      retriesRef.current = 0
    }

    ws.onmessage = (event) => {
      setMessages((prev) => [...prev, JSON.parse(event.data)])
    }

    ws.onclose = () => {
      setStatus('closed')
      // Reconnect with exponential backoff
      const delay = Math.min(1000 * 2 ** retriesRef.current, 30000)
      retriesRef.current++
      setTimeout(connect, delay)
    }
  }, [url])

  useEffect(() => {
    connect()
    return () => wsRef.current?.close()
  }, [connect])

  const send = useCallback((data: unknown) => {
    wsRef.current?.send(JSON.stringify(data))
  }, [])

  return { messages, status, send }
}
```

## Combining SSE with Loaders

Load initial data with a loader and subscribe to live updates with SSE:

```tsx
// routes/dashboard.tsx
import { createLoader } from '@ereo/data'

export const loader = createLoader(async () => {
  const stats = await db.stats.getCurrent()
  return { stats }
})

export default function Dashboard({ loaderData }) {
  const [stats, setStats] = useState(loaderData.stats)

  useEffect(() => {
    const source = new EventSource('/api/stats-stream')
    source.onmessage = (event) => {
      setStats(JSON.parse(event.data))
    }
    return () => source.close()
  }, [])

  return (
    <div>
      <h1>Dashboard</h1>
      <p>Active users: {stats.activeUsers}</p>
      <p>Revenue today: ${stats.revenueToday}</p>
    </div>
  )
}
```

This pattern gives you fast initial page loads (SSR with loader data) plus live updates after hydration.

## When to Use SSE vs WebSockets

| Feature | SSE | WebSocket |
|---------|-----|-----------|
| Direction | Server to client | Bidirectional |
| Reconnection | Built-in | Manual |
| Protocol | HTTP | WS |
| Complexity | Low | Medium |
| Use cases | Notifications, feeds, progress | Chat, gaming, collaboration |

Use SSE when you only need to push data to the client. Use WebSockets when you need two-way communication.

## Related

- [RPC Guide](/guides/rpc) — Type-safe server functions with subscriptions
- [@ereo/rpc Subscriptions](/api/rpc/hooks) — Real-time hooks via `useSubscription`
- [Islands](/concepts/islands) — Hydrating interactive components on the client
