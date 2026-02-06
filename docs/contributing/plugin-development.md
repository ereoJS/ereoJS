# Plugin Development

How to create plugins for the EreoJS ecosystem.

## Plugin Structure

An EreoJS plugin is a function that returns a plugin object with lifecycle hooks:

```ts
import type { EreoPlugin } from '@ereo/core'

export function myPlugin(options?: MyPluginOptions): EreoPlugin {
  return {
    name: 'my-plugin',

    setup(app) {
      // Called once when the plugin is registered
    },

    configResolved(config) {
      // Called after all config is resolved
    },

    buildStart() {
      // Called when the build starts
    },

    buildEnd() {
      // Called when the build finishes
    },

    devServerStart(server) {
      // Called when the dev server starts
    },
  }
}
```

Register the plugin in `ereo.config.ts`:

```ts
import { defineConfig } from '@ereo/core'
import { myPlugin } from './plugins/my-plugin'

export default defineConfig({
  plugins: [
    myPlugin({ /* options */ }),
  ],
})
```

## Lifecycle Hooks

Hooks are called in this order during development:

1. `setup(app)` --- Register services, set initial state
2. `configResolved(config)` --- Read the final merged configuration
3. `devServerStart(server)` --- Access the Bun HTTP server instance
4. `buildStart()` --- Called before bundling (dev or production)
5. `transform(code, id)` --- Transform source files during bundling
6. `buildEnd()` --- Called after bundling completes

During production builds, `devServerStart` is skipped.

## Creating a Middleware Plugin

A common plugin pattern is adding middleware to the request pipeline:

```ts
import type { EreoPlugin } from '@ereo/core'

export function rateLimitPlugin(maxRequests = 100): EreoPlugin {
  const requestCounts = new Map<string, number>()

  return {
    name: 'rate-limit',

    setup(app) {
      app.middleware('rateLimit', async (request, context, next) => {
        const ip = request.headers.get('x-forwarded-for') || 'unknown'
        const count = requestCounts.get(ip) || 0

        if (count >= maxRequests) {
          return new Response('Too Many Requests', { status: 429 })
        }

        requestCounts.set(ip, count + 1)
        return next()
      })
    },
  }
}
```

Routes can then reference this middleware by name:

```tsx
// routes/api/_middleware.ts
export const config = {
  middleware: ['rateLimit'],
}
```

## Creating a Virtual Module Plugin

Virtual modules let plugins provide imports that do not correspond to actual files on disk:

```ts
import type { EreoPlugin } from '@ereo/core'

export function buildInfoPlugin(): EreoPlugin {
  return {
    name: 'build-info',

    setup(app) {
      app.virtualModule('virtual:build-info', () => {
        return `
          export const buildTime = ${JSON.stringify(new Date().toISOString())};
          export const version = ${JSON.stringify(process.env.npm_package_version)};
          export const nodeEnv = ${JSON.stringify(process.env.NODE_ENV)};
        `
      })
    },
  }
}
```

Import the virtual module in your application:

```tsx
import { buildTime, version } from 'virtual:build-info'

export default function Footer() {
  return <footer>v{version} - Built {buildTime}</footer>
}
```

For TypeScript support, create a declaration file:

```ts
// types/virtual-build-info.d.ts
declare module 'virtual:build-info' {
  export const buildTime: string
  export const version: string
  export const nodeEnv: string
}
```

## Transforming Source Files

Use the `transform` hook to modify source code during bundling:

```ts
import type { EreoPlugin } from '@ereo/core'

export function autoImportPlugin(): EreoPlugin {
  return {
    name: 'auto-import',

    transform(code, id) {
      // Only process .tsx route files
      if (!id.endsWith('.tsx') || !id.includes('/routes/')) return

      // Add automatic imports
      if (code.includes('useLoaderData') && !code.includes("from '@ereo/client'")) {
        return `import { useLoaderData } from '@ereo/client'\n${code}`
      }
    },
  }
}
```

Return `undefined` or `null` to skip transformation. Return a string to replace the file contents.

## Testing Plugins

Test plugins using Bun's test runner with a mock application context:

```ts
// my-plugin.test.ts
import { test, expect } from 'bun:test'
import { createTestApp } from '@ereo/core/test'
import { myPlugin } from './my-plugin'

test('plugin registers middleware', async () => {
  const app = createTestApp({
    plugins: [myPlugin()],
  })

  await app.init()

  expect(app.hasMiddleware('myMiddleware')).toBe(true)
})

test('plugin transforms route files', async () => {
  const app = createTestApp({
    plugins: [myPlugin()],
  })

  await app.init()
  const result = app.transform('const x = 1', '/routes/index.tsx')

  expect(result).toContain('import')
})
```

## Publishing to npm

1. Follow the standard package conventions (ESM, TypeScript declarations)
2. Name your package `ereo-plugin-*` or `@yourscope/ereo-plugin-*`
3. Include `ereo-plugin` in the `keywords` array in `package.json`
4. Export the plugin factory function as the default export or a named export
5. Include a `README.md` with installation and configuration instructions

```json
{
  "name": "ereo-plugin-analytics",
  "version": "1.0.0",
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "keywords": ["ereo", "ereo-plugin", "analytics"],
  "peerDependencies": {
    "@ereo/core": "^0.1.0"
  }
}
```

See the [Plugins guide](/guides/plugins) for how users consume plugins.
