# Data Cache

Caching utilities for data loading.

## Import

```ts
import {
  MemoryCache,
  getCache,
  setCache,
  cached,
  generateCacheKey,
  cacheKey,
  buildCacheControl,
  parseCacheControl,
  Cached,
  createDataCacheAdapter
} from '@ereo/data'
```

## MemoryCache

In-memory cache implementation with tag-based invalidation support.

### Constructor

```ts
new MemoryCache()
```

The `MemoryCache` class takes no constructor parameters.

### CacheStorage Interface Methods

All methods are async and return Promises:

```ts
class MemoryCache implements CacheStorage {
  // Get full cache entry with metadata
  get<T>(key: string): Promise<CacheEntry<T> | null>

  // Set a cache entry with full metadata
  set<T>(key: string, entry: CacheEntry<T>): Promise<void>

  // Delete a cache entry
  delete(key: string): Promise<boolean>

  // Delete all entries with a specific tag
  deleteByTag(tag: string): Promise<void>

  // Clear all entries
  clear(): Promise<void>

  // Get all keys
  keys(): Promise<string[]>

  // Get cache statistics
  getStats(): { size: number; tags: number }
}
```

### CacheAdapter-Compatible Methods

For easier integration with `@ereo/core`:

```ts
class MemoryCache {
  // Get just the value (not full entry)
  getValue<T>(key: string): Promise<T | undefined>

  // Set value with options (ttl in seconds, tags)
  setValue<T>(key: string, value: T, options?: { ttl?: number; tags?: string[] }): Promise<void>

  // Check if key exists
  has(key: string): Promise<boolean>

  // Invalidate by tag
  invalidateTag(tag: string): Promise<void>
  invalidateTags(tags: string[]): Promise<void>

  // Get keys by tag
  getByTag(tag: string): Promise<string[]>

  // Get CacheAdapter wrapper
  asCacheAdapter(): CacheAdapter & TaggedCache
}
```

### CacheEntry Interface

```ts
interface CacheEntry<T = unknown> {
  value: T
  timestamp: number
  maxAge: number
  staleWhileRevalidate?: number
  tags: string[]
}
```

### Example

```ts
const cache = new MemoryCache()

// Set a value with full entry metadata
await cache.set('user:123', {
  value: { name: 'Alice' },
  timestamp: Date.now(),
  maxAge: 3600,
  tags: ['users', 'user-123']
})

// Get the full entry (includes metadata)
const entry = await cache.get('user:123')
if (entry) {
  console.log(entry.value) // { name: 'Alice' }
}

// Or use simplified getValue for just the value
const user = await cache.getValue('user:123')

// Set with simplified interface
await cache.setValue('session:abc', { userId: 123 }, { ttl: 1800, tags: ['sessions'] })

// Check existence
if (await cache.has('user:123')) {
  console.log('User is cached')
}

// Delete single entry
await cache.delete('user:123')

// Delete all entries with a tag
await cache.deleteByTag('users')

// Clear all
await cache.clear()

// Get all keys
const keys = await cache.keys()

// Get stats
const stats = cache.getStats()
console.log(`Cache has ${stats.size} entries and ${stats.tags} tags`)

// Get CacheAdapter for use with @ereo/core
const adapter = cache.asCacheAdapter()
```

## getCache / setCache

Global cache instance management functions.

### Signatures

```ts
// Get (or create) the global cache instance
function getCache(): CacheStorage

// Set a custom cache storage implementation
function setCache(storage: CacheStorage): void
```

### CacheStorage Interface

```ts
interface CacheStorage {
  get<T>(key: string): Promise<CacheEntry<T> | null>
  set<T>(key: string, entry: CacheEntry<T>): Promise<void>
  delete(key: string): Promise<boolean | void>
  deleteByTag(tag: string): Promise<void>
  clear(): Promise<void>
  keys(): Promise<string[]>
}
```

### Example

