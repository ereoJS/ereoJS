/**
 * @oreo/dev-inspector - DevTools Types
 */

import type { PipelineMetrics, WaterfallInfo } from '@oreo/data';

/**
 * DevTools configuration.
 */
export interface DevToolsConfig {
  /** Mount path for DevTools panel (default: /__devtools) */
  mountPath?: string;
  /** Enable data pipeline visualization */
  dataPipeline?: boolean;
  /** Enable routes visualization */
  routes?: boolean;
  /** Enable islands visualization */
  islands?: boolean;
  /** Enable cache visualization */
  cache?: boolean;
  /** Position of overlay (default: bottom-right) */
  position?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
}

/**
 * Data pipeline visualization data.
 */
export interface DataPipelineVisualization {
  /** Route path */
  route: string;
  /** Total execution time */
  totalTime: number;
  /** Individual loader timings */
  loaders: LoaderTiming[];
  /** Parallel efficiency score (0-1) */
  efficiency: number;
  /** Detected waterfalls */
  waterfalls: WaterfallInfo[];
  /** Timestamp of request */
  timestamp: number;
}

/**
 * Individual loader timing data.
 */
export interface LoaderTiming {
  /** Loader key/name */
  key: string;
  /** Start time relative to request start (ms) */
  start: number;
  /** End time relative to request start (ms) */
  end: number;
  /** Duration (ms) */
  duration: number;
  /** Whether result came from cache */
  cacheHit: boolean;
  /** Data source type */
  source: 'db' | 'api' | 'cache' | 'compute' | 'unknown';
  /** Loaders this was waiting for */
  waitingFor: string[];
  /** Data size in bytes (if available) */
  size?: number;
}

/**
 * Island visualization data.
 */
export interface IslandVisualization {
  /** Island ID */
  id: string;
  /** Component name */
  component: string;
  /** Hydration strategy */
  strategy: 'load' | 'idle' | 'visible' | 'media' | 'none';
  /** Media query (if strategy is 'media') */
  mediaQuery?: string;
  /** Whether island is currently hydrated */
  hydrated: boolean;
  /** Time to hydration (ms) */
  hydrationTime?: number;
  /** Props size in bytes */
  propsSize: number;
  /** DOM element selector */
  selector: string;
}

/**
 * Cache visualization data.
 */
export interface CacheVisualization {
  /** Cache entries */
  entries: CacheEntry[];
  /** Total cache size */
  totalSize: number;
  /** Hit rate (0-1) */
  hitRate: number;
  /** Cache stats by tag */
  tagStats: Map<string, { count: number; hits: number; misses: number }>;
}

/**
 * Individual cache entry.
 */
export interface CacheEntry {
  /** Cache key */
  key: string;
  /** Associated tags */
  tags: string[];
  /** Entry size in bytes */
  size: number;
  /** Time to live remaining (ms) */
  ttl: number;
  /** Created timestamp */
  created: number;
  /** Last accessed timestamp */
  lastAccessed: number;
  /** Access count */
  accessCount: number;
}

/**
 * Route visualization data.
 */
export interface RouteVisualization {
  /** Route path */
  path: string;
  /** Route file */
  file: string;
  /** Render mode */
  renderMode: 'ssr' | 'ssg' | 'csr' | 'api' | 'rsc';
  /** Has loader */
  hasLoader: boolean;
  /** Has action */
  hasAction: boolean;
  /** Middleware chain */
  middleware: string[];
  /** Island count */
  islandCount: number;
  /** Cache tags */
  cacheTags: string[];
  /** Auth required */
  authRequired: boolean;
  /** Last request timing */
  lastTiming?: number;
}

/**
 * HMR event for DevTools.
 */
export interface HMREvent {
  /** Event type */
  type: 'full-reload' | 'css-update' | 'island-update' | 'loader-update' | 'component-update';
  /** File path */
  path: string;
  /** Reason for update type */
  reason?: string;
  /** Timestamp */
  timestamp: number;
  /** Duration (ms) */
  duration?: number;
}
