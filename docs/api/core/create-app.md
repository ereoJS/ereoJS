# createApp

Creates a new EreoJS application instance.

## Import

```ts
import { createApp, defineConfig } from '@ereo/core'
```

## Signature

```ts
function createApp(options?: ApplicationOptions): EreoApp
```

## Parameters

| Name | Type | Description |
|------|------|-------------|
| `options` | `ApplicationOptions` | Optional configuration for the application |

### ApplicationOptions

```ts
interface ApplicationOptions {
  // Framework configuration (use defineConfig for type safety)
  config?: FrameworkConfig

  // Initial routes to register
  routes?: Route[]
}
```

### FrameworkConfig

```ts
interface FrameworkConfig {
  server?: {
    port?: number           // Default: 3000
    hostname?: string       // Default: 'localhost'
    development?: boolean   // Default: process.env.NODE_ENV !== 'production'
  }
  build?: {
    target?: 'bun' | 'cloudflare' | 'node' | 'deno' | 'edge'
    outDir?: string         // Default: '.ereo'
    minify?: boolean        // Default: true
    sourcemap?: boolean     // Default: true
  }
  plugins?: Plugin[]        // Default: []
  basePath?: string         // Default: ''
  routesDir?: string        // Default: 'app/routes'
}
```

## defineConfig

Helper function for type-safe configuration.

```ts
function defineConfig(config: FrameworkConfig): FrameworkConfig
```

```ts
import { defineConfig } from '@ereo/core'

export default defineConfig({
  server: {
    port: 3000,
    hostname: 'localhost',
  },
  build: {
    target: 'bun',
    minify: true,
  },
  routesDir: 'app/routes',
})
```

## Returns

Returns an `EreoApp` instance with the following properties and methods:

### EreoApp Properties

| Property | Type | Description |
|----------|------|-------------|
| `config` | `FrameworkConfig` | The merged configuration (readonly) |
| `routes` | `Route[]` | Registered routes |
| `plugins` | `Plugin[]` | Registered plugins |

### EreoApp Methods

| Method | Signature | Description |
|--------|-----------|-------------|
| `use(plugin)` | `(plugin: Plugin) => this` | Register a plugin (chainable) |
| `middleware(handler)` | `(handler: MiddlewareHandler) => this` | Register global middleware (chainable) |
| `setRouteMatcher(matcher)` | `(matcher: (pathname: string) => RouteMatch \| null) => void` | Set custom route matcher (typically from @ereo/router) |
| `setRoutes(routes)` | `(routes: Route[]) => void` | Set application routes directly |
| `handle(request)` | `(request: Request) => Promise<Response>` | Handle an incoming HTTP request |
| `dev()` | `() => Promise<void>` | Initialize for development mode |
| `build()` | `() => Promise<void>` | Build for production |
| `start()` | `() => Promise<void>` | Start production server |
| `getPluginRegistry()` | `() => PluginRegistry` | Get the plugin registry for advanced usage |

## isEreoApp

Type guard to check if a value is an EreoApp instance.

```ts
function isEreoApp(value: unknown): value is EreoApp
```

```ts
import { isEreoApp } from '@ereo/core'

if (isEreoApp(app)) {
  await app.handle(request)
}
```

## Examples

### Basic Application

```ts
import { createApp } from '@ereo/core'
import { createFileRouter } from '@ereo/router'
import { createServer } from '@ereo/server'

const app = createApp()

// Set up routes
const router = await createFileRouter({ routesDir: './src/routes' })
app.setRoutes(router.getRoutes())

// Create and start server
const server = createServer(app)
server.listen(3000)
```

### With Plugins

```ts
import { createApp, defineConfig, definePlugin } from '@ereo/core'

const loggingPlugin = definePlugin({
  name: 'logging',
  setup(context) {
    console.log('App running in', context.mode, 'mode')
  }
})

const app = createApp({
  config: defineConfig({
    plugins: [loggingPlugin]
  })
})

// Or register plugins after creation
app.use(loggingPlugin)
```

### With Global Middleware

```ts
import { createApp } from '@ereo/core'
import type { MiddlewareHandler } from '@ereo/core'

const app = createApp()

// Middleware receives request, context, and next function
const loggingMiddleware: MiddlewareHandler = async (request, context, next) => {
  const start = Date.now()
  const response = await next()
  console.log(`${request.method} ${request.url} - ${Date.now() - start}ms`)
  return response
}

app.middleware(loggingMiddleware)
```

### Manual Request Handling

```ts
import { createApp } from '@ereo/core'

const app = createApp()
// ... setup routes

// Handle a request manually
const response = await app.handle(new Request('http://localhost/api/users'))
console.log(await response.json())
```

### Development vs Production

```ts
import { createApp, defineConfig } from '@ereo/core'

const isDev = process.env.NODE_ENV !== 'production'

const app = createApp({
  config: defineConfig({
    server: {
      development: isDev
    }
  })
})

if (isDev) {
  await app.dev()
} else {
  await app.build()
  await app.start()
}
```

## Related

- [defineConfig](/api/core/plugins#defineconfig)
- [RequestContext](/api/core/context)
- [Plugins](/api/core/plugins)
- [createServer](/api/server/bun-server)
