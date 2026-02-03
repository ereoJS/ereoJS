# @ereo/server

High-performance Bun HTTP server for the EreoJS framework. Includes streaming SSR, middleware, static file serving, and compression.

## Installation

```bash
bun add @ereo/server
```

## Quick Start

```typescript
import { createServer, serve } from '@ereo/server';
import { createFileRouter } from '@ereo/router';

const router = createFileRouter({ routesDir: './src/routes' });

const server = createServer({
  router,
  port: 3000,
});

serve(server);
// Server running at http://localhost:3000
```

## Key Features

- **High Performance** - Built on Bun's native HTTP server for maximum speed
- **Streaming SSR** - Stream React components with `renderToStream` and Suspense support
- **Middleware Stack** - Composable middleware with `createMiddlewareChain`
- **Static Files** - Efficient static file serving with `serveStatic` and MIME type detection
- **Built-in Middleware** - Logger, CORS, security headers, compression, and rate limiting
- **Shell Templates** - Customizable HTML shells for SSR with `createShell`

## Middleware Example

```typescript
import { createMiddlewareChain, logger, cors, securityHeaders, compress } from '@ereo/server';

const middleware = createMiddlewareChain([
  logger(),
  cors({ origin: 'https://example.com' }),
  securityHeaders(),
  compress(),
]);
```

## Streaming SSR

```typescript
import { renderToStream, createShell } from '@ereo/server';

const shell = createShell({
  head: '<title>My App</title>',
  scripts: ['/client.js'],
});

const stream = await renderToStream(<App />, { shell });
return new Response(stream, {
  headers: { 'Content-Type': 'text/html' },
});
```

## Documentation

For full documentation, visit [https://ereojs.dev/docs/server](https://ereojs.dev/docs/server)

## Part of EreoJS

This package is part of the [EreoJS](https://github.com/ereojs/ereo) monorepo - a modern full-stack framework built for Bun.

## License

MIT
