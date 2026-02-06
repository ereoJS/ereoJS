# Streaming SSR

This guide covers streaming server-side rendering in EreoJS.

## Overview

Streaming SSR sends HTML progressively as it's rendered, providing:

- Faster Time to First Byte (TTFB)
- Progressive content loading
- Better perceived performance
- SEO-friendly (critical content renders first)

## Enabling Streaming

```tsx
// routes/posts/[id].tsx
export const config = {
  render: 'streaming'
}
```

## Deferred Data

Use `defer` for non-critical data that can load after the initial render:

```tsx
import { createLoader, defer } from '@ereo/data'
import { Suspense } from 'react'
import { Await } from '@ereo/client'

export const config = {
  render: 'streaming'
}

export const loader = createLoader(async ({ params }) => {
  // Critical data - awaited immediately
  const post = await db.posts.find(params.id)

  if (!post) {
    throw new Response('Not Found', { status: 404 })
  }

  // Non-critical data - deferred
  const comments = defer(db.comments.findByPost(post.id))
  const related = defer(getRelatedPosts(post.id))
  const author = defer(db.users.find(post.authorId))

  return { post, comments, related, author }
})

export default function Post({ loaderData }) {
  const { post, comments, related, author } = loaderData

  return (
    <article>
      {/* Renders immediately */}
      <h1>{post.title}</h1>
      <p>{post.content}</p>

      {/* Author loads later */}
      <Suspense fallback={<AuthorSkeleton />}>
        <Await resolve={author}>
          {(authorData) => <AuthorCard author={authorData} />}
        </Await>
      </Suspense>

      {/* Comments stream in */}
      <section>
        <h2>Comments</h2>
        <Suspense fallback={<CommentsSkeleton />}>
          <Await resolve={comments}>
            {(commentsData) => <CommentList comments={commentsData} />}
          </Await>
        </Suspense>
      </section>

      {/* Related posts load last */}
      <Suspense fallback={<RelatedSkeleton />}>
        <Await resolve={related}>
          {(relatedData) => <RelatedPosts posts={relatedData} />}
        </Await>
      </Suspense>
    </article>
  )
}
```

## How Streaming Works

```
Timeline:
─────────────────────────────────────────────────────────>

0ms     50ms    100ms   200ms   500ms   800ms
│       │       │       │       │       │
│       └─ Post content rendered
│               │
│               └─ Author data arrives, rendered
│                       │
│                       └─ Comments arrive, rendered
│                               │
│                               └─ Related posts arrive, rendered
│
└─ HTML shell sent
```

The browser receives and displays content as it arrives, rather than waiting for everything.

## Await Component

The `Await` component renders deferred data:

```tsx
import { Await } from '@ereo/client'

<Await
  resolve={deferredData}
  errorElement={<ErrorFallback />}
>
  {(data) => <Component data={data} />}
</Await>
```

### Props

| Prop | Type | Description |
|------|------|-------------|
| `resolve` | `DeferredData<T>` | The deferred data promise |
| `children` | `(data: T) => ReactNode` | Render function |
| `errorElement` | `ReactNode` | Fallback for errors |

### Error Handling

```tsx
<Suspense fallback={<Loading />}>
  <Await
    resolve={loaderData.comments}
    errorElement={
      <div className="error">
        Failed to load comments.
        <button onClick={() => window.location.reload()}>
          Retry
        </button>
      </div>
    }
  >
    {(comments) => <CommentList comments={comments} />}
  </Await>
</Suspense>
```

## Nested Suspense

Create granular loading states:

```tsx
export default function Dashboard({ loaderData }) {
  return (
    <div className="dashboard">
      {/* Stats load first */}
      <Suspense fallback={<StatsSkeleton />}>
        <Await resolve={loaderData.stats}>
          {(stats) => <StatsPanel stats={stats} />}
        </Await>
      </Suspense>

      <div className="grid">
        {/* Chart loads independently */}
        <Suspense fallback={<ChartSkeleton />}>
          <Await resolve={loaderData.chartData}>
            {(data) => <Chart data={data} />}
          </Await>
        </Suspense>

        {/* Table loads independently */}
        <Suspense fallback={<TableSkeleton />}>
          <Await resolve={loaderData.tableData}>
            {(data) => <DataTable data={data} />}
          </Await>
        </Suspense>
      </div>
    </div>
  )
}
```

## Skeleton Components

Create meaningful loading states:

```tsx
function CommentsSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      {[1, 2, 3].map((i) => (
        <div key={i} className="bg-gray-200 rounded-lg p-4">
          <div className="h-4 bg-gray-300 rounded w-1/4 mb-2" />
          <div className="h-3 bg-gray-300 rounded w-full mb-1" />
          <div className="h-3 bg-gray-300 rounded w-2/3" />
        </div>
      ))}
    </div>
  )
}
```

## Parallel vs Sequential Loading

### Parallel (Recommended)

```tsx
export const loader = createLoader(async ({ params }) => {
  // All start at the same time
  const post = await db.posts.find(params.id)

  return {
    post,
    comments: defer(db.comments.findByPost(post.id)),
    related: defer(getRelatedPosts(post.id)),
    author: defer(db.users.find(post.authorId))
  }
})
```

### Sequential (When Needed)

```tsx
export const loader = createLoader(async ({ params }) => {
  const post = await db.posts.find(params.id)

  // Author depends on post
  const author = await db.users.find(post.authorId)

  return {
    post,
    author,
    // These can still be deferred
    comments: defer(db.comments.findByPost(post.id))
  }
})
```

## When to Use Streaming

### Good Use Cases

- Pages with multiple data sources
- Slow API calls that aren't critical
- Large datasets that can load progressively
- User-specific content alongside static content

### When to Avoid

- Simple pages with fast data loading
- When all data is equally critical
- When SEO requires all content immediately
- Very small pages where overhead isn't worth it

## Performance Tips

1. **Prioritize critical content** - Keep important content in the initial render
2. **Use meaningful skeletons** - Match the final layout shape
3. **Group related data** - Defer related items together
4. **Test on slow networks** - Verify streaming benefits
5. **Monitor TTFB** - Ensure streaming improves it

## Server Configuration

Ensure your server supports streaming:

```ts
// The default Bun server supports streaming automatically
const server = createServer(app)
```

For reverse proxies, disable buffering:

```nginx
# Nginx
proxy_buffering off;
proxy_http_version 1.1;
```
