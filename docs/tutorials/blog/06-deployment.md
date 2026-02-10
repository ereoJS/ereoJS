# Blog Tutorial: Deployment

In this final chapter, we'll prepare our blog for production and deploy it.

## Production Checklist

Before deploying, let's ensure our app is production-ready:

### 1. Environment Variables

Create `.env.production`:

```bash
NODE_ENV=production
DATABASE_URL=./data/blog.db
```

Update your code to use environment variables:

```ts
// app/lib/db.ts
import { Database } from 'bun:sqlite'

const dbPath = process.env.DATABASE_URL || 'blog.db'
const db = new Database(dbPath)

// ... rest of the file
```

### 2. Security Headers

Add security middleware. Create `app/middleware/security.ts`:

```ts
import type { MiddlewareHandler } from '@ereo/core'

export const securityMiddleware: MiddlewareHandler = async (request, context, next) => {
  const response = await next()

  // Add security headers
  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set('X-Frame-Options', 'DENY')
  response.headers.set('X-XSS-Protection', '1; mode=block')
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')

  return response
}
```

### 3. Error Pages

Create a root error page at `app/routes/_error.tsx`. The simplest approach receives the error as a prop:

```tsx
// app/routes/_error.tsx
export default function RootError({ error }: { error: Error }) {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">
          Something went wrong
        </h1>
        <p className="text-gray-600 mb-8">
          {error?.message || 'An unexpected error occurred.'}
        </p>
        <a href="/" className="btn">Go Home</a>
      </div>
    </div>
  )
}
```

For more advanced error handling (e.g., distinguishing 404s from 500s), you can use the `useRouteError` hook:

```tsx
// app/routes/_error.tsx
import { useRouteError, isRouteErrorResponse } from '@ereo/client'

export default function RootError() {
  const error = useRouteError()

  if (isRouteErrorResponse(error)) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-6xl font-bold text-gray-900 mb-4">
            {error.status}
          </h1>
          <p className="text-xl text-gray-600 mb-8">
            {error.status === 404 ? 'Page not found' : error.statusText}
          </p>
          <a href="/" className="btn">Go Home</a>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">
          Something went wrong
        </h1>
        <p className="text-gray-600 mb-8">
          We're sorry, an unexpected error occurred.
        </p>
        <a href="/" className="btn">Go Home</a>
      </div>
    </div>
  )
}
```

### 4. Meta Tags

Add SEO meta tags. Update `app/routes/_layout.tsx`:

```tsx
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="description" content="A blog about web development and EreoJS" />
        <meta property="og:title" content="My Blog" />
        <meta property="og:description" content="A blog about web development" />
        <meta property="og:type" content="website" />
        <link rel="icon" href="/favicon.ico" />
        <title>My Blog</title>
        <link rel="stylesheet" href="/styles.css" />
      </head>
      <body className="bg-gray-50 text-gray-900 min-h-screen">
        {/* ... rest of layout */}
      </body>
    </html>
  )
}
```

## Build for Production

```bash
# Build CSS and application
bun run build
```

This creates an optimized build in `dist/`.

## Deployment Options

### Option 1: Self-Hosted with Bun

The simplest deployment is running Bun directly:

```bash
# On your server
bun install --production
bun run build
bun ereo start
```

Use a process manager like PM2:

```bash
pm2 start "bun ereo start" --name blog
```

### Option 2: Docker

Create a `Dockerfile`:

```dockerfile
FROM oven/bun:1

WORKDIR /app

# Install dependencies
COPY package.json bun.lockb ./
RUN bun install --frozen-lockfile --production

# Copy source
COPY . .

# Build
RUN bun run build

# Expose port
EXPOSE 3000

# Start
CMD ["bun", "ereo", "start"]
```

Build and run:

```bash
docker build -t my-blog .
docker run -p 3000:3000 my-blog
```

### Option 3: Docker Compose

Create `docker-compose.yml`:

```yaml
version: '3.8'

services:
  blog:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
    volumes:
      - ./data:/app/data
    restart: unless-stopped
```

Run:

```bash
docker-compose up -d
```

### Option 4: Fly.io

Create `fly.toml`:

```toml
app = "my-blog"
primary_region = "sjc"

[build]
  dockerfile = "Dockerfile"

[http_service]
  internal_port = 3000
  force_https = true
  auto_stop_machines = true
  auto_start_machines = true
  min_machines_running = 0

[mounts]
  source = "data"
  destination = "/app/data"
```

Deploy:

```bash
fly launch
fly deploy
```

## Add a Health Check

Create `app/routes/api/health.ts`:

```ts
import { createLoader } from '@ereo/data'

export const loader = createLoader(async () => {
  return Response.json({
    status: 'ok',
    timestamp: new Date().toISOString()
  })
})
```

## Set Up Reverse Proxy (Nginx)

If using Nginx as a reverse proxy:

```nginx
server {
    listen 80;
    server_name blog.example.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name blog.example.com;

    ssl_certificate /etc/letsencrypt/live/blog.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/blog.example.com/privkey.pem;

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
}
```

## Monitoring

Add basic logging:

```ts
// app/middleware/logger.ts
import type { MiddlewareHandler } from '@ereo/core'

export const loggerMiddleware: MiddlewareHandler = async (request, context, next) => {
  const start = Date.now()
  const response = await next()
  const duration = Date.now() - start

  console.log(JSON.stringify({
    method: request.method,
    url: request.url,
    status: response.status,
    duration: `${duration}ms`,
    timestamp: new Date().toISOString()
  }))

  return response
}
```

## Final Project Structure

```
blog/
├── app/
│   ├── components/
│   │   └── LikeButton.tsx
│   ├── lib/
│   │   └── db.ts
│   ├── middleware/
│   │   ├── logger.ts
│   │   └── security.ts
│   └── routes/
│       ├── api/
│       │   ├── health.ts
│       │   └── posts/
│       │       └── [id]/
│       │           └── like.ts
│       ├── posts/
│       │   ├── _error.tsx
│       │   ├── index.tsx
│       │   ├── new.tsx
│       │   ├── [slug].tsx
│       │   └── [slug]/
│       │       └── edit.tsx
│       ├── _error.tsx
│       ├── _layout.tsx
│       └── index.tsx
├── public/
│   ├── favicon.ico
│   └── styles.css
├── data/
│   └── blog.db
├── .env
├── .env.production
├── Dockerfile
├── docker-compose.yml
├── ereo.config.ts
├── package.json
├── tailwind.config.js
└── tsconfig.json
```

## Congratulations!

You've built a complete blog application with EreoJS! You've learned:

1. **Project setup** - Creating and configuring an EreoJS project
2. **File-based routing** - Pages, dynamic routes, layouts
3. **Data loading** - Loaders for fetching data
4. **Form handling** - Actions for mutations, validation, error handling
5. **Islands** - Interactive components with selective hydration
6. **Styling** - Tailwind CSS integration
7. **Deployment** - Production builds and hosting

## Next Steps

- Add user authentication
- Implement search functionality
- Add categories and tags
- Set up a proper database (PostgreSQL, etc.)
- Add image uploads
- Implement RSS feed

## Resources

- [EreoJS Documentation](/)
- [API Reference](/api/core/create-app)
- [GitHub Repository](https://github.com/ereoJS/ereoJS)

[← Previous: Styling](/tutorials/blog/05-styling) | [Back to Tutorials](/tutorials/)
