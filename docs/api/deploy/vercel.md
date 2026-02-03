# Vercel Deployment

Deploy EreoJS applications to Vercel with Node.js or Edge runtime support.

## Installation

```bash
bun add @ereo/deploy-vercel
```

## Overview

The `@ereo/deploy-vercel` package provides utilities to configure EreoJS applications for Vercel deployment. It supports:

- **Node.js Runtime** - Traditional serverless functions using `@vercel/node`
- **Edge Runtime** - Lightweight functions running at the edge using `@vercel/edge`

## API Reference

### Exports

The package exports the following:

| Export | Type | Description |
|--------|------|-------------|
| `vercel` | Function | Generate EreoJS framework configuration |
| `generateVercelJson` | Function | Generate vercel.json content |
| `generateBuildScript` | Function | Generate bash build script |
| `VercelConfig` | Interface | Configuration type definition |
| `default` | Function | Default export (same as `vercel`) |

---

## `vercel(config?)`

Generates EreoJS framework configuration for Vercel deployment.

### Signature

```typescript
function vercel(config?: VercelConfig): Partial<FrameworkConfig>
```

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `config` | `VercelConfig` | No | Configuration options |

### Returns

Returns a partial `FrameworkConfig` object with the build target set:

```typescript
{
  build: {
    target: 'node' | 'edge'
  }
}
```

### Examples

#### Default Configuration (Node.js)

```typescript
import { defineConfig } from '@ereo/core';
import { vercel } from '@ereo/deploy-vercel';

export default defineConfig({
  ...vercel()
});

// Equivalent to:
// { build: { target: 'node' } }
```

#### Edge Runtime

```typescript
import { defineConfig } from '@ereo/core';
import { vercel } from '@ereo/deploy-vercel';

export default defineConfig({
  ...vercel({ edge: true })
});

// Equivalent to:
// { build: { target: 'edge' } }
```

#### Using Default Export

```typescript
import vercel from '@ereo/deploy-vercel';

export default defineConfig({
  ...vercel({ edge: true })
});
```

---

## `generateVercelJson(config)`

Generates a `vercel.json` configuration file as a formatted JSON string.

### Signature

```typescript
function generateVercelJson(config: VercelConfig): string
```

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `config` | `VercelConfig` | Yes | Configuration options |

### Returns

Returns a formatted JSON string suitable for writing to `vercel.json`.

### Generated Structure

The function generates a Vercel configuration with:

- **version**: Always `2`
- **builds**: Single build entry for `dist/server.js`
- **routes**: Catch-all route directing to the server
- **regions**: Included if specified in config
- **functions**: Added for Edge runtime only

### Examples

#### Node.js Runtime

```typescript
import { generateVercelJson } from '@ereo/deploy-vercel';

const json = generateVercelJson({});
console.log(json);
```

Output:

```json
{
  "version": 2,
  "builds": [
    {
      "src": "dist/server.js",
      "use": "@vercel/node",
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
  ]
}
```

#### Edge Runtime with Regions

```typescript
import { generateVercelJson } from '@ereo/deploy-vercel';

const json = generateVercelJson({
  edge: true,
  regions: ['iad1', 'sfo1', 'fra1']
});
console.log(json);
```

Output:

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
  "regions": ["iad1", "sfo1", "fra1"],
  "functions": {
    "dist/server.js": {
      "runtime": "edge",
      "regions": ["iad1", "sfo1", "fra1"]
    }
  }
}
```

#### Writing to File

```typescript
import { generateVercelJson } from '@ereo/deploy-vercel';

const config = generateVercelJson({
  edge: true,
  regions: ['iad1']
});

await Bun.write('vercel.json', config);
```

---

## `generateBuildScript()`

Generates a bash build script for Vercel deployment.

### Signature

```typescript
function generateBuildScript(): string
```

### Parameters

None.

### Returns

Returns a bash script string that:

1. Sets strict error handling (`set -e`)
2. Installs dependencies with `bun install`
3. Builds the application with `bun run build`
4. Copies static assets from `public/` to `dist/public/`

### Generated Script

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

### Example

```typescript
import { generateBuildScript } from '@ereo/deploy-vercel';

const script = generateBuildScript();
await Bun.write('build.sh', script);

// Make executable (via CLI)
// chmod +x build.sh
```

---

## `VercelConfig` Interface

Configuration options for Vercel deployment.

### Definition

```typescript
interface VercelConfig {
  /** Use Vercel Edge runtime (default: false = Node.js) */
  edge?: boolean;

