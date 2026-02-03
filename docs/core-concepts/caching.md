# Caching

Ereo provides explicit, tag-based caching that gives you full control over what gets cached and when it's invalidated. Unlike implicit caching systems, you always know what's cached and why.

## Philosophy

Ereo's caching is built on three principles:

1. **Explicit over implicit** - You opt into caching, not out
2. **Tag-based invalidation** - Invalidate related content together
3. **Composable** - Caching rules combine predictably

## Route-Level Caching

Configure caching in your route's config:

```tsx
// routes/posts/[id].tsx
export const config = {
  cache: {
    maxAge: 3600,              // Cache for 1 hour
    staleWhileRevalidate: 86400, // Serve stale for 24h while revalidating
    tags: ['posts', 'post-123']  // Cache tags for invalidation
  }
}

export const loader = createLoader(async ({ params }) => {
  const post = await db.posts.find(params.id)
  return { post }
})
```

### Cache Options

| Option | Type | Description |
|--------|------|-------------|
| `maxAge` | number | Seconds to cache (0 = no cache) |
| `staleWhileRevalidate` | number | Seconds to serve stale while revalidating |
| `tags` | string[] | Tags for invalidation |
| `private` | boolean | Prevent CDN caching (user-specific content) |
| `revalidate` | number | Revalidate every N seconds (ISR-style) |

### Dynamic Cache Tags

Add tags based on the data:

```tsx
export const config = {
  cache: ({ params }) => ({
    maxAge: 3600,
    tags: ['posts', `post-${params.id}`, `author-${post.authorId}`]
  })
}
```

## Data-Level Caching

Cache specific data fetches:

```tsx
import { cached, cacheKey } from '@ereo/data'

export const loader = createLoader(async ({ params }) => {
  // Cache this specific fetch
  const post = await cached(
    cacheKey('post', params.id),
    () => db.posts.find(params.id),
    { ttl: 3600, tags: ['posts', `post-${params.id}`] }
  )

  // Uncached - always fresh
  const views = await db.analytics.getViews(params.id)

  return { post, views }
})
```

## Tag-Based Invalidation

Invalidate cached content by tags:

```tsx
import { revalidateTag, revalidateTags } from '@ereo/data'

export const action = createAction(async ({ request }) => {
  const formData = await request.formData()
  const post = await db.posts.create(Object.fromEntries(formData))

  // Invalidate all content tagged with 'posts'
  await revalidateTag('posts')

  // Or invalidate multiple tags
  await revalidateTags(['posts', 'homepage', `author-${post.authorId}`])

  return redirect(`/posts/${post.id}`)
})
```

### Common Tagging Patterns

```tsx
// Collection tag - invalidate all posts
tags: ['posts']

// Individual item tag - invalidate one post
tags: ['posts', `post-${id}`]

// Related content - invalidate when author changes
tags: ['posts', `post-${id}`, `author-${post.authorId}`]

// Category tag - invalidate posts in a category
tags: ['posts', `category-${post.categoryId}`]

// User-specific - invalidate user's content
tags: [`user-${userId}-posts`]
```

## Path-Based Invalidation

Invalidate by URL path:

```tsx
import { revalidatePath } from '@ereo/data'

// Invalidate specific path
await revalidatePath('/posts')

// Invalidate with pattern
await revalidatePath('/posts/*')

// Invalidate specific post
await revalidatePath(`/posts/${postId}`)
```

## Cache Adapters

Ereo supports different cache backends:

### Memory Cache (Default)

Built-in memory cache, good for development and single-server deployments:

```tsx
import { createCache, createTaggedCache } from '@ereo/core'

// Simple cache
const cache = createCache({
  maxSize: 1000,  // Maximum entries
  ttl: 3600       // Default TTL
})

// Tagged cache
const taggedCache = createTaggedCache({
  maxSize: 1000
})
```

### Redis Cache

For production with multiple servers:

```tsx
// ereo.config.ts
import { defineConfig } from '@ereo/core'
import { redisCache } from '@ereo/cache-redis'

export default defineConfig({
  cache: redisCache({
    url: process.env.REDIS_URL,
    prefix: 'ereo:'
  })
})
```

### Custom Adapter

Implement your own cache adapter:

