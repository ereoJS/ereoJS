# Chat Tutorial: Client UI

With the server procedures and WebSocket infrastructure ready, it's time to build the frontend. In this chapter, you'll use the `@ereo/rpc` React hooks — `useQuery`, `useMutation`, and `useSubscription` — to build a fully reactive chat interface as Ereo islands.

## The Three RPC Hooks

| Hook | Purpose | Connection |
|------|---------|------------|
| `useQuery` | Fetch data once (with optional refetch) | HTTP |
| `useMutation` | Trigger server actions | HTTP |
| `useSubscription` | Stream real-time data | WebSocket |

These hooks are imported from `@ereo/rpc/client` and work with the typed client you created in the previous chapter.

## Chat Room Island

This is the main island — it loads message history, subscribes to live events, and renders the full chat UI:

```tsx
// app/components/ChatRoom.tsx
'use client'
import { useState, useEffect, useRef } from 'react'
import { useQuery, useMutation, useSubscription } from '@ereo/rpc/client'
import { createIsland } from '@ereo/client'
import { rpc } from '~/lib/rpc-client'
import type { ChatEvent } from '~/lib/events'

interface ChatRoomProps {
  roomId: string
  username: string
}

interface Message {
  id: string
  username: string
  content: string
  timestamp: number
}

function ChatRoom({ roomId, username }: ChatRoomProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [inputValue, setInputValue] = useState('')
  const [typingUsers, setTypingUsers] = useState<string[]>([])
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout>>()

  // Load initial messages
  const { data: roomData, isLoading } = useQuery(rpc.rooms.get, {
    input: { roomId },
  })

  // Populate messages from initial query
  useEffect(() => {
    if (roomData?.messages) {
      setMessages(roomData.messages)
    }
  }, [roomData])

  // Join room on mount
  const joinMutation = useMutation(rpc.rooms.join)
  const leaveMutation = useMutation(rpc.rooms.leave)

  useEffect(() => {
    joinMutation.mutate({ roomId, username })
    return () => {
      leaveMutation.mutate({ roomId, username })
    }
  }, [roomId, username])

  // Subscribe to real-time events
  const subscription = useSubscription(rpc.events, {
    input: { roomId },
    enabled: true,
    onData: (event: ChatEvent) => {
      switch (event.type) {
        case 'message':
          setMessages((prev) => [...prev, event.message])
          // Remove sender from typing
          setTypingUsers((prev) => prev.filter((u) => u !== event.message.username))
          break
        case 'typing':
          if (event.username !== username) {
            setTypingUsers((prev) =>
              prev.includes(event.username) ? prev : [...prev, event.username]
            )
            // Auto-clear typing after 3s
            setTimeout(() => {
              setTypingUsers((prev) => prev.filter((u) => u !== event.username))
            }, 3000)
          }
          break
        case 'stop_typing':
          setTypingUsers((prev) => prev.filter((u) => u !== event.username))
          break
        case 'user_joined':
        case 'user_left':
          // Refetch room data to update online list
          break
      }
    },
  })

  // Send message mutation
  const sendMutation = useMutation(rpc.messages.send)
  const typingMutation = useMutation(rpc.typing.start)
  const stopTypingMutation = useMutation(rpc.typing.stop)

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    setInputValue(e.target.value)

    // Send typing indicator (debounced)
    clearTimeout(typingTimeoutRef.current)
    if (e.target.value.trim()) {
      typingMutation.mutate({ roomId, username })
      typingTimeoutRef.current = setTimeout(() => {
        stopTypingMutation.mutate({ roomId, username })
      }, 2000)
    } else {
      stopTypingMutation.mutate({ roomId, username })
    }
  }

  async function handleSend(e: React.FormEvent) {
    e.preventDefault()
    const content = inputValue.trim()
    if (!content) return

    setInputValue('')
    clearTimeout(typingTimeoutRef.current)

    await sendMutation.mutateAsync({ roomId, username, content })
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-gray-500">Loading messages...</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Connection status */}
      <div className="flex items-center gap-2 px-4 py-2 bg-gray-800 border-b border-gray-700">
        <div className={`w-2 h-2 rounded-full ${subscription.isActive ? 'bg-green-500' : 'bg-yellow-500'}`} />
        <span className="text-xs text-gray-400">
          {subscription.isActive ? 'Connected' : subscription.status === 'connecting' ? 'Connecting...' : 'Reconnecting...'}
        </span>
        <span className="text-xs text-gray-600 ml-auto">
          {roomData?.online?.length ?? 0} online
        </span>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.map((msg) => (
          <MessageBubble
            key={msg.id}
            message={msg}
            isOwn={msg.username === username}
          />
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Typing indicator */}
      {typingUsers.length > 0 && (
        <div className="px-4 py-1">
          <p className="text-xs text-gray-500 italic">
            {typingUsers.length === 1
              ? `${typingUsers[0]} is typing...`
              : `${typingUsers.join(', ')} are typing...`}
          </p>
        </div>
      )}

      {/* Input */}
      <form onSubmit={handleSend} className="p-4 border-t border-gray-700 flex gap-2">
        <input
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          placeholder="Type a message..."
          maxLength={1000}
          autoFocus
          className="flex-1 px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
        <button
          type="submit"
          disabled={!inputValue.trim() || sendMutation.isPending}
          className="px-4 py-2 bg-blue-600 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          Send
        </button>
      </form>
    </div>
  )
}

export default createIsland(ChatRoom, 'ChatRoom')

function MessageBubble({ message, isOwn }: { message: Message; isOwn: boolean }) {
  const time = new Date(message.timestamp).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  })

  return (
    <div className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-xs lg:max-w-md ${isOwn ? 'order-2' : ''}`}>
        {!isOwn && (
          <p className="text-xs text-gray-500 mb-1 px-1">{message.username}</p>
        )}
        <div
          className={`px-3 py-2 rounded-lg ${
            isOwn
              ? 'bg-blue-600 text-white'
              : 'bg-gray-800 text-gray-100'
          }`}
        >
          <p className="text-sm break-words">{message.content}</p>
        </div>
        <p className="text-xs text-gray-600 mt-1 px-1">{time}</p>
      </div>
    </div>
  )
}
```

## Room List Island

A sidebar that shows available rooms with live online counts:

```tsx
// app/components/RoomList.tsx
'use client'
import { useQuery } from '@ereo/rpc/client'
import { createIsland } from '@ereo/client'
import { rpc } from '~/lib/rpc-client'

