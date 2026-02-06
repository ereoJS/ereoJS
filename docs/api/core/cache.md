# Cache

EreoJS provides a flexible caching system with support for tag-based invalidation.

## Import

```ts
import {
  createCache,
  createTaggedCache,
  MemoryCacheAdapter,
  isTaggedCache,
  wrapCacheAdapter
} from '@ereo/core'
```

## createCache

Creates a basic in-memory cache.

### Signature

```ts
function createCache(options?: CacheOptions): CacheAdapter
```

### Options

```ts
interface CacheOptions {
  // Maximum number of entries (default: Infinity)
  maxSize?: number

  // Default TTL in seconds for all entries
  defaultTtl?: number

  // Enable tag support (used internally)
  tagged?: boolean
}
```

### CacheAdapter Interface

```ts
interface CacheAdapter {
  get<T>(key: string): Promise<T | undefined>
  set<T>(key: string, value: T, options?: CacheSetOptions): Promise<void>
  delete(key: string): Promise<boolean>
  has(key: string): Promise<boolean>
  clear(): Promise<void>
}
```

### Example

```ts
const cache = createCache({
  maxSize: 1000,
  defaultTtl: 3600
})

// Store a value
await cache.set('user:123', { name: 'Alice' })

// Retrieve a value
const user = await cache.get('user:123')

// Check existence
if (await cache.has('user:123')) {
  console.log('User is cached')
}

// Delete a value
await cache.delete('user:123')

// Clear all
await cache.clear()
```

## createTaggedCache

Creates a cache with tag-based invalidation support.

### Signature

```ts
function createTaggedCache(options?: Omit<CacheOptions, 'tagged'>): TaggedCache
```

The `tagged` option is automatically set to `true` — you only need to provide `maxSize` and `defaultTtl`.

### TaggedCache Interface

```ts
interface TaggedCache extends CacheAdapter {
  // Invalidate all entries with a specific tag
  invalidateTag(tag: string): Promise<void>

  // Invalidate all entries with any of the specified tags
  invalidateTags(tags: string[]): Promise<void>

  // Get all keys associated with a tag
  getByTag(tag: string): Promise<string[]>
}
```

> **Note:** The `MemoryCacheAdapter` class (the built-in implementation) also provides `getStats()` and `keys()` methods, but these are not part of the `TaggedCache` interface. If you need them, use `MemoryCacheAdapter` directly.

### Example

```ts
const cache = createTaggedCache({ maxSize: 1000 })

// Store with tags
await cache.set('post:123', post, {
  ttl: 3600,
  tags: ['posts', 'post-123', 'author-456']
})

await cache.set('post:456', anotherPost, {
  ttl: 3600,
  tags: ['posts', 'post-456', 'author-789']
})

// Invalidate all posts
await cache.invalidateTag('posts')

// Invalidate specific post
await cache.invalidateTag('post-123')

// Invalidate multiple tags
await cache.invalidateTags(['author-456', 'author-789'])

// Get stats
const stats = cache.getStats()
console.log(`Cache size: ${stats.size}, Tags: ${stats.tags}`)
```

## MemoryCacheAdapter

The built-in memory cache implementation. Implements both `CacheAdapter` and `TaggedCache` interfaces.

### Constructor

```ts
new MemoryCacheAdapter(options?: CacheOptions)
```

### Methods

```ts
class MemoryCacheAdapter implements TaggedCache {
  // CacheAdapter methods
  get<T>(key: string): Promise<T | undefined>
  set<T>(key: string, value: T, options?: CacheSetOptions): Promise<void>
  delete(key: string): Promise<boolean>
  has(key: string): Promise<boolean>
  clear(): Promise<void>

  // TaggedCache methods
  invalidateTag(tag: string): Promise<void>
  invalidateTags(tags: string[]): Promise<void>
  getByTag(tag: string): Promise<string[]>

  // Additional methods
  keys(): Promise<string[]>
  getStats(): { size: number; tags: number }
}
```

### Example

