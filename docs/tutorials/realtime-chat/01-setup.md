# Chat Tutorial: Setup

In this chapter, you'll scaffold the Chatterbox project, install `@ereo/rpc`, and write your first procedure — a simple health check query that proves everything is wired up correctly.

## Create the Project

```bash
bunx create-ereo@latest chatterbox --template minimal
cd chatterbox
```

Install the RPC package:

```bash
bun add @ereo/rpc @ereo/state
```

## Project Structure

Create the directories we'll need:

```bash
mkdir -p app/rpc app/components app/lib
```

Final structure:

```
chatterbox/
├── app/
│   ├── routes/
│   │   ├── _layout.tsx        # Root layout
│   │   ├── index.tsx          # Landing / username picker
│   │   └── chat/
│   │       ├── _layout.tsx    # Chat layout
│   │       └── [room].tsx     # Chat room
│   ├── rpc/
│   │   ├── router.ts          # RPC router
│   │   └── procedures.ts      # All procedures
│   ├── components/
│   │   ├── ChatRoom.tsx        # Main chat island
│   │   ├── RoomList.tsx        # Room list island
│   │   └── TypingIndicator.tsx # Typing indicator
│   └── lib/
│       └── store.ts            # In-memory message store
├── ereo.config.ts
└── package.json
```

## In-Memory Store

Since we're focusing on RPC patterns, we'll store everything in memory. Create the data store:

```ts
// app/lib/store.ts

export interface Message {
  id: string
  roomId: string
  username: string
  content: string
  timestamp: number
}

export interface Room {
  id: string
  name: string
  description: string
}

// Predefined rooms
const rooms: Room[] = [
  { id: 'general', name: 'General', description: 'General discussion' },
  { id: 'random', name: 'Random', description: 'Off-topic chat' },
  { id: 'help', name: 'Help', description: 'Ask for help' },
]

// Messages per room (capped at 100 per room)
const messages = new Map<string, Message[]>()

// Online users per room
const onlineUsers = new Map<string, Set<string>>()

// Who is typing per room
const typingUsers = new Map<string, Map<string, number>>()

export const store = {
  // --- Rooms ---
  getRooms(): Room[] {
    return rooms
  },

  getRoom(roomId: string): Room | undefined {
    return rooms.find((r) => r.id === roomId)
  },

  // --- Messages ---
  getMessages(roomId: string, limit = 50): Message[] {
    const roomMessages = messages.get(roomId) || []
    return roomMessages.slice(-limit)
  },

  addMessage(roomId: string, username: string, content: string): Message {
    const msg: Message = {
      id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      roomId,
      username,
      content,
      timestamp: Date.now(),
    }

    if (!messages.has(roomId)) messages.set(roomId, [])
    const roomMessages = messages.get(roomId)!
    roomMessages.push(msg)

    // Cap at 100 messages per room
    if (roomMessages.length > 100) {
      roomMessages.splice(0, roomMessages.length - 100)
    }

    return msg
  },

  // --- Presence ---
  joinRoom(roomId: string, username: string) {
    if (!onlineUsers.has(roomId)) onlineUsers.set(roomId, new Set())
    onlineUsers.get(roomId)!.add(username)
  },

  leaveRoom(roomId: string, username: string) {
    onlineUsers.get(roomId)?.delete(username)
  },

  getOnlineUsers(roomId: string): string[] {
    return [...(onlineUsers.get(roomId) || [])]
  },

  // --- Typing ---
  setTyping(roomId: string, username: string) {
    if (!typingUsers.has(roomId)) typingUsers.set(roomId, new Map())
    typingUsers.get(roomId)!.set(username, Date.now())
  },

  clearTyping(roomId: string, username: string) {
    typingUsers.get(roomId)?.delete(username)
  },

  getTypingUsers(roomId: string, excludeUser?: string): string[] {
    const typing = typingUsers.get(roomId)
    if (!typing) return []

    const now = Date.now()
    const active: string[] = []

    for (const [user, timestamp] of typing) {
      // Typing expires after 3 seconds
      if (now - timestamp < 3000 && user !== excludeUser) {
        active.push(user)
      } else if (now - timestamp >= 3000) {
        typing.delete(user)
      }
    }

    return active
  },
}
```

## First Procedure: Health Check

Write your first RPC procedure — a simple query that returns the server status:

```ts
// app/rpc/procedures.ts
import { procedure } from '@ereo/rpc'
import { store } from '~/lib/store'

// Public procedure (no auth required yet)
const pub = procedure

export const health = pub.query(() => {
  return {
    status: 'ok',
    rooms: store.getRooms().length,
    timestamp: Date.now(),
  }
})

export const listRooms = pub.query(() => {
  return store.getRooms().map((room) => ({
    ...room,
    online: store.getOnlineUsers(room.id).length,
  }))
})
```

