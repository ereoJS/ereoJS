# Revalidation

Revalidation APIs for invalidating cached data.

## Import

```ts
import {
  revalidateTag,
  revalidatePath,
  revalidate,
  unstable_cache,
  tags,
  onDemandRevalidate,
  createRevalidationHandler
} from '@ereo/data'
```

## revalidateTag

Invalidates all cached data associated with a tag.

### Signature

```ts
function revalidateTag(tag: string): Promise<void>
```

### Example

```ts
// In an action after creating a post
export const action = createAction(async ({ request }) => {
  const formData = await request.formData()
  await db.posts.create(Object.fromEntries(formData))

  // Invalidate all cached data tagged with 'posts'
  await revalidateTag('posts')

  return redirect('/posts')
})
```

## revalidateTags

Invalidates multiple tags at once.

### Signature

```ts
function revalidateTags(tags: string[]): Promise<void>
```

### Example

```ts
export const action = createAction(async ({ request, params }) => {
  const post = await db.posts.update(params.id, data)

  // Invalidate multiple related caches
  await revalidateTags([
    'posts',
    `post-${params.id}`,
    `author-${post.authorId}`
  ])

  return redirect(`/posts/${params.id}`)
})
```

## revalidatePath

Invalidates cached data for a specific path.

### Signature

```ts
function revalidatePath(path: string): Promise<void>
```

### Example

```ts
// Invalidate specific path
await revalidatePath('/posts')

// Invalidate with wildcard
await revalidatePath('/posts/*')

// Invalidate specific post
await revalidatePath(`/posts/${postId}`)
```

## revalidate

Invalidates cache with flexible options.

### Signature

```ts
function revalidate(options: RevalidateOptions): Promise<void>
```

### Options

```ts
interface RevalidateOptions {
  // Invalidate by tag
  tag?: string
  tags?: string[]

  // Invalidate by path
  path?: string
  paths?: string[]

  // Invalidate everything
  all?: boolean
}
```

### Example

```ts
// Invalidate by tag
await revalidate({ tag: 'posts' })

// Invalidate multiple tags
await revalidate({ tags: ['posts', 'users'] })

// Invalidate by path
await revalidate({ path: '/posts' })

// Invalidate multiple paths
await revalidate({ paths: ['/posts', '/users'] })

// Invalidate everything
await revalidate({ all: true })

// Combined
await revalidate({
  tags: ['posts'],
  paths: ['/home']
})
```

## unstable_cache

Wraps a function with caching and revalidation support.

### Signature

```ts
function unstable_cache<T>(
  fn: () => T | Promise<T>,
  options?: RevalidateOptions & { ttl?: number }
): () => Promise<T>
```

### Example

```ts
const getPosts = unstable_cache(
  async () => {
    return await db.posts.findMany()
  },
  {
    tags: ['posts'],
    ttl: 3600 // 1 hour
  }
)

// In a loader
export const loader = createLoader(async () => {
  const posts = await getPosts() // Cached
  return { posts }
})
```

## tags

Helper to define cache tags.

### Signature

```ts
function tags(...tagNames: string[]): { tags: string[] }
```

### Example

```ts
import { tags } from '@ereo/data'

export const config = {
  cache: {
    maxAge: 3600,
    ...tags('posts', 'homepage')
  }
}
```

## onDemandRevalidate

Handles on-demand revalidation from external sources.

### Signature

```ts
function onDemandRevalidate(request: Request): Promise<RevalidateResult>
```

### Example

Create an API route for webhooks:

```ts
// routes/api/revalidate.ts
import { onDemandRevalidate } from '@ereo/data'

export async function POST(request: Request) {
  // Verify the request (e.g., webhook signature)
  const secret = request.headers.get('X-Revalidate-Secret')
  if (secret !== process.env.REVALIDATION_SECRET) {
    return Response.json({ error: 'Invalid secret' }, { status: 401 })
  }

  const result = await onDemandRevalidate(request)

  return Response.json(result)
}
```

Call from external service:

```bash
curl -X POST https://example.com/api/revalidate \
  -H "X-Revalidate-Secret: your-secret" \
  -H "Content-Type: application/json" \
  -d '{"tag": "posts"}'
```

## createRevalidationHandler

Creates a revalidation handler with custom options.

### Signature

```ts
function createRevalidationHandler(
  options: RevalidateOptions
): (request: Request) => Promise<RevalidateResult>
```

### Example

```ts
const revalidatePosts = createRevalidationHandler({
  tags: ['posts']
})

// In an API route
export async function POST(request: Request) {
  const result = await revalidatePosts(request)
  return Response.json(result)
}
```

## Revalidation Patterns

### After Create

```ts
export const action = createAction(async ({ request }) => {
  await db.posts.create(data)

  // Invalidate list pages
  await revalidateTag('posts')

  return redirect('/posts')
})
```

### After Update

```ts
export const action = createAction(async ({ request, params }) => {
  const post = await db.posts.update(params.id, data)

  // Invalidate both the specific post and list pages
  await revalidateTags(['posts', `post-${params.id}`])

  return redirect(`/posts/${params.id}`)
})
```

### After Delete

```ts
export const action = createAction(async ({ params }) => {
  const post = await db.posts.delete(params.id)

  // Invalidate the post, list, and any related caches
  await revalidateTags([
    'posts',
    `post-${params.id}`,
    `author-${post.authorId}`
  ])

  return redirect('/posts')
})
```

### Webhook Handler

```ts
// routes/api/cms-webhook.ts
export async function POST(request: Request) {
  const body = await request.json()

  // Handle different CMS events
  switch (body.event) {
    case 'post.created':
    case 'post.updated':
    case 'post.deleted':
      await revalidateTag('posts')
      if (body.postId) {
        await revalidateTag(`post-${body.postId}`)
      }
      break

    case 'author.updated':
      await revalidateTag(`author-${body.authorId}`)
      break

    case 'site.settings.updated':
      await revalidate({ all: true })
      break
  }

  return Response.json({ success: true })
}
```

### Scheduled Revalidation

```ts
// scripts/revalidate-stale.ts
import { revalidateTag } from '@ereo/data'

// Run periodically to refresh stale content
async function revalidateStaleContent() {
  const staleContent = await db.content.findStale()

  for (const content of staleContent) {
    await revalidateTag(`content-${content.id}`)
  }
}
```

## RevalidateResult

The result of a revalidation operation.

```ts
interface RevalidateResult {
  revalidated: boolean
  tags?: string[]
  paths?: string[]
  error?: string
}
```

## Best Practices

1. **Use granular tags** - More specific tags allow more precise invalidation
2. **Invalidate conservatively** - Better to over-invalidate than miss stale data
3. **Combine related invalidations** - Use `revalidateTags` for related data
4. **Secure revalidation endpoints** - Always verify webhook signatures
5. **Log revalidations** - Track what gets invalidated and when
6. **Test invalidation paths** - Verify cache clears correctly

## Related

- [Caching Concepts](/core-concepts/caching)
- [Cache API](/api/core/cache)
- [Data Loading](/core-concepts/data-loading)
