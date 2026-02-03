# @ereo/core

Core framework package providing the application container, request context, plugin system, environment variables, caching, and type definitions for the EreoJS framework.

## Installation

```bash
bun add @ereo/core
```

## Overview

The `@ereo/core` package provides essential building blocks for EreoJS applications:

- **Application Container** - App lifecycle and configuration management
- **Request Context** - Async context for request-scoped data
- **Plugin System** - Extensible plugin architecture
- **Environment Variables** - Type-safe env handling with validation
- **Caching** - Unified cache interface with adapters
- **Type System** - Core TypeScript definitions

## Quick Start

```tsx
import { createApp, defineConfig } from '@ereo/core';

// Define configuration
const config = defineConfig({
  server: {
    port: 3000,
    hostname: 'localhost',
  },
  build: {
    target: 'bun',
    outDir: '.ereo',
  },
});

// Create app instance
const app = createApp(config);

// Start server
await app.start();
```

---

## Application

### createApp()

Creates an EreoJS application instance.

```tsx
import { createApp, defineConfig } from '@ereo/core';

const app = createApp(defineConfig({
  server: { port: 3000 },
  routesDir: 'app/routes',
}));

// Start the server
await app.start();
```

### defineConfig()

Defines strongly-typed configuration with autocomplete.

```tsx
import { defineConfig } from '@ereo/core';

export default defineConfig({
  // Server settings
  server: {
    port: 3000,
    hostname: '0.0.0.0',
    https: {
      key: './certs/key.pem',
      cert: './certs/cert.pem',
    },
  },
  
  // Build settings
  build: {
    target: 'bun',
    outDir: '.ereo',
    minify: true,
    sourcemap: true,
    splitting: true,
  },
  
  // Development settings
  dev: {
    hmr: true,
    errorOverlay: true,
  },
  
  // Routes location
  routesDir: 'app/routes',
  
  // Plugins
  plugins: [
    // Add plugins here
  ],
});
```

See [create-app](/api/core/create-app) for complete configuration options.

---

## Request Context

### createContext()

Creates a request-scoped async context.

```tsx
import { createContext, getContext } from '@ereo/core';

// Create a context for the current request
const context = createContext({
  requestId: generateId(),
  startTime: Date.now(),
  user: await getCurrentUser(request),
});

// Access context anywhere in the request lifecycle
type Context = { user: User; requestId: string };
const ctx = getContext<Context>();
console.log(ctx.user.id);
```

### Context Usage

```tsx
// Middleware that sets context
export async function authMiddleware({ request, context }: MiddlewareArgs) {
  const user = await verifyAuth(request);
  context.set('user', user);
  return context.next();
}

// Access in loader
export async function loader({ context }: LoaderArgs) {
  const user = context.get('user');
  return json({ posts: await getUserPosts(user.id) });
}
```

See [context](/api/core/context) for detailed documentation.

---

## Plugin System

### definePlugin()

Creates a strongly-typed plugin.

```tsx
import { definePlugin } from '@ereo/core';

const myPlugin = definePlugin({
  name: 'my-plugin',
  version: '1.0.0',
  
  setup(app) {
    // Plugin initialization
    console.log('Plugin initialized');
    
    // Hook into build lifecycle
    app.on('build:start', () => {
      console.log('Build starting...');
    });
    
    // Add middleware
    app.use(async (ctx, next) => {
      // Custom middleware logic
      await next();
    });
  },
});
```

### Plugin Configuration

```tsx
import { defineConfig } from '@ereo/core';
import { dbPlugin } from '@ereo/db';
import { authPlugin } from '@ereo/auth';

export default defineConfig({
  plugins: [
    dbPlugin({
      database: 'postgresql',
      url: process.env.DATABASE_URL,
    }),
    authPlugin({
      provider: 'github',
    }),
  ],
});
```

See [plugins](/api/core/plugins) for the complete plugin API.

---

## Environment Variables

### Type-safe Environment

```tsx
import { env, typedEnv } from '@ereo/core';

// Access with defaults
const port = env.PORT.number(3000);
const debug = env.DEBUG.boolean(false);
const apiUrl = env.API_URL.string('https://api.example.com');

// Validated environment
const config = typedEnv({
  PORT: { type: 'number', default: 3000 },
  DATABASE_URL: { type: 'string', required: true },
  DEBUG: { type: 'boolean', default: false },
});
```

### Loading Environment Files

```tsx
import { loadEnvFiles, validateEnv } from '@ereo/core';

// Load .env files
await loadEnvFiles(['.env', '.env.local']);

// Validate required variables
validateEnv([
  'DATABASE_URL',
  'API_SECRET',
  'STRIPE_KEY',
]);
```

### Public Environment Variables

