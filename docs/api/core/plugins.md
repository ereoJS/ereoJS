# Plugins

EreoJS's plugin system allows extending the framework with custom functionality. Plugins can hook into the build process, add middleware, transform code, and more.

## Import

```ts
import {
  definePlugin,
  composePlugins,
  PluginRegistry,
  securityHeadersPlugin,
  isPlugin
} from '@ereo/core'
```

## definePlugin

Creates a plugin with proper typing.

### Signature

```ts
function definePlugin(plugin: Plugin): Plugin
```

### Plugin Interface

```ts
interface Plugin {
  // Plugin name (required, must be unique)
  name: string

  // Plugin initialization — called once when the plugin is registered
  setup?: (context: PluginContext) => void | Promise<void>

  // Vite-compatible hooks
  resolveId?: (id: string) => string | null
  load?: (id: string) => string | null | Promise<string | null>
  transform?: (code: string, id: string) => string | null | Promise<string | null>
  // Return null from transform to indicate "no transformation" for this file

  // Build hooks
  buildStart?: () => void | Promise<void>
  buildEnd?: () => void | Promise<void>

  // Dev server hooks
  configureServer?: (server: DevServer) => void | Promise<void>

  // Framework hooks
  extendConfig?: (config: FrameworkConfig) => FrameworkConfig
  transformRoutes?: (routes: Route[]) => Route[]
  runtimeMiddleware?: MiddlewareHandler[]
  virtualModules?: Record<string, string>
}
```

### Example

```ts
const myPlugin = definePlugin({
  name: 'my-plugin',

  setup(context) {
    console.log('Plugin initialized')
  },

  transform(code, id) {
    if (id.endsWith('.tsx')) {
      // Transform TSX files
      return code.replace(/console\.log/g, 'logger.log')
    }
    return null // Return null to skip transformation for this file
  },

  buildStart() {
    console.log('Build starting...')
  },

  buildEnd() {
    console.log('Build complete!')
  }
})
```

## composePlugins

Combines multiple plugins into a single plugin.

### Signature

```ts
function composePlugins(name: string, plugins: Plugin[]): Plugin
```

### Example

```ts
const combinedPlugin = composePlugins('combined', [
  loggingPlugin(),
  analyticsPlugin(),
  securityPlugin()
])

const app = createApp({
  plugins: [combinedPlugin]
})
```

## PluginRegistry

Manages registered plugins.

### Methods

| Method | Description |
|--------|-------------|
| `register(plugin)` | Register a single plugin |
| `registerAll(plugins)` | Register multiple plugins |
| `getPlugins()` | Get all registered plugins |
| `getPlugin(name)` | Get a plugin by name |
| `transform(code, id)` | Run all transform hooks |
| `resolveId(id)` | Run all resolveId hooks |
| `load(id)` | Run all load hooks |
| `configureServer(server)` | Configure dev server |
| `buildStart()` | Run all buildStart hooks |
| `buildEnd()` | Run all buildEnd hooks |

### Example

```ts
const registry = app.getPluginRegistry()

// Check if a plugin is registered
const tailwind = registry.getPlugin('tailwind')
if (tailwind) {
  console.log('Tailwind is configured')
}

// Get all plugins
const plugins = registry.getPlugins()
console.log(`${plugins.length} plugins registered`)
```

## Built-in Plugins

### securityHeadersPlugin

A built-in plugin that adds sensible security defaults to responses. The plugin is pre-configured with no options required.

```ts
import { securityHeadersPlugin, createApp, defineConfig } from '@ereo/core'

const app = createApp({
  config: defineConfig({
    plugins: [securityHeadersPlugin]
  })
})
```

Note: For custom security header configuration, create a custom plugin using `definePlugin`.

## Creating Custom Plugins

### Basic Plugin

```ts
import { definePlugin } from '@ereo/core'

export function myPlugin(options = {}) {
  return definePlugin({
    name: 'my-plugin',

    setup(context) {
      // Initialize with options
      console.log('Options:', options)
    }
  })
}
```

### Transform Plugin

```ts
export function importAliasPlugin(aliases: Record<string, string>) {
  return definePlugin({
    name: 'import-alias',

    resolveId(id) {
      for (const [alias, target] of Object.entries(aliases)) {
        if (id.startsWith(alias)) {
          return id.replace(alias, target)
        }
      }
      return null
    }
  })
}

// Usage
const app = createApp({
  plugins: [
    importAliasPlugin({
      '@/': './src/',
      '~/': './src/'
    })
  ]
})
```

### Middleware Plugin

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

### Dev Server Plugin

```ts
export function devToolsPlugin() {
  return definePlugin({
    name: 'dev-tools',

    configureServer(server) {
      // Add middleware to the dev server
      // server.middlewares is a MiddlewareHandler[] array
      server.middlewares.push(async (request, context, next) => {
        const url = new URL(request.url)
        if (url.pathname === '/__dev/health') {
          return Response.json({ status: 'ok' })
        }
        return next()
      })

      // Watch additional files for changes
      server.watcher?.add('./config')
      server.watcher?.on('change', (file) => {
        console.log(`Config file changed: ${file}`)
        server.ws.send({ type: 'full-reload' })
      })
    }
  })
}
```

### Build Plugin

```ts
export function bundleAnalyzerPlugin() {
  let startTime: number

  return definePlugin({
    name: 'bundle-analyzer',

    buildStart() {
      startTime = Date.now()
      console.log('Build started...')
    },

    buildEnd() {
      const duration = Date.now() - startTime
      console.log(`Build completed in ${duration}ms`)

      // Analyze bundle size
      const stats = analyzeBundles()
      console.log('Bundle sizes:', stats)
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

Example usage:

```ts
const myPlugin = definePlugin({
  name: 'my-plugin',
  setup(context) {
    console.log('Running in', context.mode, 'mode')
    console.log('Project root:', context.root)
    console.log('Server port:', context.config.server?.port)
  }
})
```

## isPlugin

Type guard for Plugin objects.

```ts
function isPlugin(value: unknown): value is Plugin
```

```ts
const maybePlugin = loadConfig().plugin

if (isPlugin(maybePlugin)) {
  registry.register(maybePlugin)
}
```

## Related

- [Guides: Plugins](/guides/plugins)
- [createApp](/api/core/create-app)
- [Middleware](/concepts/middleware)
