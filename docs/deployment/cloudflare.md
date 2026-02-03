# Deploying to Cloudflare

Deploy your EreoJS application to Cloudflare Workers/Pages.

## Cloudflare Pages

Best for full-stack applications with server-side rendering.

### Setup

1. Push your code to GitHub/GitLab
2. Go to Cloudflare Dashboard → Pages
3. Create a new project
4. Connect your repository
5. Configure build settings:

```
Build command: bun run build
Build output directory: dist
Root directory: /
```

### Configuration

Create `wrangler.toml`:

```toml
name = "my-ereo-app"
compatibility_date = "2024-01-01"

[build]
command = "bun run build"

[site]
bucket = "./dist/static"
```

### Build for Cloudflare

Update `ereo.config.ts`:

```ts
import { defineConfig } from '@ereo/core'

export default defineConfig({
  build: {
    target: 'cloudflare'
  }
})
```

## Cloudflare Workers

For serverless edge deployment.

### Project Structure

```
my-app/
├── src/
│   └── worker.ts
├── dist/
├── wrangler.toml
└── package.json
```

### Worker Entry

```ts
// src/worker.ts
import { createApp } from '@ereo/core'
import { createFileRouter } from '@ereo/router'

const app = createApp()

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    return app.handle(request)
  }
}
```

### Deploy

```bash
# Install Wrangler
npm i -g wrangler

# Login
wrangler login

# Deploy
wrangler deploy
```

## Environment Variables

### Via Dashboard

1. Pages → Your Project → Settings → Environment Variables
2. Add variables for Production and Preview

### Via wrangler.toml

```toml
[vars]
PUBLIC_API_URL = "https://api.example.com"

# Secrets via CLI
# wrangler secret put DATABASE_URL
```

## KV Storage

For caching and data storage:

```toml
# wrangler.toml
[[kv_namespaces]]
binding = "CACHE"
id = "your-kv-id"
```

```ts
// In your worker
export default {
  async fetch(request: Request, env: Env) {
    // Use KV for caching
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
// In your worker
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

## Functions

For Cloudflare Pages Functions:

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

## Durable Objects

For stateful edge computing:

```ts
// For real-time features, WebSockets, etc.
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

Some Node.js APIs aren't available on Workers. Use polyfills:

```toml
# wrangler.toml
node_compat = true
```
