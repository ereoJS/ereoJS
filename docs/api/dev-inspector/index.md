# @ereo/dev-inspector

Visual development tools and route inspector for EreoJS applications. Provides real-time insights into routes, data loading, islands, and caching during development.

## Import

```ts
// Core functions
import {
  createDevInspector,
  createDevToolsPlugin,
  generateInspectorHTML,
  createRouteInfo,
  formatRouteTree,
} from '@ereo/dev-inspector'

// DevTools tab components and generators
import {
  DevToolsPanel,
  generateDevToolsPanelHTML,
  DataPipelineTab,
  generateDataPipelineHTML,
  RoutesTab,
  generateRoutesTabHTML,
  IslandsTab,
  generateIslandsTabHTML,
  CacheTab,
  generateCacheTabHTML,
} from '@ereo/dev-inspector'

// Types
import type {
  InspectorConfig,
  RouteInfo,
  DevToolsConfig,
  DevToolsPanelData,
  DataPipelineVisualization,
  LoaderTiming,
  IslandVisualization,
  CacheVisualization,
  CacheEntry,
  RouteVisualization,
  HMREvent,
} from '@ereo/dev-inspector'

// WaterfallInfo is defined in @ereo/data (used by DataPipelineVisualization)
import type { WaterfallInfo } from '@ereo/data'
```

## Overview

The `@ereo/dev-inspector` package provides two main features:

1. **Route Inspector** - A simple route visualization tool mounted at a configurable path (default: `/__ereo`)
2. **DevTools Panel** - A comprehensive browser-based developer panel with five tabs for routes, data pipeline, islands, cache, and HMR visualization (default: `/__devtools`)

## Enabling the Inspector

### Route Inspector Setup

```ts
import { createApp } from '@ereo/core'
import { createDevInspector } from '@ereo/dev-inspector'

const app = createApp()

if (process.env.NODE_ENV === 'development') {
  app.use(createDevInspector())
}
```

Access at `http://localhost:3000/__ereo`

### Custom Mount Path

```ts
app.use(createDevInspector({
  mountPath: '/__routes'
}))
```

### Full DevTools Panel

```ts
import { createApp } from '@ereo/core'
import { createDevToolsPlugin } from '@ereo/dev-inspector'

const app = createApp()

if (process.env.NODE_ENV === 'development') {
  app.use(createDevToolsPlugin({
    mountPath: '/__devtools',
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
  /** Path to mount inspector (default: '/__ereo') */
  mountPath?: string

  /** Enable route testing (reserved - not currently implemented) */
  enableTesting?: boolean

  /** Show loader data (reserved - not currently implemented) */
  showLoaderData?: boolean
}
```

**Note**: Only `mountPath` is currently functional. The `enableTesting` and `showLoaderData` options are defined for future implementation.

#### Plugin Behavior

The plugin:
1. Registers a server middleware
2. Serves HTML UI at the mount path
3. Exposes a JSON API at `{mountPath}/api/routes`
4. Logs the mount path to console on startup

### createDevToolsPlugin

Creates the full DevTools panel plugin with all visualization features.

#### Signature

```ts
function createDevToolsPlugin(config?: DevToolsConfig): Plugin
```

#### Configuration

