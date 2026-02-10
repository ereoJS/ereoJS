# SaaS Tutorial: Observability & Deployment

In this final chapter, you'll add full-stack tracing with `@ereo/trace` so you can see exactly how requests flow through your app, then deploy TaskFlow to production.

## Add Tracing

`@ereo/trace` instruments every layer of the framework — loaders, actions, middleware, database queries, RPC calls, and island hydration. In development, traces appear in the CLI and a browser-based viewer. In production, you replace the tracer with a 616-byte no-op.

### Configure the Tracer

```ts
// app/lib/tracer.ts
import { createTracer, traceMiddleware, traceLoader, traceRPCCall, tracedAdapter } from '@ereo/trace'
import { createCLIReporter } from '@ereo/trace'

export const tracer = createTracer({
  serviceName: 'taskflow',
  bufferSize: 200,
})

// CLI reporter for development
if (process.env.NODE_ENV !== 'production') {
  createCLIReporter(tracer, {
    showTimings: true,
    colorize: true,
  })
}

// Middleware instrumentor
export const traceMiddlewareHandler = traceMiddleware(tracer, {
  includeHeaders: false,
  includeQuery: true,
})

// Export instrumentors for use in loaders and RPC
export { traceLoader, traceRPCCall, tracedAdapter }
```

### Wire Tracing into the App

Update the config to include the trace middleware:

```ts
// ereo.config.ts
import { defineConfig } from '@ereo/core'
import { dbPlugin } from './app/lib/db'
import { authPlugin } from './app/middleware/auth'
import { rpcPlugin } from '@ereo/rpc'
import { rpcRouter } from './app/rpc/router'
import { tracer } from './app/lib/tracer'

const rpc = rpcPlugin({
  router: rpcRouter,
  endpoint: '/api/rpc',
})

export default defineConfig({
  plugins: [dbPlugin, authPlugin, rpc],
  trace: process.env.NODE_ENV !== 'production' ? tracer : undefined,
})
```

### Instrument Database Queries

Wrap the Drizzle adapter with tracing:

```ts
// app/lib/db.ts (updated)
import { Database } from 'bun:sqlite'
import { drizzle } from 'drizzle-orm/'
import { createDrizzleAdapter, createDatabasePlugin } from '@ereo/db-drizzle'
import { tracedAdapter } from '@ereo/trace'
import { tracer } from './tracer'
import * as schema from './schema'

const sqlite = new Database('taskflow.db')
sqlite.pragma('journal_mode = WAL')
sqlite.pragma('foreign_keys = ON')

export const db = drizzle(sqlite, { schema })

const baseAdapter = createDrizzleAdapter({
  driver: '',
  client: db,
})

// Wrap with tracing in development
export const dbAdapter = process.env.NODE_ENV !== 'production'
  ? tracedAdapter(baseAdapter, tracer)
  : baseAdapter

export const dbPlugin = createDatabasePlugin(dbAdapter)
```

### View Traces in Development

Start the dev server with tracing enabled:

```bash
bun run dev --trace
```

Now when you load the dashboard, you'll see traces in the terminal:

```
┌─ GET /dashboard (142ms)
│  ├─ middleware:auth (2ms) ✓
│  ├─ loader:/dashboard (138ms)
│  │  ├─ db:select users (3ms)
│  │  ├─ db:select team_members (2ms)
│  │  ├─ db:select projects (4ms)
│  │  └─ db:select tasks (6ms)
│  └─ render (12ms)
└─ 200 OK
```

You can also open `http://localhost:3000/__ereo/traces` to see the browser-based trace viewer with waterfall diagrams.

### Production No-Op

In production, the tracer is replaced with a no-op that adds zero overhead:

```ts
// Import from the noop subpath for production
import { noopTracer } from '@ereo/trace/noop'
```

The no-op export is only 616 bytes and all methods are empty functions. The conditional in `ereo.config.ts` already handles this — when `trace` is `undefined`, no tracing runs.

## Prepare for Production

### Environment Variables

Create a production environment file:

```bash
# .env.production
AUTH_SECRET=generate-a-real-secret-here
NODE_ENV=production
PORT=3000
```

Generate a proper secret:

```bash
openssl rand -base64 32
```

### Build the App

```bash
bun run build
```

This runs the Ereo bundler, which:
1. Bundles client-side islands with tree-shaking
2. Compiles Tailwind CSS
3. Generates the route manifest
4. Outputs to `dist/`

