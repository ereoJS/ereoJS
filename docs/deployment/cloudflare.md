# Deploying to Cloudflare

Deploy your EreoJS application to Cloudflare Pages or Workers.

## Prerequisites

- [Cloudflare account](https://dash.cloudflare.com)
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/install-and-update/) (optional for CLI-based deployment)

## Quick Deploy

### From GitHub (Cloudflare Pages)

1. Push your code to GitHub/GitLab
2. Go to Cloudflare Dashboard → Pages
3. Create a new project and connect your repository
4. Configure build settings:

```
Build command: bun run build
Build output directory: dist
Root directory: /
```

### From CLI

```bash
# Install Wrangler
npm i -g wrangler

# Login
wrangler login

# Deploy
wrangler deploy
```

## Configuration

### Using the Cloudflare Adapter (Recommended)

Install the adapter:

```bash
bun add @ereo/deploy-cloudflare
```

Configure your `ereo.config.ts` using the `cloudflare()` function. This sets the build target to `'cloudflare'`:

```ts
// ereo.config.ts
import { defineConfig } from '@ereo/core'
import { cloudflare } from '@ereo/deploy-cloudflare'

export default defineConfig({
  ...cloudflare(),
})
```

The `cloudflare()` function accepts an optional configuration object:

```ts
export default defineConfig({
  ...cloudflare({
    routes: ['myapp.example.com/*'],
    kvNamespaces: ['CACHE', 'SESSIONS'],
  }),
})
```

#### Configuration Options

| Option | Type | Description |
|--------|------|-------------|
| `target` | `'pages' \| 'workers'` | Deployment target (reserved for future use) |
| `accountId` | `string` | Cloudflare account ID (reserved for future use) |
| `routes` | `string[]` | Custom domain routes |
| `kvNamespaces` | `string[]` | KV namespace binding names |
| `durableObjects` | `string[]` | Durable Object binding names (reserved for future use) |

> **Note:** Currently, the `cloudflare()` function sets the build target to `'cloudflare'`. The `routes` and `kvNamespaces` options are used by `generateWranglerToml()` (see below). The other options are accepted for forward compatibility and will be used in future releases.

#### Generating wrangler.toml

Use `generateWranglerToml()` to create a `wrangler.toml` file from your config:

```ts
// scripts/setup-cloudflare.ts
import { generateWranglerToml } from '@ereo/deploy-cloudflare'

await Bun.write('wrangler.toml', generateWranglerToml({
  routes: ['myapp.example.com/*'],
  kvNamespaces: ['CACHE', 'SESSIONS'],
}))
```

This generates:

```toml
name = "ereo-app"
compatibility_date = "2024-01-01"
main = "dist/server.js"

routes = ["myapp.example.com/*"]

[[kv_namespaces]]
binding = "CACHE"
id = "your-namespace-id"

[[kv_namespaces]]
binding = "SESSIONS"
id = "your-namespace-id"
```

> **Important:** Replace the `"your-namespace-id"` placeholders with your actual Cloudflare KV namespace IDs. You can find these in the Cloudflare Dashboard under Workers → KV.

### Manual Configuration

If you prefer to configure everything manually without the adapter, set the build target directly in `ereo.config.ts`:

```ts
import { defineConfig } from '@ereo/core'

export default defineConfig({
  build: {
    target: 'cloudflare'
  }
})
```

Then create `wrangler.toml` by hand:

```toml
name = "my-ereo-app"
compatibility_date = "2024-01-01"
main = "dist/server.js"
```

## Cloudflare Pages vs Workers

Cloudflare offers two deployment options. Both work with EreoJS:

| Feature | Pages | Workers |
|---------|-------|---------|
| Best for | Full-stack apps with SSR | API-heavy or edge-first apps |
| Static assets | Built-in CDN | Requires separate asset serving |
| Git integration | Automatic deploys on push | Manual or via CI/CD |
| Preview deployments | Per-branch previews | Not built-in |

For most EreoJS applications, **Cloudflare Pages** is the simpler starting point.

## Data Loading on Cloudflare

EreoJS loaders and actions work the same way on Cloudflare as on any other platform. Define them in your route files using any of the three approaches:

```tsx
// routes/posts/index.tsx
import { createLoader, createAction, redirect } from '@ereo/data'

export const loader = createLoader(async ({ params }) => {
  const posts = await db.posts.findMany()
  return { posts }
})

export const action = createAction(async ({ request }) => {
  const formData = await request.formData()
  await db.posts.create({ title: formData.get('title') as string })
  return redirect('/posts')
})

export default function Posts({ loaderData }) {
  return (
    <ul>
      {loaderData.posts.map(post => (
        <li key={post.id}>{post.title}</li>
      ))}
    </ul>
  )
}
```

