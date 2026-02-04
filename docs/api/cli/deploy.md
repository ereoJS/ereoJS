# deploy

Deploy your EreoJS application to production with a single command. Supports multiple platforms with automatic configuration generation.

## Usage

```bash
bun ereo deploy [target] [options]
```

Or via package.json:

```json
{
  "scripts": {
    "deploy": "ereo deploy",
    "deploy:prod": "ereo deploy --prod"
  }
}
```

## Deployment Targets

| Target | Description | URL Pattern |
|--------|-------------|-------------|
| `vercel` | Vercel (default) | `*.vercel.app` |
| `cloudflare` | Cloudflare Pages/Workers | `*.workers.dev` |
| `fly` | Fly.io | `*.fly.dev` |
| `netlify` | Netlify | `*.netlify.app` |
| `docker` | Docker image build | Local image |

## Options

| Option | Alias | Description | Default |
|--------|-------|-------------|---------|
| `--prod` | `--production` | Deploy to production | `false` |
| `--dry-run` | `--dryRun` | Preview deployment without executing | `false` |
| `--name` | | Project name for new deployments | Auto-detected |
| `--no-build` | | Skip the build step | `false` |
| `--help` | `-h` | Show deploy help | |

## Examples

### Quick Deploy

```bash
# Auto-detect platform and deploy
bun ereo deploy

# Deploy to production
bun ereo deploy --prod
```

### Platform-Specific

```bash
# Vercel
bun ereo deploy vercel --prod

# Cloudflare Workers
bun ereo deploy cloudflare

# Fly.io
bun ereo deploy fly --prod

# Netlify
bun ereo deploy netlify --prod

# Docker
bun ereo deploy docker --name my-app
```

### Preview Deployment

```bash
# See what would be deployed without executing
bun ereo deploy --dry-run
```

### Skip Build

```bash
# Deploy existing build
bun ereo deploy --no-build
```

## Platform Configuration

### Vercel

The deploy command auto-generates `vercel.json` if not present:

```json
{
  "buildCommand": "bun run build",
  "outputDirectory": "dist",
  "framework": null,
  "functions": {
    "api/**/*.ts": {
      "runtime": "@vercel/bun@0.1.0"
    }
  }
}
```

**Prerequisites:**
- Vercel CLI (`bunx vercel` or `bun add -g vercel`)
- Vercel account and authentication

**Deploy:**

```bash
# Preview deployment
bun ereo deploy vercel

# Production deployment
bun ereo deploy vercel --prod
```

**Manual Vercel setup:**

```bash
# Install CLI
bun add -g vercel

# Login
vercel login

# Link project
vercel link
```

### Cloudflare Workers

Auto-generates `wrangler.toml` if not present:

```toml
name = "ereo-app"
main = "dist/server/index.js"
compatibility_date = "2024-01-01"

[site]
bucket = "./dist/client"

[build]
command = "bun run build"
```

**Prerequisites:**
- Wrangler CLI (`bun add -g wrangler`)
- Cloudflare account and authentication

**Deploy:**

```bash
bun ereo deploy cloudflare
```

**Manual Wrangler setup:**

```bash
# Install CLI
bun add -g wrangler

# Login
wrangler login

# Deploy
wrangler deploy
```

### Fly.io

Auto-generates `fly.toml` if not present:

```toml
app = "ereo-app"
primary_region = "iad"

[build]
  builder = "oven/bun"

[http_service]
  internal_port = 3000
  force_https = true
  auto_stop_machines = true
  auto_start_machines = true
  min_machines_running = 0
```

**Prerequisites:**
- Fly CLI (`flyctl`)
- Fly.io account and authentication

**Install Fly CLI:**

```bash
# macOS
brew install flyctl

# Linux
curl -L https://fly.io/install.sh | sh

# Windows
powershell -Command "iwr https://fly.io/install.ps1 -useb | iex"
```

**Deploy:**

```bash
# Login
fly auth login

# Create app (first time)
fly apps create my-app

# Deploy
bun ereo deploy fly --prod
```

### Netlify

Auto-generates `netlify.toml` if not present:

```toml
[build]
  command = "bun run build"
  publish = "dist/client"
  functions = "dist/server"

[functions]
  node_bundler = "esbuild"

[[redirects]]
  from = "/api/*"
  to = "/.netlify/functions/api/:splat"
  status = 200

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

**Prerequisites:**
- Netlify CLI (`bun add -g netlify-cli`)
- Netlify account and authentication

**Deploy:**

```bash
# Install CLI
bun add -g netlify-cli

# Login
netlify login

# Deploy preview
bun ereo deploy netlify

# Deploy production
bun ereo deploy netlify --prod
```

### Docker

Auto-generates `Dockerfile` if not present:

```dockerfile
# Build stage
FROM oven/bun:1 as builder
WORKDIR /app
COPY package.json bun.lockb* ./
RUN bun install --frozen-lockfile
COPY . .
RUN bun run build

