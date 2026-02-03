# @ereo/data

Data loading and caching for the EreoJS framework. One pattern, not four - simple and explicit data fetching with automatic parallelization.

## Installation

```bash
bun add @ereo/data
```

## Quick Start

```typescript
import { createLoader, createAction, cached } from '@ereo/data';

// Create a loader for fetching data
export const loader = createLoader(async ({ params }) => {
  const user = await fetchUser(params.id);
  return { user };
});

// Create an action for mutations
export const action = createAction(async ({ request }) => {
  const formData = await request.formData();
  await updateUser(formData);
  return redirect('/users');
});
```

## Key Features

- **Loaders** - Fetch data with `createLoader`, support for deferred data with `defer`
- **Actions** - Handle mutations with `createAction`, `typedAction`, and `jsonAction`
- **Caching** - Built-in memory cache with `cached`, `getCache`, `setCache`
- **Cache Control** - Fine-grained cache headers with `buildCacheControl`
- **Revalidation** - On-demand revalidation with `revalidateTag` and `revalidatePath`
- **Data Pipelines** - Auto-parallelization with `createPipeline` and `dataSource`
- **Response Helpers** - `redirect`, `json`, and `error` utilities

## Caching Example

```typescript
import { cached, revalidateTag } from '@ereo/data';

const getUser = cached(
  async (id: string) => fetchUser(id),
  { tags: ['user'], ttl: 60000 }
);

// Revalidate when user is updated
await revalidateTag('user');
```

## Data Pipeline

```typescript
import { createPipeline, dataSource, cachedSource } from '@ereo/data';

const pipeline = createPipeline({
  user: dataSource(() => fetchUser(id)),
  posts: cachedSource(() => fetchPosts(id), { ttl: 5000 }),
  comments: dataSource((ctx) => fetchComments(ctx.posts)),
});

const data = await pipeline.execute();
// { user, posts, comments } - automatically parallelized
```

## Documentation

For full documentation, visit [https://ereojs.dev/docs/data](https://ereojs.dev/docs/data)

## Part of EreoJS

This package is part of the [EreoJS](https://github.com/ereojs/ereo) monorepo - a modern full-stack framework built for Bun.

## License

MIT
