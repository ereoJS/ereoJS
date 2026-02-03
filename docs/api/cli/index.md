# CLI Reference

The EreoJS CLI (`@ereo/cli`) provides commands for development, building, and deployment of EreoJS applications.

## Installation

The CLI is included when you create a new project with `create-ereo`. You can also install it manually:

```bash
bun add @ereo/cli
```

## Usage

```bash
bun ereo <command> [options]
```

Or via package.json scripts:

```json
{
  "scripts": {
    "dev": "ereo dev",
    "build": "ereo build",
    "start": "ereo start",
    "deploy": "ereo deploy"
  }
}
```

## Commands

| Command | Description |
|---------|-------------|
| [`dev`](/api/cli/dev) | Start development server with HMR |
| [`build`](/api/cli/build) | Build for production |
| [`start`](/api/cli/start) | Start production server |
| [`create`](/api/cli/create) | Create a new project |
| [`deploy`](/api/cli/deploy) | Deploy to production platforms |

## Global Options

| Option | Alias | Description |
|--------|-------|-------------|
| `--help` | `-h` | Show help message |
| `--version` | `-v` | Show CLI version |

## Quick Reference

### Development

```bash
# Start dev server
bun ereo dev

# Custom port
bun ereo dev --port 8080

# Open browser
bun ereo dev --open
```

### Production

```bash
# Build
bun ereo build

# Start production server
bun ereo start
```

### Deployment

```bash
# Deploy to Vercel
bun ereo deploy vercel --prod

# Deploy to Cloudflare
bun ereo deploy cloudflare

# Deploy to Fly.io
bun ereo deploy fly --prod

# Build Docker image
bun ereo deploy docker --name my-app
```

### Project Creation

```bash
# Create new project
bun ereo create my-app

# With specific template
bun ereo create my-app --template minimal
```

## Configuration File

The CLI reads configuration from `ereo.config.ts` (or `.js`):

```ts
import { defineConfig } from '@ereo/core';

export default defineConfig({
  // Server configuration
  server: {
    port: 3000,
    hostname: 'localhost',
    https: {
      key: './certs/key.pem',
      cert: './certs/cert.pem',
    },
  },

  // Build configuration
  build: {
    target: 'bun',        // 'bun' | 'node' | 'cloudflare' | 'deno'
    outDir: '.ereo',
    minify: true,
    sourcemap: false,
    splitting: true,
    external: ['sharp'],
  },

  // Development options
  dev: {
    islands: { debug: true },
    cache: { debug: true },
  },

  // Routes directory
  routesDir: 'app/routes',

  // Plugins
  plugins: [
    // Plugin instances
  ],
});
```

## Environment Variables

The CLI loads environment files in order:

### Development (`ereo dev`)

1. `.env`
2. `.env.local`
3. `.env.development`
4. `.env.development.local`

### Production (`ereo build`, `ereo start`)

1. `.env`
2. `.env.local`
3. `.env.production`
4. `.env.production.local`

### Access Variables

```ts
// Server-side
const secret = process.env.API_SECRET;

// Client-side (must be prefixed with EREO_PUBLIC_)
const apiUrl = process.env.EREO_PUBLIC_API_URL;
```

## Programmatic Usage

All CLI commands can be used programmatically:

```ts
import { dev, build, start, create, deploy } from '@ereo/cli';

// Development server
await dev({ port: 3000, open: true });

// Production build
await build({ minify: true, sourcemap: false });

// Production server
await start({ port: 8080 });

// Create project
await create('my-app', { template: 'tailwind' });

// Deploy
const result = await deploy({ target: 'vercel', production: true });
```

## Type Exports

```ts
import type {
  DevOptions,
  BuildCommandOptions,
  StartOptions,
  CreateOptions,
  DeployOptions,
  DeployTarget,
  DeployResult,
} from '@ereo/cli';
```

## Debugging

Enable verbose output:

```bash
DEBUG=ereo:* bun ereo dev
DEBUG=ereo:* bun ereo build
```

Debug categories:
- `ereo:router` - Route discovery and matching
- `ereo:build` - Build process
- `ereo:hmr` - Hot module replacement
- `ereo:cache` - Caching operations

## Exit Codes

| Code | Meaning |
|------|---------|
| `0` | Success |
| `1` | General error |
| `2` | Invalid arguments |
| `3` | Build error |
| `4` | Runtime error |

## Related

- [create-ereo](/api/create-ereo) - Project scaffolding tool
- [Configuration](/api/core/create-app) - App configuration
- [Plugins](/api/core/plugins) - Plugin system
