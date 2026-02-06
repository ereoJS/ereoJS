# Deployment Overview

EreoJS runs anywhere Bun runs. Since the framework produces a standard Bun server binary with no proprietary runtime requirements, you have full flexibility in choosing where and how to deploy. Whether you prefer a managed serverless platform, a container orchestrator, or a bare-metal VPS, the deployment process follows the same core pattern: build, configure environment variables, and start.

## Choosing a Platform

Not sure where to deploy? Use this decision guide:

- **Need zero-config deploys?** Try [Vercel](/ecosystem/deployment/vercel) or [Railway](/ecosystem/deployment/railway). Both detect EreoJS projects automatically and handle build settings for you.
- **Need edge performance?** [Cloudflare](/ecosystem/deployment/cloudflare) runs your application at the edge in 300+ locations worldwide, minimizing latency for global users.
- **Need full control?** [Docker](/ecosystem/deployment/docker) or [Bun self-hosted](/ecosystem/deployment/bun) give you complete ownership of the runtime, networking, and scaling decisions.
- **Need global multi-region deployment?** [Fly.io](/ecosystem/deployment/fly-io) makes it straightforward to run instances in multiple regions with automatic request routing to the nearest node.

## Platform Comparison

| Platform | Best For | Scaling | Cost | Setup Complexity |
|----------|----------|---------|------|------------------|
| [Bun (Self-Hosted)](/ecosystem/deployment/bun) | Full control, custom infrastructure | Manual (PM2, systemd) | Server costs only | Medium |
| [Docker](/ecosystem/deployment/docker) | Containerized environments, Kubernetes | Container orchestration | Varies by host | Medium |
| [Vercel](/ecosystem/deployment/vercel) | Serverless, rapid iteration | Automatic, per-request | Free tier, then usage-based | Low |
| [Cloudflare](/ecosystem/deployment/cloudflare) | Edge-first, global distribution | Automatic, edge-based | Free tier, then usage-based | Low-Medium |
| [Fly.io](/ecosystem/deployment/fly-io) | Full-stack apps, global regions | Automatic, multi-region | Free tier, then usage-based | Low |
| [Railway](/ecosystem/deployment/railway) | Simple deployment, databases included | Automatic | Free tier, then usage-based | Low |

## Quick Deploy

The fastest way to deploy any EreoJS app:

```bash
# Build for production
bun run build

# Start the production server
bun start
```

For platform-specific deployment, use the `ereo deploy` command:

```bash
# Deploy to Vercel
bun ereo deploy --target vercel

# Deploy to Cloudflare
bun ereo deploy --target cloudflare

# Deploy to Fly.io
bun ereo deploy --target fly

# Deploy to Railway
bun ereo deploy --target railway
```

The deploy command handles platform-specific build adapters, output formatting, and configuration generation automatically.

## Environment Variables

Production environment variables should be configured through your deployment platform's dashboard or CLI -- never commit `.env` files to version control.

**General best practices:**

- Use your platform's environment variable UI or CLI to set secrets (database URLs, API keys, etc.)
- Add `.env`, `.env.local`, and `.env.production` to your `.gitignore` file
- Use `.env.example` to document which variables your app requires, without including actual values
- EreoJS reads `process.env` at runtime, so variables set on the platform are available in loaders and actions

```bash
# Example: setting env vars via platform CLI
# Vercel
vercel env add DATABASE_URL

# Railway
railway variables set DATABASE_URL=postgres://...

# Fly.io
fly secrets set DATABASE_URL=postgres://...
```

For a complete guide on managing environment variables across development and production, see the [Environment Variables guide](/guides/environment-variables).

## Build Optimization

EreoJS applies several optimizations during `bun run build`, but you can further improve production performance:

- **Tree-shaking:** EreoJS eliminates unused code automatically. Keep imports specific (e.g., `import { signal } from '@ereo/state'` rather than `import * as state from '@ereo/state'`) to help the bundler remove dead code.
- **Minification:** Production builds are minified by default. No additional configuration is needed.
- **Static generation:** For pages that do not depend on request-time data, consider using static generation (`export const prerender = true` in your route) to serve pre-built HTML with zero server overhead.
- **Asset hashing:** Static assets receive content hashes in their filenames for optimal cache headers. The framework handles cache-busting automatically.

## Health Checks

Most deployment platforms require a health check endpoint to monitor your application. Add a simple health route to your project:

```ts
// app/routes/api/health.ts
export function loader() {
  return new Response(JSON.stringify({ status: 'ok', timestamp: Date.now() }), {
    headers: { 'Content-Type': 'application/json' },
  })
}
```

Configure your platform's health check to `GET /api/health` and expect a `200` response. This ensures the platform can detect and restart unhealthy instances.

## First Deployment

New to deployment? The [First Deployment quickstart](/getting-started/first-deployment) walks you through deploying an EreoJS app from scratch, including environment setup, build verification, and going live.

## Platform Guides

Each platform guide covers setup, configuration, and platform-specific optimizations in detail:

- **[Bun (Self-Hosted)](/ecosystem/deployment/bun)** -- Run EreoJS directly on a VPS or dedicated server with full control over the runtime and networking.
- **[Docker](/ecosystem/deployment/docker)** -- Containerize your EreoJS app for use with Docker Compose, Kubernetes, or any container platform.
- **[Vercel](/ecosystem/deployment/vercel)** -- Deploy serverless with automatic previews for every pull request and built-in analytics.
- **[Cloudflare](/ecosystem/deployment/cloudflare)** -- Run at the edge with Cloudflare Workers for ultra-low latency globally.
- **[Fly.io](/ecosystem/deployment/fly-io)** -- Deploy full-stack applications with multi-region support and persistent volumes for databases.
- **[Railway](/ecosystem/deployment/railway)** -- One-click deploys with integrated databases, cron jobs, and team collaboration built in.
