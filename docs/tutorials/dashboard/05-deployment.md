# Dashboard Tutorial: Deployment

Deploy your authenticated dashboard to production.

## Pre-Deployment Checklist

Before deploying, ensure:

- [ ] All routes work correctly
- [ ] Authentication flows are tested
- [ ] Environment variables are configured
- [ ] Database migrations are ready
- [ ] Islands hydrate correctly

## Environment Configuration

Create `.env.production`:

```env
NODE_ENV=production
DATABASE_URL=file:./data/dashboard.db
SESSION_SECRET=your-secure-secret-key-here
```

## Production Build

Build the application:

```bash
bun run build
```

This generates:

```
dist/
├── server/
│   └── index.js          # Server bundle
├── client/
│   ├── routes/           # Client route chunks
│   └── islands/          # Island bundles
└── static/
    └── ...               # Static assets
```

## Database Considerations

### SQLite for Simple Deployments

SQLite works great for single-server deployments:

```ts
// Ensure data directory exists
import { mkdirSync } from 'fs'
mkdirSync('./data', { recursive: true })

const db = new Database('./data/dashboard.db')
```

### PostgreSQL for Production

For multi-server deployments, use PostgreSQL:

```bash
bun add pg
```

Update `app/lib/db.ts`:

```ts
import { Pool } from 'pg'

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
})

export const db = {
  query: async <T>(sql: string, params?: any[]): Promise<T[]> => {
    const result = await pool.query(sql, params)
    return result.rows
  },
  run: async (sql: string, params?: any[]) => {
    await pool.query(sql, params)
  }
}
```

## Deploy to a VPS

### Using Docker

Create `Dockerfile`:

```dockerfile
FROM oven/bun:1 AS builder
WORKDIR /app
COPY package.json bun.lockb ./
RUN bun install --frozen-lockfile
COPY . .
RUN bun run build

FROM oven/bun:1-slim
WORKDIR /app

RUN addgroup --system --gid 1001 app && \
    adduser --system --uid 1001 --ingroup app app

COPY --from=builder --chown=app:app /app/dist ./dist
COPY --from=builder --chown=app:app /app/node_modules ./node_modules
COPY --from=builder --chown=app:app /app/package.json ./

USER app
EXPOSE 3000
CMD ["bun", "ereo", "start"]
```

Create `docker-compose.yml`:

```yaml
version: '3.8'

services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - DATABASE_URL=postgres://postgres:password@db:5432/dashboard
      - SESSION_SECRET=${SESSION_SECRET}
    volumes:
      - app_data:/app/data
    depends_on:
      db:
        condition: service_healthy

  db:
    image: postgres:16-alpine
    volumes:
      - postgres_data:/var/lib/postgresql/data
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: password
      POSTGRES_DB: dashboard
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 5s
      timeout: 5s
      retries: 5

volumes:
  app_data:
  postgres_data:
```

Deploy:

```bash
docker-compose up -d
```

### Using systemd

For direct deployment on a VPS:

```bash
# Copy files to server
rsync -avz dist/ user@server:/app/dist/
rsync -avz node_modules/ user@server:/app/node_modules/
rsync -avz package.json user@server:/app/
```

Create `/etc/systemd/system/dashboard.service`:

```ini
[Unit]
Description=Dashboard App
After=network.target

[Service]
Type=simple
User=app
WorkingDirectory=/app
Environment=NODE_ENV=production
Environment=PORT=3000
ExecStart=/usr/local/bin/bun ereo start
Restart=on-failure

[Install]
WantedBy=multi-user.target
```

Start the service:

```bash
sudo systemctl enable dashboard
sudo systemctl start dashboard
```

## Deploy to Cloud Platforms

### Vercel

Create `vercel.json`:

```json
{
  "buildCommand": "bun run build",
  "outputDirectory": "dist",
  "installCommand": "bun install"
}
```

```bash
vercel --prod
```

### Cloudflare Workers

Update `ereo.config.ts`:

```ts
export default defineConfig({
  build: {
    target: 'cloudflare'
  }
})
```

Deploy:

```bash
wrangler deploy
```

### Fly.io

Create `fly.toml`:

```toml
app = "dashboard-app"
primary_region = "ord"

[build]
  dockerfile = "Dockerfile"

[env]
  NODE_ENV = "production"
  PORT = "3000"

[http_service]
  internal_port = 3000
  force_https = true

[[services.ports]]
  handlers = ["http"]
  port = 80

[[services.ports]]
  handlers = ["tls", "http"]
  port = 443

[mounts]
  source = "data"
  destination = "/app/data"
```

Deploy:

```bash
fly launch
fly deploy
```

## Nginx Configuration

For production with SSL:

```nginx
server {
    listen 80;
    server_name dashboard.example.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name dashboard.example.com;

    ssl_certificate /etc/letsencrypt/live/dashboard.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/dashboard.example.com/privkey.pem;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # Static files with long cache
    location /static/ {
        proxy_pass http://localhost:3000;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

## Session Security

For production, enhance session security:

```ts
// app/lib/auth.ts
export function createSession(userId: number): string {
  const sessionId = randomUUID()
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)

  db.run(
    'INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)',
    [sessionId, userId, expiresAt.toISOString()]
  )

  return sessionId
}

export function getSessionCookie(sessionId: string): string {
  const isProduction = process.env.NODE_ENV === 'production'

  return [
    `session=${sessionId}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${7 * 24 * 60 * 60}`,
    isProduction ? 'Secure' : ''
  ].filter(Boolean).join('; ')
}
```

## Monitoring

Add health check endpoint:

```ts
// app/routes/api/health.ts
export const loader = createLoader(async () => {
  // Check database connection
  try {
    db.query('SELECT 1')
    return { status: 'healthy', timestamp: new Date().toISOString() }
  } catch (error) {
    return new Response(JSON.stringify({
      status: 'unhealthy',
      error: 'Database connection failed'
    }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' }
    })
  }
})
```

## What You've Built

Congratulations! You've built a complete dashboard with:

- ✅ User authentication with sessions
- ✅ Protected routes with middleware
- ✅ Interactive islands with shared state
- ✅ Real-time data visualization
- ✅ Production-ready deployment

## Next Steps

- Add more dashboard features
- Implement role-based access control
- Add real-time notifications with WebSockets
- Integrate with external APIs

## Related Resources

- [Authentication Guide](/guides/authentication)
- [Islands Architecture](/concepts/islands)
- [Deployment Options](/ecosystem/deployment/bun)
- [State Management](/api/state/signals)
