/**
 * @oreo/data - Data Pipeline
 *
 * Unified data loading with automatic parallelization and dependency management.
 * Prevents waterfalls by analyzing dependencies and running independent loaders in parallel.
 */

import type { LoaderArgs, RouteParams, AppContext } from '@oreo/core';

// ============================================================================
// Types
// ============================================================================

/**
 * Single data source definition.
 */
export interface DataSource<T = unknown, P = RouteParams> {
  /** Loader function */
  load: (args: LoaderArgs<P>) => T | Promise<T>;
  /** Cache tags for this data source */
  tags?: string[] | ((params: P) => string[]);
  /** Cache TTL in seconds */
  ttl?: number;
  /** Whether this data is required (throws on failure) */
  required?: boolean;
  /** Fallback value if load fails */
  fallback?: T;
}

/**
 * Pipeline configuration.
 */
export interface PipelineConfig<
  TLoaders extends Record<string, DataSource>,
  P = RouteParams
> {
  /** Data source loaders */
  loaders: TLoaders;
  /** Dependencies between loaders (key depends on values) */
  dependencies?: Partial<Record<keyof TLoaders, (keyof TLoaders)[]>>;
  /** Global error handler */
  onError?: (error: Error, key: string) => void;
  /** Enable timing metrics */
  metrics?: boolean;
}

/**
 * Pipeline execution result.
 */
export interface PipelineResult<TLoaders extends Record<string, DataSource>> {
  /** Loaded data for each source */
  data: { [K in keyof TLoaders]: Awaited<ReturnType<TLoaders[K]['load']>> };
  /** Timing metrics for each loader */
  metrics: PipelineMetrics;
  /** Any errors that occurred */
  errors: Map<keyof TLoaders, Error>;
}

/**
 * Timing metrics for pipeline execution.
 */
export interface PipelineMetrics {
  /** Total execution time */
  total: number;
  /** Per-loader timing */
  loaders: Map<string, LoaderMetrics>;
  /** Execution order (for visualization) */
  executionOrder: ExecutionStep[];
  /** Parallel efficiency (0-1, higher is better) */
  parallelEfficiency: number;
  /** Detected waterfalls */
  waterfalls: WaterfallInfo[];
}

/**
 * Per-loader metrics.
 */
export interface LoaderMetrics {
  /** Loader key */
  key: string;
  /** Start time (relative to pipeline start) */
  startTime: number;
  /** End time (relative to pipeline start) */
  endTime: number;
  /** Duration in ms */
  duration: number;
  /** Whether this was a cache hit */
  cacheHit: boolean;
  /** Data source (db, api, cache, etc.) */
  source?: string;
  /** Which loaders this was waiting for */
  waitingFor: string[];
}

/**
 * Execution step for visualization.
 */
export interface ExecutionStep {
  /** Timestamp relative to start */
  time: number;
  /** Event type */
  type: 'start' | 'end';
  /** Loader key */
  loader: string;
}

/**
 * Detected waterfall info.
 */
export interface WaterfallInfo {
  /** The loader that waited */
  loader: string;
  /** The loaders it waited for */
  waitedFor: string[];
  /** Whether the wait was necessary */
  necessary: boolean;
  /** Suggestion for optimization */
  suggestion?: string;
}

// ============================================================================
// Pipeline Execution
// ============================================================================

/**
 * Create a data pipeline with automatic parallelization.
 *
 * @example
 * const pipeline = createPipeline({
 *   loaders: {
 *     user: { load: async () => getUser() },
 *     posts: { load: async () => getPosts() },
 *     comments: { load: async ({ data }) => getComments(data.posts) },
 *   },
 *   dependencies: {
 *     comments: ['posts'], // comments depends on posts
 *   },
 * });
 *
 * export const loader = pipeline.toLoader();
 */
export function createPipeline<
  TLoaders extends Record<string, DataSource<unknown, P>>,
  P = RouteParams
