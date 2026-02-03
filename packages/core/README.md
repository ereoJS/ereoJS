# @ereo/core

Core framework package for EreoJS providing the application container, request context, plugin system, caching, and type definitions.

## Installation

```bash
bun add @ereo/core
```

## Quick Start

```typescript
import { createApp, defineConfig, definePlugin } from '@ereo/core';

// Create your application
const app = createApp(defineConfig({
  server: {
    port: 3000,
  },
}));

// Define a custom plugin
const analyticsPlugin = definePlugin({
  name: 'analytics',
  setup(app) {
    console.log('Analytics initialized');
  },
});

app.use(analyticsPlugin);
```

## Key Features

- **Application Container** - Create and configure EreoJS applications with `createApp` and `defineConfig`
- **Request Context** - Access request-scoped data with `createContext`, `getContext`, and `attachContext`
- **Plugin System** - Extend functionality with `definePlugin` and `composePlugins`
- **Environment Variables** - Type-safe env management with `env`, `validateEnv`, and `typedEnv`
- **Unified Cache Interface** - Flexible caching with `createCache`, `createTaggedCache`, and adapters
- **Full TypeScript Support** - Comprehensive type definitions for routes, loaders, actions, middleware, and more

## Environment Variables

```typescript
import { env, validateEnv, typedEnv } from '@ereo/core';

// Access environment variables
const dbUrl = env('DATABASE_URL');

// Typed environment access
const config = typedEnv({
  PORT: { type: 'number', default: 3000 },
  NODE_ENV: { type: 'string', required: true },
});
```

## Documentation

For full documentation, visit [https://ereojs.dev/docs/core](https://ereojs.dev/docs/core)

## Part of EreoJS

This package is part of the [EreoJS](https://github.com/ereojs/ereo) monorepo - a modern full-stack framework built for Bun.

## License

MIT