interface RoomListProps {
  currentRoomId: string
}

function RoomList({ currentRoomId }: RoomListProps) {
  const { data: rooms, isLoading } = useQuery(rpc.rooms.list, {
    refetchInterval: 5000, // Refresh every 5 seconds for online counts
  })

  if (isLoading) {
    return <div className="p-4 text-gray-500 text-sm">Loading rooms...</div>
  }

  return (
    <nav className="space-y-1">
      {rooms?.map((room) => {
        const isActive = room.id === currentRoomId
        return (
          <a
            key={room.id}
            href={`/chat/${room.id}`}
            className={`block px-3 py-2 rounded-lg text-sm transition-colors ${
              isActive
                ? 'bg-gray-700 text-white'
                : 'text-gray-400 hover:bg-gray-800 hover:text-gray-200'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="font-medium"># {room.name}</span>
              {room.online > 0 && (
                <span className="text-xs bg-gray-700 text-gray-400 px-1.5 py-0.5 rounded">
                  {room.online}
                </span>
              )}
            </div>
            <p className="text-xs text-gray-600 mt-0.5">{room.description}</p>
          </a>
        )
      })}
    </nav>
  )
}

export default createIsland(RoomList, 'RoomList')
```

## Chat Layout

Create the chat layout with a sidebar and main content area:

```tsx
// app/routes/chat/_layout.tsx
import { createLoader, redirect } from '@ereo/data'
import { Outlet } from '@ereo/client'
import RoomList from '~/components/RoomList'
import type { RouteComponentProps } from '@ereo/core'

export const loader = createLoader(async ({ request }) => {
  // Read username from cookie
  const cookieHeader = request.headers.get('Cookie') || ''
  const match = cookieHeader.match(/username=([^;]+)/)
  const username = match ? decodeURIComponent(match[1]) : null

  if (!username) return redirect('/')

  return { username }
})

export default function ChatLayout({ loaderData, children }: RouteComponentProps) {
  const { username } = loaderData

  return (
    <div className="flex h-screen">
      {/* Sidebar */}
      <aside className="w-60 bg-gray-900 border-r border-gray-800 flex flex-col">
        <div className="p-4 border-b border-gray-800">
          <h1 className="font-bold text-lg">Chatterbox</h1>
          <p className="text-sm text-gray-500">{username}</p>
        </div>
        <div className="flex-1 p-3 overflow-y-auto">
          <RoomList client:load currentRoomId="" />
        </div>
        <div className="p-3 border-t border-gray-800">
          <a href="/" className="text-xs text-gray-600 hover:text-gray-400">Change username</a>
        </div>
      </aside>

      {/* Main chat area */}
      <main className="flex-1 flex flex-col">
        {children}
      </main>
    </div>
  )
}
```

## Chat Room Route

Wire the ChatRoom island into the route:

```tsx
// app/routes/chat/[room].tsx
import { createLoader, redirect } from '@ereo/data'
import { store } from '~/lib/store'
import ChatRoom from '~/components/ChatRoom'
import type { RouteComponentProps } from '@ereo/core'

export const loader = createLoader(async ({ params, request }) => {
  const room = store.getRoom(params.room)
  if (!room) throw new Response('Room not found', { status: 404 })

  const cookieHeader = request.headers.get('Cookie') || ''
  const match = cookieHeader.match(/username=([^;]+)/)
  const username = match ? decodeURIComponent(match[1]) : null

  if (!username) return redirect('/')

  return { room, username }
})

export default function ChatRoomPage({ loaderData }: RouteComponentProps) {
  const { room, username } = loaderData

  return (
    <div className="flex flex-col h-full">
      {/* Room header */}
      <header className="px-4 py-3 bg-gray-900 border-b border-gray-800">
        <h2 className="font-semibold"># {room.name}</h2>
        <p className="text-xs text-gray-500">{room.description}</p>
      </header>

      {/* Chat island */}
      <div className="flex-1 min-h-0" style={{ height: '100%' }}>
        <ChatRoom client:load roomId={room.id} username={username} />
      </div>
    </div>
  )
}
```

## Understanding the Hook Lifecycle

Here's what happens when the ChatRoom island mounts:

```
1. ChatRoom mounts
   │
   ├── useQuery(rpc.rooms.get, { input: { roomId } })
   │   └── HTTP POST /api/rpc → returns room + messages
   │       └── setMessages(roomData.messages) → initial render
   │
   ├── useMutation(rpc.rooms.join)
   │   └── useEffect → joinMutation.mutate({ roomId, username })
   │       └── HTTP POST /api/rpc → server adds user to room → emits 'user_joined'
   │
   └── useSubscription(rpc.events, { input: { roomId } })
       └── Opens WebSocket → sends { type: 'subscribe', path: ['events'], input: { roomId } }
           │
           ├── Server yields 'user_joined' → onData callback → (handled)
           ├── Someone sends message → server yields 'message' → onData → setMessages(prev => [...prev, msg])
           ├── Someone types → server yields 'typing' → onData → setTypingUsers(...)
           └── ...continues until unmount
               │
               └── useEffect cleanup → leaveRoom + unsubscribe
```

The key pattern: `useQuery` for initial data, `useSubscription` for live updates, `useMutation` for user actions. They compose naturally.

## useSubscription Return Values

The `useSubscription` hook returns useful state:

```ts
const {
  data,          // Most recent event
  history,       // Array of all received events
  error,         // Error if subscription failed
  status,        // 'idle' | 'connecting' | 'connected' | 'error' | 'closed'
  isActive,      // true when status is 'connected' or 'connecting'
  unsubscribe,   // Manually unsubscribe
  resubscribe,   // Reconnect after unsubscribe
} = useSubscription(...)
```

We use `isActive` for the connection indicator and `status` for the reconnecting state.

## Try It Out

1. Visit `http://localhost:3000`, enter a username, join the chat
2. Open a second browser tab (or incognito window), enter a different username
3. Send a message in one tab — it appears instantly in the other
4. Start typing in one tab — the other shows the typing indicator
5. Watch the green "Connected" indicator in the header

## What We've Done

- Built the ChatRoom island with `useQuery`, `useMutation`, and `useSubscription`
- Created a RoomList with auto-refreshing online counts
- Wired islands into routes with proper server-side data loading
- Implemented typing indicators with debounced mutation calls
- Handled the full lifecycle: join room → subscribe → send messages → leave room

## Next Step

The chat works but has no security — anyone can impersonate any username, and there's no rate limiting. In the final chapter, we'll add auth middleware, rate limiting, and prepare for deployment.

[← Previous: Real-time](/tutorials/realtime-chat/03-realtime) | [Continue to Chapter 5: Polish & Deploy →](/tutorials/realtime-chat/05-polish)
