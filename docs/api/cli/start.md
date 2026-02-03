# start

Starts the production server.

## Usage

```bash
bun ereo start [options]
```

Or via package.json:

```json
{
  "scripts": {
    "start": "ereo start"
  }
}
```

```bash
bun start
```

## Prerequisites

Run `bun ereo build` before starting the production server.

## Options

| Option | Alias | Description | Default |
|--------|-------|-------------|---------|
| `--port` | `-p` | Port to listen on | `3000` |
| `--host` | `-h` | Host to bind to | `0.0.0.0` |

## Examples

### Basic Usage

```bash
# Build first
bun ereo build

# Start production server
bun ereo start

# Custom port
bun ereo start --port 8080

# Custom host
bun ereo start --host 127.0.0.1
```

## Production Features

### Performance

- Minified bundles
- Optimized assets
- Efficient caching
- Compressed responses

### Security

- Security headers enabled
- No stack traces in errors
- Source maps not exposed

### Caching

Static assets served with cache headers:

```
Cache-Control: public, max-age=31536000, immutable
```

## Configuration

Configure production server in `ereo.config.ts`:

```ts
import { defineConfig } from '@ereo/core'

export default defineConfig({
  server: {
    port: process.env.PORT || 3000,
    host: '0.0.0.0'
  }
})
```

## Environment Variables

Production environment files:

1. `.env`
2. `.env.production`
3. `.env.production.local`

Required variables example:

```bash
PORT=3000
NODE_ENV=production
DATABASE_URL=postgres://...
```

## Process Management

### Direct

```bash
bun ereo start
```

### With PM2

```bash
pm2 start "bun ereo start" --name ereo-app
```

### With Systemd

```ini
# /etc/systemd/system/ereo-app.service
[Unit]
Description=EreoJS Application
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/var/www/app
ExecStart=/usr/local/bin/bun ereo start
Restart=on-failure
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl enable ereo-app
sudo systemctl start ereo-app
```

## Health Checks

Add a health check endpoint:

```ts
// routes/api/health.ts
export function GET() {
  return Response.json({
    status: 'ok',
    timestamp: new Date().toISOString()
  })
}
```

## Logging

Production logging configuration:

```ts
import { defineConfig } from '@ereo/core'

export default defineConfig({
  server: {
    logging: {
      level: 'info', // 'debug' | 'info' | 'warn' | 'error'
      format: 'json' // 'json' | 'pretty'
    }
  }
})
```

## Graceful Shutdown

EreoJS handles shutdown signals:

```ts
// Handles SIGTERM and SIGINT
// - Stops accepting new connections
// - Finishes in-flight requests
// - Closes database connections
// - Exits cleanly
```

## Programmatic Usage

```ts
import { start } from '@ereo/cli'

await start({
  port: 3000,
  host: '0.0.0.0'
})
```

## Monitoring

### Request Timing

Add timing middleware:

```ts
app.middleware(async (request, next) => {
  const start = Date.now()
  const response = await next()
  const duration = Date.now() - start

  console.log(JSON.stringify({
    method: request.method,
    url: request.url,
    status: response.status,
    duration
  }))

  return response
})
```

### Metrics

Export Prometheus metrics:

```ts
// routes/api/metrics.ts
import { getMetrics } from '../lib/metrics'

export function GET() {
  return new Response(getMetrics(), {
    headers: { 'Content-Type': 'text/plain' }
  })
}
```

## Troubleshooting

### Port Already in Use

```bash
# Find and kill process
lsof -i :3000
kill -9 <PID>
```

### Permission Denied (Port 80/443)

```bash
# Use reverse proxy (nginx/caddy)
# Or use port >= 1024 and reverse proxy

# Or grant capability (not recommended)
sudo setcap 'cap_net_bind_service=+ep' $(which bun)
```

### Out of Memory

```bash
# Monitor memory usage
top -p $(pgrep -f "bun ereo")

# Increase limits if needed
NODE_OPTIONS="--max-old-space-size=4096" bun ereo start
```

## Related

- [dev](/api/cli/dev)
- [build](/api/cli/build)
- [Deployment](/deployment/bun)
