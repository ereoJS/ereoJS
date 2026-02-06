# Performance Optimization

This guide covers performance optimization techniques for EreoJS applications.

## Bundle Size

### Code Splitting

EreoJS automatically code-splits routes:

```
dist/
├── client/
│   ├── routes/
│   │   ├── index.js      # Only loads on /
│   │   ├── posts.js      # Only loads on /posts
│   │   └── about.js      # Only loads on /about
│   └── shared/
│       └── vendor.js     # Shared dependencies
```

### Dynamic Imports

Lazy load heavy components:

```tsx
import { lazy, Suspense } from 'react'

const HeavyChart = lazy(() => import('../components/HeavyChart'))

export default function Dashboard({ loaderData }) {
  return (
    <div>
      <h1>Dashboard</h1>
      <Suspense fallback={<ChartSkeleton />}>
        <HeavyChart data={loaderData.chartData} />
      </Suspense>
    </div>
  )
}
```

### Tree Shaking

Import only what you need:

```tsx
// Good - tree shakeable
import { format } from 'date-fns/format'

// Avoid - imports entire library
import { format } from 'date-fns'
```

### Analyze Bundle

```bash
bun ereo build --analyze
```

This opens an interactive visualization of your bundle.

## Islands Optimization

### Minimize Island Size

```tsx
// Keep islands small and focused
// islands/LikeButton.tsx
export default function LikeButton({ postId, initialLikes }) {
  const [likes, setLikes] = useState(initialLikes)
  const like = () => fetch(`/api/like/${postId}`, { method: 'POST' })
    .then(r => r.json())
    .then(d => setLikes(d.likes))

  return <button onClick={like}>❤️ {likes}</button>
}
```

### Defer Non-Critical Islands

```tsx
// Hydrate when visible
<Comments
  data-island="Comments"
  data-hydrate="visible"
  postId={post.id}
/>

// Hydrate when idle
<RelatedPosts
  data-island="RelatedPosts"
  data-hydrate="idle"
  posts={related}
/>
```

### Share State Efficiently

```tsx
// lib/store.ts - shared between islands
import { signal } from '@ereo/state'

export const cartItems = signal([])
export const cartTotal = computed(
  () => cartItems.get().reduce((sum, i) => sum + i.price, 0),
  [cartItems]
)

// Multiple islands can use the same signals
```

## Data Loading

### Parallel Loading

```tsx
export const loader = createLoader(async ({ params }) => {
  // Parallel - faster
  const [post, comments, author] = await Promise.all([
    db.posts.find(params.id),
    db.comments.findByPost(params.id),
    db.users.find(params.authorId)
  ])

  return { post, comments, author }
})
```

### Avoid Waterfalls

```tsx
// Bad - waterfall
export const loader = createLoader(async ({ params }) => {
  const post = await db.posts.find(params.id)
  const author = await db.users.find(post.authorId)  // Waits for post
  const comments = await db.comments.findByPost(post.id)  // Waits for author

  return { post, author, comments }
})

// Good - parallel where possible
export const loader = createLoader(async ({ params }) => {
  const post = await db.posts.find(params.id)

  const [author, comments] = await Promise.all([
    db.users.find(post.authorId),
    db.comments.findByPost(post.id)
  ])

  return { post, author, comments }
})
```

### Use Streaming for Slow Data

```tsx
export const config = { render: 'streaming' }

export const loader = createLoader(async ({ params }) => {
  const post = await db.posts.find(params.id)

  return {
    post,
    comments: defer(db.comments.findByPost(post.id)),
    recommendations: defer(getRecommendations(post.id))
  }
})
```

## Database Optimization

### Use Indexes

```sql
-- Index frequently queried columns
CREATE INDEX idx_posts_slug ON posts(slug);
CREATE INDEX idx_posts_author ON posts(author_id);
CREATE INDEX idx_posts_created ON posts(created_at DESC);
```

### Efficient Queries

```tsx
// Bad - N+1 problem
const posts = await db.posts.findMany()
for (const post of posts) {
  post.author = await db.users.find(post.authorId)
}

// Good - single query with join
const posts = await db.query(`
  SELECT posts.*, users.name as author_name
  FROM posts
  JOIN users ON posts.author_id = users.id
  ORDER BY posts.created_at DESC
`)
```

### Pagination

```tsx
export const loader = createLoader(async ({ request }) => {
  const url = new URL(request.url)
  const page = parseInt(url.searchParams.get('page') || '1')
  const limit = 20

  const [posts, total] = await Promise.all([
    db.posts.findMany({
      take: limit,
      skip: (page - 1) * limit,
      orderBy: { createdAt: 'desc' }
    }),
    db.posts.count()
  ])

  return {
    posts,
    pagination: {
      page,
      totalPages: Math.ceil(total / limit),
      hasNext: page * limit < total
    }
  }
})
```

## Caching

### Cache Expensive Operations

```tsx
import { cached } from '@ereo/data'

export const loader = createLoader(async () => {
  const stats = await cached(
    'dashboard-stats',
    async () => {
      // Expensive aggregation
      return await db.query(`
        SELECT
          COUNT(*) as total_posts,
          SUM(views) as total_views,
          AVG(rating) as avg_rating
        FROM posts
      `)
    },
    { ttl: 300, tags: ['stats'] }
  )

  return { stats }
})
```

### Use Stale-While-Revalidate

```tsx
export const config = {
  cache: {
    maxAge: 60,
    staleWhileRevalidate: 3600
  }
}
```

## Image Optimization

### Use Next-Gen Formats

```tsx
<picture>
  <source srcSet="/image.avif" type="image/avif" />
  <source srcSet="/image.webp" type="image/webp" />
  <img src="/image.jpg" alt="Description" />
</picture>
```

### Lazy Load Images

```tsx
<img
  src="/image.jpg"
  alt="Description"
  loading="lazy"
  decoding="async"
/>
```

### Responsive Images

```tsx
<img
  src="/image.jpg"
  srcSet="/image-320.jpg 320w, /image-640.jpg 640w, /image-1280.jpg 1280w"
  sizes="(max-width: 320px) 280px, (max-width: 640px) 600px, 1200px"
  alt="Description"
/>
```

## Monitoring

### Add Performance Metrics

```tsx
// middleware/metrics.ts
export const metricsMiddleware: MiddlewareHandler = async (request, context, next) => {
  const start = performance.now()
  const response = await next()
  const duration = performance.now() - start

  // Log slow requests
  if (duration > 1000) {
    console.warn(`Slow request: ${request.url} took ${duration}ms`)
  }

  // Add Server-Timing header
  response.headers.set('Server-Timing', `total;dur=${duration}`)

  return response
}
```

### Web Vitals

```tsx
// Track Core Web Vitals
import { onCLS, onFID, onLCP } from 'web-vitals'

onCLS(console.log)
onFID(console.log)
onLCP(console.log)
```

## Checklist

- [ ] Run bundle analyzer
- [ ] Enable code splitting
- [ ] Use islands for interactivity
- [ ] Implement data caching
- [ ] Add database indexes
- [ ] Use streaming for slow data
- [ ] Optimize images
- [ ] Set up monitoring
- [ ] Test on slow networks
- [ ] Profile and measure
