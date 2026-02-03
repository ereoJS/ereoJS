# @ereo/bundler

Build system for the EreoJS framework. Includes Hot Module Replacement (HMR), production builds, and a comprehensive plugin system.

## Installation

```bash
bun add @ereo/bundler
```

## Overview

The `@ereo/bundler` package provides:

- **HMR Server** - Sub-100ms hot module replacement for development
- **Production Build** - Optimized builds using Bun's bundler with code splitting
- **Plugin System** - Extensible architecture for islands, types, and Tailwind CSS
- **Error Overlay** - Development error display with source mapping

## Import

```ts
import {
  // HMR
  HMRServer,
  HMRWatcher,
  createHMRServer,
  createHMRWatcher,
  createHMRWebSocket,
  HMR_CLIENT_CODE,

  // Error Overlay
  parseError,
  generateErrorOverlayHTML,
  createErrorResponse,
  createErrorJSON,
  ERROR_OVERLAY_SCRIPT,

  // Production Build
  build,
  formatSize,
  printBuildReport,
  analyzeBuild,

  // Type Generation Plugin
  extractParams,
  generateRouteTypes,
  writeRouteTypes,
  createTypesPlugin,
  generateLinkTypes,
  generateHookTypes,

  // Islands Plugin
  extractIslands,
  transformIslandJSX,
  generateIslandManifest,
  generateIslandEntry,
  createIslandsPlugin,
  findIslandByName,
  hasIslands,

  // Tailwind Plugin
  createTailwindPlugin,
  generateTailwindConfig,
  generateCSSEntry,
  hasTailwindConfig,
  tailwindMiddleware,
  extractTailwindClasses,
  generateSafelist,
} from '@ereo/bundler'
```

---

## Hot Module Replacement (HMR)

The HMR system provides granular updates during development, enabling sub-100ms refresh times for most changes.

### HMRServer

Manages WebSocket connections and broadcasts updates to connected clients.

```ts
import { createHMRServer, createHMRWebSocket } from '@ereo/bundler'

const hmr = createHMRServer()

// Use with Bun.serve
Bun.serve({
  port: 3000,
  fetch(request, server) {
    // Upgrade HMR connections
    if (request.url.endsWith('/__hmr')) {
      server.upgrade(request)
      return
    }
    // Handle other requests...
  },
  websocket: createHMRWebSocket(hmr),
})
```

#### HMRServer Methods

| Method | Description |
|--------|-------------|
| `handleConnection(ws)` | Handle new WebSocket connection |
| `handleClose(ws)` | Handle WebSocket close |
| `send(update)` | Send update to all connected clients |
| `reload(reason?)` | Trigger a full page reload |
| `cssUpdate(path)` | Notify of a CSS file update |
| `jsUpdate(path)` | Notify of a JS file update with granular analysis |
| `error(message, stack?)` | Send error to clients |
| `clearError()` | Clear the current error state |
| `getClientCount()` | Get number of connected clients |
| `registerModule(id, info)` | Register a module in the dependency graph |
| `canHotUpdate(moduleId)` | Check if module can be hot-updated |
| `getDependencyGraph()` | Get the dependency graph (for debugging) |

### HMRUpdate Type

```ts
interface HMRUpdate {
  type: HMRUpdateType
  path?: string
  timestamp: number
  error?: {
    message: string
    stack?: string
  }
  module?: {
    id: string
    exports?: string[]
    isIsland?: boolean
    isLoader?: boolean
    isAction?: boolean
    isComponent?: boolean
  }
  reason?: string
}

type HMRUpdateType =
  | 'full-reload'
  | 'css-update'
  | 'js-update'
  | 'island-update'
  | 'loader-update'
  | 'component-update'
  | 'error'
```

### HMRWatcher

File watcher that monitors project files and triggers appropriate HMR updates.

```ts
import { createHMRServer, createHMRWatcher } from '@ereo/bundler'

const hmr = createHMRServer()
const watcher = createHMRWatcher(hmr)

// Start watching
watcher.watch('./app')

// Stop watching
watcher.stop()
```

The watcher automatically:

- Debounces rapid file changes (50ms)
- Categorizes changes by type (CSS, JS, config)
- Triggers full reloads for config changes
- Sends granular updates for component changes
- Skips hidden files and node_modules

### HMR Client Code

Inject the HMR client script into development pages:

```ts
import { HMR_CLIENT_CODE } from '@ereo/bundler'

// In your HTML response
const html = `
  <!DOCTYPE html>
  <html>
    <body>
      <!-- Your app content -->
      <script>${HMR_CLIENT_CODE}</script>
    </body>
  </html>
`
```

The client script handles:

- WebSocket connection to `/__hmr`
- CSS hot updates (stylesheet reload)
- Island hot updates (component re-hydration)
- Loader updates (data refresh)
- Error overlay display
- Automatic reconnection

---

## Production Build

### build()

Builds the project for production with optimized bundles.

```ts
import { build } from '@ereo/bundler'

const result = await build({
  root: process.cwd(),
  outDir: '.ereo',
  minify: true,
  sourcemap: true,
  splitting: true,
  plugins: [],
})
```

#### BuildOptions

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `root` | `string` | `process.cwd()` | Project root directory |
| `outDir` | `string` | `.ereo` | Output directory |
| `minify` | `boolean` | `true` | Enable minification |
| `sourcemap` | `boolean` | `true` | Generate sourcemaps |
| `target` | `'bun' \| 'browser' \| 'node'` | - | Target runtime |
| `entrypoints` | `string[]` | - | Entry points |
| `external` | `string[]` | - | External packages |
| `splitting` | `boolean` | `true` | Enable code splitting |
| `plugins` | `Plugin[]` | `[]` | Plugins to use |
| `publicPath` | `string` | `'/_ereo/'` | Public path for assets |
| `assetExtensions` | `string[]` | Default extensions | Asset file extensions to copy |

#### BuildResult

```ts
interface BuildResult {
  success: boolean
  outputs: BuildOutput[]
  duration: number
  errors?: string[]
}

interface BuildOutput {
  path: string
  size: number
  type: 'js' | 'css' | 'asset' | 'map'
  hash?: string
  isEntry?: boolean
  exports?: string[]
}
```

### Output Directory Structure

```
.ereo/
├── server/
│   ├── index.js              # Server entry
│   ├── routes/               # Compiled route modules
│   │   ├── index.js
│   │   └── blog/[slug].js
│   └── chunks/               # Server shared chunks
├── client/
│   ├── index.js              # Client entry
│   ├── islands/              # Island bundles
│   │   ├── Counter-abc123.js
│   │   ├── SearchBox-def456.js
│   │   └── manifest.json
│   └── chunks/               # Client shared chunks
├── assets/
│   ├── styles.css            # Combined CSS
│   └── images/               # Copied static assets
└── manifest.json             # Build manifest
```

### Build Analysis

```ts
import { build, analyzeBuild, printBuildReport, formatSize } from '@ereo/bundler'

const result = await build()

// Print detailed report
printBuildReport(result)

// Get analysis
const analysis = analyzeBuild(result)
console.log(`Total JS: ${formatSize(analysis.jsSize)}`)
console.log(`Total CSS: ${formatSize(analysis.cssSize)}`)
console.log(`Recommendations:`, analysis.recommendations)
```

#### analyzeBuild() Returns

```ts
interface BuildAnalysis {
  totalSize: number
  jsSize: number
  cssSize: number
  assetSize: number
  largestFiles: BuildOutput[]
  recommendations: string[]
}
```

### formatSize()

Formats bytes to human-readable size:

```ts
formatSize(1024)        // "1.00 KB"
formatSize(1048576)     // "1.00 MB"
formatSize(512)         // "512 B"
```

---

## Dev vs Production Build Differences

| Feature | Development | Production |
|---------|-------------|------------|
| Minification | Disabled | Enabled |
| Source maps | Inline | External |
| HMR | Enabled | Disabled |
| Error overlay | Enabled | Disabled |
| CSS processing | On-demand | Pre-compiled |
| Code splitting | Minimal | Optimized |
| Tree shaking | Disabled | Enabled |

### Development Mode

```ts
import { createHMRServer, createHMRWatcher, HMR_CLIENT_CODE, ERROR_OVERLAY_SCRIPT } from '@ereo/bundler'

const hmr = createHMRServer()
const watcher = createHMRWatcher(hmr)
watcher.watch('./app')

// Inject dev scripts
const devScripts = `
  ${HMR_CLIENT_CODE}
  ${ERROR_OVERLAY_SCRIPT}
`
```

### Production Mode

