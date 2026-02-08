# Dashboard Tutorial

Build an authenticated dashboard with interactive islands.

## Overview

In this tutorial, you'll build a team dashboard featuring:

- **User authentication** with sessions
- **Protected routes** using middleware
- **Interactive widgets** using islands architecture
- **Shared state** between islands using signals
- **Real-time updates** with WebSockets
- **Production deployment**

## Prerequisites

Before starting this tutorial, you should have:

- Completed the [Blog Tutorial](/tutorials/blog/01-setup)
- Basic understanding of [Authentication](/guides/authentication)
- Familiarity with [Islands Architecture](/concepts/islands)

## What You'll Build

```
┌─────────────────────────────────────────────────────────────┐
│  Dashboard                         Welcome, John    [Logout]│
├────────────┬────────────────────────────────────────────────┤
│            │                                                │
│  Overview  │   ┌─────────┐ ┌─────────┐ ┌─────────┐         │
│  Analytics │   │  Users  │ │ Revenue │ │ Orders  │         │
│  Settings  │   │  1,234  │ │ $54,321 │ │   892   │         │
│            │   │  ↑ 12%  │ │  ↑ 8%   │ │  ↓ 3%   │         │
│            │   └─────────┘ └─────────┘ └─────────┘         │
│            │                                                │
│            │   ┌─────────────────────────────────────────┐ │
│            │   │            Revenue Chart                │ │
│            │   │    ╱╲    ╱╲                             │ │
│            │   │   ╱  ╲╱╱  ╲╱╲    ╱╲                     │ │
│            │   │  ╱          ╲╲╱╱  ╲                     │ │
│            │   └─────────────────────────────────────────┘ │
│            │                                                │
│            │   ┌──────────────────┐ ┌──────────────────┐   │
│            │   │  Activity Feed   │ │ Recent Actions   │   │
│            │   │  John: Created   │ │ ...              │   │
│            │   │  Jane: Updated   │ │                  │   │
│            │   └──────────────────┘ └──────────────────┘   │
└────────────┴────────────────────────────────────────────────┘
```

## Chapters

| Chapter | Topic | What You'll Learn |
|---------|-------|-------------------|
| [1. Setup](/tutorials/dashboard/01-setup) | Project Setup | Initialize project, database, auth utilities |
| [2. Authentication](/tutorials/dashboard/02-authentication) | Auth Flow | Login, registration, sessions, protected routes |
| [3. Islands](/tutorials/dashboard/03-islands) | Interactive Widgets | Stats, charts, activity feed as islands |
| [4. Analytics](/tutorials/dashboard/04-analytics) | Shared State | Date picker, metric selector, shared signals |
| [5. Deployment](/tutorials/dashboard/05-deployment) | Production | Docker, VPS, cloud platforms |

## Key Concepts Covered

### Authentication
- Password hashing with bcrypt
- Session-based auth with cookies
- Protected routes with middleware
- Login/register/logout flows

### Islands Architecture
- Selective hydration strategies
- Different hydration triggers (load, visible, idle)
- Shared state between islands using signals
- Optimistic UI updates

### Real-Time Features
- Live data updates with polling
- WebSocket connections
- Auto-scrolling activity feeds

## Quick Start

```bash
# Create new project
bunx create-ereo@latest dashboard-app
cd dashboard-app

# Install dependencies
bun add @ereo/auth bcrypt
bun add -d @types/bcrypt

# Start development
bun dev
```

## Final Code

The complete dashboard example is available in the repository:

```bash
git clone https://github.com/ereoJS/ereoJS
cd ereo/packages/examples/dashboard
bun install
bun dev
```

## Next Steps

After completing this tutorial:

- Explore [Caching Strategies](/architecture/caching-deep-dive) for performance
- Learn about [Custom Adapters](/architecture/custom-adapters) for different platforms
- Review [Security Best Practices](/architecture/security)

---

[Start the Tutorial →](/tutorials/dashboard/01-setup)