  /** Deployment regions */
  regions?: string[];

  /** Function timeout in seconds (reserved - not yet implemented) */
  timeout?: number;

  /** Memory allocation in MB (reserved - not yet implemented) */
  memory?: number;

  /** Environment variables (reserved - not yet implemented) */
  env?: Record<string, string>;
}
```

### Properties

| Property | Type | Default | Used By | Description |
|----------|------|---------|---------|-------------|
| `edge` | `boolean` | `false` | `vercel()`, `generateVercelJson()` | When `true`, configures for Edge runtime |
| `regions` | `string[]` | `undefined` | `generateVercelJson()` | Array of Vercel region codes |
| `timeout` | `number` | - | Not yet implemented | Reserved for function timeout |
| `memory` | `number` | - | Not yet implemented | Reserved for memory allocation |
| `env` | `Record<string, string>` | - | Not yet implemented | Reserved for environment variables |

> **Note:** The `timeout`, `memory`, and `env` options are defined in the interface for future compatibility but are not currently used by any functions.

### Vercel Regions

Common Vercel region codes:

| Code | Location |
|------|----------|
| `iad1` | Washington, D.C., USA |
| `sfo1` | San Francisco, USA |
| `fra1` | Frankfurt, Germany |
| `hnd1` | Tokyo, Japan |
| `syd1` | Sydney, Australia |

See [Vercel Regions documentation](https://vercel.com/docs/edge-network/regions) for full list.

---

## Deployment Guide

### Step 1: Install the Package

```bash
bun add @ereo/deploy-vercel
```

### Step 2: Configure EreoJS

```typescript
// ereo.config.ts
import { defineConfig } from '@ereo/core';
import { vercel } from '@ereo/deploy-vercel';

export default defineConfig({
  ...vercel({
    edge: false  // or true for Edge runtime
  })
});
```

### Step 3: Generate vercel.json

```typescript
// scripts/generate-vercel-config.ts
import { generateVercelJson } from '@ereo/deploy-vercel';

const config = generateVercelJson({
  edge: false,
  regions: ['iad1']
});

await Bun.write('vercel.json', config);
console.log('Generated vercel.json');
```

Run:

```bash
bun run scripts/generate-vercel-config.ts
```

### Step 4: Build and Deploy

```bash
# Build the application
bun run build

# Deploy to Vercel (preview)
vercel deploy

# Deploy to production
vercel deploy --prod
```

---

## Runtime Comparison

| Feature | Node.js (`edge: false`) | Edge (`edge: true`) |
|---------|------------------------|---------------------|
| Vercel Builder | `@vercel/node` | `@vercel/edge` |
| Maximum Timeout | 900 seconds | 30 seconds |
| Memory Range | 128 MB - 3008 MB | 1024 MB - 4096 MB |
| Node.js APIs | Full support | Limited (Web APIs) |
| File System | Available | Not available |
| Cold Start | Slower | Faster |
| Global Deployment | Per-region | Edge network |

### When to Use Node.js Runtime

- Need full Node.js API support
- Long-running operations (up to 15 minutes)
- File system operations
- Heavy computation

### When to Use Edge Runtime

- Low-latency requirements
- Simple request/response handling
- Geolocation-based logic
- Authentication/authorization middleware

---

## Package Scripts

Recommended `package.json` scripts:

```json
{
  "scripts": {
    "dev": "bun run --watch src/index.ts",
    "build": "bun run build",
    "deploy": "vercel deploy",
    "deploy:prod": "vercel deploy --prod",
    "generate:vercel": "bun run scripts/generate-vercel-config.ts"
  }
}
```

---

## Troubleshooting

### Build Output Location

The generated configuration expects your build output at `dist/server.js`. Ensure your build process outputs to this location.

### Missing Regions

If `regions` is not specified, Vercel uses its default region selection. For explicit control:

```typescript
generateVercelJson({
  regions: ['iad1']  // Explicitly set regions
});
```

### Edge Runtime Functions Block

The `functions` block in `vercel.json` is only added when `edge: true`. For Node.js runtime, configure function settings directly in Vercel's dashboard or manually add to `vercel.json`.

### Static Assets

The generated build script copies files from `public/` to `dist/public/`. Ensure your static assets are in the `public/` directory.

---

## Dependencies

This package depends on:

- `@ereo/core` - For the `FrameworkConfig` type

---

## Related

- [Cloudflare Deployment](/api/deploy/cloudflare)
- [EreoJS Core](/api/core)