>(config: PipelineConfig<TLoaders, P>) {
  const { loaders, dependencies = {}, onError, metrics: enableMetrics = false } = config;

  // Build dependency graph
  const graph = buildDependencyGraph(loaders, dependencies as Record<string, string[]>);

  return {
    /**
     * Execute the pipeline.
     */
    async execute(args: LoaderArgs<P>): Promise<PipelineResult<TLoaders>> {
      const startTime = performance.now();
      const results = new Map<string, unknown>();
      const errors = new Map<keyof TLoaders, Error>();
      const loaderMetrics = new Map<string, LoaderMetrics>();
      const executionOrder: ExecutionStep[] = [];

      // Execute loaders in topological order with parallelization
      const completed = new Set<string>();
      const inProgress = new Map<string, Promise<void>>();

      const executeLoader = async (key: string): Promise<void> => {
        if (completed.has(key) || inProgress.has(key)) {
          return inProgress.get(key);
        }

        // Wait for dependencies
        const deps = graph.get(key) || [];
        const waitingFor: string[] = [];

        for (const dep of deps) {
          if (!completed.has(dep)) {
            waitingFor.push(dep);
            await executeLoader(dep);
          }
        }

        const loaderStartTime = performance.now() - startTime;
        executionOrder.push({ time: loaderStartTime, type: 'start', loader: key });

        const promise = (async () => {
          const loader = loaders[key];

          try {
            // Create extended args with access to loaded data
            const extendedArgs = {
              ...args,
              data: Object.fromEntries(results) as { [K in keyof TLoaders]?: Awaited<ReturnType<TLoaders[K]['load']>> },
            };

            const result = await loader.load(extendedArgs as LoaderArgs<P>);
            results.set(key, result);
          } catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));

            if (loader.fallback !== undefined) {
              results.set(key, loader.fallback);
            } else if (loader.required !== false) {
              errors.set(key as keyof TLoaders, err);
            }

            onError?.(err, key);
          }

          const loaderEndTime = performance.now() - startTime;
          executionOrder.push({ time: loaderEndTime, type: 'end', loader: key });

          loaderMetrics.set(key, {
            key,
            startTime: loaderStartTime,
            endTime: loaderEndTime,
            duration: loaderEndTime - loaderStartTime,
            cacheHit: false, // TODO: integrate with cache system
            waitingFor,
          });

          completed.add(key);
        })();

        inProgress.set(key, promise);
        return promise;
      };

      // Find all root loaders (no dependencies) and start them in parallel
      const roots = Object.keys(loaders).filter((key) => {
        const deps = graph.get(key) || [];
        return deps.length === 0;
      });

      // Execute all roots in parallel, then their dependents will execute
      await Promise.all(roots.map(executeLoader));

      // Execute any remaining loaders
      await Promise.all(Object.keys(loaders).map(executeLoader));

      const totalTime = performance.now() - startTime;

      // Calculate metrics
      const waterfalls = detectWaterfalls(loaderMetrics, graph);
      const parallelEfficiency = calculateParallelEfficiency(loaderMetrics, totalTime);

      return {
        data: Object.fromEntries(results) as PipelineResult<TLoaders>['data'],
        metrics: {
          total: totalTime,
          loaders: loaderMetrics,
          executionOrder,
          parallelEfficiency,
          waterfalls,
        },
        errors,
      };
    },

    /**
     * Convert pipeline to a standard loader function.
     */
    toLoader() {
      return async (args: LoaderArgs<P>) => {
        const result = await this.execute(args);

        // Throw first error if any required loaders failed
        if (result.errors.size > 0) {
          const [key, error] = result.errors.entries().next().value!;
          throw new Error(`Loader '${String(key)}' failed: ${error.message}`);
        }

        // Attach metrics to context if enabled
        if (enableMetrics && args.context) {
          args.context.set('__pipeline_metrics', result.metrics);
        }

        return result.data;
      };
    },

    /**
     * Get the dependency graph for visualization.
     */
    getDependencyGraph() {
      return graph;
    },
  };
}