```ts
interface DevToolsConfig {
  /** Mount path for DevTools panel (default: '/__devtools') */
  mountPath?: string

  /** Enable data pipeline visualization (default: true) */
  dataPipeline?: boolean

  /** Enable routes visualization (default: true) */
  routes?: boolean

  /** Enable islands visualization (default: true) */
  islands?: boolean

  /** Enable cache visualization (default: true) */
  cache?: boolean

  /** Position of overlay toggle button (default: 'bottom-right') */
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

#### Plugin Behavior

The plugin:
1. Uses `transformRoutes` hook to collect route information
2. Registers server middleware for DevTools endpoints
3. Injects an overlay script into HTML responses
4. Stores up to 100 pipeline metrics and HMR events
5. Provides real-time metrics collection from route context

## Features and Capabilities

### Route Inspector (/__ereo)

The route inspector displays all registered routes with:

| Feature | Description |
|---------|-------------|
| Route path | The URL pattern |
| Render mode | Badge showing SSR, SSG, CSR, API, or RSC |
| File location | Source file for the route |
| Feature tags | Loaders, actions, island counts, auth |
| Statistics | Total routes, SSR count, SSG count, API count |
| Search | Filter routes by path (case-insensitive) |

### DevTools Panel Tabs

#### 1. Data Pipeline Tab

The flagship feature for visualizing data loading performance:

| Feature | Description |
|---------|-------------|
| Loader timeline | Visual bars showing when each loader runs |
| Parallel efficiency | Score (0-100%) indicating parallelization |
| Waterfall detection | Identifies unnecessary sequential patterns |
| Cache indicators | Shows cache hits vs fresh loads |
| Source icons | Database, API, Cache, or Compute sources |
| Total time | Combined request duration |

**Efficiency Score Thresholds:**
- Excellent (green): >= 80%
- Good (blue): >= 50%
- Fair (yellow): >= 30%
- Poor (red): < 30%

**Source Type Icons:**
- Database: Storage icon
- API: Globe icon
- Cache: Lightning bolt
- Compute: Gear icon

#### 2. Routes Tab

Interactive route exploration:

| Feature | Description |
|---------|-------------|
| Route list | All routes sorted alphabetically |
| Search input | Filter routes by path |
| Filter buttons | Quick filter by render mode (All, SSR, SSG, API) |
| Feature tags | Loader, action, islands, auth, middleware counts |
| Timing display | Last request timing per route |

#### 3. Islands Tab

Component hydration visualization:

| Feature | Description |
|---------|-------------|
| Island list | All hydrated islands on the page |
| Hydration status | Hydrated or Pending indicator |
| Strategy breakdown | Count by strategy (load, idle, visible, media) |
| Props size | Data size passed to each island |
| Hydration time | Time to hydrate (when available) |
| Actions | Inspect, Scroll to island |

**Hydration Strategies:**
- **load** - Hydrate immediately on page load
- **idle** - Hydrate during browser idle time
- **visible** - Hydrate when scrolled into view
- **media** - Hydrate based on media query match
- **none** - Do not hydrate (static)

#### 4. Cache Tab

Cache state and performance metrics:

| Feature | Description |
|---------|-------------|
| Entry count | Total cached items |
| Total size | Memory usage (formatted as B/KB/MB) |
| Hit rate | Overall cache effectiveness (0-100%) |
| Entries view | List of cache keys with tags, size, TTL, hits |
| Tags view | Statistics grouped by cache tag |
| Actions | Invalidate by key, Invalidate by tag |

**Hit Rate Color Coding:**
- Excellent (green): >= 80%
- Good (blue): >= 50%
- Fair (yellow): >= 20%
- Poor (red): < 20%

**TTL Status Indicators:**
- Expired: Red
- Expiring Soon (< 60 seconds): Yellow
- Healthy: Green

#### 5. HMR Tab

Hot Module Replacement event history:

| Feature | Description |
|---------|-------------|
| Event list | Last 50 HMR events (stores up to 100) |
| Connection status | Shows if HMR is connected |
| Event types | full-reload, css-update, island-update, loader-update, component-update |
| File path | Which file triggered the update |
| Duration | Time to apply the update |
| Timestamp | When the event occurred |

**Event Type Indicators:**
- Full Reload: Orange border
- CSS Update: Green border
- Island Update: Blue border
- Loader Update: Purple border
- Component Update: Pink border

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

### Recording Pipeline Metrics

```ts
// POST to /__devtools/api/pipeline/record
fetch('/__devtools/api/pipeline/record', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    route: '/posts/123',
    totalTime: 45.2,
    loaders: [
      {
        key: 'getPost',
        start: 0,
        end: 20,
        duration: 20,
        cacheHit: false,
        source: 'db',
        waitingFor: []
      }
    ],
    efficiency: 0.85,
    waterfalls: [],
    timestamp: Date.now()
  })
})
```

## Utility Functions

### generateInspectorHTML

Generates the standalone route inspector HTML page.

```ts
import { generateInspectorHTML } from '@ereo/dev-inspector'

const html = generateInspectorHTML([
  {
    id: 'home',
    path: '/',
    file: 'app/routes/index.tsx',
    renderMode: 'ssr',
    islandCount: 2,
    hasLoader: true,
    hasAction: false,
    middlewareCount: 0,
    authRequired: false
  }
])
```

### createRouteInfo

Transforms framework routes into inspector-friendly format.

```ts
import { createRouteInfo } from '@ereo/dev-inspector'

const routes = router.getRoutes()
const routeInfo = createRouteInfo(routes)
```

#### RouteInfo Interface

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

Formats routes for CLI display with icons.

```ts
import { formatRouteTree, createRouteInfo } from '@ereo/dev-inspector'

const routes = router.getRoutes()
const routeInfo = createRouteInfo(routes)
console.log(formatRouteTree(routeInfo))
```

**Output:**
```
Route Tree:

  ⚡ / [loader]
     → app/routes/index.tsx
  📄 /about
     → app/routes/about.ssg.tsx
  🔌 /api/posts [loader, action]
     → app/routes/api/posts.api.ts
  🚀 /dashboard [auth, 3 islands]
     → app/routes/dashboard.tsx