```tsx
import { wrapCacheAdapter } from '@ereo/core'

const customCache = wrapCacheAdapter({
  async get(key) {
    // Return cached value or undefined
  },
  async set(key, value, options) {
    // Store value with TTL and tags
  },
  async delete(key) {
    // Delete cached value
  },
  async invalidateTag(tag) {
    // Invalidate all entries with this tag
  }
})
```

## HTTP Cache Headers

Ereo automatically sets cache headers based on your config:

```tsx
export const config = {
  cache: {
    maxAge: 3600,
    staleWhileRevalidate: 86400,
    private: false
  }
}
// Sets: Cache-Control: public, max-age=3600, stale-while-revalidate=86400
```

```tsx
export const config = {
  cache: {
    maxAge: 60,
    private: true
  }
}
// Sets: Cache-Control: private, max-age=60
```

### Manual Cache Control

Set cache headers in your loader:

```tsx
export const loader = createLoader(async ({ request, context }) => {
  const post = await db.posts.find(params.id)

  // Conditional caching
  if (post.isPublished) {
    context.cache.set({
      maxAge: 3600,
      tags: ['posts', `post-${post.id}`]
    })
  } else {
    context.cache.set({ maxAge: 0 }) // No cache for drafts
  }

  return { post }
})
```

## Stale-While-Revalidate

SWR serves cached content immediately while fetching fresh data in the background:

```tsx
export const config = {
  cache: {
    maxAge: 60,                  // Fresh for 1 minute
    staleWhileRevalidate: 3600   // Stale OK for 1 hour
  }
}
```

Timeline:
- 0-60s: Serve cached response (fresh)
- 60s-3660s: Serve cached response + fetch fresh in background (stale)
- 3660s+: Cache expired, wait for fresh response

## Revalidation Patterns

### On-Demand Revalidation

Invalidate when data changes:

```tsx
// After creating a post
export const action = createAction(async ({ request }) => {
  await db.posts.create(/* ... */)
  await revalidateTag('posts')
  return redirect('/posts')
})

// After updating a post
export const action = createAction(async ({ request, params }) => {
  await db.posts.update(params.id, /* ... */)
  await revalidateTags(['posts', `post-${params.id}`])
  return redirect(`/posts/${params.id}`)
})

// After deleting a post
export const action = createAction(async ({ params }) => {
  const post = await db.posts.delete(params.id)
  await revalidateTags(['posts', `post-${params.id}`, `author-${post.authorId}`])
  return redirect('/posts')
})
```

### Time-Based Revalidation

Revalidate periodically (ISR-style):

```tsx
export const config = {
  render: 'ssg',
  cache: {
    revalidate: 60  // Regenerate every 60 seconds
  }
}
```

### Webhook Revalidation

Expose an API route for external revalidation:

```tsx
// routes/api/revalidate.ts
import { revalidateTag } from '@ereo/data'

export async function POST(request: Request) {
  const { secret, tag } = await request.json()

  if (secret !== process.env.REVALIDATION_SECRET) {
    return Response.json({ error: 'Invalid secret' }, { status: 401 })
  }

  await revalidateTag(tag)
  return Response.json({ revalidated: true })
}
```

## Cache Debugging

Enable cache debugging in development:

```tsx
// ereo.config.ts
export default defineConfig({
  dev: {
    cache: {
      debug: true
    }
  }
})
```

This logs:
```
[Cache] HIT posts/123 (age: 45s, tags: posts, post-123)
[Cache] MISS posts/456
[Cache] INVALIDATE tag:posts (12 entries)
```

### Cache Stats

Get cache statistics:

```tsx
import { createTaggedCache } from '@ereo/core'

const cache = createTaggedCache()

// Later...
const stats = cache.getStats()
console.log(stats)
// { size: 156, tags: 23 }
```

## Best Practices

1. **Start without caching** - Add caching when you identify performance needs

2. **Use granular tags** - More tags = more precise invalidation
   ```tsx
   tags: ['posts', `post-${id}`, `category-${categoryId}`, `author-${authorId}`]
   ```

3. **Invalidate conservatively** - Better to invalidate too much than too little

4. **Test invalidation** - Verify that mutations properly invalidate related caches

5. **Monitor cache hit rates** - Low hit rates indicate overly aggressive invalidation

6. **Don't cache user-specific data publicly** - Use `private: true` for personalized content

7. **Consider cache warmup** - Pre-populate cache after invalidation for critical paths