/**
 * Build dependency graph from config.
 */
function buildDependencyGraph(
  loaders: Record<string, DataSource>,
  dependencies: Record<string, string[]>
): Map<string, string[]> {
  const graph = new Map<string, string[]>();

  for (const key of Object.keys(loaders)) {
    graph.set(key, dependencies[key] || []);
  }

  // Validate: check for missing dependencies
  for (const [key, deps] of graph) {
    for (const dep of deps) {
      if (!loaders[dep]) {
        throw new Error(`Loader '${key}' depends on '${dep}' which does not exist`);
      }
    }
  }

  // Validate: check for cycles
  const visited = new Set<string>();
  const recursionStack = new Set<string>();

  const hasCycle = (node: string): boolean => {
    visited.add(node);
    recursionStack.add(node);

    const deps = graph.get(node) || [];
    for (const dep of deps) {
      if (!visited.has(dep)) {
        if (hasCycle(dep)) return true;
      } else if (recursionStack.has(dep)) {
        return true;
      }
    }

    recursionStack.delete(node);
    return false;
  };

  for (const key of graph.keys()) {
    if (!visited.has(key) && hasCycle(key)) {
      throw new Error(`Circular dependency detected involving '${key}'`);
    }
  }

  return graph;
}

/**
 * Detect waterfalls in execution.
 */
function detectWaterfalls(
  metrics: Map<string, LoaderMetrics>,
  graph: Map<string, string[]>
): WaterfallInfo[] {
  const waterfalls: WaterfallInfo[] = [];

  for (const [key, metric] of metrics) {
    if (metric.waitingFor.length > 0) {
      const deps = graph.get(key) || [];
      const necessary = metric.waitingFor.every((w) => deps.includes(w));

      if (!necessary) {
        waterfalls.push({
          loader: key,
          waitedFor: metric.waitingFor,
          necessary: false,
          suggestion: `'${key}' waited for ${metric.waitingFor.join(', ')} but doesn't depend on them. Consider running in parallel.`,
        });
      } else if (metric.waitingFor.length > 1) {
        waterfalls.push({
          loader: key,
          waitedFor: metric.waitingFor,
          necessary: true,
          suggestion: `'${key}' waited for multiple loaders. Consider if all dependencies are necessary.`,
        });
      }
    }
  }

  return waterfalls;
}

/**
 * Calculate parallel efficiency.
 */
function calculateParallelEfficiency(
  metrics: Map<string, LoaderMetrics>,
  totalTime: number
): number {
  if (metrics.size === 0) return 1;

  // Sum of all individual durations
  let sequentialTime = 0;
  for (const metric of metrics.values()) {
    sequentialTime += metric.duration;
  }

  // Efficiency = sequential time / (actual time * number of loaders)
  // Perfect parallelization would have efficiency close to 1
  if (totalTime === 0) return 1;

  return Math.min(1, sequentialTime / (totalTime * metrics.size));
}

// ============================================================================
// Convenience Helpers
// ============================================================================

/**
 * Create a simple data source.
 *
 * @example
 * const userSource = dataSource(async ({ params }) => getUser(params.id));
 */
export function dataSource<T, P = RouteParams>(
  load: (args: LoaderArgs<P>) => T | Promise<T>,
  options: Omit<DataSource<T, P>, 'load'> = {}
): DataSource<T, P> {
  return { load, ...options };
}

/**
 * Create a cached data source.
 *
 * @example
 * const cachedPosts = cachedSource(
 *   async () => db.posts.findMany(),
 *   { tags: ['posts'], ttl: 300 }
 * );
 */
export function cachedSource<T, P = RouteParams>(
  load: (args: LoaderArgs<P>) => T | Promise<T>,
  options: { tags?: string[] | ((params: P) => string[]); ttl?: number }
): DataSource<T, P> {
  return {
    load,
    tags: options.tags,
    ttl: options.ttl,
  };
}