```ts
import { build, analyzeBuild } from '@ereo/bundler'

const result = await build({
  minify: true,
  sourcemap: true,
  splitting: true,
})

if (!result.success) {
  console.error('Build failed:', result.errors)
  process.exit(1)
}

const analysis = analyzeBuild(result)
if (analysis.jsSize > 500 * 1024) {
  console.warn('Warning: Large bundle size detected')
}
```

---

## Plugin System

### Plugin Interface

Plugins hook into the build lifecycle:

```ts
interface Plugin {
  name: string
  setup?(context: PluginContext): Promise<void> | void
  transform?(code: string, id: string): Promise<string | null> | string | null
  resolveId?(id: string): string | null
  load?(id: string): Promise<string | null> | string | null
  transformRoutes?(routes: Route[]): Route[]
  buildStart?(): Promise<void> | void
  buildEnd?(): Promise<void> | void
  configureServer?(server: DevServer): Promise<void> | void
}

interface PluginContext {
  root: string
  mode: 'development' | 'production'
}
```

### Creating a Custom Plugin

```ts
import type { Plugin } from '@ereo/core'

function myPlugin(options = {}): Plugin {
  return {
    name: 'my-plugin',

    async setup(context) {
      console.log(`Plugin initialized in ${context.mode} mode`)
    },

    transform(code, id) {
      if (!id.endsWith('.tsx')) return null

      // Transform the code
      return code.replace(/console\.log/g, 'void')
    },

    async buildStart() {
      console.log('Build starting...')
    },

    async buildEnd() {
      console.log('Build complete!')
    },
  }
}
```

### Built-in Plugins

#### Types Plugin

Generates TypeScript type definitions for routes:

```ts
import { createTypesPlugin } from '@ereo/bundler'

const typesPlugin = createTypesPlugin({
  outDir: '.ereo',
  routesDir: 'app/routes',
  inferTypes: true,
  watch: false,
})
```

Generates type-safe route definitions:

```ts
// .ereo/routes.d.ts
declare module '@ereo/core' {
  export interface RouteTypes {
    '/': {
      params: Record<string, never>
      loader: { posts: Post[] }
      action: unknown
    }
    '/blog/[slug]': {
      params: { slug: string }
      loader: { post: Post; comments: Comment[] }
      action: { success: boolean }
    }
  }
}

export type RoutePath = '/' | '/blog/[slug]'
export type ParamsFor<T extends RoutePath> = RouteTypes[T]['params']
export type LoaderDataFor<T extends RoutePath> = RouteTypes[T]['loader']
```

#### Islands Plugin

Extracts and processes island components for selective hydration:

```ts
import { createIslandsPlugin } from '@ereo/bundler'

const islandsPlugin = createIslandsPlugin()
```

Island detection patterns:

```tsx
// Detected as island with 'use client' directive
'use client'
export default function Counter() { ... }

// Detected with client:* directives
<SearchBox client:load />
<Analytics client:idle />
<Comments client:visible />
<MobileNav client:media="(max-width: 768px)" />
```

#### Tailwind Plugin

Full Tailwind CSS integration with PostCSS processing:

```ts
import { createTailwindPlugin } from '@ereo/bundler'

const tailwindPlugin = createTailwindPlugin({
  content: ['./app/**/*.{js,ts,jsx,tsx}'],
  config: './tailwind.config.js',
  darkMode: 'class',
  minify: true,
  sourcemap: false,
  watch: true,
})
```

##### TailwindPluginOptions

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `content` | `string[]` | Default patterns | Content paths to scan |
| `config` | `string` | Auto-detected | Custom config path |
| `darkMode` | `'class' \| 'media' \| 'selector' \| false` | `'class'` | Dark mode strategy |
| `minify` | `boolean` | `true` in production | Minify CSS output |
| `sourcemap` | `boolean` | `true` in dev | Generate sourcemaps |
| `postcssPlugins` | `any[]` | `[]` | Additional PostCSS plugins |
| `watch` | `boolean` | `true` | Watch content files |

---

## Error Overlay

Development error display with source mapping and stack traces.

### parseError()

Parses errors into displayable info:

```ts
import { parseError } from '@ereo/bundler'

try {
  throw new Error('Something went wrong')
} catch (e) {
  const info = parseError(e)
  // {
  //   message: 'Something went wrong',
  //   stack: '...',
  //   type: 'runtime',
  //   source: { file: '...', line: 10, column: 5 }
  // }
}
```