> For a full guide on loaders, actions, and the three different approaches to defining them, see [Data Loading](/core-concepts/data-loading).

## Environment Variables

### Via Dashboard

1. Pages → Your Project → Settings → Environment Variables
2. Add variables for Production and Preview

### Via wrangler.toml

```toml
[vars]
PUBLIC_API_URL = "https://api.example.com"

# Secrets via CLI (never commit secrets to wrangler.toml)
# wrangler secret put DATABASE_URL
```

## KV Storage

For caching and data storage at the edge:

```toml
# wrangler.toml
[[kv_namespaces]]
binding = "CACHE"
id = "your-kv-id"
```

Access KV in your loaders or actions via the Cloudflare `env` bindings:

```ts
// In a Cloudflare Worker entry
export default {
  async fetch(request: Request, env: Env) {
    const cached = await env.CACHE.get('key')
    if (cached) return new Response(cached)

    const data = await fetchData()
    await env.CACHE.put('key', data, { expirationTtl: 3600 })

    return new Response(data)
  }
}
```

## D1 Database

Cloudflare's edge SQL database:

```toml
# wrangler.toml
[[d1_databases]]
binding = "DB"
database_name = "my-database"
database_id = "your-d1-id"
```

```ts
const posts = await env.DB.prepare(
  'SELECT * FROM posts ORDER BY created_at DESC'
).all()
```

## R2 Storage

For file storage:

```toml
# wrangler.toml
[[r2_buckets]]
binding = "BUCKET"
bucket_name = "my-bucket"
```

```ts
// Upload
await env.BUCKET.put('images/photo.jpg', imageBuffer)

// Download
const object = await env.BUCKET.get('images/photo.jpg')
```

## Custom Domains

1. Pages → Your Project → Custom Domains
2. Add your domain
3. Configure DNS (CNAME to pages.dev)
4. SSL is automatic

## Headers and Redirects

Create `_headers` in your output directory:

```
/*
  X-Frame-Options: DENY
  X-Content-Type-Options: nosniff

/static/*
  Cache-Control: public, max-age=31536000, immutable
```

Create `_redirects`:

```
/old-path /new-path 301
/api/* https://api.example.com/:splat 200
```

## Cloudflare Pages Functions

Cloudflare Pages supports server-side functions via the `functions/` directory. Note that EreoJS already handles API routes via [HTTP method exports](/core-concepts/data-loading#api-routes-http-method-exports) in your route files — you only need Pages Functions if you want Cloudflare-specific functionality outside of the EreoJS router:

```ts
// functions/api/posts.ts
export async function onRequest(context) {
  const { request, env } = context

  if (request.method === 'GET') {
    const posts = await env.DB.prepare('SELECT * FROM posts').all()
    return Response.json(posts.results)
  }

  return new Response('Method not allowed', { status: 405 })
}
```

> **Tip:** For most API routes, prefer using EreoJS route files with `GET`/`POST`/`PUT`/`DELETE` exports. Use Cloudflare Pages Functions only when you need direct access to Cloudflare bindings (`env.DB`, `env.CACHE`, etc.) outside the EreoJS request pipeline.

## Durable Objects

For stateful edge computing (real-time features, WebSockets, etc.):

```ts
export class ChatRoom {
  state: DurableObjectState

  constructor(state: DurableObjectState) {
    this.state = state
  }

  async fetch(request: Request) {
    // Handle WebSocket connections
  }
}
```

## CI/CD with GitHub Actions

```yaml
name: Deploy to Cloudflare

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: oven-sh/setup-bun@v1

      - run: bun install
      - run: bun run build

      - name: Deploy to Cloudflare Pages
        uses: cloudflare/pages-action@v1
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          projectName: my-ereo-app
          directory: dist
```

## Troubleshooting

### Build Errors

Check logs in Cloudflare Dashboard or:

```bash
wrangler tail
```

### Size Limits

Workers have a 1MB limit (compressed). Split large dependencies:

```ts
// Use dynamic imports for large modules
const heavy = await import('./heavy-module')
```

### Compatibility

Some Node.js APIs aren't available on Workers. Enable the compatibility flag:

```toml
# wrangler.toml
node_compat = true
```

## Related

- [Data Loading](/core-concepts/data-loading) — Loaders, actions, and all three definition approaches
- [Deploying to Vercel](/deployment/vercel) — Alternative deployment platform
- [CLI deploy command](/api/cli/deploy) — Deploy from the command line
