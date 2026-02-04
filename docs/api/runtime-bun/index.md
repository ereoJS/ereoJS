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

| Method | Signature | Description |
|--------|-----------|-------------|
| `getApp()` | `() => EreoApp` | Returns the EreoJS app instance |
| `use(plugin)` | `(plugin: Plugin) => this` | Register a plugin (chainable) |
| `start()` | `() => Promise<Server>` | Start the server, returns Bun server instance |
| `stop()` | `() => void` | Stop the server |
| `handle(request)` | `(request: Request) => Promise<Response>` | Handle a request directly |

#### Example

```ts
import { createBunRuntime } from '@ereo/runtime-bun'
import { tailwindPlugin } from '@ereo/plugin-tailwind'

const runtime = createBunRuntime({
  server: { port: 3000 }
})

// Register plugins (chainable)
runtime
  .use(tailwindPlugin())
  .use(anotherPlugin())

// Start the server
const server = await runtime.start()
console.log(`Server running on port ${server.port}`)

// Handle a request directly (useful for testing)
const response = await runtime.handle(
  new Request('http://localhost/api/users')
)
console.log(await response.json())

// Stop the server when done
runtime.stop()
```

#### Testing with handle()

The `handle()` method is useful for testing without starting a real server:

```ts
import { describe, test, expect } from 'bun:test'
import { createBunRuntime } from '@ereo/runtime-bun'

describe('API', () => {
  const runtime = createBunRuntime()

  test('GET /api/health returns ok', async () => {
    const response = await runtime.handle(
      new Request('http://localhost/api/health')
    )

    expect(response.status).toBe(200)
    const data = await response.json()
    expect(data.status).toBe('ok')
  })
})
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

// Read and parse JSON (with TypeScript generics)
const config = await readJSON<Config>('./config.json')
```

#### Error Handling

File operations can throw errors. Always handle them appropriately:

```ts
import { readFile, readJSON, requireEnv } from '@ereo/runtime-bun'

// File not found
try {
  const content = await readFile('./missing-file.txt')
} catch (error) {
  // Error: ENOENT - file not found
  console.error('File not found:', error.message)
}

// JSON parse error
try {
  const config = await readJSON('./invalid.json')
} catch (error) {
  // Error: JSON Parse error or ENOENT
  console.error('Failed to read JSON:', error.message)
}

// Missing environment variable
try {
  const apiKey = requireEnv('MISSING_VAR')
} catch (error) {
  // Error: Missing required environment variable: MISSING_VAR
  console.error(error.message)
}
```

### Compression

```ts
import { gzip, gunzip } from '@ereo/runtime-bun'

// Compress string data (returns Uint8Array)
const compressed = gzip('Hello, World!')

// Compress ArrayBuffer
const buffer = new TextEncoder().encode('Hello, World!')
const compressedBuffer = gzip(buffer)

// Decompress data (returns Uint8Array)
const decompressed = gunzip(compressed)

// Convert back to string
const text = new TextDecoder().decode(decompressed)
console.log(text) // "Hello, World!"
```

#### Full Compression Workflow

```ts
import { gzip, gunzip } from '@ereo/runtime-bun'

// Compress for storage or transmission
const originalData = JSON.stringify({ users: [...] })
const compressed = gzip(originalData)

// Store or send compressed bytes...

// Later: decompress and parse
const decompressed = gunzip(compressed)
const data = JSON.parse(new TextDecoder().decode(decompressed))
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

Access Bun's native SQLite database:

```ts
import { getDatabase } from '@ereo/runtime-bun'

// Get a SQLite database instance (uses bun:sqlite)
const db = await getDatabase('./data.db')

// Use Bun's SQLite API
db.run('CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY, name TEXT)')

// Prepared statements for better performance
const insert = db.prepare('INSERT INTO users (name) VALUES (?)')
insert.run('Alice')

// Query data
const users = db.query('SELECT * FROM users').all()
console.log(users) // [{ id: 1, name: 'Alice' }]

// Close when done
db.close()
```

> **Note:** `getDatabase()` uses dynamic import internally to avoid bundling issues in non-Bun environments. For full SQLite documentation, see [Bun's SQLite docs](https://bun.sh/docs/api/sqlite).

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

// The returned Subprocess has these properties:
// proc.stdout - ReadableStream for stdout
// proc.stderr - ReadableStream for stderr
// proc.exited - Promise<number> that resolves to exit code

// Example: Capture output
const result = spawn(['echo', 'hello'])
const output = await new Response(result.stdout).text()
console.log(output) // "hello\n"

// Wait for process to complete
const exitCode = await result.exited
```

## Configuration

### Server Options

The server configuration accepts `ServerOptions` from `@ereo/server`:

```ts
import { serve } from '@ereo/runtime-bun'

const runtime = await serve({
  server: {
    port: 3000,
    hostname: '0.0.0.0',
    development: true,
    logging: true,
    cors: true,  // or CorsOptions object
    security: true,  // or SecurityHeadersOptions object
    tls: {
      cert: './certs/cert.pem',
      key: './certs/key.pem',
    },
  }
})
```

See [BunServer documentation](/api/server/bun-server) for full `ServerOptions` reference.

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
