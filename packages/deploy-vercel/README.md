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

## API Reference

### `vercel(config?)`

Generates EreoJS framework configuration for Vercel deployment.

**Parameters:**
- `config` (optional): `VercelConfig` object

**Returns:** `Partial<FrameworkConfig>` with build target set

```typescript
import { vercel } from '@ereo/deploy-vercel';

// Default: Node.js runtime
const nodeConfig = vercel();
// Returns: { build: { target: 'node' } }

// Edge runtime
const edgeConfig = vercel({ edge: true });
// Returns: { build: { target: 'edge' } }
```

### `generateVercelJson(config)`

Generates a `vercel.json` configuration file as a JSON string.

**Parameters:**
- `config`: `VercelConfig` object

**Returns:** `string` - Formatted JSON configuration

```typescript
import { generateVercelJson } from '@ereo/deploy-vercel';

// Node.js configuration
const nodeJson = generateVercelJson({});

// Edge configuration with regions
const edgeJson = generateVercelJson({
  edge: true,
  regions: ['iad1', 'sfo1'],
});

// Write to file
await Bun.write('vercel.json', edgeJson);
```

**Generated JSON Structure (Edge example):**

```json
{
  "version": 2,
  "builds": [
    {
      "src": "dist/server.js",
      "use": "@vercel/edge",
      "config": {
        "includeFiles": ["dist/**"]
      }
    }
  ],
  "routes": [
    {
      "src": "/(.*)",
      "dest": "dist/server.js"
    }
  ],
  "regions": ["iad1", "sfo1"],
  "functions": {
    "dist/server.js": {
      "runtime": "edge",
      "regions": ["iad1", "sfo1"]
    }
  }
}
```

### `generateBuildScript()`

Generates a bash build script for Vercel deployment.

**Parameters:** None

**Returns:** `string` - Bash script content

```typescript
import { generateBuildScript } from '@ereo/deploy-vercel';

const script = generateBuildScript();
await Bun.write('build.sh', script);
```

**Generated Script:**

```bash
#!/bin/bash
# Vercel build script for EreoJS framework

set -e

echo "Building for Vercel..."

# Install dependencies
bun install

# Build the application
bun run build

# Copy static assets to dist
mkdir -p dist/public
cp -r public/* dist/public/ 2>/dev/null || true

echo "Build complete!"
```

### `VercelConfig` Interface

```typescript
interface VercelConfig {
  /** Use Vercel Edge runtime (default: false = Node.js) */
  edge?: boolean;

  /** Deployment regions */
  regions?: string[];

  /** Function timeout in seconds - Reserved for future use */
  timeout?: number;

  /** Memory allocation in MB - Reserved for future use */
  memory?: number;

  /** Environment variables - Reserved for future use */
  env?: Record<string, string>;
}
```

| Option | Type | Used By | Description |
|--------|------|---------|-------------|
| `edge` | `boolean` | `vercel()`, `generateVercelJson()` | Use Edge runtime instead of Node.js |
| `regions` | `string[]` | `generateVercelJson()` | Vercel deployment regions |
| `timeout` | `number` | Reserved | Function timeout (not yet implemented) |
| `memory` | `number` | Reserved | Memory allocation (not yet implemented) |
| `env` | `Record<string, string>` | Reserved | Environment variables (not yet implemented) |

### Default Export

The package default export is the `vercel` function:

```typescript
import vercel from '@ereo/deploy-vercel';
// Equivalent to: import { vercel } from '@ereo/deploy-vercel';
```

## Deployment

### Using Vercel CLI

```bash
# Build the application
bun run build

# Deploy to Vercel
vercel deploy

# Deploy to production
vercel deploy --prod
```

### Generate Configuration Files

```typescript
import { generateVercelJson, generateBuildScript } from '@ereo/deploy-vercel';

// Generate vercel.json
const vercelConfig = generateVercelJson({ edge: true, regions: ['iad1'] });
await Bun.write('vercel.json', vercelConfig);

// Generate build script
const buildScript = generateBuildScript();
await Bun.write('build.sh', buildScript);
```

## Runtime Comparison

| Feature | Node.js Runtime | Edge Runtime |
|---------|----------------|--------------|
| Builder | `@vercel/node` | `@vercel/edge` |
| Max Timeout | 900 seconds | 30 seconds |
| Memory Range | 128-3008 MB | 1024-4096 MB |
| Node.js APIs | Full support | Limited |
| Cold Start | Slower | Faster |

## Current Limitations

The following config options are defined in the interface but not yet implemented:

- `timeout` - Function timeout configuration
- `memory` - Memory allocation configuration
- `env` - Environment variables

These options are accepted for future compatibility but do not affect the generated output.

## Documentation

For full documentation, visit [https://ereo.dev/docs/deploy-vercel](https://ereo.dev/docs/deploy-vercel)

## Part of EreoJS

This package is part of the [EreoJS monorepo](https://github.com/anthropics/ereo-js).

## License

MIT
