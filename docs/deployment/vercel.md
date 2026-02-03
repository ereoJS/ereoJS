# Deploying to Vercel

Deploy your EreoJS application to Vercel.

## Prerequisites

- [Vercel account](https://vercel.com)
- [Vercel CLI](https://vercel.com/cli) (optional)

## Quick Deploy

### From GitHub

1. Push your code to GitHub
2. Go to [vercel.com/new](https://vercel.com/new)
3. Import your repository
4. Vercel auto-detects EreoJS settings
5. Click Deploy

### From CLI

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel
```

## Configuration

Create `vercel.json`:

```json
{
  "buildCommand": "bun run build",
  "outputDirectory": "dist",
  "installCommand": "bun install",
  "framework": null,
  "functions": {
    "dist/server/index.js": {
      "runtime": "nodejs18.x"
    }
  }
}
```

## Build Configuration

Update `ereo.config.ts` for Vercel:

```ts
import { defineConfig } from '@ereo/core'

export default defineConfig({
  build: {
    target: 'node',  // Vercel uses Node.js
    outDir: 'dist'
  }
})
```

## Environment Variables

### Via Dashboard

1. Go to Project Settings → Environment Variables
2. Add your variables
3. Redeploy to apply

### Via CLI

```bash
vercel env add DATABASE_URL production
```

### In vercel.json

```json
{
  "env": {
    "PUBLIC_API_URL": "https://api.example.com"
  }
}
```

## Serverless Functions

For API routes, create serverless functions:

```ts
// api/posts.ts (Vercel function)
import type { VercelRequest, VercelResponse } from '@vercel/node'

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  if (req.method === 'GET') {
    const posts = await getPosts()
    return res.json(posts)
  }

  res.status(405).json({ error: 'Method not allowed' })
}
```

## Edge Functions

For faster response times:

```ts
// api/hello.ts
export const config = {
  runtime: 'edge'
}

export default function handler(request: Request) {
  return new Response('Hello from the edge!')
}
```

## Static Assets

Static files in `public/` are automatically served from Vercel's CDN.

```json
{
  "headers": [
    {
      "source": "/static/(.*)",
      "headers": [
        {
          "key": "Cache-Control",
          "value": "public, max-age=31536000, immutable"
        }
      ]
    }
  ]
}
```

## Redirects and Rewrites

```json
{
  "redirects": [
    {
      "source": "/old-path",
      "destination": "/new-path",
      "permanent": true
    }
  ],
  "rewrites": [
    {
      "source": "/api/:path*",
      "destination": "https://api.example.com/:path*"
    }
  ]
}
```

## Preview Deployments

Every pull request gets a preview URL:

```
https://your-project-git-branch-name-username.vercel.app
```

## Production Deployment

```bash
# Deploy to production
vercel --prod
```

Or push to your main branch with auto-deploy enabled.

## Monitoring

Vercel provides built-in:

- Analytics
- Speed Insights
- Logs
- Error tracking

Access from your project dashboard.

## Troubleshooting

### Build Failures

Check build logs in the Vercel dashboard or:

```bash
vercel logs
```

### Function Timeouts

Default timeout is 10 seconds. Increase in `vercel.json`:

```json
{
  "functions": {
    "api/**/*.ts": {
      "maxDuration": 30
    }
  }
}
```

### Memory Issues

```json
{
  "functions": {
    "api/**/*.ts": {
      "memory": 1024
    }
  }
}
```

## Domain Setup

1. Go to Project Settings → Domains
2. Add your domain
3. Configure DNS as shown
4. SSL is automatic

## CI/CD with GitHub Actions

```yaml
# .github/workflows/deploy.yml
name: Deploy to Vercel

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Deploy to Vercel
        uses: amondnet/vercel-action@v25
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
          vercel-args: '--prod'
```
