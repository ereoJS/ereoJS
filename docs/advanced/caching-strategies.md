# Caching Strategies

This guide covers advanced caching patterns in EreoJS.

## Cache Hierarchy

```
Request
    │
    ▼
┌─────────────────┐
│   CDN Cache     │  ← Edge caching
└─────────────────┘
    │ Miss
    ▼
┌─────────────────┐
│  Application    │  ← Tag-based cache
│     Cache       │
└─────────────────┘
    │ Miss
    ▼
┌─────────────────┐
│   Data Source   │  ← Database/API
└─────────────────┘
```

## Route-Level Caching

### Static Content

```tsx
// routes/about.tsx
export const config = {
  render: 'ssg',
  cache: {
    maxAge: 86400,  // 24 hours
    staleWhileRevalidate: 604800  // 7 days
  }
}
```

### Dynamic Content with Revalidation

```tsx
// routes/posts/[slug].tsx
export const config = {
  cache: {
    maxAge: 60,
    staleWhileRevalidate: 3600,
    tags: ['posts']
  }
}

export const loader = createLoader(async ({ params, context }) => {
  const post = await db.posts.findBySlug(params.slug)

  // Add specific tags for this post
  context.cache.addTags([`post-${post.id}`, `author-${post.authorId}`])

  return { post }
})
```

### User-Specific Content

```tsx
// routes/dashboard.tsx
export const config = {
  cache: {
    maxAge: 0,  // No shared cache
    private: true
  }
}
```

## Data-Level Caching

### Cache Individual Queries

```tsx
import { cached, cacheKey } from '@ereo/data'

export const loader = createLoader(async ({ params }) => {
  // Cache this specific query
  const post = await cached(
    cacheKey('post', params.slug),
    () => db.posts.findBySlug(params.slug),
    {
      maxAge: 300,  // 5 minutes
      tags: ['posts', `post-${params.slug}`]
    }
  )

  // Don't cache user-specific data
  const userBookmarks = await db.bookmarks.findByUser(userId)

  return { post, userBookmarks }
})
```

### Cache with Stale-While-Revalidate

```tsx
async function getWithSWR<T>(
  key: string,
  fetcher: () => Promise<T>,
  { maxAge, swr }: { maxAge: number; swr: number }
): Promise<T> {
  const cached = await cache.get<{ data: T; timestamp: number }>(key)
  const now = Date.now()

  if (cached) {
    const age = (now - cached.timestamp) / 1000

    if (age < maxAge) {
      // Fresh
      return cached.data
    }

    if (age < maxAge + swr) {
      // Stale but acceptable - revalidate in background
      fetcher().then(data => {
        cache.set(key, { data, timestamp: Date.now() })
      })
      return cached.data
    }
  }

  // Miss or expired
  const data = await fetcher()
  await cache.set(key, { data, timestamp: now })
  return data
}
```

## Tag-Based Invalidation

### Defining Tags

```tsx
// On routes
export const config = {
  cache: {
    tags: ['posts', 'homepage']
  }
}

// In loaders
context.cache.addTags([`user-${userId}`, `team-${teamId}`])

// With cached()
await cached(key, fetcher, {
  tags: ['posts', `post-${id}`, `category-${categoryId}`]
})
```

### Invalidating Tags

```tsx
import { revalidateTag } from '@ereo/data'

// After creating a post
export const action = createAction(async ({ request }) => {
  const post = await createPost(data)

  // Pass multiple tags as separate arguments
  await revalidateTag(
    'posts',                       // All posts lists
    'homepage',                    // Homepage with recent posts
    `category-${post.categoryId}`  // Category page
  )

  return redirect(`/posts/${post.slug}`)
})

// After updating a post
export const action = createAction(async ({ request, params }) => {
  const post = await updatePost(params.id, data)

  await revalidateTag(
    'posts',
    `post-${params.id}`,
    `author-${post.authorId}`
  )

  return redirect(`/posts/${post.slug}`)
})

// After deleting a post
export const action = createAction(async ({ params }) => {
  const post = await db.posts.find(params.id)
  await deletePost(params.id)

  await revalidateTag(
    'posts',
    `post-${params.id}`,
    `author-${post.authorId}`,
    `category-${post.categoryId}`
  )

  return redirect('/posts')
})
```

## Cache Patterns