### Database for Production

For a real deployment, you'd switch from SQLite to PostgreSQL. The `@ereo/db-drizzle` adapter makes this a config change:

```ts
// app/lib/db.ts (production variant)
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { createDrizzleAdapter, createDatabasePlugin } from '@ereo/db-drizzle'
import * as schema from './schema'

const client = postgres(process.env.DATABASE_URL!)
export const db = drizzle(client, { schema })

export const dbAdapter = createDrizzleAdapter({
  driver: 'postgres-js',
  client: db,
})

export const dbPlugin = createDatabasePlugin(dbAdapter)
```

For this tutorial, SQLite with WAL mode works fine for single-server deployments.

## Deploy to Fly.io

Fly.io is a good fit for Bun apps because it supports persistent volumes (for SQLite) and WebSocket connections (for RPC subscriptions).

### Dockerfile

```dockerfile
FROM oven/bun:1 AS base
WORKDIR /app

# Install dependencies
COPY package.json bun.lockb ./
RUN bun install --frozen-lockfile --production

# Copy source and build
COPY . .
RUN bun run build

# Run migrations
RUN bunx drizzle-kit migrate

EXPOSE 3000
CMD ["bun", "run", "start"]
```

### Fly Configuration

```bash
fly launch --name taskflow
```

This generates `fly.toml`. Update it:

```toml
[env]
  NODE_ENV = "production"
  PORT = "3000"

[http_service]
  internal_port = 3000
  force_https = true

[[vm]]
  size = "shared-cpu-1x"
  memory = "512mb"

[mounts]
  source = "taskflow_data"
  destination = "/app/data"
```

Set the auth secret:

```bash
fly secrets set AUTH_SECRET=$(openssl rand -base64 32)
```

Update the database path to use the persistent volume:

```ts
// app/lib/db.ts — update the path
const sqlite = new Database('/app/data/taskflow.db')
```

Deploy:

```bash
fly deploy
```

## Alternative: Deploy to Docker

If you prefer running your own infrastructure:

```bash
docker build -t taskflow .
docker run -p 3000:3000 -v taskflow-data:/app/data -e AUTH_SECRET=your-secret -e NODE_ENV=production taskflow
```

## What We've Built

Across these 7 chapters, you built a production-ready SaaS application using nearly every part of Ereo:

| Feature | Packages Used |
|---------|---------------|
| Project scaffolding | `create-ereo`, `@ereo/cli` |
| Routing & layouts | `@ereo/router`, `@ereo/core` |
| Data loading | `@ereo/data` (createLoader, createAction) |
| Navigation & links | `@ereo/client` (Link, Form, useLoaderData) |
| Authentication | `@ereo/auth` (credentials, JWT sessions) |
| Database | `@ereo/db`, `@ereo/db-drizzle` (SQLite + Drizzle ORM) |
| Forms & validation | `@ereo/forms` (useForm, useField, useFieldArray) |
| Interactive islands | `@ereo/client` (data-island, hydration) |
| Shared state | `@ereo/state` (signal, computed, batch) |
| Type-safe RPC | `@ereo/rpc` (procedures, router, client) |
| Real-time updates | `@ereo/rpc` (WebSocket subscriptions) |
| Observability | `@ereo/trace` (tracer, instrumentors, CLI reporter) |
| Styling | `@ereo/plugin-tailwind` |

## Next Steps

Here are ways to extend TaskFlow:

- **Team invitations**: Add an invite flow using `@ereo/forms` with email validation and the `apiKey` auth provider
- **File attachments**: Add file uploads to tasks using the [file uploads guide](/guides/file-uploads)
- **Search**: Add full-text search across tasks and projects
- **Notifications**: Use RPC subscriptions to send browser notifications when assigned a task
- **Multi-team support**: Let users switch between teams using a dropdown in the sidebar
- **Audit log UI**: Build a page that displays the activity table with filters and pagination

## Further Reading

- [Architecture: Performance](/architecture/performance) — optimization strategies for production
- [Architecture: Security](/architecture/security) — security hardening checklist
- [Guide: Testing](/guides/testing) — how to test loaders, actions, islands, and RPC procedures
- [API: @ereo/rpc](/api/rpc/procedure) — full RPC API reference
- [API: @ereo/forms](/api/forms/use-form) — full forms API reference

[← Previous: RPC & Real-time](/tutorials/saas/06-rpc-realtime)
