# @ereo/bundler

Build system for the EreoJS framework. Includes Hot Module Replacement (HMR), production builds, error overlays, and plugins for islands and Tailwind CSS.

## Installation

```bash
bun add @ereo/bundler
```

## Quick Start

```typescript
import { build, createHMRServer } from '@ereo/bundler';

// Production build
await build({
  entry: './src/entry.tsx',
  outdir: './dist',
  minify: true,
});

// Development with HMR
const hmr = createHMRServer({ port: 3001 });
hmr.start();
```

## Key Features

- **Production Builds** - Optimized builds with `build`, tree-shaking, and minification
- **Hot Module Replacement** - Fast refresh with `createHMRServer` and `createHMRWatcher`
- **Error Overlay** - Developer-friendly error display with stack traces
- **Build Analysis** - Bundle size analysis with `analyzeBuild` and `printBuildReport`
- **Islands Plugin** - Extract and transform island components with `createIslandsPlugin`
- **Types Plugin** - Generate route types with `createTypesPlugin`
- **Tailwind Plugin** - Integrated Tailwind CSS support with `createTailwindPlugin`

## Production Build

```typescript
import { build, printBuildReport, analyzeBuild } from '@ereo/bundler';

const result = await build({
  entry: './src/entry.tsx',
  outdir: './dist',
  minify: true,
  sourcemap: true,
});

printBuildReport(result);
const analysis = analyzeBuild(result);
```

## Development Server

```typescript
import { createHMRServer, createHMRWatcher } from '@ereo/bundler';

const hmr = createHMRServer({ port: 3001 });
const watcher = createHMRWatcher({
  watchDir: './src',
  onUpdate: (update) => hmr.broadcast(update),
});

hmr.start();
watcher.start();
```

## Plugins

```typescript
import { createIslandsPlugin, createTailwindPlugin, createTypesPlugin } from '@ereo/bundler';

const plugins = [
  createTypesPlugin({ routesDir: './src/routes' }),
  createIslandsPlugin({ componentsDir: './src/components' }),
  createTailwindPlugin({ config: './tailwind.config.js' }),
];
```

## Documentation

For full documentation, visit [https://ereojs.dev/docs/bundler](https://ereojs.dev/docs/bundler)

## Part of EreoJS

This package is part of the [EreoJS](https://github.com/ereojs/ereo) monorepo - a modern full-stack framework built for Bun.

## License

MIT
