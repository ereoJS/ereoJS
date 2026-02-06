# Rendering Modes

EreoJS supports multiple rendering modes, allowing you to choose the best approach for each route based on your requirements for performance, SEO, and interactivity.

## Overview

| Mode | When Renders | Use Case |
|------|--------------|----------|
| **SSR** | Every request | Dynamic content, personalization |
| **SSG** | Build time | Static content, blogs, docs |
| **CSR** | Client-side | Dashboards, authenticated apps |
| **Streaming** | Progressive | Large pages, slow data sources |

## Server-Side Rendering (SSR)

SSR renders the page on every request. The server fetches data, renders HTML, and sends the complete page to the browser.

```tsx
// routes/posts/[id].tsx
export const config = {
  render: 'ssr'
}

export const loader = createLoader(async ({ params }) => {
  const post = await db.posts.find(params.id)
  return { post }
})

export default function Post({ loaderData }) {
  return <article>{loaderData.post.content}</article>
}
```

**Benefits:**
- Always fresh content
- Good for personalized or frequently changing data
- SEO-friendly

**Trade-offs:**
- Server compute on every request
- Slower TTFB than SSG

### When to Use SSR

- User-specific content (dashboards, profiles)
- Frequently updated data (news, stock prices)
- Content that must be current (inventory, pricing)
- Pages requiring authentication context

## Static Site Generation (SSG)

SSG renders pages at build time. The HTML is generated once and served from a CDN for all subsequent requests.

```tsx
// routes/about.tsx
export const config = {
  render: 'ssg'
}

export const loader = createLoader(async () => {
  const team = await getTeamMembers()
  return { team }
})

export default function About({ loaderData }) {
  return <TeamGrid members={loaderData.team} />
}
```

**Benefits:**
- Fastest possible load times
- Reduced server load
- Can be served from edge CDN

**Trade-offs:**
- Content only updates on rebuild
- Not suitable for personalized content

### Dynamic SSG Routes

Generate pages for dynamic routes at build time:

```tsx
// routes/posts/[slug].tsx
export const config = {
  render: 'ssg'
}

// Tell EreoJS which paths to generate
export async function getStaticPaths() {
  const posts = await db.posts.findMany()
  return posts.map(post => ({
    params: { slug: post.slug }
  }))
}

export const loader = createLoader(async ({ params }) => {
  const post = await db.posts.findBySlug(params.slug)
  return { post }
})
```

### Incremental Static Regeneration

Combine SSG with revalidation for the best of both worlds:

```tsx
export const config = {
  render: 'ssg',
  cache: {
    revalidate: 60 // Regenerate every 60 seconds
  }
}
```

The page serves from cache but regenerates in the background when stale.

## Client-Side Rendering (CSR)

CSR sends a minimal HTML shell, then renders the page entirely in the browser.

```tsx
// routes/dashboard.tsx
export const config = {
  render: 'csr'
}

// Loader runs on client
export const loader = createLoader(async () => {
  const response = await fetch('/api/dashboard')
  return response.json()
})

export default function Dashboard({ loaderData }) {
  return <DashboardContent data={loaderData} />
}
```

**Benefits:**
- No server rendering overhead
- Rich interactivity
- Smaller initial payload

**Trade-offs:**
- No SEO (initially empty HTML)
- Slower perceived load (blank page then content)
- Requires JavaScript

### When to Use CSR

- Authenticated dashboards (no SEO needed)
- Complex interactive applications
- When data is entirely client-fetched

## Streaming SSR

Streaming sends HTML progressively as it's rendered. This provides fast time-to-first-byte while allowing slow data to load.

```tsx
// routes/posts/[id].tsx
export const config = {
  render: 'streaming'
}

export const loader = createLoader(async ({ params }) => {
  // Fast data - rendered immediately
  const post = await db.posts.find(params.id)

  // Slow data - streamed later
  const comments = defer(db.comments.findByPost(params.id))
  const recommendations = defer(getRecommendations(params.id))

  return { post, comments, recommendations }
})

export default function Post({ loaderData }) {
  return (
    <article>
      {/* Rendered immediately */}
      <h1>{loaderData.post.title}</h1>
      <p>{loaderData.post.content}</p>

      {/* Streamed when ready */}
      <Suspense fallback={<CommentsSkeleton />}>
        <Await resolve={loaderData.comments}>
          {(comments) => <Comments data={comments} />}
        </Await>
      </Suspense>

      <Suspense fallback={<RecommendationsSkeleton />}>
        <Await resolve={loaderData.recommendations}>
          {(recs) => <Recommendations items={recs} />}
        </Await>
      </Suspense>
    </article>
  )
}
```

