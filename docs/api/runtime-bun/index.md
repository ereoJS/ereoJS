# @ereo/runtime-bun

Bun runtime adapter for the EreoJS framework. This is the default runtime, optimized for Bun's performance.

## Import

```ts
import {
  BunRuntime,
  createBunRuntime,
  serve
} from '@ereo/runtime-bun'
```

## Overview

The `@ereo/runtime-bun` package provides a high-level adapter for running EreoJS applications on Bun. It wraps the core application and server components, providing a simplified API for common use cases while exposing Bun-specific utilities for optimal performance.

## Quick Start

```ts
import { serve } from '@ereo/runtime-bun'

// Start a server with default configuration
const runtime = await serve()

// Your app is now running at http://localhost:3000
```

## API Reference

### createBunRuntime

Creates a new Bun runtime instance.

#### Signature

```ts
function createBunRuntime(options?: BunRuntimeOptions): BunRuntime
```

#### Options

```ts
interface BunRuntimeOptions {
  // Server configuration
  server?: ServerOptions

  // Framework configuration
  config?: FrameworkConfig
}
```

#### Example

```ts
import { createBunRuntime } from '@ereo/runtime-bun'

const runtime = createBunRuntime({
  server: {
    port: 3000,
    hostname: 'localhost'
  },
  config: {
    mode: 'development'
  }
})
```

### serve

Quick start helper that creates and starts a runtime in one call.

#### Signature

```ts
async function serve(options?: BunRuntimeOptions): Promise<BunRuntime>
```

#### Example

```ts
import { serve } from '@ereo/runtime-bun'

// Start with default configuration
const runtime = await serve()

// Or with custom options
const runtime = await serve({
  server: { port: 8080 }
})
```

### BunRuntime Class

The main runtime class that manages the application lifecycle.

#### Methods

| Method | Description |
|--------|-------------|
| `getApp()` | Returns the EreoJS app instance |
| `use(plugin)` | Register a plugin |
| `start()` | Start the server |
| `stop()` | Stop the server |
| `handle(request)` | Handle a request directly |

#### Example

```ts
import { createBunRuntime } from '@ereo/runtime-bun'
import { tailwindPlugin } from '@ereo/plugin-tailwind'

const runtime = createBunRuntime()

// Register plugins
runtime.use(tailwindPlugin())

// Start the server
await runtime.start()

// Handle a request directly (useful for testing)
const response = await runtime.handle(
  new Request('http://localhost/api/users')
)
```

## Bun-Specific Utilities

The runtime package exports several utilities that leverage Bun's native APIs for optimal performance.

### File Operations

```ts
import { readFile, writeFile, readJSON } from '@ereo/runtime-bun'

// Read a file as text
const content = await readFile('./config.json')

// Write content to a file
await writeFile('./output.txt', 'Hello, World!')

// Read and parse JSON
const config = await readJSON<Config>('./config.json')
```

### Compression

```ts
import { gzip, gunzip } from '@ereo/runtime-bun'

// Compress data
const compressed = gzip('Hello, World!')

// Decompress data
const decompressed = gunzip(compressed)
```

### Password Hashing

```ts
import { hashPassword, verifyPassword } from '@ereo/runtime-bun'

// Hash a password
const hash = await hashPassword('mysecretpassword')

// Verify a password
const isValid = await verifyPassword('mysecretpassword', hash)
```

### Database

```ts
import { getDatabase } from '@ereo/runtime-bun'

// Get a SQLite database instance
const db = await getDatabase('./data.db')
```

### Environment Variables

```ts
import { env, requireEnv } from '@ereo/runtime-bun'

// Get environment variable with optional default
const port = env('PORT', '3000')

// Get required environment variable (throws if missing)
const apiKey = requireEnv('API_KEY')
```

### Utilities

```ts
import {
  isBun,
  getBunVersion,
  randomUUID,
  sleep,
  spawn
} from '@ereo/runtime-bun'

// Check if running in Bun
if (isBun()) {
  console.log('Running on Bun', getBunVersion())
}

// Generate a UUID
const id = randomUUID()

// Sleep for a duration
await sleep(1000) // 1 second

// Spawn a shell command
const proc = spawn(['ls', '-la'], { cwd: './src' })
```

## Configuration

### Server Options

The server configuration accepts standard Bun server options:

```ts
import { serve } from '@ereo/runtime-bun'

const runtime = await serve({
  server: {
    port: 3000,
    hostname: '0.0.0.0',
    development: true,
    maxRequestBodySize: 1024 * 1024 * 50, // 50MB
  }
})
```

### Framework Configuration

Pass framework configuration to customize the EreoJS application:

```ts
import { createBunRuntime } from '@ereo/runtime-bun'

const runtime = createBunRuntime({
  config: {
    mode: 'production',
    root: './app',
    plugins: []
  }
})
```

## Full Example

```ts
import { createBunRuntime } from '@ereo/runtime-bun'
import { tailwindPlugin } from '@ereo/plugin-tailwind'
import { authPlugin } from '@ereo/plugin-auth'
import { createDevInspector } from '@ereo/dev-inspector'

const isDev = Bun.env.NODE_ENV !== 'production'

const runtime = createBunRuntime({
  server: {
    port: parseInt(Bun.env.PORT || '3000'),
    hostname: '0.0.0.0',
  },
  config: {
    mode: isDev ? 'development' : 'production',
  }
})

// Register plugins
runtime.use(tailwindPlugin())
runtime.use(authPlugin({
  providers: ['github', 'google']
}))

// Add dev inspector in development
if (isDev) {
  runtime.use(createDevInspector({
    mountPath: '/__ereo'
  }))
}

// Start the server
await runtime.start()

console.log(`Server running at http://localhost:${Bun.env.PORT || 3000}`)
```

## Re-exports

For convenience, the package re-exports commonly used functions from core packages:

```ts
import {
  createApp,
  createServer
} from '@ereo/runtime-bun'

// These are re-exported from @ereo/core and @ereo/server
```

## Related

- [createApp](/api/core/create-app)
- [Bun Server](/api/server/bun-server)
- [Plugins](/api/core/plugins)
- [Environment Variables](/api/core/env)