```tsx
import { getPublicEnv } from '@ereo/core';

// Variables prefixed with EREO_PUBLIC_ are available client-side
const publicEnv = getPublicEnv();
// { API_URL: 'https://api.example.com', APP_NAME: 'My App' }
```

See [env](/api/core/env) for complete environment handling.

---

## Caching

### Unified Cache Interface

```tsx
import { createCache, MemoryCacheAdapter } from '@ereo/core';

// Create cache with memory adapter
const cache = createCache({
  adapter: new MemoryCacheAdapter(),
  ttl: 60 * 1000, // 1 minute default TTL
});

// Basic operations
await cache.set('key', { data: 'value' }, { ttl: 5000 });
const value = await cache.get('key');
await cache.delete('key');
await cache.clear();
```

### Tagged Cache

```tsx
import { createTaggedCache } from '@ereo/core';

const cache = createTaggedCache({
  adapter: new MemoryCacheAdapter(),
});

// Set with tags
await cache.set('post:1', post, { tags: ['posts', 'user:123'] });

// Invalidate by tag
await cache.invalidateTag('user:123');
// All entries tagged with 'user:123' are removed
```

### Cache Adapters

```tsx
// Memory (development)
import { MemoryCacheAdapter } from '@ereo/core';

// Redis (production)
import { RedisCacheAdapter } from '@ereo/cache-redis';

// Cloudflare Workers
import { KVCacheAdapter } from '@ereo/cache-kv';
```

See [cache](/api/core/cache) for complete caching documentation.

---

## Type System

### Route Types

```tsx
import type { 
  LoaderArgs, 
  ActionArgs,
  MetaFunction,
  HeadersFunction 
} from '@ereo/core';

export async function loader({ params, context }: LoaderArgs) {
  // params and context are fully typed
  return json({ data: 'value' });
}

export async function action({ request }: ActionArgs) {
  // request is the standard Request object
  const formData = await request.formData();
  return json({ success: true });
}

export const meta: MetaFunction = ({ data }) => [
  { title: data.title },
  { name: 'description', content: data.description },
];

export const headers: HeadersFunction = ({ loaderHeaders }) => ({
  'Cache-Control': loaderHeaders.get('Cache-Control') || 'max-age=3600',
});
```

### Type-Safe Routing

```tsx
import type { RouteTypes } from '@ereo/core';

// Define route types
type MyRoutes = {
  '/': {
    params: Record<string, never>;
    loader: { posts: Post[] };
  };
  '/posts/[id]': {
    params: { id: string };
    loader: { post: Post; comments: Comment[] };
    action: { success: boolean };
  };
};

declare module '@ereo/core' {
  interface RouteTypes extends MyRoutes {}
}
```

See [types](/api/core/types) and [type-safe-routing](/api/core/type-safe-routing) for complete type documentation.

---

## Complete Example

```tsx
// ereo.config.ts
import { defineConfig } from '@ereo/core';
import { dbPlugin } from '@ereo/db';
import { authPlugin } from '@ereo/auth';

export default defineConfig({
  server: {
    port: parseInt(process.env.PORT || '3000'),
    hostname: '0.0.0.0',
  },
  
  build: {
    target: 'bun',
    outDir: '.ereo',
    minify: true,
  },
  
  dev: {
    hmr: true,
    errorOverlay: true,
  },
  
  plugins: [
    dbPlugin({ url: process.env.DATABASE_URL }),
    authPlugin({
      providers: ['github', 'google'],
    }),
  ],
});
```

```tsx
// app/routes/index.tsx
import { json } from '@ereo/core';
import type { LoaderArgs, MetaFunction } from '@ereo/core';

export async function loader({ context }: LoaderArgs) {
  const db = context.get('db');
  const posts = await db.posts.findMany({ limit: 10 });
  return json({ posts });
}

export const meta: MetaFunction<typeof loader> = ({ data }) => [
  { title: 'Home' },
  { name: 'description', content: `Latest posts: ${data.posts.length}` },
];

export default function HomePage() {
  // Component implementation
}
```

---

## Submodules

| Module | Description |
|--------|-------------|
| [`create-app`](/api/core/create-app) | Application initialization |
| [`context`](/api/core/context) | Request context management |
| [`plugins`](/api/core/plugins) | Plugin system |
| [`env`](/api/core/env) | Environment variable handling |
| [`cache`](/api/core/cache) | Caching interface |
| [`types`](/api/core/types) | Type definitions |
| [`type-safe-routing`](/api/core/type-safe-routing) | Type-safe routing utilities |

---

## Related

- [@ereo/router](/api/router) - File-based routing
- [@ereo/server](/api/server) - Server utilities
- [@ereo/client](/api/client) - Client runtime
- [@ereo/bundler](/api/bundler) - Build system