**Benefits:**
- Fast TTFB
- Progressive content loading
- Better perceived performance
- SEO-friendly (critical content renders first)

**Trade-offs:**
- More complex component structure
- Requires Suspense boundaries
- Some overhead in streaming setup

### How Streaming Works

```
┌─────────────────────────────────────────────────────────┐
│ Time: 0ms                                               │
│ Server: Start rendering, send HTML shell                │
│ Browser: Receives <html><head>...<body>                 │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│ Time: 50ms                                              │
│ Server: Post data ready, send article content           │
│ Browser: Displays article with loading placeholders     │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│ Time: 200ms                                             │
│ Server: Comments ready, stream comment chunk            │
│ Browser: Comments replace skeleton                      │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│ Time: 500ms                                             │
│ Server: Recommendations ready, stream final chunk       │
│ Browser: Page complete                                  │
└─────────────────────────────────────────────────────────┘
```

## Hybrid Rendering

Different routes can use different rendering modes:

```tsx
// routes/index.tsx - SSG for landing page
export const config = { render: 'ssg' }

// routes/blog/[slug].tsx - SSG with revalidation for blog posts
export const config = {
  render: 'ssg',
  cache: { revalidate: 3600 }
}

// routes/dashboard/index.tsx - CSR for authenticated dashboard
export const config = { render: 'csr' }

// routes/search.tsx - SSR for dynamic search
export const config = { render: 'ssr' }

// routes/products/[id].tsx - Streaming for product pages
export const config = { render: 'streaming' }
```

## Per-Request Mode Selection

Choose rendering mode dynamically:

```tsx
export const config = {
  render: ({ request }) => {
    // Bots get SSR for SEO
    const userAgent = request.headers.get('User-Agent')
    if (isBot(userAgent)) {
      return 'ssr'
    }

    // Logged-in users get streaming
    if (request.headers.get('Cookie')?.includes('session')) {
      return 'streaming'
    }

    // Default to SSG
    return 'ssg'
  }
}
```

## Comparison Table

| Feature | SSR | SSG | CSR | Streaming |
|---------|-----|-----|-----|-----------|
| SEO | Excellent | Excellent | Poor | Excellent |
| TTFB | Medium | Fast | Fast | Fast |
| Time to Interactive | Medium | Fast | Slow | Medium |
| Server Load | High | None | None | Medium |
| Content Freshness | Real-time | Build-time | Real-time | Real-time |
| Personalization | Yes | No | Yes | Yes |
| Caching | Complex | Easy | N/A | Complex |

## Choosing a Rendering Mode

```
Is the content the same for all users?
├─ Yes → Does it change frequently?
│        ├─ No → SSG
│        └─ Yes → SSG + revalidation or SSR
└─ No → Is SEO important?
         ├─ Yes → Does it have slow data sources?
         │        ├─ Yes → Streaming
         │        └─ No → SSR
         └─ No → CSR
```

## Best Practices

1. **Default to SSR** - Start with SSR, optimize to SSG/streaming as needed
2. **Use SSG for static content** - Marketing pages, docs, blog posts
3. **Stream slow data** - Don't block on non-critical data
4. **CSR sparingly** - Only when SEO doesn't matter
5. **Monitor TTFB** - Streaming helps when SSR is slow
6. **Test with slow connections** - Streaming benefits are most visible on slow networks

## Anti-Patterns

### Using CSR for SEO-critical pages

CSR pages have empty HTML until JavaScript loads — search engines may not index them properly. Use SSR or SSG for any page that needs to appear in search results.

### SSG for frequently changing data

If your data changes every few minutes, SSG with long revalidation intervals serves stale content. Use SSR or SSG with short `revalidate` instead.

### Streaming everything

Streaming adds complexity (Suspense boundaries, loading states). Only use streaming for routes with genuinely slow data sources. For fast queries, SSR is simpler and equally performant.

### Mixing rendering modes in a layout

A layout's rendering mode affects all child routes. If the layout is SSG, child SSR routes may behave unexpectedly. Keep layout rendering modes compatible with their children.

## Decision Tree

```
Need SEO? ─── No → CSR (dashboards, authenticated apps)
  │
  Yes
  │
Content changes often? ─── No → SSG (blogs, docs, marketing)
  │
  Yes
  │
Has slow data sources? ─── Yes → Streaming SSR
  │
  No → SSR
```
