# Plugins

This guide covers creating and using plugins in EreoJS.

## Using Plugins

### Installation

```ts
// ereo.config.ts
import { defineConfig } from '@ereo/core'
import { tailwindPlugin } from '@ereo/plugin-tailwind'
import { authPlugin } from '@ereo/plugin-auth'

export default defineConfig({
  plugins: [
    tailwindPlugin(),
    authPlugin({
      providers: ['github', 'google']
    })
  ]
})
```

### Plugin Order

Plugins execute in order. Place foundational plugins first:

```ts
plugins: [
  // Infrastructure
  loggingPlugin(),
  securityPlugin(),

  // Features
  authPlugin(),
  analyticsPlugin(),

  // Styling/build
  tailwindPlugin()
]
```

## Creating Plugins

### Basic Plugin

```ts
// plugins/my-plugin.ts
import { definePlugin } from '@ereo/core'

export function myPlugin(options = {}) {
  return definePlugin({
    name: 'my-plugin',

    setup(context) {
      console.log('Plugin initialized with:', options)
      console.log('App root:', context.root)
      console.log('Mode:', context.mode)
    }
  })
}
```

### Plugin with Middleware

```ts
export function requestIdPlugin() {
  return definePlugin({
    name: 'request-id',

    runtimeMiddleware: [
      async (request, context, next) => {
        const requestId = crypto.randomUUID()
        context.set('requestId', requestId)

        const response = await next()
        response.headers.set('X-Request-Id', requestId)

        return response
      }
    ]
  })
}
```

### Transform Plugin

Transform code during build:

```ts
export function envReplacePlugin() {
  return definePlugin({
    name: 'env-replace',

    transform(code, id) {
      // Only transform JS/TS files
      if (!id.match(/\.[jt]sx?$/)) return code

      // Replace process.env.NODE_ENV
      return code.replace(
        /process\.env\.NODE_ENV/g,
        JSON.stringify(process.env.NODE_ENV)
      )
    }
  })
}
```

### Virtual Module Plugin

Create virtual modules:

```ts
export function virtualConfigPlugin(config: Record<string, any>) {
  const virtualModuleId = 'virtual:app-config'
  const resolvedId = '\0' + virtualModuleId

  return definePlugin({
    name: 'virtual-config',

    resolveId(id) {
      if (id === virtualModuleId) {
        return resolvedId
      }
      return null
    },

    load(id) {
      if (id === resolvedId) {
        return `export default ${JSON.stringify(config)}`
      }
      return null
    }
  })
}

// Usage
import config from 'virtual:app-config'
console.log(config.siteName)
```

### Build Hooks Plugin

```ts
export function buildStatsPlugin() {
  let startTime: number

  return definePlugin({
    name: 'build-stats',

    buildStart() {
      startTime = Date.now()
      console.log('Build started...')
    },

    buildEnd() {
      const duration = Date.now() - startTime
      console.log(`Build completed in ${duration}ms`)
    }
  })
}
```

### Dev Server Plugin

```ts
export function devToolsPlugin() {
  return definePlugin({
    name: 'dev-tools',

    configureServer(server) {
      // Add custom middleware to dev server
      server.middlewares.use('/__dev/routes', (req, res) => {
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify(server.routes))
      })

      // Add WebSocket handler
      server.ws.on('connection', (socket) => {
        socket.on('message', (msg) => {
          console.log('Dev tools message:', msg)
        })
      })
    }
  })
}
```

## Plugin Context

The `PluginContext` provides access to framework internals:

```ts
interface PluginContext {
  // Framework configuration
  config: FrameworkConfig

  // Project root directory (process.cwd())
  root: string

  // Environment mode
  mode: 'development' | 'production'
}
```

### Using Context

```ts
export function configLoggerPlugin() {
  return definePlugin({
    name: 'config-logger',

    setup(context) {
      console.log('Running in', context.mode, 'mode')
      console.log('Project root:', context.root)
      console.log('Server port:', context.config.server?.port)
      console.log('Build target:', context.config.build?.target)
    }
  })
}
```

## Composing Plugins

Combine multiple plugins:

```ts
import { composePlugins } from '@ereo/core'

const securityPlugin = composePlugins('security', [
  csrfPlugin(),
  corsPlugin({ origin: '*' }),
  securityHeadersPlugin()
])

export default defineConfig({
  plugins: [securityPlugin]
})
```

## Real-World Examples

### Analytics Plugin

```ts
export function analyticsPlugin(options: { trackingId: string }) {
  return definePlugin({
    name: 'analytics',

    runtimeMiddleware: [
      async (request, context, next) => {
        const start = Date.now()
        const response = await next()
        const duration = Date.now() - start

        // Track page view
        trackEvent('pageview', {
          url: request.url,
          duration,
          status: response.status
        })

        return response
      }
    ],

    // Inject tracking script
    transform(code, id) {
      if (id.endsWith('_layout.tsx')) {
        return code.replace(
          '</head>',
          `<script src="https://analytics.com/track.js" data-id="${options.trackingId}"></script></head>`
        )
      }
      return code
    }
  })
}
```

### Database Plugin

```ts
export function databasePlugin(options: { url: string }) {
  let db: Database

  return definePlugin({
    name: 'database',

    async setup(context) {
      db = await createConnection(options.url)
      context.logger.info('Database connected')
    },

    runtimeMiddleware: [
      async (request, context, next) => {
        context.set('db', db)
        return next()
      }
    ],

    async buildEnd() {
      await db?.close()
    }
  })
}
```

### Feature Flags Plugin

```ts
export function featureFlagsPlugin(flags: Record<string, boolean>) {
  return definePlugin({
    name: 'feature-flags',

    runtimeMiddleware: [
      async (request, context, next) => {
        context.set('features', flags)
        return next()
      }
    ],

    // Replace at build time for tree-shaking
    transform(code, id) {
      if (!id.match(/\.[jt]sx?$/)) return code

      for (const [flag, enabled] of Object.entries(flags)) {
        code = code.replace(
          new RegExp(`features\\.${flag}`, 'g'),
          String(enabled)
        )
      }

      return code
    }
  })
}
```

## Publishing Plugins

### Package Structure

```
my-ereo-plugin/
├── src/
│   └── index.ts
├── dist/
│   └── index.js
├── package.json
└── README.md
```

### package.json

```json
{
  "name": "ereo-plugin-example",
  "version": "1.0.0",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "peerDependencies": {
    "@ereo/core": "^1.0.0"
  }
}
```

## Best Practices

1. **Name plugins descriptively** - Use `name` for debugging
2. **Accept options** - Make plugins configurable
3. **Use context.logger** - For consistent logging
4. **Handle errors gracefully** - Don't crash the app
5. **Document your plugin** - Explain options and usage
6. **Test thoroughly** - Test all hooks and scenarios
7. **Keep plugins focused** - One responsibility per plugin
