/**
 * @oreo/dev-inspector - Main exports
 */

export {
  createDevInspector,
  generateInspectorHTML,
  createRouteInfo,
  formatRouteTree,
} from './inspector';

export type {
  InspectorConfig,
  RouteInfo,
} from './inspector';

// DevTools (FLAGSHIP FEATURE)
export {
  DataPipelineTab,
  generateDataPipelineHTML,
  RoutesTab,
  generateRoutesTabHTML,
  IslandsTab,
  generateIslandsTabHTML,
  CacheTab,
  generateCacheTabHTML,
  DevToolsPanel,
  generateDevToolsPanelHTML,
  createDevToolsPlugin,
} from './devtools';

export type {
  DevToolsConfig,
  DataPipelineVisualization,
  IslandVisualization,
  CacheVisualization,
} from './devtools';
