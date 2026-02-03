# Vercel Deployment

Deploy EreoJS applications to Vercel with Node.js or Edge runtime support.

## Installation

```bash
bun add @ereo/deploy-vercel
```

## Overview

The Vercel adapter configures your EreoJS application for deployment to Vercel. It supports:

- **Node.js Runtime** - Traditional serverless functions
- **Edge Runtime** - Lightweight functions running at the edge
- **Static Generation** - Pre-rendered pages at build time

## Setup

### Basic Configuration

```ts
// ereo.config.ts
import { defineConfig } from '@ereo/core'
import { vercel } from '@ereo/deploy-vercel'

export default defineConfig({
  ...vercel()
})
```

### Edge Runtime Configuration

```ts
import { defineConfig } from '@ereo/core'
import { vercel } from '@ereo/deploy-vercel'

export default defineConfig({
  ...vercel({
    edge: true,
    regions: ['iad1', 'sfo1', 'fra1']
  })
})
```

## Configuration Options

```ts
interface VercelConfig {
  /** Use Vercel Edge runtime (default: false = Node.js) */
  edge?: boolean

  /** Deployment regions */
  regions?: string[]

  /** Function timeout in seconds */
  timeout?: number

  /** Memory allocation in MB */
  memory?: number

  /** Environment variables to set */
  env?: Record<string, string>
}
```

| Option | Type | Description | Default |
|--------|------|-------------|---------|
| `edge` | `boolean` | Use Edge runtime | `false` |
| `regions` | `string[]` | Deployment regions | `['iad1']` |
| `timeout` | `number` | Function timeout (seconds) | `10` (Edge: `30`, Node: `900` max) |
| `memory` | `number` | Memory in MB | `1024` (Edge: `1024-4096`, Node: `128-3008`) |
| `env` | `Record<string, string>` | Environment variables | - |

## Vercel Configuration

### Generate vercel.json

The adapter can generate a `vercel.json` configuration file:

```ts
import { generateVercelJson } from '@ereo/deploy-vercel'

const config = generateVercelJson({
  edge: true,
  regions: ['iad1', 'sfo1']
})

console.log(config)
```

Output:

```json
{
  "version": 2,
  "builds": [
    {
      "src": "dist/server.js",
      "use": "@vercel/edge",
      "config": {
        "includeFiles": ["dist/**"]
      }
    }
  ],
  "routes": [
    {
      "src": "/(.*)",
      "dest": "dist/server.js"
    }
  ],
  "regions": ["iad1", "sfo1"],
  "functions": {
    "dist/server.js": {
      "runtime": "edge",
      "regions": ["iad1", "sfo1"]
    }
  }
}
```

### Manual vercel.json

Create `vercel.json` in your project root:

```json
{
  "version": 2,
  "buildCommand": "bun run build",
  "outputDirectory": "dist",
  "framework": null,
  "functions": {
    "dist/server.js": {
      "memory": 1024,
      "maxDuration": 30
    }
  },
  "routes": [
    {
      "src": "/static/(.*)",
      "dest": "/static/$1"
    },
    {
      "src": "/(.*)",
      "dest": "/dist/server.js"
    }
  ]
}
```

## Build Commands

### Development

```bash
# Local development
bun ereo dev

# With Vercel CLI
vercel dev
```

### Production Build

```bash
# Build for Vercel
bun ereo build

# Deploy to Vercel
vercel deploy
```

### Build Script

The adapter generates a build script for Vercel:

```ts
import { generateBuildScript } from '@ereo/deploy-vercel'

const script = generateBuildScript()
// Outputs bash script for Vercel builds
```

### Package Scripts

```json
{
  "scripts": {
    "dev": "ereo dev",
    "build": "ereo build",
    "deploy": "vercel deploy",
    "deploy:prod": "vercel deploy --prod"
  }
}
```

## Environment Variables

### Local Development

Create `.env.local`:

```
DATABASE_URL=postgres://localhost/mydb
API_KEY=secret123
```

### Production

Set environment variables via Vercel Dashboard or CLI:

```bash
# Set a secret
vercel env add API_KEY production

# Pull environment variables
vercel env pull .env.local
```

### Accessing in Code

```ts
// routes/api/data.ts
export const loader = createLoader(async ({ request }) => {
  // Access environment variables
  const apiKey = process.env.API_KEY
  const dbUrl = process.env.DATABASE_URL

  return { data: 'example' }
})
```

### Environment File Priority

Files loaded in order (later overrides earlier):

1. `.env`
2. `.env.local`
3. `.env.production` (production builds)
4. `.env.production.local`

