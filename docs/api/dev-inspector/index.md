# @ereo/dev-inspector

Visual development tools and route inspector for EreoJS applications. Provides real-time insights into routes, data loading, islands, and caching during development.

## Import

```ts
import {
  createDevInspector,
  createDevToolsPlugin,
  generateInspectorHTML,
  createRouteInfo,
  formatRouteTree
} from '@ereo/dev-inspector'
```

## Overview

The `@ereo/dev-inspector` package provides two main features:

1. **Route Inspector** - A simple route visualization tool mounted at a configurable path
2. **DevTools Panel** - A comprehensive browser-based developer panel with tabs for routes, data pipeline, islands, and cache visualization

## Enabling the Inspector

### Basic Setup

```ts
import { createApp } from '@ereo/core'
import { createDevInspector } from '@ereo/dev-inspector'

const app = createApp()

// Only enable in development
if (process.env.NODE_ENV === 'development') {
  app.use(createDevInspector())
}
```

### With Custom Mount Path

```ts
app.use(createDevInspector({
  mountPath: '/__routes'  // Default: '/__ereo'
}))
```

### Full DevTools Panel

For the complete development experience with all visualization features:

```ts
import { createApp } from '@ereo/core'
import { createDevToolsPlugin } from '@ereo/dev-inspector'

const app = createApp()

if (process.env.NODE_ENV === 'development') {
  app.use(createDevToolsPlugin({
    dataPipeline: true,
    routes: true,
    islands: true,
    cache: true,
    position: 'bottom-right'
  }))
}
```

## API Reference

### createDevInspector

Creates a simple route inspector plugin.

#### Signature

```ts
function createDevInspector(config?: InspectorConfig): Plugin
```

#### Configuration

```ts
interface InspectorConfig {
  // Path to mount inspector (default: '/__ereo')
  mountPath?: string

  // Enable route testing
  enableTesting?: boolean

  // Show loader data
  showLoaderData?: boolean
}
```

### createDevToolsPlugin

Creates the full DevTools panel plugin with all visualization features.

#### Signature

```ts
function createDevToolsPlugin(config?: DevToolsConfig): Plugin
```

#### Configuration

```ts
interface DevToolsConfig {
  // Mount path for DevTools panel (default: '/__devtools')
  mountPath?: string

  // Enable data pipeline visualization
  dataPipeline?: boolean

  // Enable routes visualization
  routes?: boolean

  // Enable islands visualization
  islands?: boolean

  // Enable cache visualization
  cache?: boolean

  // Position of overlay toggle button
  position?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left'
}
```

#### Example

```ts
import { createDevToolsPlugin } from '@ereo/dev-inspector'

const devTools = createDevToolsPlugin({
  mountPath: '/__devtools',
  dataPipeline: true,
  routes: true,
  islands: true,
  cache: true,
  position: 'bottom-right'
})
```

## Features and Capabilities

### Route Inspector

The route inspector displays all registered routes with their configuration:

- **Route path** - The URL pattern
- **Render mode** - SSR, SSG, CSR, API, or RSC
- **File location** - Source file for the route
- **Features** - Loaders, actions, islands, auth requirements
- **Search** - Filter routes by path

Access the inspector by navigating to the mount path (default: `/__ereo`).

### Data Pipeline Tab

Visualizes data loading performance:

- **Loader timeline** - See when each loader starts and completes
- **Parallel efficiency** - Score indicating how well loaders are parallelized
- **Waterfall detection** - Identifies sequential loading patterns that could be optimized
- **Cache hits** - Shows which data came from cache vs fresh loads
- **Request history** - Browse previous requests and their metrics

### Routes Tab

Comprehensive route information:

- **Route tree** - Hierarchical view of all routes
- **Configuration** - Render mode, middleware, auth requirements
- **Timing data** - Last request timing for each route
- **Quick navigation** - Click to navigate to any route

### Islands Tab

Interactive component visualization:

- **Island list** - All hydrated islands on the current page
- **Hydration status** - Whether each island is hydrated
- **Strategy** - Load, idle, visible, or media query
- **Props size** - Data size passed to each island
- **Highlight** - Visually highlight islands on the page
- **Scroll to** - Navigate to specific islands

### Cache Tab

Cache state and performance:

- **Cache entries** - All cached data with keys and tags
- **TTL remaining** - Time until cache expiration
- **Hit rate** - Overall cache effectiveness
- **Tag statistics** - Performance by cache tag
- **Size metrics** - Total cache memory usage

## Usage Guide

### Opening DevTools

When the DevTools plugin is enabled, a floating button appears in the configured position (default: bottom-right corner). Click the button to open the DevTools panel.

Keyboard shortcut: Press `Ctrl+Shift+D` (or `Cmd+Shift+D` on Mac) to toggle DevTools.

