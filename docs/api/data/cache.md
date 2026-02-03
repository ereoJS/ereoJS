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

In-memory cache implementation.

### Constructor

```ts
new MemoryCache(options?: { maxSize?: number; ttl?: number })
```

### Methods

```ts
class MemoryCache {
  get<T>(key: string): T | undefined
  set<T>(key: string, value: T, ttl?: number): void
  delete(key: string): boolean
  has(key: string): boolean
  clear(): void
  keys(): string[]
  size(): number
}
```

### Example

```ts
const cache = new MemoryCache({ maxSize: 1000, ttl: 3600 })

// Set a value
cache.set('user:123', { name: 'Alice' })

// Get a value
const user = cache.get('user:123')

// Set with custom TTL
cache.set('session:abc', { userId: 123 }, 1800) // 30 minutes

// Check existence
if (cache.has('user:123')) {
  console.log('User is cached')
}

// Delete
cache.delete('user:123')

// Clear all
cache.clear()

// Get all keys
const keys = cache.keys()

// Get size
console.log(`Cache has ${cache.size()} entries`)
```

## getCache / setCache

Global cache accessors.

### Signatures

```ts
function getCache<T>(key: string): T | undefined
function setCache<T>(key: string, value: T, ttl?: number): void
```

### Example

```ts
// Store in global cache
setCache('config', { theme: 'dark' })

// Retrieve from global cache
const config = getCache('config')
```

## cached

Wraps a function with caching.

### Signature

```ts
function cached<T>(
  key: string,
  fn: () => T | Promise<T>,
  options?: { ttl?: number; tags?: string[] }
): Promise<T>
```

### Example

```ts
export const loader = createLoader(async ({ params }) => {
  // Cache the database call
  const post = await cached(
    `post:${params.id}`,
    () => db.posts.find(params.id),
    { ttl: 3600, tags: ['posts', `post-${params.id}`] }
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

    // Don't cache drafts
    if (post.status === 'draft') {
      throw new CacheSkip()
    }

    return post
  },
  { ttl: 3600 }
)
```

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
    { ttl: 3600 }
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
      ttl: user ? 60 : 3600,
      tags: ['posts', `post-${params.id}`]
    }
  )

  return { post }
})
```

### Cache with Fallback

```ts
export const loader = createLoader(async ({ params }) => {
  let post = await getCache(`post:${params.id}`)

  if (!post) {
    post = await db.posts.find(params.id)

    if (post) {
      setCache(`post:${params.id}`, post, 3600)
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

```ts
async function getWithSWR<T>(
  key: string,
  fetcher: () => Promise<T>,
  maxAge: number,
  swr: number
): Promise<T> {
  const cached = await getCache<{ value: T; timestamp: number }>(key)
  const now = Date.now()

  if (cached) {
    const age = (now - cached.timestamp) / 1000

    // Fresh: return cached
    if (age < maxAge) {
      return cached.value
    }

    // Stale but within SWR: return cached and refresh in background
    if (age < maxAge + swr) {
      // Background refresh
      fetcher().then(value => {
        setCache(key, { value, timestamp: Date.now() }, maxAge + swr)
      })
      return cached.value
    }
  }

  // Expired or missing: fetch fresh
  const value = await fetcher()
  setCache(key, { value, timestamp: now }, maxAge + swr)
  return value
}
```

### Cache Warming

```ts
async function warmCache() {
  const popularPosts = await db.posts.findPopular(10)

  for (const post of popularPosts) {
    setCache(`post:${post.id}`, post, 3600)
  }
}
```

### Cache Busting

```ts
function bustCache(pattern: string) {
  const cache = new MemoryCache()
  const keys = cache.keys()

  for (const key of keys) {
    if (key.match(pattern)) {
      cache.delete(key)
    }
  }
}

// Bust all post caches
bustCache(/^post:/)
```

## Related

- [Caching Concepts](/core-concepts/caching)
- [Core Cache API](/api/core/cache)
- [Revalidation](/api/data/revalidation)
