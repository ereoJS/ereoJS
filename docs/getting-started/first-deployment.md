# First Deployment

Get your EreoJS application deployed in minutes. This guide covers three options: running Bun directly on a server, containerizing with Docker, and deploying to Vercel.

## Build for Production

All deployment methods start with a production build:

```bash
bun run build
```

This creates an optimized build in the `.ereo/` directory with server bundles, client assets, and a build manifest.

## Option 1: Bun (Self-Hosted)

The simplest path -- run your build directly with Bun on any Linux or macOS server.

**1. Install Bun on your server:**

```bash
curl -fsSL https://bun.sh/install | bash
```

**2. Copy your project to the server** (via `scp`, `rsync`, or your CI pipeline):

```bash
rsync -avz --exclude node_modules ./ user@server:/var/www/app/
```

**3. Install dependencies and build:**

```bash
cd /var/www/app
bun install --frozen-lockfile
bun run build
```

**4. Start the server:**

```bash
NODE_ENV=production bun ereo start
```

For production, use a process manager like PM2 or systemd to keep the server running. See [Deploying with Bun](/ecosystem/deployment/bun) for PM2 and systemd configuration.

## Option 2: Docker

Package your application in a container for consistent deployments across any infrastructure.

**1. Create a `Dockerfile`:**

```dockerfile
FROM oven/bun:1-slim AS deps
WORKDIR /app
COPY package.json bun.lockb ./
RUN bun install --frozen-lockfile --production

FROM oven/bun:1 AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN bun run build

FROM oven/bun:1-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/.ereo ./.ereo
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
EXPOSE 3000
CMD ["bun", "ereo", "start"]
```

**2. Build and run:**

```bash
docker build -t my-app .
docker run -p 3000:3000 my-app
```

See [Deploying with Docker](/ecosystem/deployment/docker) for multi-stage builds, Docker Compose, and Kubernetes configurations.

## Option 3: Vercel

Deploy to Vercel with zero infrastructure management.

**1. Install the deploy adapter:**

```bash
bun add @ereo/deploy-vercel
```

**2. Update your config:**

```ts
// ereo.config.ts
import { defineConfig } from '@ereo/core'
import { vercel } from '@ereo/deploy-vercel'

export default defineConfig({
  ...vercel(),
})
```

**3. Deploy:**

```bash
npx vercel
```

Or push to GitHub with Vercel's Git integration enabled for automatic deploys on every push.

See [Deploying to Vercel](/ecosystem/deployment/vercel) for environment variables, edge functions, and custom domain setup.

## Health Check Endpoint

Regardless of platform, add a health check route for monitoring:

```ts
// routes/api/health.ts
export function GET() {
  return Response.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
  })
}
```

## Environment Variables

Set environment-specific values in `.env.production`:

```bash
NODE_ENV=production
PORT=3000
DATABASE_URL=postgres://...
```

EreoJS loads `.env.production` automatically when `NODE_ENV=production`.

## Next Steps

- [Deploying with Bun](/ecosystem/deployment/bun) -- PM2, systemd, Nginx reverse proxy
- [Deploying with Docker](/ecosystem/deployment/docker) -- Docker Compose, Kubernetes, CI/CD
- [Deploying to Vercel](/ecosystem/deployment/vercel) -- Edge functions, preview deployments
- [Deploying to Cloudflare](/ecosystem/deployment/cloudflare) -- Workers and Pages
