# Deploying to Fly.io

Deploy your EreoJS application to [Fly.io](https://fly.io) for globally distributed hosting.

## Prerequisites

- A [Fly.io account](https://fly.io/app/sign-up)
- The Fly CLI installed: `curl -L https://fly.io/install.sh | sh`
- Authenticate: `fly auth login`

## Dockerfile

Create a `Dockerfile` in your project root:

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

RUN addgroup --system --gid 1001 app && \
    adduser --system --uid 1001 --ingroup app app

COPY --from=builder --chown=app:app /app/dist ./dist
COPY --from=builder --chown=app:app /app/node_modules ./node_modules
COPY --from=builder --chown=app:app /app/package.json ./

USER app

EXPOSE 3000

CMD ["bun", "ereo", "start"]
```

## Fly Configuration

Create a `fly.toml` configuration file:

```toml
# fly.toml
app = "my-ereo-app"
primary_region = "iad"

[build]

[http_service]
  internal_port = 3000
  force_https = true
  auto_stop_machines = "stop"
  auto_start_machines = true
  min_machines_running = 1

[checks]
  [checks.health]
    type = "http"
    port = 3000
    path = "/api/health"
    interval = "30s"
    timeout = "5s"
```

## Launch and Deploy

Initialize the Fly app:

```bash
fly launch
```

This detects the Dockerfile, creates the app on Fly.io, and prompts for configuration. Review the settings and confirm.

Deploy:

```bash
fly deploy
```

Fly builds the Docker image remotely and deploys it. Subsequent deploys only rebuild changed layers.

## Secrets Management

Set environment variables as Fly secrets (encrypted, not stored in `fly.toml`):

```bash
fly secrets set DATABASE_URL="postgres://user:pass@host:5432/db"
fly secrets set SESSION_SECRET="your-secret-here"
```

List current secrets:

```bash
fly secrets list
```

Secrets are injected as environment variables at runtime and are available via `process.env`.

## Scaling Across Regions

Deploy to multiple regions for lower latency:

```bash
# Add a region
fly scale count 2 --region iad,cdg

# List current machines
fly status
```

Common regions:
- `iad` --- Ashburn, Virginia (US East)
- `lax` --- Los Angeles (US West)
- `cdg` --- Paris (Europe)
- `nrt` --- Tokyo (Asia)

## Database with Fly Postgres

Create a Fly Postgres database:

```bash
fly postgres create --name my-ereo-db
fly postgres attach my-ereo-db
```

This automatically sets the `DATABASE_URL` secret on your app.

## Volumes for Persistent Storage

If your app needs persistent file storage (uploads, SQLite):

```bash
fly volumes create data --size 1 --region iad
```

Mount it in `fly.toml`:

```toml
[mounts]
  source = "data"
  destination = "/app/data"
```

## Monitoring

View application logs:

```bash
fly logs
```

Check deployment status:

```bash
fly status
```

Open the deployed app in your browser:

```bash
fly open
```

## Continuous Deployment

See the [CI/CD guide](/ecosystem/ci-cd) for setting up automatic deploys from GitHub Actions when pushing to `main`.
