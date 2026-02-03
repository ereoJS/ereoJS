# @ereo/dev-inspector

Visual route inspector and DevTools for EreoJS framework development. Provides comprehensive UI for exploring routes, data pipelines, islands, and cache during development.

## Installation

```bash
bun add -D @ereo/dev-inspector
```

## Quick Start

### Route Inspector Only

```typescript
import { createDevInspector } from '@ereo/dev-inspector';
import { defineConfig } from '@ereo/core';

export default defineConfig({
  plugins: [
    createDevInspector({
      mountPath: '/__ereo', // default
    }),
  ],
});
```

Visit `http://localhost:3000/__ereo` to open the route inspector.

### Full DevTools Panel

```typescript
import { createDevToolsPlugin } from '@ereo/dev-inspector';
import { defineConfig } from '@ereo/core';

export default defineConfig({
  plugins: [
    createDevToolsPlugin({
      mountPath: '/__devtools',
      dataPipeline: true,
      routes: true,
      islands: true,
      cache: true,
      position: 'bottom-right',
    }),
  ],
});
```

A floating button appears on your page. Click it to open the DevTools panel.

## Features

### Route Inspector

Visual interface for exploring routes at `/__ereo`:

- Route paths with file locations
- Render mode badges (SSR, SSG, CSR, API, RSC)
- Feature tags (loader, action, islands count, auth)
- Search filtering by path
- Statistics cards (total, SSR, SSG, API counts)

### DevTools Panel

Comprehensive development panel with five tabs:

1. **Data Pipeline** - Loader timeline visualization with waterfall detection
2. **Routes** - Route list with filtering by render mode
3. **Islands** - Hydration status and strategy breakdown
4. **Cache** - Cache entries, tags, TTL, and hit rates
5. **HMR** - Hot Module Replacement event history

## API Reference

### createDevInspector(config?)

Creates the route inspector plugin.

```typescript
interface InspectorConfig {
  /** Path to mount inspector (default: '/__ereo') */
  mountPath?: string;
  /** Enable route testing (reserved for future use) */
  enableTesting?: boolean;
  /** Show loader data (reserved for future use) */
  showLoaderData?: boolean;
}
```

**Note**: Currently only `mountPath` is functional. Other options are reserved for future implementation.

### createDevToolsPlugin(config?)

Creates the full DevTools panel plugin.

```typescript
interface DevToolsConfig {
  /** Mount path for DevTools panel (default: '/__devtools') */
  mountPath?: string;
  /** Enable data pipeline visualization (default: true) */
  dataPipeline?: boolean;
  /** Enable routes visualization (default: true) */
  routes?: boolean;
  /** Enable islands visualization (default: true) */
  islands?: boolean;
  /** Enable cache visualization (default: true) */
  cache?: boolean;
  /** Position of overlay button (default: 'bottom-right') */
  position?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
}
```

### Utility Functions

```typescript
// Generate inspector HTML from route info
generateInspectorHTML(routes: RouteInfo[]): string

// Convert framework routes to RouteInfo format
createRouteInfo(routes: Route[]): RouteInfo[]

// Format routes as CLI tree output
formatRouteTree(routes: RouteInfo[]): string

// DevTools HTML generators
generateDevToolsPanelHTML(data: DevToolsPanelData): string
generateDataPipelineHTML(data: DataPipelineVisualization): string
generateRoutesTabHTML(routes: RouteVisualization[]): string
generateIslandsTabHTML(islands: IslandVisualization[]): string
generateCacheTabHTML(cache: CacheVisualization): string
```

## Type Exports

```typescript
export type {
  InspectorConfig,
  RouteInfo,
  DevToolsConfig,
  DataPipelineVisualization,
  IslandVisualization,
  CacheVisualization,
  HMREvent,
  LoaderTiming,
  CacheEntry,
} from '@ereo/dev-inspector';
```

## CLI Output Example

```typescript
import { createRouteInfo, formatRouteTree } from '@ereo/dev-inspector';

const routes = router.getRoutes();
const info = createRouteInfo(routes);
console.log(formatRouteTree(info));

// Output:
// Route Tree:
//
//   ⚡ / [loader]
//      → src/routes/index.tsx
//   📄 /about
//      → src/routes/about.ssg.tsx
//   🔌 /api/posts [loader, action]
//      → src/routes/api/posts.api.ts
```

Render mode icons:
- ⚡ SSR (Server-Side Rendering)
- 📄 SSG (Static Site Generation)
- 💻 CSR (Client-Side Rendering)
- 🔌 API
- 🚀 RSC (React Server Components)
- • Unknown/Custom

## Production Usage

Exclude DevTools from production builds:

```typescript
const plugins = [];

if (process.env.NODE_ENV === 'development') {
  const { createDevToolsPlugin } = await import('@ereo/dev-inspector');
  plugins.push(createDevToolsPlugin());
}

const app = createApp({ plugins });
```

## API Endpoints

The DevTools plugin exposes the following HTTP endpoints:

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/__devtools` | GET | DevTools panel HTML |
| `/__devtools/api/routes` | GET | JSON array of route data |
| `/__devtools/api/pipeline` | GET | JSON array of pipeline metrics history |
| `/__devtools/api/hmr` | GET | JSON array of HMR events |
| `/__devtools/api/pipeline/record` | POST | Record custom pipeline metrics |

The Route Inspector exposes:

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/__ereo` | GET | Route inspector HTML |
| `/__ereo/api/routes` | GET | JSON array of routes |

## Documentation

For full documentation, visit [https://ereo.dev/docs/dev-inspector](https://ereo.dev/docs/dev-inspector)

## Part of EreoJS

This package is part of the [EreoJS monorepo](https://github.com/anthropics/ereo-js).

## License

MIT