### ErrorInfo Type

```ts
interface ErrorInfo {
  message: string
  stack?: string
  source?: {
    file: string
    line: number
    column: number
    code?: string
  }
  type: 'runtime' | 'build' | 'syntax' | 'type'
}
```

### createErrorResponse()

Creates an HTML error page response:

```ts
import { createErrorResponse } from '@ereo/bundler'

try {
  // Handle request
} catch (error) {
  return createErrorResponse(error)
}
```

### createErrorJSON()

Creates a JSON error response:

```ts
import { createErrorJSON } from '@ereo/bundler'

return createErrorJSON(error)
// Response with { message, stack, type, source }
```

### ERROR_OVERLAY_SCRIPT

Client-side script for displaying runtime errors:

```ts
import { ERROR_OVERLAY_SCRIPT } from '@ereo/bundler'

// Include in development HTML
const html = `
  <body>
    ${ERROR_OVERLAY_SCRIPT}
  </body>
`
```

Features:
- Catches unhandled errors and promise rejections
- Displays error message, source location, and stack trace
- Closeable with Escape key or close button
- Styled dark overlay with syntax highlighting

---

## Type Generation

### extractParams()

Extracts route parameters from a path:

```ts
import { extractParams } from '@ereo/bundler'

extractParams('/blog/[slug]')
// { slug: { type: 'string' } }

extractParams('/docs/[...path]')
// { path: { type: 'string[]' } }

extractParams('/users/[[id]]')
// { id: { type: 'string', optional: true } }
```

### generateRouteTypes()

Generates TypeScript type definitions:

```ts
import { generateRouteTypes } from '@ereo/bundler'

const types = generateRouteTypes(routes, {
  routesDir: 'app/routes',
  inferTypes: true,
})

await Bun.write('.ereo/routes.d.ts', types)
```

### generateLinkTypes()

Generates type-safe Link component props:

```ts
import { generateLinkTypes } from '@ereo/bundler'

const linkTypes = generateLinkTypes(routes)
await Bun.write('.ereo/link.d.ts', linkTypes)
```

### generateHookTypes()

Generates hook type declarations:

```ts
import { generateHookTypes } from '@ereo/bundler'

const hookTypes = generateHookTypes()
await Bun.write('.ereo/hooks.d.ts', hookTypes)
```

---

## Islands

### extractIslands()

Extracts island metadata from file content:

```ts
import { extractIslands } from '@ereo/bundler'

const content = await Bun.file('components/Counter.tsx').text()
const islands = extractIslands(content, 'components/Counter.tsx')
// [{ id: '...', name: 'Counter', file: '...', strategy: 'load', exports: ['Counter'] }]
```

### IslandMeta Type

```ts
interface IslandMeta {
  id: string
  name: string
  file: string
  strategy: 'load' | 'idle' | 'visible' | 'media' | 'none'
  media?: string
  exports: string[]
}
```

### hasIslands()

Checks if a file contains islands:

```ts
import { hasIslands } from '@ereo/bundler'

if (hasIslands(fileContent)) {
  const islands = extractIslands(fileContent, filePath)
}
```

### generateIslandManifest()

Generates JSON manifest for islands:

```ts
import { generateIslandManifest } from '@ereo/bundler'

const manifest = generateIslandManifest(islands)
await Bun.write('.ereo/islands.json', manifest)
```

### generateIslandEntry()

Generates the client entry for island hydration:

```ts
import { generateIslandEntry } from '@ereo/bundler'

const entry = generateIslandEntry(islands)
await Bun.write('.ereo/islands.entry.ts', entry)
```

Output:

```ts
import { registerIslandComponent, initializeIslands } from '@ereo/client'

import Island_Counter from './components/Counter.tsx'
import Island_SearchBox from './components/SearchBox.tsx'

registerIslandComponent('Counter', Island_Counter)
registerIslandComponent('SearchBox', Island_SearchBox)

initializeIslands()
```

---

## Tailwind Utilities

### hasTailwindConfig()

Checks if Tailwind is configured:

```ts
import { hasTailwindConfig } from '@ereo/bundler'

const hasTailwind = await hasTailwindConfig(process.cwd())
if (hasTailwind) {
  plugins.push(createTailwindPlugin())
}
```

### generateTailwindConfig()

Generates a Tailwind configuration file:

