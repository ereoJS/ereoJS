# Tutorials

Hands-on tutorials to learn EreoJS by building real applications.

## Available Tutorials

### [Build a Blog](/tutorials/blog/01-setup)

A comprehensive 6-part tutorial that covers all the fundamentals by building a full-featured blog application.

**What you'll learn:**
- Setting up an EreoJS project
- File-based routing
- Data loading with loaders
- Form handling with actions
- Styling with Tailwind CSS
- Deploying to production

**Prerequisites:** Basic React knowledge

**Time:** ~2 hours

### [Build a Dashboard](/tutorials/dashboard/)

Learn advanced patterns by building an authenticated dashboard with interactive islands.

**What you'll learn:**
- Authentication patterns
- Islands architecture
- Real-time updates
- Complex state management

**Prerequisites:** Completed Blog tutorial

**Time:** ~3 hours

### [Build a SaaS App](/tutorials/saas/)

Build a full-featured project management app (TaskFlow) that covers the complete EreoJS stack — authentication, database with Drizzle ORM, forms with validation, islands, RPC, and deployment.

**What you'll learn:**
- Drizzle ORM with SQLite
- Multi-table relational schema
- Form validation and error handling
- Islands with shared state
- RPC procedures and real-time subscriptions
- Production deployment with tracing

**Prerequisites:** Completed Blog tutorial

**Time:** ~4 hours

### [Real-time Chat (RPC)](/tutorials/realtime-chat/)

Build a real-time chat application using `@ereo/rpc` with WebSocket subscriptions, focusing on RPC procedures, real-time data flow, and reactive client components.

**What you'll learn:**
- RPC router and procedure definitions
- Query, mutation, and subscription patterns
- WebSocket-based real-time updates
- Reactive client components with signals
- Rate limiting and error handling

**Prerequisites:** Basic understanding of [RPC](/guides/rpc)

**Time:** ~2 hours

## Tutorial Structure

Each tutorial is broken into manageable sections:

1. **Setup** - Project initialization and configuration
2. **Core Features** - Building the main functionality
3. **Enhancements** - Adding polish and advanced features
4. **Deployment** - Getting your app live

## Getting the Most from Tutorials

1. **Type along** - Don't just copy-paste. Typing helps you learn.
2. **Experiment** - Try changing things to see what happens.
3. **Read the errors** - Error messages teach you about the framework.
4. **Check the source** - Reference code is available in `/packages/examples/`.

## Quick Reference

### Blog Tutorial Chapters

| Chapter | Topic | Duration |
|---------|-------|----------|
| [1. Setup](/tutorials/blog/01-setup) | Project initialization | 15 min |
| [2. Routes](/tutorials/blog/02-routes) | Pages and navigation | 20 min |
| [3. Data Loading](/tutorials/blog/03-data-loading) | Loaders and database | 25 min |
| [4. Forms](/tutorials/blog/04-forms) | Actions and mutations | 25 min |
| [5. Styling](/tutorials/blog/05-styling) | Tailwind CSS | 20 min |
| [6. Deployment](/tutorials/blog/06-deployment) | Going live | 15 min |

### Dashboard Tutorial Chapters

| Chapter | Topic | Duration |
|---------|-------|----------|
| [1. Setup](/tutorials/dashboard/01-setup) | Project and database setup | 20 min |
| [2. Authentication](/tutorials/dashboard/02-authentication) | Login, registration, sessions | 30 min |
| [3. Islands](/tutorials/dashboard/03-islands) | Interactive widgets | 35 min |
| [4. Analytics](/tutorials/dashboard/04-analytics) | Shared state between islands | 30 min |
| [5. Deployment](/tutorials/dashboard/05-deployment) | Production deployment | 25 min |

### SaaS Tutorial Chapters

| Chapter | Topic | Duration |
|---------|-------|----------|
| [1. Setup](/tutorials/saas/01-setup) | Project scaffolding and schema | 20 min |
| [2. Authentication](/tutorials/saas/02-authentication) | Auth plugin, sessions, middleware | 30 min |
| [3. Database](/tutorials/saas/03-database) | Queries, CRUD, Drizzle ORM | 35 min |
| [4. Forms](/tutorials/saas/04-forms) | Validation, error handling | 30 min |
| [5. Islands](/tutorials/saas/05-islands) | Interactive components, shared state | 35 min |
| [6. RPC & Real-time](/tutorials/saas/06-rpc-realtime) | Procedures, subscriptions | 30 min |
| [7. Deployment](/tutorials/saas/07-deploy) | Production build, tracing, Docker | 20 min |

### Real-time Chat Tutorial Chapters

| Chapter | Topic | Duration |
|---------|-------|----------|
| [1. Setup](/tutorials/realtime-chat/01-setup) | Project, store, RPC router | 20 min |
| [2. Procedures](/tutorials/realtime-chat/02-procedures) | Queries, mutations, events | 25 min |
| [3. Real-time](/tutorials/realtime-chat/03-realtime) | Subscriptions, WebSocket client | 25 min |
| [4. Client](/tutorials/realtime-chat/04-client) | Chat UI, room list, islands | 25 min |
| [5. Polish](/tutorials/realtime-chat/05-polish) | Rate limiting, reconnection, typing | 20 min |

## Example Code

All tutorial code is available in the repository:

- Blog: `/packages/examples/blog`
- Minimal: `/packages/examples/minimal`

Clone and run:

```bash
git clone https://github.com/ereoJS/ereoJS
cd ereo/packages/examples/blog
bun install
bun dev
```

## Need Help?

- Check the [API Reference](/api/core/create-app) for detailed documentation
- Visit [GitHub Discussions](https://github.com/ereoJS/ereoJS/discussions) for community support
- Report issues on [GitHub Issues](https://github.com/ereoJS/ereoJS/issues)
