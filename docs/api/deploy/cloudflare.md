# Cloudflare Deployment

Deploy EreoJS applications to Cloudflare Workers or Cloudflare Pages.

## Installation

```bash
bun add @ereo/deploy-cloudflare
```

## Overview

The Cloudflare adapter configures your EreoJS application for deployment to Cloudflare's edge network. It supports both:

- **Cloudflare Workers** - Serverless functions at the edge
- **Cloudflare Pages** - Full-stack applications with static assets

## Setup

### Basic Configuration

```ts
// ereo.config.ts
import { defineConfig } from '@ereo/core'
import { cloudflare } from '@ereo/deploy-cloudflare'

export default defineConfig({
  ...cloudflare({
    target: 'pages'
  })
})
```

### Workers Configuration

```ts
import { defineConfig } from '@ereo/core'
import { cloudflare } from '@ereo/deploy-cloudflare'

export default defineConfig({
  ...cloudflare({
    target: 'workers',
    accountId: process.env.CF_ACCOUNT_ID,
    routes: ['example.com/*', 'api.example.com/*']
  })
})
```

## Configuration Options

```ts
interface CloudflareConfig {
  /** Deployment target: 'pages' or 'workers' */
  target?: 'pages' | 'workers'

  /** Cloudflare account ID */
  accountId?: string

  /** Custom domain routes (Workers only) */
  routes?: string[]

  /** KV namespace bindings */
  kvNamespaces?: string[]

  /** Durable Object bindings */
  durableObjects?: string[]
}
```

| Option | Type | Description | Default |
|--------|------|-------------|---------|
| `target` | `'pages' \| 'workers'` | Deployment target | `'pages'` |
| `accountId` | `string` | Cloudflare account ID | - |
| `routes` | `string[]` | Custom domain routes | - |
| `kvNamespaces` | `string[]` | KV namespace bindings | - |
| `durableObjects` | `string[]` | Durable Object bindings | - |

## Wrangler Configuration

### Generate wrangler.toml

The adapter can generate a `wrangler.toml` configuration file:

```ts
import { generateWranglerToml } from '@ereo/deploy-cloudflare'

const config = generateWranglerToml({
  target: 'workers',
  routes: ['example.com/*'],
  kvNamespaces: ['CACHE', 'SESSIONS']
})

console.log(config)
```

Output:

```toml
name = "ereo-app"
compatibility_date = "2024-01-01"
main = "dist/server.js"

routes = ["example.com/*"]

[[kv_namespaces]]
binding = "CACHE"
id = "your-namespace-id"

[[kv_namespaces]]
binding = "SESSIONS"
id = "your-namespace-id"
```

### Manual wrangler.toml

Create `wrangler.toml` in your project root:

```toml
name = "my-ereo-app"
compatibility_date = "2024-01-01"
main = "dist/server.js"

[site]
bucket = "./dist/static"

# KV Namespaces
[[kv_namespaces]]
binding = "CACHE"
id = "abc123"

# Durable Objects
[[durable_objects.bindings]]
name = "COUNTER"
class_name = "Counter"

# Environment Variables
[vars]
API_URL = "https://api.example.com"
```

## Build Commands

### Development

```bash
# Local development with Wrangler
wrangler dev
```

### Production Build

```bash
# Build for Cloudflare
bun ereo build

# Deploy to Cloudflare
wrangler deploy
```

### Package Scripts

```json
{
  "scripts": {
    "dev": "wrangler dev",
    "build": "ereo build",
    "deploy": "ereo build && wrangler deploy",
    "preview": "wrangler pages dev dist"
  }
}
```

## Environment Variables

### Local Development

Create `.dev.vars` for local secrets:

```
DATABASE_URL=postgres://localhost/mydb
API_KEY=secret123
```

### Production

Set environment variables in Cloudflare Dashboard or via Wrangler:

```bash
# Set a secret
wrangler secret put API_KEY

# Set a variable
wrangler vars set API_URL https://api.example.com
```

### Accessing in Code

```ts
// routes/api/data.ts
export const loader = createLoader(async ({ request, context }) => {
  // Access environment bindings
  const env = context.get('env')

  const apiKey = env.API_KEY
  const cache = env.CACHE // KV namespace

  return { data: 'example' }
})
```

## Edge Functions

EreoJS routes run as edge functions on Cloudflare Workers.

### Request Handling

```ts
// routes/api/hello.ts
export const loader = createLoader(async ({ request }) => {
  // Access Cloudflare-specific properties
  const cf = request.cf

  return {
    country: cf?.country,
    city: cf?.city,
    timezone: cf?.timezone
  }
})
```

### KV Storage

```ts
export const loader = createLoader(async ({ context }) => {
  const env = context.get('env')
  const cache = env.CACHE // KV namespace

  // Read from KV
  const value = await cache.get('key')

  // Write to KV
  await cache.put('key', 'value', {
    expirationTtl: 3600
  })

  return { value }
})
```

### Durable Objects

```ts
export const loader = createLoader(async ({ context }) => {
  const env = context.get('env')

  // Get Durable Object stub
  const id = env.COUNTER.idFromName('my-counter')
  const counter = env.COUNTER.get(id)

  // Call Durable Object
  const response = await counter.fetch('/increment')
  const count = await response.json()

  return { count }
})
```

## Cloudflare Pages

### Pages Configuration

For Pages deployment, create `_routes.json` or configure in `wrangler.toml`:

```json
{
  "version": 1,
  "include": ["/*"],
  "exclude": ["/static/*", "/assets/*"]
}
```

### Static Assets

Static files are served from `dist/static`:

```
dist/
├── server.js        # Worker entry
└── static/
    ├── index.html
    ├── styles.css
    └── assets/
```

### Functions Directory

For Pages Functions, place handlers in `functions/`:

```
functions/
├── api/
│   └── [[path]].ts  # Catch-all API handler
└── _middleware.ts   # Global middleware
```

## Troubleshooting

### Common Issues

#### Module Not Found

```
Error: Cannot find module '@ereo/core'
```

Ensure all dependencies are bundled:

```ts
// ereo.config.ts
export default defineConfig({
  build: {
    external: [] // Bundle all dependencies
  }
})
```

#### Compatibility Flags

Add required compatibility flags in `wrangler.toml`:

```toml
compatibility_date = "2024-01-01"
compatibility_flags = ["nodejs_compat"]
```

#### Request Size Limits

Cloudflare Workers have request size limits:

- Request body: 100 MB (paid plans)
- Response body: Unlimited (streaming)

For large uploads, use Cloudflare R2 with presigned URLs.

#### Cold Start Performance

Optimize bundle size for faster cold starts:

```ts
export default defineConfig({
  build: {
    minify: true,
    splitting: false, // Single bundle for Workers
    external: ['sharp'] // Exclude large packages
  }
})
```

### Debug Mode

Enable verbose logging:

```bash
# Local debugging
WRANGLER_LOG=debug wrangler dev

# Check deployment logs
wrangler tail
```

### Bundle Size

Check your bundle size (Workers limit: 1 MB compressed):

```bash
# Build and check size
bun ereo build
ls -lh dist/server.js

# Analyze bundle
bun ereo build --analyze
```

## CI/CD Deployment

### GitHub Actions

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

      - uses: cloudflare/wrangler-action@v3
        with:
          apiToken: ${{ secrets.CF_API_TOKEN }}
          accountId: ${{ secrets.CF_ACCOUNT_ID }}
```

## Related

- [Vercel Deployment](/api/deploy/vercel)
- [Build CLI](/api/cli/build)
- [Environment Variables](/api/core/env)
