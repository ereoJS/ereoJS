# @ereo/deploy-cloudflare

Cloudflare Pages and Workers deployment adapter for the EreoJS framework. Configure and deploy your EreoJS applications to Cloudflare's global edge network.

## Installation

```bash
bun add @ereo/deploy-cloudflare
```

## Quick Start

```typescript
import { defineConfig } from '@ereo/core';
import { cloudflare } from '@ereo/deploy-cloudflare';

export default defineConfig({
  ...cloudflare({
    target: 'pages',
    accountId: 'your-account-id',
    routes: ['example.com/*'],
  }),
});
```

## Configuration

```typescript
import { cloudflare, generateWranglerToml } from '@ereo/deploy-cloudflare';

const config = {
  // Deployment target: 'pages' or 'workers'
  target: 'workers',

  // Cloudflare account ID
  accountId: 'your-account-id',

  // Custom domain routes
  routes: ['api.example.com/*'],

  // KV namespace bindings
  kvNamespaces: ['CACHE', 'SESSIONS'],

  // Durable Object bindings
  durableObjects: ['COUNTER', 'RATE_LIMITER'],
};

// Apply to EreoJS config
export default defineConfig({
  ...cloudflare(config),
});

// Generate wrangler.toml
const wranglerConfig = generateWranglerToml(config);
```

## Deployment

### Using Wrangler

```bash
# Build the application
ereo build

# Deploy to Cloudflare
wrangler deploy
```

### Using EreoJS CLI

```bash
# Deploy to Cloudflare
ereo deploy cloudflare --prod

# Preview deployment
ereo deploy cloudflare --dry-run
```

## API

### `cloudflare(config?)`

Generate EreoJS configuration for Cloudflare deployment.

### `generateWranglerToml(config)`

Generate a wrangler.toml configuration file.

```typescript
const toml = generateWranglerToml({
  target: 'workers',
  kvNamespaces: ['CACHE'],
  routes: ['api.example.com/*'],
});

await Bun.write('wrangler.toml', toml);
```

## Key Features

- Support for Cloudflare Pages and Workers
- KV namespace bindings
- Durable Object integration
- Custom domain routing
- Automatic wrangler.toml generation
- Edge runtime optimization

## Documentation

For full documentation, visit [https://ereo.dev/docs/deploy-cloudflare](https://ereo.dev/docs/deploy-cloudflare)

## Part of EreoJS

This package is part of the [EreoJS monorepo](https://github.com/anthropics/ereo-js).

## License

MIT
