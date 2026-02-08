# @ereo/deploy-cloudflare

Cloudflare deployment adapter for the EreoJS framework. Generates build configuration and wrangler.toml files for deploying to Cloudflare Workers.

## Installation

```bash
bun add @ereo/deploy-cloudflare
```

## Quick Start

```typescript
import { defineConfig } from '@ereo/core';
import { cloudflare } from '@ereo/deploy-cloudflare';

export default defineConfig({
  ...cloudflare(),
});
```

This sets the build target to `'cloudflare'` in your EreoJS configuration.

## API Reference

### `cloudflare(config?)`

Generates EreoJS configuration for Cloudflare deployment.

**Parameters:**
- `config` (optional): `CloudflareConfig` object

**Returns:** `Partial<FrameworkConfig>` - Always returns:
```typescript
{
  build: {
    target: 'cloudflare'
  }
}
```

**Note:** The current implementation returns the same output regardless of configuration options passed. Configuration properties are accepted for future compatibility but are not yet utilized.

```typescript
import { cloudflare } from '@ereo/deploy-cloudflare';

const config = cloudflare();
// Returns: { build: { target: 'cloudflare' } }
```

### `generateWranglerToml(config)`

Generates a wrangler.toml configuration string.

**Parameters:**
- `config`: `CloudflareConfig` object

**Returns:** `string` - wrangler.toml content

**Supported Options:**
- `routes`: Array of route patterns (e.g., `['example.com/*']`)
- `kvNamespaces`: Array of KV namespace binding names

**Example:**

```typescript
import { generateWranglerToml } from '@ereo/deploy-cloudflare';

const toml = generateWranglerToml({
  routes: ['api.example.com/*'],
  kvNamespaces: ['CACHE', 'SESSIONS'],
});

await Bun.write('wrangler.toml', toml);
```

**Output:**

```toml
name = "ereo-app"
compatibility_date = "2024-01-01"
main = "dist/server.js"

routes = ["api.example.com/*"]

[[kv_namespaces]]
binding = "CACHE"
id = "your-namespace-id"

[[kv_namespaces]]
binding = "SESSIONS"
id = "your-namespace-id"
```

**Important:** You must manually replace `"your-namespace-id"` with your actual Cloudflare KV namespace IDs.

### `CloudflareConfig` Interface

```typescript
interface CloudflareConfig {
  /** Deployment target: 'pages' or 'workers' (not currently used) */
  target?: 'pages' | 'workers';

  /** Cloudflare account ID (not currently used) */
  accountId?: string;

  /** Custom domain routes - included in wrangler.toml output */
  routes?: string[];

  /** KV namespace bindings - included in wrangler.toml output */
  kvNamespaces?: string[];

  /** Durable Object bindings (not currently used) */
  durableObjects?: string[];
}
```

### Default Export

The package default export is the `cloudflare` function:

```typescript
import cloudflare from '@ereo/deploy-cloudflare';
// Equivalent to: import { cloudflare } from '@ereo/deploy-cloudflare';
```

## Deployment Workflow

### 1. Configure EreoJS

```typescript
// ereo.config.ts
import { defineConfig } from '@ereo/core';
import { cloudflare } from '@ereo/deploy-cloudflare';

export default defineConfig({
  ...cloudflare(),
});
```

### 2. Generate wrangler.toml

```typescript
// scripts/generate-wrangler.ts
import { generateWranglerToml } from '@ereo/deploy-cloudflare';

const toml = generateWranglerToml({
  routes: ['myapp.example.com/*'],
  kvNamespaces: ['CACHE'],
});

await Bun.write('wrangler.toml', toml);
console.log('Generated wrangler.toml - remember to update KV namespace IDs!');
```

### 3. Deploy with Wrangler

```bash
# Build the application
bun run build

# Deploy to Cloudflare
wrangler deploy
```

## Current Limitations

This package provides minimal configuration scaffolding. The following features are defined in the interface but not yet implemented:

- `target` option does not differentiate between Pages and Workers
- `accountId` is not used in any output
- `durableObjects` bindings are not generated in wrangler.toml
- KV namespace IDs must be manually configured (placeholder values are generated)

For full Cloudflare configuration, manually edit the generated wrangler.toml or create one from scratch following [Cloudflare's documentation](https://developers.cloudflare.com/workers/wrangler/configuration/).

## Documentation

For full documentation, visit [https://ereojs.github.io/ereoJS/api/deploy/cloudflare](https://ereojs.github.io/ereoJS/api/deploy/cloudflare)

## Part of EreoJS

This package is part of the [EreoJS monorepo](https://github.com/ereoJS/ereoJS).

## License

MIT
