# @ereo/dev-inspector

Visual route inspector and DevTools for EreoJS framework development. Provides a comprehensive UI for exploring routes, data pipelines, islands, and cache during development.

## Installation

```bash
bun add -D @ereo/dev-inspector
```

## Quick Start

```typescript
import { createDevInspector, createDevToolsPlugin } from '@ereo/dev-inspector';
import { defineConfig } from '@ereo/core';

export default defineConfig({
  plugins: [
    createDevInspector({
      mountPath: '/__ereo',
      enableTesting: true,
      showLoaderData: true,
    }),
    createDevToolsPlugin(),
  ],
});
```

Then visit `http://localhost:3000/__ereo` to open the inspector.

## Features

### Route Inspector

Visual interface for exploring all routes in your application:

- View route paths and file locations
- See render modes (SSR, SSG, CSR, API, RSC)
- Check for loaders, actions, and middleware
- Filter and search routes
- View island component counts

### DevTools Panel

Comprehensive development tools including:

- **Data Pipeline Tab** - Visualize data flow through loaders
- **Routes Tab** - Interactive route tree exploration
- **Islands Tab** - View hydrated components and their state
- **Cache Tab** - Monitor cache entries and hit rates

## API

### `createDevInspector(config?)`

Create the route inspector plugin.

```typescript
createDevInspector({
  mountPath: '/__ereo',     // Inspector URL path
  enableTesting: true,      // Enable route testing
  showLoaderData: true,     // Display loader data
});
```

### `createDevToolsPlugin()`

Create the full DevTools panel plugin with all tabs.

### `generateInspectorHTML(routes)`

Generate HTML for the route inspector UI.

### `createRouteInfo(routes)`

Transform routes into inspector-friendly format.

### `formatRouteTree(routes)`

Format routes as a CLI-friendly tree string.

## Key Features

- Visual route tree with search and filtering
- Render mode badges (SSR, SSG, CSR, API, RSC)
- Loader and action indicators
- Island component counting
- Data pipeline visualization
- Cache monitoring and statistics
- Dark theme UI optimized for development

## Documentation

For full documentation, visit [https://ereo.dev/docs/dev-inspector](https://ereo.dev/docs/dev-inspector)

## Part of EreoJS

This package is part of the [EreoJS monorepo](https://github.com/anthropics/ereo-js).

## License

MIT