### Using the Route Inspector

1. Navigate to `/__ereo` (or your configured mount path)
2. View the route tree showing all registered routes
3. Use the search box to filter routes
4. Click on a route to see detailed information

### Interpreting Data Pipeline Metrics

The data pipeline visualization shows:

```
Route: /posts/[id]
Total Time: 45ms
Efficiency: 0.85

Loaders:
|-- getPost --------|  (20ms, cache miss)
     |-- getAuthor -|  (15ms, cache hit)
     |-- getComments|  (25ms, cache miss)

Waterfalls Detected: 1
  - getAuthor depends on getPost
```

A high efficiency score (close to 1.0) indicates good parallelization. Waterfalls show opportunities for optimization.

### Highlighting Islands

In the Islands tab:

1. Click "Highlight All" to outline all islands on the page
2. Click on a specific island to scroll to it and highlight it
3. View hydration timing to identify slow-loading components

## API Endpoints

The DevTools plugin exposes several API endpoints:

| Endpoint | Description |
|----------|-------------|
| `GET /__devtools` | DevTools panel HTML |
| `GET /__devtools/api/routes` | JSON route data |
| `GET /__devtools/api/pipeline` | Pipeline metrics history |
| `GET /__devtools/api/hmr` | HMR event history |
| `POST /__devtools/api/pipeline/record` | Record pipeline metrics |

## Utility Functions

### generateInspectorHTML

Generates the route inspector HTML.

```ts
import { generateInspectorHTML, createRouteInfo } from '@ereo/dev-inspector'

const routes = router.getRoutes()
const routeInfo = createRouteInfo(routes)
const html = generateInspectorHTML(routeInfo)
```

### createRouteInfo

Transforms routes into inspector-friendly format.

```ts
interface RouteInfo {
  id: string
  path: string
  file: string
  renderMode: string
  islandCount: number
  hasLoader: boolean
  hasAction: boolean
  middlewareCount: number
  cacheTags?: string[]
  authRequired?: boolean
}
```

### formatRouteTree

Formats routes for CLI display.

```ts
import { formatRouteTree, createRouteInfo } from '@ereo/dev-inspector'

const routes = router.getRoutes()
const routeInfo = createRouteInfo(routes)
console.log(formatRouteTree(routeInfo))

// Output:
// Route Tree:
//
//   ⚡ /                 [loader]
//      → src/routes/index.tsx
//   📄 /about
//      → src/routes/about.ssg.tsx
//   🔌 /api/posts       [loader, action]
//      → src/routes/api/posts.api.tsx
```

## Customization

### Custom Panel Styling

The DevTools panel uses CSS custom properties for styling:

```css
:root {
  --ereo-devtools-bg: #0f172a;
  --ereo-devtools-text: #e2e8f0;
  --ereo-devtools-border: #334155;
  --ereo-devtools-primary: #3b82f6;
  --ereo-devtools-accent: #8b5cf6;
}
```

### Extending DevTools

You can add custom data to the DevTools panel by using the context:

```ts
// In a loader or middleware
export async function loader({ context }) {
  const startTime = performance.now()
  const data = await fetchData()

  // Add custom metrics
  context.set('__custom_metrics', {
    fetchTime: performance.now() - startTime,
    dataSize: JSON.stringify(data).length
  })

  return data
}
```

## Type Definitions

### DataPipelineVisualization

```ts
interface DataPipelineVisualization {
  route: string
  totalTime: number
  loaders: LoaderTiming[]
  efficiency: number
  waterfalls: WaterfallInfo[]
  timestamp: number
}
```

### IslandVisualization

```ts
interface IslandVisualization {
  id: string
  component: string
  strategy: 'load' | 'idle' | 'visible' | 'media' | 'none'
  mediaQuery?: string
  hydrated: boolean
  hydrationTime?: number
  propsSize: number
  selector: string
}
```

### CacheVisualization

```ts
interface CacheVisualization {
  entries: CacheEntry[]
  totalSize: number
  hitRate: number
  tagStats: Map<string, { count: number; hits: number; misses: number }>
}
```

## Performance Considerations

The DevTools plugin adds minimal overhead in development:

- Route transformation is done once at startup
- Pipeline metrics are collected passively
- The overlay script is lightweight (~2KB)
- API endpoints are only called when DevTools is open

In production, the plugin should not be included:

```ts
import { createApp } from '@ereo/core'

const plugins = []

if (process.env.NODE_ENV === 'development') {
  const { createDevToolsPlugin } = await import('@ereo/dev-inspector')
  plugins.push(createDevToolsPlugin())
}

const app = createApp({ plugins })
```

## Related

- [Route Inspector CLI](/api/cli/dev)
- [Data Loaders](/api/data/loaders)
- [Islands](/api/client/islands)
- [Cache](/api/core/cache)