/**
 * Create a data source with a fallback.
 *
 * @example
 * const userPrefs = optionalSource(
 *   async ({ params }) => getUserPreferences(params.id),
 *   { defaultTheme: 'light' }
 * );
 */
export function optionalSource<T, P = RouteParams>(
  load: (args: LoaderArgs<P>) => T | Promise<T>,
  fallback: T
): DataSource<T, P> {
  return {
    load,
    fallback,
    required: false,
  };
}

/**
 * Combine multiple pipelines into one.
 *
 * @example
 * const combinedPipeline = combinePipelines(
 *   { user: userPipeline },
 *   { posts: postsPipeline }
 * );
 */
export function combinePipelines<T extends Record<string, ReturnType<typeof createPipeline>>>(
  pipelines: T
): {
  execute: (args: LoaderArgs) => Promise<{ [K in keyof T]: Awaited<ReturnType<T[K]['execute']>>['data'] }>;
} {
  return {
    async execute(args: LoaderArgs) {
      const results = await Promise.all(
        Object.entries(pipelines).map(async ([key, pipeline]) => {
          const result = await pipeline.execute(args);
          return [key, result.data] as const;
        })
      );

      return Object.fromEntries(results) as { [K in keyof T]: Awaited<ReturnType<T[K]['execute']>>['data'] };
    },
  };
}

// ============================================================================
// Metrics Visualization (for DevTools)
// ============================================================================

/**
 * Format metrics for console output.
 */
export function formatMetrics(metrics: PipelineMetrics): string {
  const lines: string[] = [
    `Pipeline completed in ${metrics.total.toFixed(1)}ms`,
    `Parallel efficiency: ${(metrics.parallelEfficiency * 100).toFixed(0)}%`,
    '',
    'Loader Timings:',
  ];

  // Sort by start time
  const sorted = Array.from(metrics.loaders.values()).sort((a, b) => a.startTime - b.startTime);

  for (const loader of sorted) {
    const bar = generateTimeBar(loader.startTime, loader.endTime, metrics.total);
    const cacheIndicator = loader.cacheHit ? ' \x1b[32m(cache)\x1b[0m' : '';
    lines.push(`  ${loader.key.padEnd(20)} ${bar} ${loader.duration.toFixed(1)}ms${cacheIndicator}`);
  }

  if (metrics.waterfalls.length > 0) {
    lines.push('');
    lines.push('⚠️ Detected Waterfalls:');
    for (const waterfall of metrics.waterfalls) {
      lines.push(`  - ${waterfall.loader}: ${waterfall.suggestion}`);
    }
  }

  return lines.join('\n');
}

/**
 * Generate a visual time bar.
 */
function generateTimeBar(start: number, end: number, total: number, width = 40): string {
  if (total === 0) return '━'.repeat(width);

  const startPos = Math.floor((start / total) * width);
  const endPos = Math.ceil((end / total) * width);

  let bar = '';
  for (let i = 0; i < width; i++) {
    if (i < startPos) {
      bar += '─';
    } else if (i < endPos) {
      bar += '━';
    } else {
      bar += '─';
    }
  }

  return bar;
}

/**
 * Generate metrics data for DevTools visualization.
 */
export function generateMetricsVisualization(metrics: PipelineMetrics): {
  timeline: Array<{
    key: string;
    start: number;
    end: number;
    duration: number;
    cacheHit: boolean;
    waitingFor: string[];
  }>;
  total: number;
  efficiency: number;
  waterfalls: WaterfallInfo[];
} {
  const timeline = Array.from(metrics.loaders.values())
    .sort((a, b) => a.startTime - b.startTime)
    .map((m) => ({
      key: m.key,
      start: m.startTime,
      end: m.endTime,
      duration: m.duration,
      cacheHit: m.cacheHit,
      waitingFor: m.waitingFor,
    }));

  return {
    timeline,
    total: metrics.total,
    efficiency: metrics.parallelEfficiency,
    waterfalls: metrics.waterfalls,
  };
}
