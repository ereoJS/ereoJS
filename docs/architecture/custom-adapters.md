# Custom Adapters

Deploy EreoJS to different runtimes and platforms.

## Overview

EreoJS is built on standard Web APIs and can run on any platform that supports them. Adapters provide the glue between EreoJS and specific runtimes.

## Built-in Adapters

### Bun Adapter (Default)

```ts
import { defineConfig } from '@ereo/core'

export default defineConfig({
  build: {
    target: 'bun'  // Default
  }
})
```

### Cloudflare Workers

```ts
export default defineConfig({
  build: {
    target: 'cloudflare'
  }
})
```

### Node.js

```ts
export default defineConfig({
  build: {
    target: 'node'
  }
})
```

### Deno

```ts
export default defineConfig({
  build: {
    target: 'deno'
  }
})
```

## Creating a Custom Adapter

### Adapter Interface

```ts
interface Adapter {
  name: string
  build?: (options: BuildOptions) => Promise<void>
  serve: (app: EreoApp, options: ServeOptions) => Server | Promise<Server>
}

interface BuildOptions {
  outDir: string
  minify: boolean
  sourcemap: boolean
}

interface ServeOptions {
  port: number
  hostname: string
}
```

### Basic Adapter Example

```ts
// adapters/custom.ts
import type { Adapter, EreoApp } from '@ereo/core'

export function customAdapter(): Adapter {
  return {
    name: 'custom-adapter',

    async build({ outDir, minify }) {
      // Custom build logic
      console.log(`Building to ${outDir}`)
    },

    serve(app, { port, hostname }) {
      // Create server using the app's fetch handler
      const server = createServer(async (req, res) => {
        const request = toWebRequest(req)
        const response = await app.handle(request)
        writeResponse(res, response)
      })

      server.listen(port, hostname)
      return server
    }
  }
}
```

### Using the Adapter

```ts
// ereo.config.ts
import { defineConfig } from '@ereo/core'
import { customAdapter } from './adapters/custom'

export default defineConfig({
  adapter: customAdapter()
})
```

## Platform-Specific Adapters

### AWS Lambda

```ts
// adapters/lambda.ts
import type { Adapter, EreoApp } from '@ereo/core'
import type { APIGatewayProxyEvent, Context } from 'aws-lambda'

export function lambdaAdapter(): Adapter {
  return {
    name: 'lambda',

    async build({ outDir }) {
      // Bundle for Lambda
      await Bun.build({
        entrypoints: ['./src/lambda-handler.ts'],
        outdir: outDir,
        target: 'node',
        minify: true
      })
    },

    serve(app) {
      // Return Lambda handler instead of server
      return async (event: APIGatewayProxyEvent, context: Context) => {
        const request = lambdaEventToRequest(event)
        const response = await app.handle(request)
        return responseToLambda(response)
      }
    }
  }
}

function lambdaEventToRequest(event: APIGatewayProxyEvent): Request {
  const url = `https://${event.headers.host}${event.path}`
  const searchParams = new URLSearchParams(event.queryStringParameters || {})

  return new Request(`${url}?${searchParams}`, {
    method: event.httpMethod,
    headers: new Headers(event.headers as Record<string, string>),
    body: event.body
  })
}

function responseToLambda(response: Response) {
  return {
    statusCode: response.status,
    headers: Object.fromEntries(response.headers),
    body: response.body,
    isBase64Encoded: false
  }
}
```

### Fastify

```ts
// adapters/fastify.ts
import Fastify from 'fastify'
import type { Adapter, EreoApp } from '@ereo/core'

export function fastifyAdapter(): Adapter {
  return {
    name: 'fastify',

    serve(app, { port, hostname }) {
      const fastify = Fastify()

      fastify.all('*', async (request, reply) => {
        const webRequest = new Request(
          `http://${request.hostname}${request.url}`,
          {
            method: request.method,
            headers: request.headers as Record<string, string>,
            body: request.body ? JSON.stringify(request.body) : undefined
          }
        )

        const response = await app.handle(webRequest)

        reply
          .status(response.status)
          .headers(Object.fromEntries(response.headers))
          .send(await response.text())
      })

      fastify.listen({ port, host: hostname })
      return fastify.server
    }
  }
}
```

### Express

```ts
// adapters/express.ts
import express from 'express'
import type { Adapter, EreoApp } from '@ereo/core'

export function expressAdapter(): Adapter {
  return {
    name: 'express',

    serve(app, { port, hostname }) {
      const server = express()

      server.use(async (req, res) => {
        const protocol = req.protocol
        const host = req.get('host')
        const url = `${protocol}://${host}${req.originalUrl}`

        const webRequest = new Request(url, {
          method: req.method,
          headers: req.headers as Record<string, string>,
          body: ['GET', 'HEAD'].includes(req.method) ? undefined : req.body
        })

        const response = await app.handle(webRequest)

        res.status(response.status)
        response.headers.forEach((value, key) => res.set(key, value))
        res.send(await response.text())
      })

      return server.listen(port, hostname)
    }
  }
}
```

## Adapter Hooks

Adapters can hook into the build and serve lifecycle:

```ts
export function myAdapter(): Adapter {
  return {
    name: 'my-adapter',

    // Called before build starts
    async beforeBuild(options) {
      console.log('Preparing build...')
    },

    // Main build logic
    async build(options) {
      // Build application
    },

    // Called after build completes
    async afterBuild(options, result) {
      console.log(`Built in ${result.duration}ms`)
    },

    // Called before server starts
    async beforeServe(app, options) {
      console.log('Starting server...')
    },

    // Main serve logic
    serve(app, options) {
      return server
    },

    // Called after server starts
    async afterServe(server) {
      console.log('Server ready')
    }
  }
}
```

## Static Asset Handling

Handle static assets in your adapter:

```ts
serve(app, { port, hostname }) {
  const server = Bun.serve({
    port,
    hostname,
    async fetch(request) {
      const url = new URL(request.url)

      // Serve static files
      if (url.pathname.startsWith('/static/')) {
        const file = Bun.file(`./dist${url.pathname}`)
        if (await file.exists()) {
          return new Response(file)
        }
      }

      // Handle with EreoJS
      return app.handle(request)
    }
  })

  return server
}
```

## Environment Detection

Detect runtime environment:

```ts
function detectRuntime() {
  if (typeof Bun !== 'undefined') return 'bun'
  if (typeof Deno !== 'undefined') return 'deno'
  if (typeof process !== 'undefined' && process.versions?.node) return 'node'
  if (typeof globalThis.caches !== 'undefined') return 'cloudflare'
  return 'unknown'
}
```

## Related

- [Deployment](/ecosystem/deployment/bun)
- [Build Configuration](/api/cli/build)
