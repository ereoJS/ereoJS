# @ereo/router

File-based routing for the EreoJS framework. Supports dynamic routes, catch-all routes, layouts, route groups, and middleware chains.

## Installation

```bash
bun add @ereo/router
```

## Quick Start

```typescript
import { createFileRouter, matchRoute } from '@ereo/router';

// Initialize the file router
const router = createFileRouter({
  routesDir: './src/routes',
});

// Match a URL to a route
const match = matchRoute(router, '/users/123');
// { params: { id: '123' }, route: { ... } }
```

## Key Features

- **File-Based Routing** - Automatic route generation from your file structure
- **Dynamic Routes** - Support for `[param]`, `[...catchAll]`, and `[[optional]]` segments
- **Route Groups** - Organize routes with `(group)` folders without affecting URLs
- **Layouts** - Nested layouts with automatic composition
- **Middleware Chain** - Register and compose middleware with `createMiddleware` and `chainMiddleware`
- **Route Validation** - Validate params and search params with built-in validators
- **Built-in Middleware** - Logger, CORS, and rate limiting out of the box

## Middleware Example

```typescript
import { createMiddleware, chainMiddleware, createLoggerMiddleware } from '@ereo/router';

const authMiddleware = createMiddleware(async (ctx, next) => {
  if (!ctx.request.headers.get('Authorization')) {
    return new Response('Unauthorized', { status: 401 });
  }
  return next();
});

const chain = chainMiddleware([
  createLoggerMiddleware(),
  authMiddleware,
]);
```

## Route Patterns

| Pattern | Example | Matches |
|---------|---------|---------|
| `[param]` | `/users/[id].tsx` | `/users/123` |
| `[...all]` | `/docs/[...slug].tsx` | `/docs/a/b/c` |
| `[[opt]]` | `/posts/[[page]].tsx` | `/posts`, `/posts/2` |
| `(group)` | `/(auth)/login.tsx` | `/login` |

## Documentation

For full documentation, visit [https://ereojs.dev/docs/router](https://ereojs.dev/docs/router)

## Part of EreoJS

This package is part of the [EreoJS](https://github.com/ereojs/ereo) monorepo - a modern full-stack framework built for Bun.

## License

MIT