```

**Render Mode Icons:**
| Icon | Mode |
|------|------|
| ⚡ | SSR |
| 📄 | SSG |
| 💻 | CSR |
| 🔌 | API |
| 🚀 | RSC |
| • | Unknown |

### generateDevToolsPanelHTML

Generates the complete DevTools panel HTML.

```ts
import { generateDevToolsPanelHTML } from '@ereo/dev-inspector'
import type { DevToolsPanelData } from '@ereo/dev-inspector'

const data: DevToolsPanelData = {
  pipeline: { /* DataPipelineVisualization */ },
  routes: [/* RouteVisualization[] */],
  islands: [/* IslandVisualization[] */],
  cache: { /* CacheVisualization */ },
  hmrEvents: [/* HMREvent[] */]
}

const html = generateDevToolsPanelHTML(data)
```

### Tab-Specific HTML Generators

For generating individual tab content:

```ts
import {
  generateDataPipelineHTML,
  generateRoutesTabHTML,
  generateIslandsTabHTML,
  generateCacheTabHTML
} from '@ereo/dev-inspector'

// Each returns HTML string for that specific tab
const pipelineHtml = generateDataPipelineHTML(pipelineData)
const routesHtml = generateRoutesTabHTML(routesList)
const islandsHtml = generateIslandsTabHTML(islandsList)
const cacheHtml = generateCacheTabHTML(cacheData)
```

## Type Definitions

### DevToolsPanelData

```ts
interface DevToolsPanelData {
  pipeline?: DataPipelineVisualization
  routes: RouteVisualization[]
  islands: IslandVisualization[]
  cache: CacheVisualization
  hmrEvents: HMREvent[]
}
```

### DataPipelineVisualization

```ts
interface DataPipelineVisualization {
  /** Route path */
  route: string
  /** Total execution time (ms) */
  totalTime: number
  /** Individual loader timings */
  loaders: LoaderTiming[]
  /** Parallel efficiency score (0-1) */
  efficiency: number
  /** Detected waterfalls */
  waterfalls: WaterfallInfo[]
  /** Timestamp of request */
  timestamp: number
}
```

### LoaderTiming

```ts
interface LoaderTiming {
  /** Loader key/name */
  key: string
  /** Start time relative to request start (ms) */
  start: number
  /** End time relative to request start (ms) */
  end: number
  /** Duration (ms) */
  duration: number
  /** Whether result came from cache */
  cacheHit: boolean
  /** Data source type */
  source: 'db' | 'api' | 'cache' | 'compute' | 'unknown'
  /** Loaders this was waiting for */
  waitingFor: string[]
  /** Data size in bytes (if available) */
  size?: number
}
```

### WaterfallInfo

This type is imported from `@ereo/data` and used by `DataPipelineVisualization` to describe detected waterfall patterns in your data loading.

```ts
// From @ereo/data
interface WaterfallInfo {
  /** The loader that waited */
  loader: string
  /** The loaders it waited for */
  waitedFor: string[]
  /** Whether the wait was necessary (e.g., the loader depends on data from the waited-for loaders) */
  necessary: boolean
  /** Suggestion for optimization (when the wait is unnecessary) */
  suggestion?: string
}
```

### RouteVisualization

```ts
interface RouteVisualization {
  /** Route path */
  path: string
  /** Route file */
  file: string
  /** Render mode */
  renderMode: 'ssr' | 'ssg' | 'csr' | 'api' | 'rsc'
  /** Has loader */
  hasLoader: boolean
  /** Has action */
  hasAction: boolean
  /** Middleware chain */
  middleware: string[]
  /** Island count */
  islandCount: number
  /** Cache tags */
  cacheTags: string[]
  /** Auth required */
  authRequired: boolean
  /** Last request timing (ms) */
  lastTiming?: number
}
```

### IslandVisualization

```ts
interface IslandVisualization {
  /** Island ID */
  id: string
  /** Component name */
  component: string
  /** Hydration strategy */
  strategy: 'load' | 'idle' | 'visible' | 'media' | 'none'
  /** Media query (if strategy is 'media') */
  mediaQuery?: string
  /** Whether island is currently hydrated */
  hydrated: boolean
  /** Time to hydration (ms) */
  hydrationTime?: number
  /** Props size in bytes */
  propsSize: number
  /** DOM element selector */
  selector: string
}
```

### CacheVisualization

```ts
interface CacheVisualization {
  /** Cache entries */
  entries: CacheEntry[]
  /** Total cache size (bytes) */
  totalSize: number
  /** Hit rate (0-1) */
  hitRate: number
  /** Cache stats by tag */
  tagStats: Map<string, { count: number; hits: number; misses: number }>
}
```

### CacheEntry

```ts
interface CacheEntry {
  /** Cache key */
  key: string
  /** Associated tags */
  tags: string[]
  /** Entry size in bytes */
  size: number
  /** Time to live remaining (ms) */
  ttl: number
  /** Created timestamp */
  created: number
  /** Last accessed timestamp */
  lastAccessed: number
  /** Access count */
  accessCount: number
}
```

### HMREvent

```ts
interface HMREvent {
  /** Event type */
  type: 'full-reload' | 'css-update' | 'island-update' | 'loader-update' | 'component-update'
  /** File path */
  path: string
  /** Reason for update type */
  reason?: string
  /** Timestamp */
  timestamp: number
  /** Duration (ms) */
  duration?: number
}
```

## Client-Side API

When the DevTools panel is open, it exposes a global API:

```ts
window.__EREO_DEVTOOLS__ = {
  refresh(): void           // Reload DevTools panel
  togglePosition(): void    // Toggle panel position
  close(): void             // Close DevTools panel
  highlightIslands(): void  // Highlight all islands on page
  hydrateAll(): void        // Force hydrate all islands (reserved)
  scrollToIsland(id): void  // Scroll to specific island
  inspectIsland(id): void   // Inspect island details (reserved)
  inspectEntry(key): void   // Inspect cache entry (reserved)
  clearCache(): void        // Clear all cache (reserved)
  refreshCache(): void      // Refresh cache view (reserved)
  invalidateKey(key): void  // Invalidate cache by key (reserved)
  invalidateTag(tag): void  // Invalidate cache by tag (reserved)
}
```

**Note**: Functions marked as "reserved" send messages but handlers are not fully implemented. They are reserved for future functionality.

## Overlay Functionality

The DevTools overlay supports these interactive features via `postMessage`:

| Message Type | Description |
|--------------|-------------|
| `ereo-devtools-close` | Close the DevTools panel |
| `ereo-devtools-toggle-position` | Toggle panel position |
| `ereo-devtools-highlight-islands` | Highlight all `[data-island]` elements for 3 seconds |
| `ereo-devtools-scroll-to-island` | Scroll to and highlight a specific island |

## Integration Details

### Pipeline Metrics Collection

The DevTools plugin automatically collects pipeline metrics when available in the request context:

```ts
// The plugin reads from context:
const metrics = context.get<PipelineMetrics>('__pipeline_metrics')
```

This integrates with `@ereo/data` package which sets these metrics during loader execution.

### History Limits

- Pipeline metrics: Stores last 100 requests
- HMR events: Stores last 100 events
- Cache entries display: Shows top 50 by last accessed time
- HMR events display: Shows last 50 events

### Overlay Specifications

- Button size: 48x48 pixels
- Panel height: 400px (fixed)
- Panel position: Docked to bottom of viewport
- Z-index: Button 99998, Panel 99999

## Performance Considerations

The DevTools plugin adds minimal overhead in development:

- Route transformation runs once at startup via `transformRoutes` hook
- Pipeline metrics are collected passively from context
- The overlay script is approximately 2KB
- API endpoints only process data when called
- HTML responses are only modified when `dataPipeline`, `islands`, or `cache` options are enabled

**Production Recommendation:**

```ts
import { createApp } from '@ereo/core'

const plugins = []

if (process.env.NODE_ENV === 'development') {
  const { createDevToolsPlugin } = await import('@ereo/dev-inspector')
  plugins.push(createDevToolsPlugin())
}

const app = createApp({ plugins })
```

## Troubleshooting

### DevTools Panel Not Appearing

1. Verify the plugin is added to your config
2. Check the console for the mount path message: `DevTools available at /__devtools`
3. Ensure you're not in production mode
4. Check if another middleware is intercepting the route

### No Pipeline Data Showing

1. Navigate to a route that has loaders
2. Verify `@ereo/data` package is configured
3. Check that loaders are setting `__pipeline_metrics` in context

### Islands Not Detected

1. Ensure islands use `data-island` attribute
2. Check that the islands configuration is in route config
3. Verify the page has completed loading

### Routes Not Updating

1. The plugin collects routes via `transformRoutes` which runs at startup
2. Restart the dev server after adding new routes
3. Check that routes are properly registered with the router

## Related Packages

- [@ereo/core](/api/core/) - Core framework
- [@ereo/data](/api/data/) - Data loading and pipeline metrics
- [@ereo/client](/api/client/) - Client-side islands hydration
- [@ereo/cache](/api/core/cache) - Caching system
