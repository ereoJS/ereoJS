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

Invalidates all cached data associated with one or more tags. Accepts multiple tags via spread syntax.

### Signature

```ts
function revalidateTag(...tags: string[]): Promise<RevalidateResult>
```

### RevalidateResult

```ts
interface RevalidateResult {
  success: boolean
  revalidated: {
    tags: string[]
    paths: string[]
  }
  timestamp: number
}
```

### Example

```ts
// In an action after creating a post
export const action = createAction(async ({ request }) => {
  const formData = await request.formData()
  await db.posts.create(Object.fromEntries(formData))

  // Invalidate single tag
  await revalidateTag('posts')

  return redirect('/posts')
})
```

### Invalidating Multiple Tags

```ts
export const action = createAction(async ({ request, params }) => {
  const post = await db.posts.update(params.id, data)

  // Invalidate multiple tags using spread syntax
  await revalidateTag(
    'posts',
    `post-${params.id}`,
    `author-${post.authorId}`
  )

  return redirect(`/posts/${params.id}`)
})
```

## revalidatePath

Invalidates cached data for one or more paths. Accepts variadic arguments.

### Signature

```ts
function revalidatePath(...paths: string[]): Promise<RevalidateResult>
```

### Example

```ts
// Invalidate specific path
await revalidatePath('/posts')

// Invalidate multiple paths at once
await revalidatePath('/posts', `/posts/${postId}`, '/homepage')

// Invalidate with pattern matching
await revalidatePath('/posts/*')
```

## revalidate

Invalidates cache with flexible options.

### Signature

```ts
function revalidate(options: RevalidateOptions): Promise<RevalidateResult>
```

### Options

```ts
interface RevalidateOptions {
  // Invalidate by tags
  tags?: string[]

  // Invalidate by paths
  paths?: string[]

  // Invalidate everything
  all?: boolean
}
```

### Example

```ts
// Invalidate by tags
await revalidate({ tags: ['posts'] })

// Invalidate multiple tags
await revalidate({ tags: ['posts', 'users'] })

// Invalidate by paths
await revalidate({ paths: ['/posts'] })

// Invalidate multiple paths
await revalidate({ paths: ['/posts', '/users'] })

// Invalidate everything
await revalidate({ all: true })

// Combined — tags and paths together
await revalidate({
  tags: ['posts'],
  paths: ['/home']
})
```

## unstable_cache

Wraps a function with caching and revalidation support. Similar to Next.js `unstable_cache`.

### Signature

```ts
function unstable_cache<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  keyParts: string[],
  options?: { tags?: string[]; revalidate?: number }
): T
```

### Parameters

- `fn`: The async function to cache
- `keyParts`: Array of strings used to generate the cache key
- `options.tags`: Tags for cache invalidation
- `options.revalidate`: TTL in seconds (default: 3600)

### Example

```ts
const getPosts = unstable_cache(
  async () => {
    return await db.posts.findMany()
  },
  ['posts', 'all'],  // Key parts
  {
    tags: ['posts'],
    revalidate: 3600 // 1 hour
  }
)

// In a loader
export const loader = createLoader(async () => {
  const posts = await getPosts() // Cached
  return { posts }
})
```

### With Arguments

```ts
const getPostById = unstable_cache(
  async (id: string) => {
    return await db.posts.find(id)
  },
  ['posts', 'byId'],
  { tags: ['posts'], revalidate: 1800 }
)

// Usage
const post = await getPostById('123') // Cache key includes args
```

## tags

Helper object with methods to create consistent cache tag names.

### Interface

```ts
const tags = {
  // Create a resource tag (e.g., 'post:123')
  resource: (type: string, id: string | number) => string

  // Create a collection tag (e.g., 'posts')
  collection: (type: string) => string

  // Create a user-scoped tag (e.g., 'user:123:posts')
  userScoped: (userId: string | number, type: string) => string
}
```

### Example

