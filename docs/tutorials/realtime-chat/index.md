# Build a Real-time Chat App

In this tutorial, you'll build **Chatterbox** — a real-time chat application powered by `@ereo/rpc`. You'll learn how to define type-safe procedures, connect clients via WebSockets, and build reactive UI with subscriptions — all with end-to-end type inference from server to client.

## What You'll Build

Chatterbox is a multi-room chat app where users pick a username, join rooms, and send messages that appear instantly for everyone in the room. No page reloads, no polling.

**Features:**

- Type-safe RPC queries, mutations, and subscriptions
- WebSocket connections with automatic reconnection
- Multiple chat rooms with live participant lists
- Typing indicators and online presence
- React hooks: `useQuery`, `useMutation`, `useSubscription`
- Auth middleware and rate limiting on procedures

## Architecture

```
┌────────────────────┐          ┌────────────────────┐
│  Browser (React)   │          │  Browser (React)    │
│  ┌──────────────┐  │          │  ┌──────────────┐   │
│  │ useSubscription│ │◀──WS──▶│  │ useSubscription│  │
│  │ useMutation  │  │         │  │ useMutation   │   │
│  │ useQuery     │  │         │  │ useQuery      │   │
│  └──────────────┘  │          │  └──────────────┘   │
└────────────────────┘          └────────────────────┘
          │                              │
          └──────────┬───────────────────┘
                     │ WebSocket + HTTP
              ┌──────▼──────┐
              │  Bun Server  │
              │  ┌────────┐  │
              │  │  RPC    │  │
              │  │ Router  │  │
              │  │         │  │
              │  │ queries │  │
              │  │ mutate  │  │
              │  │ subscribe│ │
              │  └────────┘  │
              └──────────────┘
```

No database in this tutorial — messages are kept in memory. This lets us focus entirely on the RPC and real-time patterns without database setup distracting from the core concepts.

## Prerequisites

- [Bun](https://bun.sh) v1.0.0 or later
- Familiarity with React and TypeScript
- No prior RPC experience needed — we'll build from fundamentals

## Time Estimate

| Chapter | Topic | Time |
|---------|-------|------|
| [1. Setup](/tutorials/realtime-chat/01-setup) | Project scaffolding and first procedure | 20 min |
| [2. Procedures](/tutorials/realtime-chat/02-procedures) | Queries, mutations, subscriptions | 30 min |
| [3. Real-time](/tutorials/realtime-chat/03-realtime) | WebSocket subscriptions and event broadcasting | 30 min |
| [4. Client UI](/tutorials/realtime-chat/04-client) | React hooks, islands, chat interface | 35 min |
| [5. Polish](/tutorials/realtime-chat/05-polish) | Auth middleware, rate limiting, deployment | 25 min |

**Total: ~2.5 hours**

## Ready?

[Start Chapter 1: Setup →](/tutorials/realtime-chat/01-setup)
