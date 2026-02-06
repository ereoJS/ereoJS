# Deployment FAQ

Frequently asked questions about building and deploying EreoJS applications.

## Which platforms support Bun?

Bun runs on macOS, Linux, and Windows (via WSL). Deployment platforms that support Bun include:

| Platform | Support | Notes |
|----------|---------|-------|
| Self-hosted (VPS) | Full | Install Bun directly |
| Docker | Full | Use the `oven/bun` base image |
| Fly.io | Full | Dockerfile-based deployment |
| Railway | Full | Auto-detects Bun projects |
| Render | Full | Custom build/start commands |
| Vercel | Partial | Via Edge Functions adapter |
| Cloudflare | Partial | Via Workers adapter |

For platforms that do not natively support Bun, use a Docker container with the official Bun image.

See the [Deployment guides](/ecosystem/deployment/) for platform-specific instructions.

## How do I set up a production environment?

Set the `NODE_ENV` environment variable to `production` and configure your secrets:

```bash
# Build the application
NODE_ENV=production bun run build

# Start the production server
NODE_ENV=production bun ereo start
```

Use environment variables for sensitive configuration. EreoJS reads `.env.production` automatically in production mode:

```bash
# .env.production
DATABASE_URL=postgres://user:pass@host:5432/mydb
SESSION_SECRET=your-secret-here
```

See the [Environment Variables guide](/guides/environment-variables) for details on env file loading order.

## Where are static assets served from?

Static assets in the `public/` directory are served from the root URL path. After building, bundled assets (JS, CSS) are output to `dist/client/`:

```
public/
  favicon.ico          # Served at /favicon.ico
  robots.txt           # Served at /robots.txt
  images/
    logo.png           # Served at /images/logo.png

dist/
  client/              # Built JS/CSS bundles (auto-served)
  server/              # Server bundle
```

In production, configure your reverse proxy or CDN to serve `dist/client/` with long cache headers, since filenames include content hashes.

## How do I enable HTTPS?

For local development, EreoJS can generate self-signed certificates:

```ts
// ereo.config.ts
export default defineConfig({
  server: {
    https: true, // Auto-generates self-signed cert for localhost
  },
})
```

In production, terminate HTTPS at your reverse proxy (Nginx, Caddy) or use your platform's built-in HTTPS support (Fly.io, Railway, Vercel all handle this automatically).

## How do I configure a custom domain?

Custom domains are configured at the platform level, not in EreoJS itself. Each deployment platform has its own process:

- **Fly.io** --- `fly certs add yourdomain.com`
- **Railway** --- Add domain in the project dashboard
- **Vercel** --- Add domain in project settings
- **Self-hosted** --- Configure DNS to point to your server IP and set up HTTPS with Caddy or Nginx

## What does the build output directory look like?

Running `bun run build` produces:

```
dist/
  client/              # Client-side bundles
    assets/
      index-[hash].js
      index-[hash].css
  server/              # Server-side bundle
    index.js
  static/              # Pre-rendered static pages (SSG routes)
    about.html
    pricing.html
```

The `dist/` directory is self-contained. Deploy it along with `node_modules` and `package.json` to run the production server.

To customize the output directory:

```ts
// ereo.config.ts
export default defineConfig({
  build: {
    outDir: './build', // Default: './dist'
  },
})
```

See the [Config Reference](/reference/config-reference) for all build options.
