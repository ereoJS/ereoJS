# Config Reference

Complete reference for `ereo.config.ts` options.

## Overview

The EreoJS configuration file is located at the project root and exports a config object using `defineConfig`:

```ts
// ereo.config.ts
import { defineConfig } from '@ereo/core'

export default defineConfig({
  // options
})
```

## Server Options

```ts
export default defineConfig({
  server: {
    port: 3000,              // Server port (default: 3000)
    host: 'localhost',       // Server host (default: 'localhost' in dev, '0.0.0.0' in production)
    https: false,            // Enable HTTPS (default: false)
                             // true = auto-generate self-signed cert
                             // { cert: string, key: string } = custom cert paths
    csrf: {
      enabled: true,         // Enable CSRF protection (default: true)
      cookieName: '_csrf',   // CSRF cookie name
      headerName: 'x-csrf-token', // CSRF header name
    },
    compression: true,       // Enable response compression (default: true)
    trustProxy: false,       // Trust X-Forwarded-* headers (default: false)
  },
})
```

## Build Options

```ts
export default defineConfig({
  build: {
    target: 'bun',          // Deployment target: 'bun' | 'node' | 'cloudflare' | 'vercel'
    outDir: './dist',        // Output directory (default: './dist')
    minify: true,            // Minify output (default: true in production)
    sourcemap: true,         // Generate source maps: true | false | 'inline' | 'external'
    external: [],            // Packages to exclude from bundling
    define: {},              // Compile-time constants (like DefinePlugin)
    chunkSizeWarningLimit: 100, // Chunk size warning threshold in kB
    splitting: true,         // Enable code splitting (default: true)
  },
})
```

### Define Constants

Replace expressions at build time:

```ts
export default defineConfig({
  build: {
    define: {
      'process.env.API_URL': JSON.stringify('https://api.example.com'),
      '__DEV__': JSON.stringify(process.env.NODE_ENV !== 'production'),
    },
  },
})
```

## Plugins

```ts
import { tailwindPlugin } from '@ereo/plugin-tailwind'
import { authPlugin } from '@ereo/plugin-auth'
import { imagesPlugin } from '@ereo/plugin-images'
import { createTypesPlugin } from '@ereo/bundler'

export default defineConfig({
  plugins: [
    tailwindPlugin(),
    authPlugin({ session: { secret: process.env.SESSION_SECRET } }),
    imagesPlugin({ formats: ['webp', 'avif'] }),
    createTypesPlugin(),
  ],
})
```

Plugins are applied in the order they are listed. Each plugin can add middleware, modify the build pipeline, register virtual modules, and extend the dev server. See the [Plugin Development guide](/contributing/plugin-development).

## Routes

```ts
export default defineConfig({
  routes: {
    dir: './routes',         // Routes directory (default: './routes')
    convention: 'file',      // Routing convention: 'file' (default)
    trailingSlash: 'never',  // 'always' | 'never' | 'ignore' (default: 'never')
    caseSensitive: false,    // Case-sensitive URL matching (default: false)
  },
})
```

## Cache

```ts
export default defineConfig({
  cache: {
    adapter: 'memory',      // Cache backend: 'memory' | 'redis' | 'custom'
    defaultMaxAge: 0,        // Default cache duration in seconds (0 = no cache)
    redis: {
      url: process.env.REDIS_URL,  // Redis connection URL
    },
    custom: {
      get: async (key) => { /* ... */ },
      set: async (key, value, ttl) => { /* ... */ },
      delete: async (key) => { /* ... */ },
      deleteByTag: async (tag) => { /* ... */ },
    },
  },
})
```

See the [Caching concepts](/concepts/caching) and [Caching Deep Dive](/architecture/caching-deep-dive) for details on the cache system.

## Dev Options

```ts
export default defineConfig({
  dev: {
    inspector: false,        // Enable the dev inspector overlay (default: false)
    hmr: true,               // Enable hot module replacement (default: true)
    overlay: true,           // Show error overlay in browser (default: true)
  },
})
```

## Rendering

```ts
export default defineConfig({
  render: {
    defaultMode: 'ssr',     // Default rendering mode: 'ssr' | 'ssg' | 'csr'
    streaming: true,         // Enable streaming SSR (default: true)
  },
})
```

Individual routes can override the rendering mode via their `config` export:

```tsx
export const config = {
  render: { mode: 'ssg' },
}
```

## Islands

```ts
export default defineConfig({
  islands: {
    defaultStrategy: 'idle', // Hydration strategy: 'load' | 'idle' | 'visible' | 'media' | 'none'
  },
})
```

| Strategy | Behavior |
|----------|----------|
| `load` | Hydrate immediately when JS loads |
| `idle` | Hydrate when the browser is idle |
| `visible` | Hydrate when the island scrolls into view |
| `media` | Hydrate when a media query matches |
| `none` | Never hydrate (server-rendered only) |

## Experimental

```ts
export default defineConfig({
  experimental: {
    rsc: false,              // React Server Components (experimental)
    viewTransitions: false,  // View Transitions API support
    partialPrerendering: false, // Partial prerendering for hybrid static/dynamic
  },
})
```

Experimental features may change or be removed in future versions. Use with caution in production.

## Full Example

```ts
// ereo.config.ts
import { defineConfig } from '@ereo/core'
import { tailwindPlugin } from '@ereo/plugin-tailwind'
import { authPlugin } from '@ereo/plugin-auth'
import { createTypesPlugin } from '@ereo/bundler'

export default defineConfig({
  server: {
    port: 3000,
    csrf: { enabled: true },
  },
  build: {
    target: 'bun',
    sourcemap: true,
    minify: true,
  },
  routes: {
    dir: './routes',
    trailingSlash: 'never',
  },
  cache: {
    adapter: 'memory',
    defaultMaxAge: 0,
  },
  render: {
    defaultMode: 'ssr',
    streaming: true,
  },
  islands: {
    defaultStrategy: 'idle',
  },
  plugins: [
    tailwindPlugin(),
    authPlugin({ session: { secret: process.env.SESSION_SECRET } }),
    createTypesPlugin(),
  ],
})
```