```ts
const cache = new MemoryCacheAdapter({
  maxSize: 5000,
  defaultTtl: 1800
})

// Use like any other cache
await cache.set('key', 'value')
const value = await cache.get('key')

// Get all keys
const keys = await cache.keys()
console.log(`Cached keys: ${keys.join(', ')}`)

// Get statistics
const stats = cache.getStats()
console.log(`Size: ${stats.size}, Tags: ${stats.tags}`)
```

## CacheSetOptions

Options when setting cache values.

```ts
interface CacheSetOptions {
  // Time to live in seconds
  ttl?: number

  // Tags for invalidation
  tags?: string[]
}
```

## wrapCacheAdapter

Wraps a custom cache implementation to conform to the CacheAdapter interface. Useful for adapting existing cache implementations.

### Signature

```ts
function wrapCacheAdapter(impl: {
  get: <T>(key: string) => Promise<T | undefined> | T | undefined
  set: <T>(key: string, value: T, options?: CacheSetOptions) => Promise<void> | void
  delete: (key: string) => Promise<boolean> | boolean
  has: (key: string) => Promise<boolean> | boolean
  clear: () => Promise<void> | void
}): CacheAdapter
```

### Example

```ts
// Wrap a Map-based cache
const mapCache = new Map<string, unknown>()

const cache = wrapCacheAdapter({
  get(key) {
    return mapCache.get(key)
  },

  set(key, value) {
    mapCache.set(key, value)
  },

  delete(key) {
    return mapCache.delete(key)
  },

  has(key) {
    return mapCache.has(key)
  },

  clear() {
    mapCache.clear()
  }
})

// Now use the standard CacheAdapter interface
await cache.set('key', 'value')
const value = await cache.get('key')
```

### Redis Example

```ts
import Redis from 'ioredis'

const redis = new Redis()

const cache = wrapCacheAdapter({
  async get(key) {
    const value = await redis.get(key)
    return value ? JSON.parse(value) : undefined
  },

  async set(key, value, options) {
    const ttl = options?.ttl || 3600
    await redis.setex(key, ttl, JSON.stringify(value))
  },

  async delete(key) {
    const result = await redis.del(key)
    return result > 0
  },

  async has(key) {
    const result = await redis.exists(key)
    return result > 0
  },

  async clear() {
    await redis.flushdb()
  }
})
```

## isTaggedCache

Type guard to check if a cache supports tags.

### Signature

```ts
function isTaggedCache(cache: CacheAdapter): cache is TaggedCache
```

### Example

```ts
const cache = createCache()

if (isTaggedCache(cache)) {
  await cache.invalidateTag('posts')
} else {
  // Fall back to clearing specific keys
  await cache.delete('posts:*')
}
```

## Using Cache in Loaders

```ts
import { createLoader } from '@ereo/data'
import { createTaggedCache } from '@ereo/core'

const cache = createTaggedCache()

export const loader = createLoader(async ({ params }) => {
  const cacheKey = `post:${params.id}`

  // Try cache first
  let post = await cache.get(cacheKey)

  if (!post) {
    // Fetch from database
    post = await db.posts.find(params.id)

    // Store in cache
    await cache.set(cacheKey, post, {
      ttl: 3600,
      tags: ['posts', `post-${params.id}`]
    })
  }

  return { post }
})
```

## Cache Patterns

### Write-Through

```ts
async function createPost(data) {
  const post = await db.posts.create(data)

  // Write to cache immediately
  await cache.set(`post:${post.id}`, post, {
    tags: ['posts', `post-${post.id}`]
  })

  return post
}
```

### Write-Behind

```ts
async function createPost(data) {
  const post = await db.posts.create(data)

  // Invalidate and let next read populate cache
  await cache.invalidateTag('posts')

  return post
}
```

### Cache-Aside with TTL

```ts
async function getPost(id) {
  const cached = await cache.get(`post:${id}`)
  if (cached) return cached

  const post = await db.posts.find(id)
  await cache.set(`post:${id}`, post, { ttl: 300 })

  return post
}
```

## Related

- [Caching Concepts](/concepts/caching)
- [Revalidation](/api/data/revalidation)
- [Data Loading](/concepts/data-loading)
