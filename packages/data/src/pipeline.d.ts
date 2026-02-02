/**
 * @areo/data - Data Pipeline
 *
 * Unified data loading with automatic parallelization and dependency management.
 * Prevents waterfalls by analyzing dependencies and running independent loaders in parallel.
 */
import type { LoaderArgs, RouteParams } from '@areo/core';
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
export interface PipelineConfig<TLoaders extends Record<string, DataSource>, P = RouteParams> {
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
    data: {
        [K in keyof TLoaders]: Awaited<ReturnType<TLoaders[K]['load']>>;
    };
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
export declare function createPipeline<TLoaders extends Record<string, DataSource>, P extends RouteParams = RouteParams>(config: PipelineConfig<TLoaders, P>): {
    /**
     * Execute the pipeline.
     */
    execute(args: LoaderArgs<P>): Promise<PipelineResult<TLoaders>>;
    /**
     * Convert pipeline to a standard loader function.
     */
    toLoader(): (args: LoaderArgs<P>) => Promise<{ [K in keyof TLoaders]: Awaited<ReturnType<TLoaders[K]["load"]>>; }>;
    /**
     * Get the dependency graph for visualization.
     */
    getDependencyGraph(): Map<string, string[]>;
};
/**
 * Create a simple data source.
 *
 * @example
 * const userSource = dataSource(async ({ params }) => getUser(params.id));
 */
export declare function dataSource<T, P = RouteParams>(load: (args: LoaderArgs<P>) => T | Promise<T>, options?: Omit<DataSource<T, P>, 'load'>): DataSource<T, P>;
/**
 * Create a cached data source.
 *
 * @example
 * const cachedPosts = cachedSource(
 *   async () => db.posts.findMany(),
 *   { tags: ['posts'], ttl: 300 }
 * );
 */
export declare function cachedSource<T, P = RouteParams>(load: (args: LoaderArgs<P>) => T | Promise<T>, options: {
    tags?: string[] | ((params: P) => string[]);
    ttl?: number;
}): DataSource<T, P>;
/**
 * Create a data source with a fallback.
 *
 * @example
 * const userPrefs = optionalSource(
 *   async ({ params }) => getUserPreferences(params.id),
 *   { defaultTheme: 'light' }
 * );
 */
export declare function optionalSource<T, P = RouteParams>(load: (args: LoaderArgs<P>) => T | Promise<T>, fallback: T): DataSource<T, P>;
/**
 * Combine multiple pipelines into one.
 *
 * @example
 * const combinedPipeline = combinePipelines(
 *   { user: userPipeline },
 *   { posts: postsPipeline }
 * );
 */
export declare function combinePipelines<T extends Record<string, ReturnType<typeof createPipeline>>>(pipelines: T): {
    execute: (args: LoaderArgs) => Promise<{
        [K in keyof T]: Awaited<ReturnType<T[K]['execute']>>['data'];
    }>;
};
/**
 * Format metrics for console output.
 */
export declare function formatMetrics(metrics: PipelineMetrics): string;
/**
 * Generate metrics data for DevTools visualization.
 */
export declare function generateMetricsVisualization(metrics: PipelineMetrics): {
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
};
//# sourceMappingURL=pipeline.d.ts.map