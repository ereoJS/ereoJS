/**
 * @ereo/bundler
 *
 * Build system for the Ereo framework.
 * Includes HMR, production builds, and plugin system.
 */

// Dev - HMR
export {
  HMRServer,
  HMRWatcher,
  createHMRServer,
  createHMRWatcher,
  createHMRWebSocket,
  HMR_CLIENT_CODE,
} from './dev/hmr';

export type { HMRUpdate, HMRUpdateType } from './dev/hmr';

// Dev - Error Overlay
export {
  parseError,
  generateErrorOverlayHTML,
  createErrorResponse,
  createErrorJSON,
  ERROR_OVERLAY_SCRIPT,
} from './dev/error-overlay';

export type { ErrorInfo } from './dev/error-overlay';

// Production Build
export {
  build,
  formatSize,
  printBuildReport,
  analyzeBuild,
} from './prod/build';

export type { BuildOptions, BuildResult, BuildOutput } from './prod/build';

// Plugins - Types
export {
  extractParams,
  generateRouteTypes,
  writeRouteTypes,
  createTypesPlugin,
  generateLinkTypes,
  generateHookTypes,
} from './plugins/types';

export type { RouteTypeInfo } from './plugins/types';

// Plugins - Islands
export {
  extractIslands,
  transformIslandJSX,
  generateIslandManifest,
  generateIslandEntry,
  createIslandsPlugin,
  findIslandByName,
  hasIslands,
} from './plugins/islands';

export type { IslandMeta } from './plugins/islands';

// Plugins - Tailwind
export {
  createTailwindPlugin,
  generateTailwindConfig,
  generateCSSEntry,
  hasTailwindConfig,
  tailwindMiddleware,
  extractTailwindClasses,
  generateSafelist,
} from './plugins/tailwind';

export type { TailwindPluginOptions } from './plugins/tailwind';
