# @ereo/runtime-bun

Bun runtime adapter for the EreoJS framework. This is the default runtime, optimized for Bun's exceptional performance and built-in features.

## Installation

```bash
bun add @ereo/runtime-bun
```

## Quick Start

```typescript
import { createBunRuntime, serve } from '@ereo/runtime-bun';

// Quick start with defaults
const runtime = await serve({
  server: { port: 3000 },
});

// Or with more control
const runtime = createBunRuntime({
  server: {
    port: 3000,
    hostname: 'localhost',
  },
  config: {
    // Framework configuration
  },
});

runtime.use(myPlugin);
await runtime.start();
```

## API

### `createBunRuntime(options?)`

Create a new Bun runtime instance.

```typescript
const runtime = createBunRuntime({
  server: { port: 3000 },
  config: { /* EreoJS config */ },
});
```

### `serve(options?)`

Quick start helper that creates and starts the runtime.

```typescript
const runtime = await serve({ server: { port: 3000 } });
```

### Runtime Methods

```typescript
const runtime = createBunRuntime({ server: { port: 3000 } });

// Register plugins
runtime.use(myPlugin);

// Start the server
const server = await runtime.start();

// Handle requests directly (useful for testing)
const response = await runtime.handle(new Request('http://localhost/api/health'));

// Stop the server
runtime.stop();
```

## Bun-Specific Utilities

The package includes optimized utilities that leverage Bun's built-in features:

```typescript
import {
  readFile,
  writeFile,
  readJSON,
  gzip,
  gunzip,
  hashPassword,
  verifyPassword,
  randomUUID,
  sleep,
  spawn,
  env,
  requireEnv,
  getDatabase,
} from '@ereo/runtime-bun';

// File operations
const content = await readFile('./data.txt');
await writeFile('./output.txt', content);
const config = await readJSON('./config.json');

// Compression
const compressed = gzip('Hello World');
const decompressed = gunzip(compressed);

// Password hashing
const hash = await hashPassword('secret');
const valid = await verifyPassword('secret', hash);

// Environment variables
const apiKey = env('API_KEY', 'default');
const dbUrl = requireEnv('DATABASE_URL'); // throws if missing

// SQLite database
const db = await getDatabase('./app.db');
```

## Key Features

- Native Bun server integration
- Optimized file I/O with Bun.file
- Built-in gzip compression
- Secure password hashing with Bun.password
- SQLite database support via bun:sqlite
- Environment variable helpers
- Process spawning utilities

## Documentation

For full documentation, visit [https://ereo.dev/docs/runtime-bun](https://ereo.dev/docs/runtime-bun)

## Part of EreoJS

This package is part of the [EreoJS monorepo](https://github.com/ereoJS/ereoJS).

## License

MIT
