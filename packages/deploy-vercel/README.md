# @ereo/deploy-vercel

Vercel deployment adapter for the EreoJS framework. Configure and deploy your EreoJS applications to Vercel with support for both Edge and Node.js runtimes.

## Installation

```bash
bun add @ereo/deploy-vercel
```

## Quick Start

```typescript
import { defineConfig } from '@ereo/core';
import { vercel } from '@ereo/deploy-vercel';

export default defineConfig({
  ...vercel({
    edge: true,
    regions: ['iad1', 'sfo1'],
  }),
});
```

## Configuration

```typescript
import { vercel, generateVercelJson } from '@ereo/deploy-vercel';

const config = {
  // Use Edge runtime (default: false = Node.js)
  edge: true,

  // Deployment regions
  regions: ['iad1', 'sfo1', 'fra1'],

  // Function timeout in seconds
  // Max: 900 for Node, 30 for Edge
  timeout: 30,

  // Memory allocation in MB
  // 128-3008 for Node, 1024-4096 for Edge
  memory: 1024,

  // Environment variables
  env: {
    NODE_ENV: 'production',
  },
};

// Apply to EreoJS config
export default defineConfig({
  ...vercel(config),
});

// Generate vercel.json
const vercelConfig = generateVercelJson(config);
```

## Deployment

### Using Vercel CLI

```bash
# Build the application
ereo build

# Deploy to Vercel
vercel deploy
```

### Using EreoJS CLI

```bash
# Deploy to Vercel
ereo deploy vercel --prod

# Preview deployment
ereo deploy vercel --dry-run
```

## API

### `vercel(config?)`

Generate EreoJS configuration for Vercel deployment.

### `generateVercelJson(config)`

Generate a vercel.json configuration file.

```typescript
const json = generateVercelJson({
  edge: true,
  regions: ['iad1'],
});

await Bun.write('vercel.json', json);
```

### `generateBuildScript()`

Generate a build script for Vercel deployment.

## Key Features

- Support for Edge and Node.js runtimes
- Multi-region deployment
- Configurable function timeout and memory
- Environment variable management
- Automatic vercel.json generation
- Optimized build output

## Documentation

For full documentation, visit [https://ereo.dev/docs/deploy-vercel](https://ereo.dev/docs/deploy-vercel)

## Part of EreoJS

This package is part of the [EreoJS monorepo](https://github.com/anthropics/ereo-js).

## License

MIT
