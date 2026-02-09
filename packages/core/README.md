# @ereo/core

Core framework package for EreoJS providing the application container, request context, plugin system, caching, environment variables, and type definitions.

## Installation

```bash
bun add @ereo/core
```

## Quick Start

```typescript
import { createApp, defineConfig, definePlugin } from '@ereo/core';

// Create application with configuration
const app = createApp({
  config: defineConfig({
    server: {
      port: 3000,
      hostname: 'localhost',
    },
  }),
});

// Define a custom plugin
const analyticsPlugin = definePlugin({
  name: 'analytics',
  setup(context) {
    console.log('Analytics initialized in', context.mode, 'mode');
  },
});

// Register the plugin
app.use(analyticsPlugin);

// Start the server
await app.start();
```

## Key Features

- **Application Container** - Create and configure EreoJS applications with `createApp` and `defineConfig`
- **Request Context** - Access request-scoped data with `createContext`, `getContext`, and `attachContext`
- **Plugin System** - Extend functionality with `definePlugin` and `composePlugins`
- **Environment Variables** - Type-safe env management with schema builders (`env.string()`, `env.number()`, etc.)
- **Unified Cache Interface** - Flexible caching with `createCache`, `createTaggedCache`, and tag-based invalidation
- **Full TypeScript Support** - Comprehensive type definitions for routes, loaders, actions, middleware, and more

## Request Context

```typescript
import { createContext, getContext, attachContext } from '@ereo/core';

// Create a request-scoped context from an incoming request
const ctx = createContext(request);

// Store data in the context
ctx.set('userId', '123');
ctx.get('userId'); // '123'

// Attach context to a request for downstream access
attachContext(request, ctx);

// Later, retrieve it
const ctx2 = getContext(request);
ctx2?.get('userId'); // '123'
```

## Environment Variables

```typescript
import { env, setupEnv, typedEnv } from '@ereo/core';

// Define environment schema
const envSchema = {
  DATABASE_URL: env.string().required(),
  PORT: env.port().default(3000),
  DEBUG: env.boolean().default(false),
  NODE_ENV: env.enum(['development', 'production', 'test']).default('development'),
};

// Validate and load environment
const result = await setupEnv('.', envSchema, 'development');

if (result.valid) {
  // Access typed environment variables
  const port = typedEnv.PORT; // number
}
```

## Caching

```typescript
import { createTaggedCache } from '@ereo/core';

const cache = createTaggedCache({ maxSize: 1000 });

// Set with tags for grouped invalidation
await cache.set('user:123', userData, {
  ttl: 3600,
  tags: ['users', 'user:123']
});

// Invalidate all entries with a tag
await cache.invalidateTag('users');
```

## Documentation

For full documentation, visit [https://ereojs.dev/docs/core](https://ereojs.dev/docs/core)

## Part of EreoJS

This package is part of the [EreoJS](https://github.com/ereoJS/ereoJS) monorepo - a modern full-stack framework built for Bun.

## License

MIT