# Production stage
FROM oven/bun:1-slim
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./
COPY --from=builder /app/node_modules ./node_modules
ENV NODE_ENV=production
EXPOSE 3000
CMD ["bun", "run", "start"]
```

**Build and run:**

```bash
# Build image
bun ereo deploy docker --name my-app

# Run container
docker run -p 3000:3000 my-app:latest

# With environment variables
docker run -p 3000:3000 -e DATABASE_URL=... my-app:latest
```

**Push to registry:**

```bash
# Tag for registry
docker tag my-app:latest registry.example.com/my-app:latest

# Push
docker push registry.example.com/my-app:latest
```

## Auto-Detection

The deploy command automatically detects the target platform by checking for existing configuration files:

1. `vercel.json` - Vercel
2. `wrangler.toml` - Cloudflare
3. `fly.toml` - Fly.io
4. `netlify.toml` - Netlify
5. `Dockerfile` - Docker

If no configuration file is found, defaults to Vercel.

## Environment Variables

### Platform-Specific Environment Variables

**Vercel:**
```bash
vercel env add DATABASE_URL production
```

**Cloudflare:**
```bash
wrangler secret put DATABASE_URL
```

**Fly.io:**
```bash
fly secrets set DATABASE_URL=...
```

**Netlify:**
```bash
netlify env:set DATABASE_URL ...
```

**Docker:**
```bash
docker run -e DATABASE_URL=... my-app:latest
```

### Build-Time Variables

For variables needed at build time:

```bash
# Vercel
vercel env add EREO_PUBLIC_API_URL production

# Or in vercel.json
{
  "build": {
    "env": {
      "EREO_PUBLIC_API_URL": "https://api.example.com"
    }
  }
}
```

## Programmatic Usage

```ts
import { deploy } from '@ereo/cli';

const result = await deploy({
  target: 'vercel',
  production: true,
  build: true,
  name: 'my-app',
});

if (result.success) {
  console.log('Deployed to:', result.url);
} else {
  console.error('Deploy failed:', result.error);
}
```

### Deploy Result

```ts
interface DeployResult {
  success: boolean;
  url?: string;           // Deployment URL
  deploymentId?: string;  // Platform-specific ID
  logs?: string[];        // Deployment logs
  error?: string;         // Error message if failed
}
```

## CI/CD Integration

### GitHub Actions

```yaml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: oven-sh/setup-bun@v1

      - name: Install dependencies
        run: bun install

      - name: Deploy to Vercel
        run: bun ereo deploy vercel --prod
        env:
          VERCEL_TOKEN: ${{ secrets.VERCEL_TOKEN }}
```

### GitLab CI

```yaml
deploy:
  stage: deploy
  image: oven/bun:1
  script:
    - bun install
    - bun ereo deploy vercel --prod
  only:
    - main
  variables:
    VERCEL_TOKEN: $VERCEL_TOKEN
```

## Troubleshooting

### CLI Not Found

```bash
# Install platform CLI
bun add -g vercel        # Vercel
bun add -g wrangler      # Cloudflare
bun add -g netlify-cli   # Netlify

# Fly.io requires separate installation
curl -L https://fly.io/install.sh | sh
```

### Authentication Failed

```bash
# Re-authenticate
vercel login
wrangler login
fly auth login
netlify login
```

### Build Fails

```bash
# Run build locally first
bun ereo build

# Check for errors
DEBUG=ereo:* bun ereo build
```

### Deployment Timeout

For large applications:

```bash
# Increase timeout (platform-specific)
vercel --timeout 600

# Or use --no-build and deploy pre-built
bun ereo build
bun ereo deploy --no-build
```

### Docker Build Fails

```bash
# Check Docker is running
docker info

# Build with verbose output
docker build -t my-app . --progress=plain

# Clean and rebuild
docker system prune -f
bun ereo deploy docker
```

## Best Practices

### 1. Use Environment Variables

Never commit secrets. Use platform-specific secret management:

```bash
# Set secrets per platform
vercel env add API_KEY production
fly secrets set API_KEY=...
```

### 2. Preview Before Production

Always test preview deployments first:

```bash
bun ereo deploy vercel       # Preview
bun ereo deploy vercel --prod # Production (after testing)
```

### 3. Use Dry Run

Check deployment configuration:

```bash
bun ereo deploy --dry-run
```

### 4. Version Your Config

Commit platform configuration files:

```bash
git add vercel.json fly.toml wrangler.toml netlify.toml
git commit -m "Add deployment configuration"
```

### 5. Set Up CI/CD

Automate deployments on merge to main branch.

## Related

- [build](/api/cli/build) - Production build
- [start](/api/cli/start) - Production server
- [dev](/api/cli/dev) - Development server
- [Environment Variables](/guides/environment-variables)
