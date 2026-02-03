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

## prefetch

Prefetches data for a route.

### Signature

```ts
function prefetch(href: string, options?: PrefetchOptions): Promise<void>

interface PrefetchOptions {
  // Priority of the prefetch
  priority?: 'high' | 'low'

  // Time to wait before prefetching (ms)
  delay?: number
}
```

### Example

```ts
// Prefetch a route
await prefetch('/posts/123')

// With options
await prefetch('/dashboard', {
  priority: 'high'
})
```

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

Clears the prefetch cache.

```ts
// Clear all
clearPrefetchCache()

// Clear specific route
clearPrefetchCache('/posts/123')
```

## setupLinkPrefetch

Sets up prefetching for a link element.

```ts
const link = document.querySelector('a[href="/posts"]')
setupLinkPrefetch(link, 'intent')
```

## setupAutoPrefetch

Enables automatic prefetching on hover/visibility.

```ts
setupAutoPrefetch({
  // Prefetch on hover
  onHover: true,
  hoverDelay: 100,

  // Prefetch when visible
  onVisible: true,
  visibleThreshold: 0.5
})
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

## isPrefetching / isPrefetched

Check prefetch status.

```ts
if (isPrefetching()) {
  console.log('Prefetch in progress')
}

if (isPrefetched('/posts/123')) {
  console.log('Route is prefetched')
}
```

## With Link Component

The `Link` component has built-in prefetch support:

```tsx
// No prefetching
<Link href="/posts" prefetch="none">Posts</Link>

// Prefetch on hover/focus
<Link href="/posts" prefetch="intent">Posts</Link>

// Prefetch immediately
<Link href="/posts" prefetch="render">Posts</Link>

// Prefetch when visible
<Link href="/posts" prefetch="viewport">Posts</Link>
```

## Programmatic Prefetching

```tsx
function ProductCard({ product }) {
  const handleMouseEnter = () => {
    prefetch(`/products/${product.id}`)
  }

  return (
    <div onMouseEnter={handleMouseEnter}>
      <Link href={`/products/${product.id}`}>
        {product.name}
      </Link>
    </div>
  )
}
```

## Related

- [Link Component](/api/client/link)
- [Navigation](/api/client/navigation)
