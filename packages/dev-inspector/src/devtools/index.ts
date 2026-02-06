/**
 * @ereo/dev-inspector - DevTools
 *
 * Browser DevTools panel for EreoJS framework.
 * Provides visibility into routes, data loading, islands, and cache.
 */

export { DataPipelineTab, generateDataPipelineHTML } from './DataPipelineTab';
export { RoutesTab, generateRoutesTabHTML } from './RoutesTab';
export { IslandsTab, generateIslandsTabHTML } from './IslandsTab';
export { CacheTab, generateCacheTabHTML } from './CacheTab';
export { DevToolsPanel, generateDevToolsPanelHTML } from './DevToolsPanel';
export { createDevToolsPlugin } from './plugin';

export type {
  DevToolsConfig,
  DataPipelineVisualization,
  LoaderTiming,
  IslandVisualization,
  CacheVisualization,
  CacheEntry,
  RouteVisualization,
  HMREvent,
} from './types';

export type { DevToolsPanelData } from './DevToolsPanel';
