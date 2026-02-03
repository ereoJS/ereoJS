# Cloudflare Deployment

Deploy EreoJS applications to Cloudflare Workers.

## Installation

```bash
bun add @ereo/deploy-cloudflare
```

## Overview

The `@ereo/deploy-cloudflare` package provides:

1. **Build configuration** - Sets the EreoJS build target to `'cloudflare'`
2. **wrangler.toml generation** - Creates a basic Wrangler configuration file

## API Reference

### `cloudflare(config?)`

Generates EreoJS build configuration for Cloudflare deployment.

**Signature:**
```typescript
function cloudflare(config?: CloudflareConfig): Partial<FrameworkConfig>
```

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `config` | `CloudflareConfig` | No | Configuration options (currently unused) |

**Returns:**
```typescript
{
  build: {
    target: 'cloudflare'
  }
}
```

**Note:** The return value is constant regardless of the config parameter. Config options are accepted for API compatibility but do not affect the output.

**Example:**
```typescript
// ereo.config.ts
import { defineConfig } from '@ereo/core';
import { cloudflare } from '@ereo/deploy-cloudflare';

export default defineConfig({
  ...cloudflare(),
});
```

### `generateWranglerToml(config)`

Generates wrangler.toml configuration content as a string.

**Signature:**
```typescript
function generateWranglerToml(config: CloudflareConfig): string
```

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `config` | `CloudflareConfig` | Yes | Configuration options |

**Returns:** `string` - wrangler.toml file content

**Supported Config Properties:**

| Property | Effect |
|----------|--------|
| `routes` | Added as `routes = [...]` in output |
| `kvNamespaces` | Generates `[[kv_namespaces]]` blocks for each binding |
| `target` | Accepted but not used |
| `accountId` | Accepted but not used |
| `durableObjects` | Accepted but not used |

**Generated Output Structure:**
```toml
name = "ereo-app"
compatibility_date = "2024-01-01"
main = "dist/server.js"

routes = ["..."]  # Only if routes provided

[[kv_namespaces]]  # One block per kvNamespace entry
binding = "BINDING_NAME"
id = "your-namespace-id"  # Placeholder - must be replaced manually
```

**Example:**
```typescript
import { generateWranglerToml } from '@ereo/deploy-cloudflare';

const config = generateWranglerToml({
  routes: ['example.com/*'],
  kvNamespaces: ['CACHE', 'SESSIONS'],
});

// Write to file
await Bun.write('wrangler.toml', config);
```

### `CloudflareConfig` Interface

```typescript
interface CloudflareConfig {
  /** Deployment target (accepted but not currently used) */
  target?: 'pages' | 'workers';

  /** Cloudflare account ID (accepted but not currently used) */
  accountId?: string;

  /** Custom domain routes - output to wrangler.toml */
  routes?: string[];

  /** KV namespace binding names - output to wrangler.toml */
  kvNamespaces?: string[];

  /** Durable Object bindings (accepted but not currently used) */
  durableObjects?: string[];
}
```

### Default Export

The `cloudflare` function is also available as the default export:

```typescript
import cloudflare from '@ereo/deploy-cloudflare';
```

## Usage

### Basic Setup

```typescript
// ereo.config.ts
import { defineConfig } from '@ereo/core';
import { cloudflare } from '@ereo/deploy-cloudflare';

export default defineConfig({
  ...cloudflare(),
});
```

### Generating wrangler.toml

```typescript
// scripts/setup-cloudflare.ts
import { generateWranglerToml } from '@ereo/deploy-cloudflare';

const toml = generateWranglerToml({
  routes: ['api.example.com/*'],
  kvNamespaces: ['CACHE'],
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
```

### Post-Generation Steps

After generating wrangler.toml, you must:

1. **Replace KV namespace IDs** - Change `"your-namespace-id"` to actual IDs from Cloudflare dashboard
2. **Add account ID** (if needed) - Add `account_id = "your-account-id"` manually
3. **Configure additional bindings** - Add Durable Objects, R2, D1, etc. manually

## Build and Deploy

### Build

```bash
# Build for Cloudflare
bun run build
```

### Deploy with Wrangler

```bash
# Deploy to Cloudflare Workers
wrangler deploy

# Local development
wrangler dev
```

### Package Scripts

```json
{
  "scripts": {
    "dev": "wrangler dev",
    "build": "bun run build",
    "deploy": "bun run build && wrangler deploy"
  }
}
```

## Manual wrangler.toml Configuration

For features not supported by `generateWranglerToml()`, create or extend wrangler.toml manually:

```toml
name = "my-ereo-app"
compatibility_date = "2024-01-01"
main = "dist/server.js"
account_id = "your-account-id"

# Routes
routes = ["example.com/*"]

# Static assets
[site]
bucket = "./dist/static"

# KV Namespaces (with real IDs)
[[kv_namespaces]]
binding = "CACHE"
id = "abc123def456"

# Durable Objects (manual configuration required)
[[durable_objects.bindings]]
name = "COUNTER"
class_name = "Counter"

# Environment Variables
[vars]
API_URL = "https://api.example.com"

# Compatibility flags
compatibility_flags = ["nodejs_compat"]
```

## Environment Variables

### Local Development

Create `.dev.vars` for local secrets:

```
DATABASE_URL=postgres://localhost/mydb
API_KEY=secret123
```

### Production Secrets

```bash
# Set a secret via Wrangler CLI
wrangler secret put API_KEY
```

## Current Limitations

The following are **not implemented** in this package:

| Feature | Status |
|---------|--------|
| `target` option (pages vs workers) | Defined but ignored |
| `accountId` in config | Defined but ignored |
| `durableObjects` bindings | Defined but not generated |
| Dynamic KV namespace IDs | Outputs placeholder only |
| Cloudflare Pages-specific config | Not implemented |
| R2, D1, Queues bindings | Not implemented |

For full Cloudflare Workers/Pages features, refer to the [Wrangler documentation](https://developers.cloudflare.com/workers/wrangler/configuration/).

## CI/CD Deployment

### GitHub Actions

```yaml
name: Deploy to Cloudflare

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: oven-sh/setup-bun@v1

      - run: bun install

      - run: bun run build

      - uses: cloudflare/wrangler-action@v3
        with:
          apiToken: ${{ secrets.CF_API_TOKEN }}
          accountId: ${{ secrets.CF_ACCOUNT_ID }}
```

## Troubleshooting

### "your-namespace-id" Error

If Wrangler reports an invalid namespace ID:

```
Error: KV namespace with id "your-namespace-id" not found
```

**Solution:** Replace the placeholder ID in wrangler.toml with your actual KV namespace ID from the Cloudflare dashboard.

### Missing Account ID

If deployment fails with account ID errors:

**Solution:** Add `account_id = "your-account-id"` to wrangler.toml manually, or set the `CLOUDFLARE_ACCOUNT_ID` environment variable.

### Bundle Size Limits

Cloudflare Workers have a 1 MB compressed bundle limit. If exceeded:

1. Check bundle size: `ls -lh dist/server.js`
2. Exclude large dependencies in your build configuration
3. Consider using Cloudflare Pages for larger applications

## Related

- [Vercel Deployment](/api/deploy/vercel)
- [Build CLI](/api/cli/build)
- [Core Configuration](/api/core/create-app)