```ts
import { generateTailwindConfig } from '@ereo/bundler'

const config = generateTailwindConfig({
  content: ['./app/**/*.tsx'],
  darkMode: 'class',
})

await Bun.write('tailwind.config.js', config)
```

### generateCSSEntry()

Generates a CSS entry file with Tailwind directives:

```ts
import { generateCSSEntry } from '@ereo/bundler'

const css = generateCSSEntry()
await Bun.write('app/styles/global.css', css)
```

Output:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

/* Custom base/components/utilities layers... */
```

### tailwindMiddleware()

Standalone middleware for serving Tailwind CSS:

```ts
import { tailwindMiddleware } from '@ereo/bundler'

const middleware = tailwindMiddleware({
  config: './tailwind.config.js',
})

// Use in your server
app.use(middleware)

// Serves CSS at /__tailwind.css
```

### extractTailwindClasses()

Extracts Tailwind classes from content:

```ts
import { extractTailwindClasses } from '@ereo/bundler'

const classes = extractTailwindClasses(fileContent)
// ['flex', 'items-center', 'p-4', 'bg-blue-500', ...]
```

### generateSafelist()

Generates a safelist from content files:

```ts
import { generateSafelist } from '@ereo/bundler'

const safelist = await generateSafelist(process.cwd(), [
  './app/**/*.tsx',
  './components/**/*.tsx',
])
```

---

## Code Examples

### Complete Dev Server Setup

```ts
import {
  createHMRServer,
  createHMRWatcher,
  createHMRWebSocket,
  HMR_CLIENT_CODE,
  ERROR_OVERLAY_SCRIPT,
  createErrorResponse,
} from '@ereo/bundler'

const hmr = createHMRServer()
const watcher = createHMRWatcher(hmr)
watcher.watch('./app')

Bun.serve({
  port: 3000,
  fetch(request, server) {
    const url = new URL(request.url)

    // HMR WebSocket upgrade
    if (url.pathname === '/__hmr') {
      server.upgrade(request)
      return
    }

    try {
      // Your request handling...
      const html = renderPage()

      // Inject dev scripts
      const devHtml = html.replace(
        '</body>',
        `<script>${HMR_CLIENT_CODE}</script>${ERROR_OVERLAY_SCRIPT}</body>`
      )

      return new Response(devHtml, {
        headers: { 'Content-Type': 'text/html' },
      })
    } catch (error) {
      hmr.error(error.message, error.stack)
      return createErrorResponse(error)
    }
  },
  websocket: createHMRWebSocket(hmr),
})

console.log('Dev server running at http://localhost:3000')
```

### Production Build Script

```ts
import {
  build,
  analyzeBuild,
  printBuildReport,
  createTypesPlugin,
  createIslandsPlugin,
  createTailwindPlugin,
} from '@ereo/bundler'

async function buildApp() {
  console.log('Building for production...\n')

  const result = await build({
    root: process.cwd(),
    outDir: 'dist',
    minify: true,
    sourcemap: true,
    splitting: true,
    plugins: [
      createTypesPlugin({ outDir: 'dist' }),
      createIslandsPlugin(),
      createTailwindPlugin({ minify: true }),
    ],
  })

  printBuildReport(result)

  const analysis = analyzeBuild(result)

  if (analysis.recommendations.length > 0) {
    console.log('\nRecommendations:')
    for (const rec of analysis.recommendations) {
      console.log(`  - ${rec}`)
    }
  }

  if (!result.success) {
    process.exit(1)
  }
}

buildApp()
```

### Custom Plugin Example

```ts
import type { Plugin } from '@ereo/core'

function imageOptimizationPlugin(): Plugin {
  return {
    name: 'image-optimization',

    async buildStart() {
      console.log('Scanning for images to optimize...')
    },

    transform(code, id) {
      if (!id.match(/\.(png|jpg|jpeg|webp)$/)) return null

      // Transform image imports
      return code
    },

    async buildEnd() {
      console.log('Image optimization complete')
    },
  }
}

// Use in build
await build({
  plugins: [imageOptimizationPlugin()],
})
```

---

## Related

- [CLI Build Command](/api/cli/build)
- [CLI Dev Command](/api/cli/dev)
- [Plugins](/api/core/plugins)
- [Islands](/api/client/islands)
- [Tailwind Plugin](/api/plugins/tailwind)
