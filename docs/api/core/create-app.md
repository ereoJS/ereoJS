# createApp

Creates a new EreoJS application instance.

## Import

```ts
import { createApp } from '@ereo/core'
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
  // Base directory for the application
  root?: string

  // Environment mode ('development' | 'production' | 'test')
  mode?: string

  // Plugins to register
  plugins?: Plugin[]
}
```

## Returns

Returns an `EreoApp` instance with the following methods:

### EreoApp Methods

| Method | Description |
|--------|-------------|
| `use(plugin)` | Register a plugin |
| `middleware(handler)` | Register global middleware |
| `setRouteMatcher(matcher)` | Set custom route matcher |
| `setRoutes(routes)` | Set application routes |
| `handle(request)` | Handle an incoming request |
| `dev()` | Start development server |
| `build()` | Build for production |
| `start()` | Start production server |
| `getPluginRegistry()` | Get the plugin registry |

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
import { createApp } from '@ereo/core'
import { tailwindPlugin } from '@ereo/plugin-tailwind'
import { authPlugin } from '@ereo/plugin-auth'

const app = createApp({
  plugins: [
    tailwindPlugin(),
    authPlugin({ providers: ['github', 'google'] })
  ]
})
```

### With Global Middleware

```ts
import { createApp } from '@ereo/core'
import { logger, cors } from '@ereo/server'

const app = createApp()

app.middleware(logger())
app.middleware(cors({ origin: '*' }))
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
import { createApp } from '@ereo/core'

const app = createApp({
  mode: process.env.NODE_ENV || 'development'
})

if (app.mode === 'development') {
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
