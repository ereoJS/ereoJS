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

// Create app with configuration
const app = createApp({
  config: defineConfig({
    server: {
      port: 3000,
      hostname: 'localhost',
    },
    build: {
      target: 'bun',
      outDir: '.ereo',
    },
  }),
});

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
    development: process.env.NODE_ENV !== 'production',
  },

  // Build settings
  build: {
    target: 'bun',
    outDir: '.ereo',
    minify: true,
    sourcemap: true,
  },

  // Routes location
  routesDir: 'app/routes',

  // Base path for all routes
  basePath: '',

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

Creates a request-scoped context.

```tsx
import { createContext, getContext, attachContext } from '@ereo/core';

// Create a context for an incoming request
const context = createContext(request);

// Store values in the context
context.set('requestId', crypto.randomUUID());
context.set('startTime', Date.now());

// Retrieve values
const requestId = context.get<string>('requestId');
```

### Context Usage

```tsx
import type { MiddlewareHandler, LoaderArgs } from '@ereo/core';

// Middleware that sets context
const authMiddleware: MiddlewareHandler = async (request, context, next) => {
  const user = await verifyAuth(request);
  context.set('user', user);
  return next();
};

// Access in loader
export async function loader({ context }: LoaderArgs) {
  const user = context.get<User>('user');
  return { posts: await getUserPosts(user.id) };
}
```

See [context](/api/core/context) for detailed documentation.

---

## Plugin System

### definePlugin()

Creates a plugin with proper typing.

```tsx
import { definePlugin } from '@ereo/core';

const myPlugin = definePlugin({
  name: 'my-plugin',

  setup(context) {
    // Plugin initialization
    console.log('Plugin initialized in', context.mode, 'mode');
    console.log('Project root:', context.root);
  },

  // Transform code during build
  transform(code, id) {
    if (id.endsWith('.tsx')) {
      return code.replace(/console\.log/g, 'logger.log');
    }
    return null;
  },

  // Build lifecycle hooks
  buildStart() {
    console.log('Build starting...');
  },

  buildEnd() {
    console.log('Build complete!');
  },
});
```

### Plugin Configuration

```tsx
import { defineConfig, definePlugin } from '@ereo/core';

const loggingPlugin = definePlugin({
  name: 'logging',
  setup(context) {
    console.log('App running in', context.mode, 'mode');
  },
});

export default defineConfig({
  plugins: [loggingPlugin],
});
```

See [plugins](/api/core/plugins) for the complete plugin API.

---

## Environment Variables

### Type-safe Environment

```tsx
import { env, setupEnv, typedEnv } from '@ereo/core';

// Define environment schema
const envSchema = {
  PORT: env.port().default(3000),
  DATABASE_URL: env.string().required(),
  DEBUG: env.boolean().default(false),
  NODE_ENV: env.enum(['development', 'production', 'test']).default('development'),
};

// Validate and load environment
const result = await setupEnv('.', envSchema, 'development');

if (result.valid) {
  // Access typed environment variables
  const port = typedEnv.PORT;  // number
}
```

### Loading Environment Files

```tsx
import { loadEnvFiles, validateEnv } from '@ereo/core';

// Load .env files (returns merged key-value pairs)
const loaded = await loadEnvFiles('./project', 'production');
// Loads: .env, .env.production, .env.production.local, .env.local

// Validate against schema
const result = validateEnv(envSchema, { ...loaded, ...process.env });
```

### Public Environment Variables

```tsx
import { getPublicEnv } from '@ereo/core';

// Define schema with public variables
const envSchema = {
  PUBLIC_API_URL: env.string().required().public(),
  PUBLIC_APP_NAME: env.string().default('My App').public(),
};

// Get only public variables (safe for client)
const publicEnv = getPublicEnv(envSchema);
// { PUBLIC_API_URL: 'https://api.example.com', PUBLIC_APP_NAME: 'My App' }
```

See [env](/api/core/env) for complete environment handling.

---

## Caching

### Unified Cache Interface

```tsx
import { createCache } from '@ereo/core';

// Create cache with options
const cache = createCache({
  maxSize: 1000,       // Maximum entries
  defaultTtl: 3600,    // Default TTL in seconds
});

// Basic operations
await cache.set('key', { data: 'value' }, { ttl: 300 });
const value = await cache.get('key');
await cache.delete('key');
await cache.clear();
```

### Tagged Cache

```tsx
import { createTaggedCache } from '@ereo/core';

const cache = createTaggedCache({
  maxSize: 1000,
});

// Set with tags for grouped invalidation
await cache.set('post:1', post, {
  ttl: 3600,
  tags: ['posts', 'user:123']
});

// Invalidate all entries with a tag
await cache.invalidateTag('user:123');

// Invalidate multiple tags
await cache.invalidateTags(['posts', 'comments']);

// Get all keys for a tag
const postKeys = await cache.getByTag('posts');
```

### Cache Adapters

```tsx
// Built-in memory cache
import { MemoryCacheAdapter, createCache, createTaggedCache } from '@ereo/core';

// Direct instantiation
const cache = new MemoryCacheAdapter({ maxSize: 5000 });

// Or use factory functions
const simpleCache = createCache({ maxSize: 1000 });
const taggedCache = createTaggedCache({ maxSize: 1000 });
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
import { defineConfig, definePlugin } from '@ereo/core';

const loggingPlugin = definePlugin({
  name: 'logging',
  setup(context) {
    console.log(`Starting in ${context.mode} mode`);
  },
});

export default defineConfig({
  server: {
    port: 3000,
    hostname: '0.0.0.0',
    development: process.env.NODE_ENV !== 'production',
  },

  build: {
    target: 'bun',
    outDir: '.ereo',
    minify: true,
  },

  routesDir: 'app/routes',

  plugins: [loggingPlugin],
});
```

```tsx
// app/routes/index.tsx
import type { LoaderArgs, MetaFunction } from '@ereo/core';

interface Post {
  id: string;
  title: string;
}

export async function loader({ context }: LoaderArgs) {
  // Access data from context (set by middleware)
  const db = context.get<Database>('db');
  const posts = await db.posts.findMany({ limit: 10 });

  // Set cache control
  context.cache.set({
    maxAge: 300,
    tags: ['posts'],
  });

  return { posts };
}

export const meta: MetaFunction<{ posts: Post[] }> = ({ data }) => [
  { title: 'Home' },
  { name: 'description', content: `Latest posts: ${data.posts.length}` },
];

export default function HomePage({ loaderData }: { loaderData: { posts: Post[] } }) {
  return (
    <div>
      <h1>Latest Posts</h1>
      {loaderData.posts.map(post => (
        <article key={post.id}>{post.title}</article>
      ))}
    </div>
  );
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

- [@ereo/router](/api/router/file-router) - File-based routing
- [@ereo/server](/api/server/bun-server) - Server utilities
- [@ereo/client](/api/client/) - Client runtime
- [@ereo/bundler](/api/bundler/) - Build system