```ts
import { tags, cached, revalidateTag } from '@ereo/data'

// In a loader - use tags for consistent naming
const post = await cached(
  `post:${params.id}`,
  () => db.posts.find(params.id),
  {
    maxAge: 3600,
    tags: [
      tags.collection('posts'),           // 'posts'
      tags.resource('post', params.id),   // 'post:123'
      tags.userScoped(userId, 'posts')    // 'user:456:posts'
    ]
  }
)

// In an action - invalidate using the same tag patterns
export const action = createAction(async ({ params }) => {
  await db.posts.delete(params.id)

  await revalidateTag(
    tags.collection('posts'),
    tags.resource('post', params.id)
  )

  return redirect('/posts')
})
```

## onDemandRevalidate

ISR-style on-demand revalidation. Automatically detects whether each argument is a tag or path (paths start with `/`).

### Signature

```ts
function onDemandRevalidate(...tagsOrPaths: string[]): Promise<RevalidateResult>
```

### Example

```ts
import { onDemandRevalidate } from '@ereo/data'

// In an action after mutation
export const action = createAction(async ({ params }) => {
  await db.posts.update(params.id, data)

  // Revalidate tags and paths together
  await onDemandRevalidate(
    'posts',              // Tag
    `post-${params.id}`,  // Tag
    '/posts',             // Path (starts with /)
    `/posts/${params.id}` // Path
  )

  return redirect(`/posts/${params.id}`)
})
```

### In Webhook Handlers

For external webhooks, use `createRevalidationHandler` instead:

```ts
// routes/api/revalidate.ts
import { createRevalidationHandler } from '@ereo/data'

const handler = createRevalidationHandler(process.env.REVALIDATION_SECRET)

export async function POST(request: Request) {
  return handler(request)
}
```

## createRevalidationHandler

Creates a revalidation handler for API routes with optional secret-based authentication.

### Signature

```ts
function createRevalidationHandler(secret?: string): (request: Request) => Promise<Response>
```

### Parameters

- `secret` (optional): If provided, the handler will verify the request has a matching `Authorization: Bearer <secret>` header

### Request Body

The handler expects a JSON body matching `RevalidateOptions`:

```ts
interface RevalidateOptions {
  tags?: string[]    // Tags to revalidate
  paths?: string[]   // Paths to revalidate
  all?: boolean      // Revalidate everything
}
```

### Example

```ts
import { createRevalidationHandler } from '@ereo/data'

// Create handler with secret authentication
const handler = createRevalidationHandler(process.env.REVALIDATION_SECRET)

// In an API route
export async function POST(request: Request) {
  return handler(request)
}
```

Call from external service:

```bash
curl -X POST https://example.com/api/revalidate \
  -H "Authorization: Bearer your-secret" \
  -H "Content-Type: application/json" \
  -d '{"tags": ["posts"]}'
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
  await revalidateTag('posts', `post-${params.id}`)

  return redirect(`/posts/${params.id}`)
})
```

### After Delete

```ts
export const action = createAction(async ({ params }) => {
  const post = await db.posts.delete(params.id)

  // Invalidate the post, list, and any related caches
  await revalidateTag(
    'posts',
    `post-${params.id}`,
    `author-${post.authorId}`
  )

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
  success: boolean
  revalidated: {
    tags: string[]
    paths: string[]
  }
  timestamp: number
}
```

## Best Practices

1. **Use granular tags** - More specific tags allow more precise invalidation
2. **Invalidate conservatively** - Better to over-invalidate than miss stale data
3. **Combine related invalidations** - Use `revalidateTag` with multiple arguments for related data
4. **Secure revalidation endpoints** - Always verify webhook signatures
5. **Log revalidations** - Track what gets invalidated and when
6. **Test invalidation paths** - Verify cache clears correctly

## Related

- [Caching Concepts](/core-concepts/caching)
- [Cache API](/api/core/cache)
- [Data Loading](/core-concepts/data-loading)