```ts
// Get the global cache instance
const cache = getCache()

// Use the cache
await cache.set('user:123', {
  value: { name: 'Alice' },
  timestamp: Date.now(),
  maxAge: 3600,
  tags: ['users']
})

const entry = await cache.get('user:123')

// Use a custom cache storage (e.g., Redis adapter)
import { RedisCache } from './my-redis-cache'
setCache(new RedisCache({ url: process.env.REDIS_URL }))
```

## cached

Wraps a function with caching and stale-while-revalidate support.

### Signature

```ts
function cached<T>(
  key: string,
  fn: () => Promise<T>,
  options: CacheOptions
): Promise<T>
```

### CacheOptions

```ts
interface CacheOptions {
  maxAge?: number              // TTL in seconds (default: 60)
  staleWhileRevalidate?: number // Additional seconds to serve stale while refreshing
  tags?: string[]              // Tags for invalidation
  private?: boolean            // Mark as private (for Cache-Control header)
}
```

### Example

```ts
export const loader = createLoader(async ({ params }) => {
  // Cache the database call
  const post = await cached(
    `post:${params.id}`,
    () => db.posts.find(params.id),
    { maxAge: 3600, tags: ['posts', `post-${params.id}`] }
  )

  return { post }
})
```

### With Conditional Caching

```ts
const post = await cached(
  `post:${params.id}`,
  async () => {
    const post = await db.posts.find(params.id)

    // Don't cache drafts - just return without caching
    if (post.status === 'draft') {
      return post // Will still be cached; handle draft logic elsewhere
    }

    return post
  },
  { maxAge: 3600, tags: ['posts'] }
)
```

> **Note:** The `cached` function always caches the result. For conditional caching, consider using `getCache()` and `setCache()` directly to control when values are stored.

## cacheKey / generateCacheKey

Generates cache keys from parts.

### Signatures

```ts
function cacheKey(...parts: string[]): string
function generateCacheKey(...parts: string[]): string
```

### Example

```ts
const key = cacheKey('posts', userId, 'page', page)
// 'posts:123:page:1'

const key2 = generateCacheKey('user', id, 'profile')
// 'user:456:profile'
```

## buildCacheControl

Builds a Cache-Control header string.

### Signature

```ts
function buildCacheControl(options: CacheControlOptions): string
```

### Options

```ts
interface CacheControlOptions {
  maxAge?: number
  sMaxAge?: number
  staleWhileRevalidate?: number
  staleIfError?: number
  private?: boolean
  public?: boolean
  noCache?: boolean
  noStore?: boolean
  mustRevalidate?: boolean
  immutable?: boolean
}
```

### Example

```ts
const header = buildCacheControl({
  maxAge: 3600,
  staleWhileRevalidate: 86400,
  public: true
})
// 'public, max-age=3600, stale-while-revalidate=86400'

const privateHeader = buildCacheControl({
  maxAge: 60,
  private: true,
  mustRevalidate: true
})
// 'private, max-age=60, must-revalidate'
```

## parseCacheControl

Parses a Cache-Control header string.

### Signature

```ts
function parseCacheControl(header: string): CacheControlOptions
```

### Example

```ts
const options = parseCacheControl('public, max-age=3600, stale-while-revalidate=86400')
// {
//   public: true,
//   maxAge: 3600,
//   staleWhileRevalidate: 86400
// }
```

## Cached Decorator

Decorator for caching class methods.

### Example

```ts
class PostService {
  @Cached({ ttl: 3600, tags: ['posts'] })
  async getPost(id: string) {
    return await db.posts.find(id)
  }

  @Cached({ ttl: 300 })
  async getPopularPosts() {
    return await db.posts.findPopular()
  }
}
```

## createDataCacheAdapter

Creates a CacheAdapter from MemoryCache.

### Signature

```ts
function createDataCacheAdapter(cache: MemoryCache): CacheAdapter
```

### Example

