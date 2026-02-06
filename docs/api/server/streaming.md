# Streaming SSR

Server-side rendering with streaming responses.

## Overview

Streaming SSR sends HTML to the browser as it's generated, improving Time to First Byte (TTFB) and perceived performance.

## Enable Streaming

Set the render mode to `streaming`:

```ts
// routes/posts/[id].tsx
export const config = {
  render: 'streaming'
}
```

## Using defer()

Mark slow data as deferred:

```ts
import { createLoader, defer } from '@ereo/data'

export const loader = createLoader(async ({ params }) => {
  const post = await db.posts.find(params.id)  // Fast

  return {
    post,
    comments: defer(db.comments.findByPost(params.id)),  // Slow
    related: defer(getRelatedPosts(params.id))           // Slow
  }
})
```

## Using Await Component

Render deferred data with Suspense:

```tsx
import { Await, Suspense } from '@ereo/client'

export default function PostPage({ loaderData }) {
  const { post, comments, related } = loaderData

  return (
    <article>
      {/* Renders immediately */}
      <h1>{post.title}</h1>
      <p>{post.content}</p>

      {/* Streams in when ready */}
      <Suspense fallback={<CommentsSkeleton />}>
        <Await resolve={comments}>
          {(data) => <CommentList comments={data} />}
        </Await>
      </Suspense>

      <Suspense fallback={<RelatedSkeleton />}>
        <Await resolve={related}>
          {(data) => <RelatedPosts posts={data} />}
        </Await>
      </Suspense>
    </article>
  )
}
```

## Streaming Flow

```
┌─────────────────────────────────────────────────────────────┐
│                        Server                               │
├─────────────────────────────────────────────────────────────┤
│  1. Receive request                                         │
│  2. Start streaming HTML shell                              │
│  3. Execute loader (deferred data starts loading)           │
│  4. Stream initial content with suspense fallbacks          │
│  5. As deferred data resolves, stream replacement scripts   │
│  6. Close stream                                            │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                        Browser                              │
├─────────────────────────────────────────────────────────────┤
│  1. Receive HTML shell                                      │
│  2. Display content with skeletons                          │
│  3. Receive replacement scripts                             │
│  4. Replace skeletons with actual content                   │
│  5. Hydrate islands                                         │
└─────────────────────────────────────────────────────────────┘
```

## Error Handling

Handle errors in deferred data:

```tsx
<Suspense fallback={<Loading />}>
  <Await
    resolve={comments}
    errorElement={<ErrorMessage />}
  >
    {(data) => <CommentList comments={data} />}
  </Await>
</Suspense>
```

With custom error component:

```tsx
function ErrorMessage({ error }) {
  return (
    <div className="text-red-500">
      Failed to load: {error.message}
    </div>
  )
}
```

## Streaming Configuration

Configure streaming behavior:

```ts
export default defineConfig({
  streaming: {
    // Timeout for deferred data (ms)
    timeout: 10000,

    // Send initial chunk immediately
    flushDelay: 0,

    // Abort on client disconnect
    abortOnClose: true
  }
})
```

## Progressive Enhancement

Streaming works without JavaScript:

```tsx
<Suspense fallback={<Loading />}>
  <Await resolve={data}>
    {(resolved) => (
      <noscript>
        {/* Content still appears, just not progressively */}
      </noscript>
    )}
  </Await>
</Suspense>
```

## Multiple Suspense Boundaries

Nest boundaries for fine-grained loading:

```tsx
<Suspense fallback={<PageSkeleton />}>
  <Header />

  <main>
    <Suspense fallback={<ContentSkeleton />}>
      <Await resolve={content}>
        {(data) => <Content data={data} />}
      </Await>
    </Suspense>

    <aside>
      <Suspense fallback={<SidebarSkeleton />}>
        <Await resolve={sidebar}>
          {(data) => <Sidebar data={data} />}
        </Await>
      </Suspense>
    </aside>
  </main>
</Suspense>
```

## When to Use Streaming

| Scenario | Recommendation |
|----------|----------------|
| Fast data sources | Regular SSR |
| Slow database queries | Streaming + defer |
| External API calls | Streaming + defer |
| Mixed fast/slow data | Streaming with selective defer |
| Static pages | SSG |

## Performance Tips

1. **Defer wisely** - Only defer genuinely slow operations
2. **Meaningful fallbacks** - Use skeletons that match content layout
3. **Error boundaries** - Always handle potential failures
4. **Timeouts** - Set reasonable timeouts for deferred data

## Related

- [Rendering Modes](/concepts/rendering-modes)
- [Advanced Streaming](/architecture/streaming-deep-dive)
- [defer()](/api/data/loaders#defer)