## Serverless Functions

### Node.js Runtime

Default runtime with full Node.js API support:

```ts
// ereo.config.ts
import { vercel } from '@ereo/deploy-vercel'

export default defineConfig({
  ...vercel({
    edge: false, // Use Node.js runtime
    timeout: 60,
    memory: 1024
  })
})
```

### Function Configuration

Per-route function configuration:

```ts
// routes/api/heavy-task.ts
export const config = {
  runtime: 'nodejs',
  maxDuration: 300 // 5 minutes
}

export const loader = createLoader(async () => {
  // Long-running task
  const result = await processLargeDataset()
  return { result }
})
```

### Streaming Responses

```ts
export const loader = createLoader(async () => {
  const stream = new ReadableStream({
    async start(controller) {
      for (let i = 0; i < 10; i++) {
        controller.enqueue(`data: ${i}\n\n`)
        await new Promise(r => setTimeout(r, 100))
      }
      controller.close()
    }
  })

  return new Response(stream, {
    headers: { 'Content-Type': 'text/event-stream' }
  })
})
```

## Edge Middleware

### Global Middleware

Create edge middleware that runs before all requests:

```ts
// middleware.ts (project root)
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  // Add custom headers
  const response = NextResponse.next()
  response.headers.set('X-Custom-Header', 'value')
  return response
}

export const config = {
  matcher: ['/((?!static|_next|favicon.ico).*)']
}
```

### Route-Level Edge Functions

```ts
// routes/api/geo.ts
export const config = {
  runtime: 'edge',
  regions: ['iad1', 'sfo1', 'fra1']
}

export const loader = createLoader(async ({ request }) => {
  // Access geo information
  const geo = request.headers.get('x-vercel-ip-country')
  const city = request.headers.get('x-vercel-ip-city')

  return { country: geo, city }
})
```

### Edge Runtime Limitations

Edge runtime has some limitations compared to Node.js:

- No native Node.js modules
- Limited file system access
- 30-second timeout maximum
- 4 MB function size limit

```ts
// Use edge-compatible packages
import { createHash } from '@noble/hashes/sha256'

export const loader = createLoader(async () => {
  const hash = createHash().update('data').digest('hex')
  return { hash }
})
```

## Static Generation

### Pre-render Pages

```ts
// routes/posts/[slug].tsx
export const config = {
  render: 'ssg'
}

export async function getStaticPaths() {
  const posts = await fetchPosts()
  return posts.map(post => ({
    params: { slug: post.slug }
  }))
}

export const loader = createLoader(async ({ params }) => {
  const post = await fetchPost(params.slug)
  return { post }
})
```

### Incremental Static Regeneration

```ts
// routes/posts/[slug].tsx
export const config = {
  render: 'isr',
  revalidate: 60 // Revalidate every 60 seconds
}
```

## Troubleshooting

### Common Issues

#### Function Size Limit

```
Error: Function size limit exceeded
```

Reduce bundle size:

```ts
export default defineConfig({
  build: {
    minify: true,
    external: ['sharp', 'canvas'] // Exclude large packages
  }
})
```

#### Timeout Errors

Increase function timeout:

```json
{
  "functions": {
    "dist/server.js": {
      "maxDuration": 60
    }
  }
}
```

#### Missing Environment Variables

Ensure variables are set for the correct environment:

```bash
# List all environment variables
vercel env ls

# Pull to local
vercel env pull .env.local
```

#### Cold Start Performance

Optimize for faster cold starts:

```ts
// Lazy load heavy dependencies
export const loader = createLoader(async () => {
  const { processImage } = await import('./heavy-module')
  return processImage()
})
```

### Debug Mode

Enable verbose logging:

```bash
# Local debugging
vercel dev --debug

# Check deployment logs
vercel logs <deployment-url>
```

### Build Analysis

```bash
# Build with analysis
bun ereo build --analyze

# Check function sizes
vercel inspect <deployment-url>
```

## CI/CD Deployment

### GitHub Integration

Connect your repository to Vercel for automatic deployments:

1. Import project at vercel.com/new
2. Configure build settings
3. Push to deploy

### GitHub Actions

```yaml
name: Deploy to Vercel

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

      - uses: amondnet/vercel-action@v25
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
          vercel-args: '--prod'
```

### Preview Deployments

Vercel automatically creates preview deployments for pull requests:

```bash
# Deploy preview manually
vercel deploy

# Deploy to production
vercel deploy --prod
```

## Related

- [Cloudflare Deployment](/api/deploy/cloudflare)
- [Build CLI](/api/cli/build)
- [Environment Variables](/api/core/env)
