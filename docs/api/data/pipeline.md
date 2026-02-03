# Data Pipeline

The data pipeline system provides automatic parallelization and dependency management for data loading. It prevents waterfalls by analyzing dependencies and running independent loaders in parallel.

## Overview

```ts
import { createPipeline, dataSource, cachedSource, optionalSource } from '@ereo/data';
```

## createPipeline

Creates a data pipeline with automatic parallelization.

```ts
const pipeline = createPipeline({
  loaders: {
    user: { load: async () => getUser() },
    posts: { load: async () => getPosts() },
    comments: { load: async ({ data }) => getComments(data.posts) },
  },
  dependencies: {
    comments: ['posts'],
  },
});

export const loader = pipeline.toLoader();
```

## PipelineConfig

```ts
interface PipelineConfig<TLoaders, P> {
  loaders: TLoaders;
  dependencies?: Partial<Record<keyof TLoaders, (keyof TLoaders)[]>>;
  onError?: (error: Error, key: string) => void;
  metrics?: boolean;
}
```

## DataSource

```ts
interface DataSource<T, P> {
  load: (args: LoaderArgs<P>) => T | Promise<T>;
  tags?: string[] | ((params: P) => string[]);
  ttl?: number;
  required?: boolean;
  fallback?: T;
}
```

## Helper Functions

### dataSource

Creates a simple data source:

```ts
const userSource = dataSource(async ({ params }) => getUser(params.id));
```

### cachedSource

Creates a cached data source:

```ts
const cachedPosts = cachedSource(
  async () => db.posts.findMany(),
  { tags: ['posts'], ttl: 300 }
);
```

### optionalSource

Creates a data source with fallback:

```ts
const userPrefs = optionalSource(
  async ({ params }) => getUserPreferences(params.id),
  { defaultTheme: 'light' }
);
```

## PipelineResult

```ts
interface PipelineResult<TLoaders> {
  data: { [K in keyof TLoaders]: Awaited<ReturnType<TLoaders[K]['load']>> };
  metrics: PipelineMetrics;
  errors: Map<keyof TLoaders, Error>;
}
```

## Metrics

```ts
interface PipelineMetrics {
  total: number;
  loaders: Map<string, LoaderMetrics>;
  executionOrder: ExecutionStep[];
  parallelEfficiency: number;
  waterfalls: WaterfallInfo[];
}
```

## Examples

### Basic Pipeline

```ts
const pipeline = createPipeline({
  loaders: {
    user: dataSource(async ({ params }) => getUser(params.id)),
    posts: dataSource(async ({ params }) => getPosts(params.id)),
  },
});

export const loader = pipeline.toLoader();
```

### With Dependencies

```ts
const pipeline = createPipeline({
  loaders: {
    user: dataSource(async () => getCurrentUser()),
    posts: dataSource(async () => getPosts()),
    comments: dataSource(async ({ data }) => getComments(data.posts)),
  },
  dependencies: {
    comments: ['posts'],
  },
});
```

### With Error Handling

```ts
const pipeline = createPipeline({
  loaders: {
    critical: { load: async () => getCriticalData(), required: true },
    optional: { load: async () => getOptionalData(), fallback: null },
  },
  onError: (error, key) => console.error(`${key} failed:`, error),
});
```

### With Metrics

```ts
const pipeline = createPipeline({
  loaders: { /* ... */ },
  metrics: true,
});

const result = await pipeline.execute(args);
console.log(formatMetrics(result.metrics));
```
