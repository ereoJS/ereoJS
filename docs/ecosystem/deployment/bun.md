# Deploying with Bun

Deploy your EreoJS application natively with Bun.

## Build for Production

```bash
bun run build
```

This creates an optimized build in `.ereo/` (the default output directory):

```
.ereo/
├── server/
│   ├── index.js     # Server entry
│   ├── routes/      # Route modules
│   └── chunks/
├── client/
│   ├── index.js     # Client entry
│   ├── islands/     # Island bundles
│   └── chunks/
├── assets/          # Static assets and CSS
└── manifest.json    # Build manifest
```

## Start the Server

```bash
bun ereo start
```

Or directly:

```bash
bun .ereo/server/index.js
```

## Environment Variables

Create `.env.production`:

```bash
PORT=3000
NODE_ENV=production
DATABASE_URL=postgres://...
```

## Running with PM2

Install PM2:

```bash
npm install -g pm2
```

Create `ecosystem.config.js`:

```js
module.exports = {
  apps: [{
    name: 'ereo-app',
    script: 'bun',
    args: 'ereo start',
    instances: 'max',
    exec_mode: 'cluster',
    env_production: {
      NODE_ENV: 'production',
      PORT: 3000
    }
  }]
}
```

Start:

```bash
pm2 start ecosystem.config.js --env production
```

## Systemd Service

Create `/etc/systemd/system/ereo-app.service`:

```ini
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
Environment=PORT=3000

[Install]
WantedBy=multi-user.target
```

Enable and start:

```bash
sudo systemctl enable ereo-app
sudo systemctl start ereo-app
```

## Nginx Reverse Proxy

```nginx
server {
    listen 80;
    server_name example.com;

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

    # Static files (served by EreoJS at /_ereo with 1-year cache)
    location /_ereo/ {
        alias /var/www/app/.ereo/client/;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

## Health Checks

Add a health endpoint:

```tsx
// routes/api/health.ts
export function GET() {
  return Response.json({
    status: 'ok',
    timestamp: new Date().toISOString()
  })
}
```

## Logging

Configure production logging:

```ts
// ereo.config.ts
export default defineConfig({
  server: {
    logging: {
      level: 'info',
      format: 'json'
    }
  }
})
```

## SSL/TLS

For HTTPS, use a reverse proxy (Nginx, Caddy) or configure directly:

```ts
export default defineConfig({
  server: {
    https: {
      key: '/path/to/key.pem',
      cert: '/path/to/cert.pem'
    }
  }
})
```

## Deployment Checklist

- [ ] Set `NODE_ENV=production`
- [ ] Configure environment variables
- [ ] Run `bun run build`
- [ ] Set up process manager (PM2/systemd)
- [ ] Configure reverse proxy
- [ ] Enable HTTPS
- [ ] Set up health checks
- [ ] Configure logging
- [ ] Set up monitoring
