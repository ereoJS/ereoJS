# Build a SaaS App

In this tutorial, you'll build **TaskFlow** — a multi-tenant project management application from scratch. By the end, you'll have a production-ready SaaS app that uses nearly every part of the Ereo framework working together.

## What You'll Build

TaskFlow lets teams organize work into projects and tasks. Users can sign up, create teams, invite members, and track progress in real time.

**Features:**

- User registration and login with session management
- Team workspaces with role-based access (owner, admin, member)
- Projects with task boards (to-do, in progress, done)
- Rich task forms with validation, assignees, and due dates
- Interactive dashboard with live-updating statistics
- Real-time task updates via RPC subscriptions
- Full-stack observability with tracing

## Architecture Overview

```
┌─────────────────────────────────────────────────┐
│  Browser                                         │
│  ┌──────────┐ ┌──────────┐ ┌──────────────────┐ │
│  │ Islands   │ │ Forms    │ │ RPC Client       │ │
│  │ (signals) │ │ (useForm)│ │ (WebSocket)      │ │
│  └──────────┘ └──────────┘ └──────────────────┘ │
├─────────────────────────────────────────────────┤
│  Server (Bun)                                    │
│  ┌──────────┐ ┌──────────┐ ┌──────────────────┐ │
│  │ Auth     │ │ Loaders/ │ │ RPC Router       │ │
│  │ Plugin   │ │ Actions  │ │ (procedures)     │ │
│  └──────────┘ └──────────┘ └──────────────────┘ │
│  ┌──────────┐ ┌──────────┐ ┌──────────────────┐ │
│  │ Drizzle  │ │ Trace    │ │ Middleware       │ │
│  │ + SQLite │ │          │ │                  │ │
│  └──────────┘ └──────────┘ └──────────────────┘ │
└─────────────────────────────────────────────────┘
```

## Packages Used

| Package | Purpose |
|---------|---------|
| `@ereo/core` | App creation, plugins, environment |
| `@ereo/router` | File-based routing |
| `@ereo/data` | Loaders, actions, caching |
| `@ereo/client` | Navigation, islands, links |
| `@ereo/server` | Bun HTTP server, middleware |
| `@ereo/state` | Signals and stores |
| `@ereo/forms` | Form management and validation |
| `@ereo/auth` | Authentication and sessions |
| `@ereo/db` | Database abstraction |
| `@ereo/db-drizzle` | Drizzle ORM adapter |
| `@ereo/rpc` | Type-safe RPC with WebSockets |
| `@ereo/trace` | Full-stack observability |
| `@ereo/plugin-tailwind` | Styling |

## Prerequisites

- [Bun](https://bun.sh) v1.0.0 or later
- Completed the [Blog Tutorial](/tutorials/blog/01-setup) (recommended)
- Familiarity with React and TypeScript
- Basic understanding of SQL databases

## Time Estimate

This is a comprehensive tutorial. Plan for **4–5 hours** to complete all chapters, or work through them over multiple sessions.

| Chapter | Topic | Time |
|---------|-------|------|
| [1. Setup](/tutorials/saas/01-setup) | Project scaffolding and database schema | 25 min |
| [2. Authentication](/tutorials/saas/02-authentication) | Login, registration, sessions, roles | 35 min |
| [3. Database](/tutorials/saas/03-database) | Drizzle ORM, queries, transactions | 30 min |
| [4. Forms](/tutorials/saas/04-forms) | Task creation, validation, field arrays | 40 min |
| [5. Islands & State](/tutorials/saas/05-islands) | Interactive dashboard, signals | 35 min |
| [6. RPC & Real-time](/tutorials/saas/06-rpc-realtime) | Live updates via WebSockets | 40 min |
| [7. Observability & Deployment](/tutorials/saas/07-deploy) | Tracing, production config | 30 min |

## Ready?

[Start Chapter 1: Setup →](/tutorials/saas/01-setup)