## Create the Router

Wire the procedures into a router and export its type:

```ts
// app/rpc/router.ts
import { createRouter } from '@ereo/rpc'
import { health, listRooms } from './procedures'

export const router = createRouter({
  health,
  rooms: {
    list: listRooms,
  },
})

// Export the type — clients use this for type inference
export type AppRouter = typeof router
```

## App Configuration

Register the RPC plugin:

```ts
// ereo.config.ts
import { defineConfig } from '@ereo/core'
import { rpcPlugin } from '@ereo/rpc'
import { router } from './app/rpc/router'

const rpc = rpcPlugin({
  router,
  endpoint: '/api/rpc',
})

export default defineConfig({
  plugins: [rpc],
})
```

## Root Layout

```tsx
// app/routes/_layout.tsx
import type { RouteComponentProps } from '@ereo/core'

export default function RootLayout({ children }: RouteComponentProps) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Chatterbox</title>
        <link rel="stylesheet" href="/styles.css" />
      </head>
      <body className="bg-gray-900 text-white min-h-screen">
        {children}
      </body>
    </html>
  )
}
```

## Landing Page

A simple username picker. We'll store the username in a cookie:

```tsx
// app/routes/index.tsx
import { createAction, redirect } from '@ereo/data'
import { Form, useNavigation } from '@ereo/client'
import type { RouteComponentProps } from '@ereo/core'

export const action = createAction(async ({ request }) => {
  const formData = await request.formData()
  const username = (formData.get('username') as string || '').trim()

  if (!username || username.length < 2 || username.length > 20) {
    return { error: 'Username must be 2–20 characters.' }
  }

  if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
    return { error: 'Username can only contain letters, numbers, hyphens, and underscores.' }
  }

  return redirect('/chat/general', {
    headers: {
      'Set-Cookie': `username=${encodeURIComponent(username)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${60 * 60 * 24}`,
    },
  })
})

export default function Home(props: RouteComponentProps) {
  const navigation = useNavigation()
  const isSubmitting = navigation.state === 'submitting'

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="w-full max-w-sm px-4">
        <h1 className="text-4xl font-bold text-center mb-2">Chatterbox</h1>
        <p className="text-gray-400 text-center mb-8">Pick a username to start chatting.</p>

        <Form method="post" className="space-y-4">
          <input
            name="username"
            type="text"
            placeholder="Username"
            required
            minLength={2}
            maxLength={20}
            autoFocus
            className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-3 bg-blue-600 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {isSubmitting ? 'Joining...' : 'Join Chat'}
          </button>
        </Form>
      </div>
    </div>
  )
}
```

## Verify It Works

Start the dev server:

```bash
bun run dev
```

Test the health check procedure with curl:

```bash
curl -X POST http://localhost:3000/api/rpc \
  -H "Content-Type: application/json" \
  -d '{"path":["health"],"type":"query"}'
```

You should see:

```json
{"ok":true,"data":{"status":"ok","rooms":3,"timestamp":1707500000000}}
```

Visit `http://localhost:3000` to see the username picker. Enter a name and you'll be redirected to `/chat/general` (which will 404 — we'll build that next).

## Understanding Procedures

A procedure is a server function exposed through the RPC router. There are three types:

| Type | HTTP Method | Use Case |
|------|-------------|----------|
| `query` | GET (or POST) | Read data. No side effects. |
| `mutation` | POST | Write data. Has side effects. |
| `subscription` | WebSocket | Stream data. Long-lived connection. |

The procedure builder supports chaining:

```ts
const pub = procedure                     // base procedure
const authed = pub.use(authMiddleware)     // add auth middleware
const admin = authed.use(adminMiddleware)  // add role check

// Create endpoints at any level
const healthCheck = pub.query(() => ...)         // no auth
const myProfile = authed.query(() => ...)        // requires login
const deleteUser = admin.mutation(schema, fn)    // admin only
```

## What We've Done

- Scaffolded a new Ereo project with `@ereo/rpc`
- Created an in-memory store for rooms, messages, presence, and typing
- Written first RPC procedures (health check, room list)
- Wired the router with exported type for client inference
- Built a username picker with cookie-based sessions
- Verified the RPC endpoint works with curl

## Next Step

In the next chapter, we'll build the full set of chat procedures — sending messages, managing presence, and the subscription that streams messages in real time.

[Continue to Chapter 2: Procedures →](/tutorials/realtime-chat/02-procedures)