```ts
const memCache = new MemoryCache({ maxSize: 1000 })
const adapter = createDataCacheAdapter(memCache)

// Use as CacheAdapter
await adapter.set('key', value, { ttl: 3600 })
const value = await adapter.get('key')
```

## Caching in Loaders

### Basic Caching

```ts
export const loader = createLoader(async ({ params }) => {
  const post = await cached(
    cacheKey('post', params.id),
    () => db.posts.find(params.id),
    { maxAge: 3600, tags: ['posts'] }
  )

  return { post }
})
```

### Conditional Caching

```ts
export const loader = createLoader(async ({ params, context }) => {
  const user = context.get('user')

  // Different cache strategies based on auth
  const post = await cached(
    cacheKey('post', params.id, user ? 'auth' : 'anon'),
    () => db.posts.find(params.id),
    {
      maxAge: user ? 60 : 3600,
      tags: ['posts', `post-${params.id}`]
    }
  )

  return { post }
})
```

### Cache with Fallback

```ts
export const loader = createLoader(async ({ params }) => {
  const cache = getCache()
  const entry = await cache.get(`post:${params.id}`)

  let post = entry?.value

  if (!post) {
    post = await db.posts.find(params.id)

    if (post) {
      await cache.set(`post:${params.id}`, {
        value: post,
        timestamp: Date.now(),
        maxAge: 3600,
        tags: ['posts', `post-${params.id}`]
      })
    }
  }

  if (!post) {
    throw new Response('Not Found', { status: 404 })
  }

  return { post }
})
```

## Cache Patterns

### Stale-While-Revalidate

The `cached` function has built-in SWR support:

```ts
// Use staleWhileRevalidate option for automatic background refresh
const post = await cached(
  `post:${params.id}`,
  () => db.posts.find(params.id),
  {
    maxAge: 3600,              // Fresh for 1 hour
    staleWhileRevalidate: 86400, // Serve stale for up to 24 more hours while refreshing
    tags: ['posts']
  }
)
```

Or implement custom SWR logic:

```ts
async function getWithSWR<T>(
  key: string,
  fetcher: () => Promise<T>,
  maxAge: number,
  swr: number
): Promise<T> {
  const cache = getCache()
  const entry = await cache.get<T>(key)
  const now = Date.now()

  if (entry) {
    const age = (now - entry.timestamp) / 1000

    // Fresh: return cached value
    if (age < maxAge) {
      return entry.value
    }

    // Stale but within SWR window: return cached and refresh in background
    if (age < maxAge + swr) {
      // Fire-and-forget background refresh
      fetcher().then(async value => {
        await cache.set(key, {
          value,
          timestamp: Date.now(),
          maxAge,
          staleWhileRevalidate: swr,
          tags: []
        })
      })
      return entry.value
    }
  }

  // Expired or missing: fetch fresh
  const value = await fetcher()
  await cache.set(key, {
    value,
    timestamp: now,
    maxAge,
    staleWhileRevalidate: swr,
    tags: []
  })
  return value
}
```

### Cache Warming

```ts
async function warmCache() {
  const cache = getCache()
  const popularPosts = await db.posts.findPopular(10)

  for (const post of popularPosts) {
    await cache.set(`post:${post.id}`, {
      value: post,
      timestamp: Date.now(),
      maxAge: 3600,
      tags: ['posts', `post-${post.id}`]
    })
  }
}
```

### Cache Busting

```ts
async function bustCache(pattern: RegExp) {
  const cache = getCache()
  const keys = await cache.keys()

  for (const key of keys) {
    if (pattern.test(key)) {
      await cache.delete(key)
    }
  }
}

// Bust all post caches
await bustCache(/^post:/)

// Or use tag-based invalidation (preferred)
await cache.deleteByTag('posts')
```

## Related

- [Caching Concepts](/core-concepts/caching)
- [Core Cache API](/api/core/cache)
- [Revalidation](/api/data/revalidation)
