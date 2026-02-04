# Prefetch

Prefetching APIs for loading data before navigation.

## Import

```ts
import {
  prefetch,
  getPrefetchedData,
  clearPrefetchCache,
  setupLinkPrefetch,
  setupAutoPrefetch,
  prefetchAll,
  isPrefetching,
  isPrefetched
} from '@ereo/client'
```

## Types

```ts
interface PrefetchOptions {
  // Prefetch strategy
  strategy?: 'hover' | 'viewport' | 'eager' | 'none'

  // Cache duration in milliseconds (default: 30000)
  cacheDuration?: number

  // Intersection observer threshold for viewport strategy
  threshold?: number
}

interface LinkPrefetchProps {
  href: string
  prefetch?: PrefetchOptions['strategy']
  children: React.ReactNode
}
```

## prefetch

Prefetches data for a URL and caches the result.

### Signature

```ts
function prefetch(url: string): Promise<void>
```

### Example

```ts
import { prefetch } from '@ereo/client'

// Prefetch a route
await prefetch('/posts/123')

// Prefetch dashboard data
await prefetch('/dashboard')
```

The prefetch function:
- Checks the cache first (30 second default duration)
- Fetches with low priority to not block other requests
- Adds `X-Prefetch: true` header for server-side optimization

## getPrefetchedData

Gets prefetched data for a route.

```ts
const data = getPrefetchedData('/posts/123')
if (data) {
  // Data was prefetched
  console.log(data.post)
}
```

## clearPrefetchCache

Clears the entire prefetch cache.

### Signature

```ts
function clearPrefetchCache(): void
```

### Example

```ts
import { clearPrefetchCache } from '@ereo/client'

// Clear all cached prefetch data
clearPrefetchCache()
```

## setupLinkPrefetch

Sets up prefetching for a specific link element.

### Signature

```ts
function setupLinkPrefetch(
  element: HTMLAnchorElement,
  options?: PrefetchOptions
): () => void  // Returns cleanup function
```

### Example

```ts
import { setupLinkPrefetch } from '@ereo/client'

const link = document.querySelector('a[href="/posts"]') as HTMLAnchorElement
const cleanup = setupLinkPrefetch(link, { strategy: 'hover' })

// Clean up when done
cleanup()
```

## setupAutoPrefetch

Enables automatic prefetching for all links on the page.

### Signature

```ts
function setupAutoPrefetch(options?: PrefetchOptions): () => void
```

### Example

```ts
import { setupAutoPrefetch } from '@ereo/client'

// Setup automatic prefetching with hover strategy
const cleanup = setupAutoPrefetch({ strategy: 'hover' })

// This function:
// - Sets up prefetch listeners on existing links
// - Watches for new links added to the DOM
// - Returns a cleanup function

// Clean up when no longer needed
cleanup()
```

## prefetchAll

Prefetches multiple routes.

```ts
await prefetchAll([
  '/posts',
  '/posts/123',
  '/about'
])
```

## isPrefetching

Check if a URL is currently being prefetched.

### Signature

```ts
function isPrefetching(url: string): boolean
```

### Example

```ts
import { isPrefetching } from '@ereo/client'

if (isPrefetching('/posts/123')) {
  console.log('Prefetch in progress for /posts/123')
}
```

## isPrefetched

Check if a URL has been prefetched and cached.

### Signature

```ts
function isPrefetched(url: string): boolean
```

### Example

```ts
import { isPrefetched } from '@ereo/client'

if (isPrefetched('/posts/123')) {
  console.log('Route data is cached')
}
```

## With Link Component

The `Link` component has built-in prefetch support:

```tsx
// No prefetching
<Link to="/posts" prefetch="none">Posts</Link>

// Prefetch on hover/focus (default)
<Link to="/posts" prefetch="intent">Posts</Link>

// Prefetch immediately when link renders
<Link to="/posts" prefetch="render">Posts</Link>

// Prefetch when link enters viewport
<Link to="/posts" prefetch="viewport">Posts</Link>
```

## Programmatic Prefetching

```tsx
import { prefetch } from '@ereo/client'
import { Link } from '@ereo/client'

function ProductCard({ product }) {
  const handleMouseEnter = () => {
    prefetch(`/products/${product.id}`)
  }

  return (
    <div onMouseEnter={handleMouseEnter}>
      <Link to={`/products/${product.id}`}>
        {product.name}
      </Link>
    </div>
  )
}
```

## Prefetch Strategies

| Strategy | Description |
|----------|-------------|
| `none` | No prefetching |
| `hover` | Prefetch on mouseenter (for `setupLinkPrefetch`) |
| `viewport` | Prefetch when element enters viewport |
| `eager` | Prefetch immediately |
| `intent` | Prefetch on hover/focus (for `Link` component) |
| `render` | Prefetch when component renders (for `Link` component) |

## Cache Behavior

- Default cache duration: 30 seconds
- Cached entries are reused within the duration
- Cache is cleared on page unload
- Use `clearPrefetchCache()` to manually clear

## Related

- [Link Component](/api/client/link)
- [Navigation](/api/client/navigation)