### Write-Through

Update cache immediately after write:

```tsx
async function createPost(data) {
  const post = await db.posts.create(data)

  // Immediately cache the new post
  await cache.set(`post:${post.slug}`, post, {
    ttl: 3600,
    tags: ['posts', `post-${post.id}`]
  })

  // Invalidate list caches
  await revalidateTag('posts')

  return post
}
```

### Cache-Aside (Lazy Loading)

Cache on read, invalidate on write:

```tsx
async function getPost(slug: string) {
  const cacheKey = `post:${slug}`

  // Try cache first
  let post = await cache.get(cacheKey)

  if (!post) {
    // Cache miss - fetch and store
    post = await db.posts.findBySlug(slug)
    if (post) {
      await cache.set(cacheKey, post, {
        ttl: 3600,
        tags: ['posts', `post-${post.id}`]
      })
    }
  }

  return post
}
```

### Cache Warming

Pre-populate cache for critical paths:

```tsx
import { cached, MemoryCache } from '@ereo/data'

async function warmCache() {
  const cache = new MemoryCache()

  // Warm popular posts
  const popularPosts = await db.posts.findPopular(20)
  for (const post of popularPosts) {
    await cache.setValue(`post:${post.slug}`, post, {
      ttl: 3600,
      tags: ['posts', `post-${post.id}`]
    })
  }

  // Warm homepage data using cached() (uses maxAge in seconds)
  await cached('homepage-data', getHomepageData, {
    maxAge: 300,
    tags: ['homepage']
  })
}

// Call after deployment or cache clear
await warmCache()
```

### Tiered Caching

Different TTLs for different content types:

```tsx
const CACHE_CONFIG = {
  // Rarely changes
  static: { ttl: 86400, swr: 604800 },

  // Changes occasionally
  content: { ttl: 3600, swr: 86400 },

  // Changes frequently
  dynamic: { ttl: 60, swr: 300 },

  // User-specific
  personalized: { ttl: 0, private: true }
}

export const config = {
  cache: CACHE_CONFIG.content
}
```

## CDN Integration

### Cache-Control Headers

```tsx
export const loader = createLoader(async ({ context }) => {
  // Set cache headers — CDN will respect staleWhileRevalidate for longer caching
  context.cache.set({
    maxAge: 60,
    staleWhileRevalidate: 86400
  })

  // For custom CDN headers (e.g., s-maxage), set them manually:
  context.responseHeaders.set(
    'Cache-Control',
    'public, max-age=60, s-maxage=3600, stale-while-revalidate=86400'
  )

  return { data }
})
```

### Vary Headers

```tsx
// Different cache for different Accept headers
context.responseHeaders.set('Vary', 'Accept')

// Different cache for authenticated vs anonymous
context.responseHeaders.set('Vary', 'Cookie')
```

### Cache Key Strategies

Use `generateCacheKey` or `cacheKey` from `@ereo/data` to create custom cache keys:

```tsx
import { cached, generateCacheKey, cacheKey } from '@ereo/data'

export const loader = createLoader(async ({ request, params }) => {
  // generateCacheKey creates a key from the request: "METHOD:pathname?search"
  const key = generateCacheKey(request)

  // Or build a custom key with cacheKey
  const url = new URL(request.url)
  const page = url.searchParams.get('page') || '1'
  const customKey = cacheKey('posts', page)  // "posts:1"

  const posts = await cached(customKey, () => db.posts.paginate(page), {
    maxAge: 300,
    tags: ['posts']
  })

  return { posts }
})
```

## Debugging Cache

```tsx
// Enable cache debugging
export default defineConfig({
  dev: {
    cache: {
      debug: true
    }
  }
})

// Logs:
// [Cache] HIT post:hello-world (age: 45s)
// [Cache] MISS post:new-post
// [Cache] INVALIDATE tag:posts (12 entries)
```

## Best Practices

1. **Start without caching** - Add caching when you identify bottlenecks
2. **Use granular tags** - More tags = more precise invalidation
3. **Test invalidation** - Verify stale data is cleared
4. **Monitor hit rates** - Low rates indicate over-invalidation
5. **Set reasonable TTLs** - Balance freshness with performance
6. **Cache at the right level** - Route, data, or both
7. **Handle cache failures gracefully** - Fall back to source
