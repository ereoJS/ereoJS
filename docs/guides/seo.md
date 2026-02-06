# SEO

EreoJS renders HTML on the server by default, giving search engines fully formed pages to index. This guide covers meta tags, structured data, sitemaps, and other SEO patterns.

## Meta Tags

Export a `meta` function from any route to set page metadata. It receives the loader data and route params:

```tsx
// routes/posts/[id].tsx
import type { MetaArgs } from '@ereo/core'

export function meta({ data, params }: MetaArgs) {
  return [
    { title: data.post.title },
    { name: 'description', content: data.post.excerpt },
  ]
}
```

The `meta` function returns an array of objects. Each object maps to an HTML `<meta>` tag or a `<title>` element:

```tsx
export function meta({ data }: MetaArgs) {
  return [
    // <title>
    { title: `${data.post.title} | My Blog` },

    // <meta name="..." content="...">
    { name: 'description', content: data.post.excerpt },
    { name: 'author', content: data.post.author.name },
    { name: 'robots', content: 'index, follow' },
  ]
}
```

## Open Graph Tags

Add Open Graph tags for social media previews:

```tsx
export function meta({ data }: MetaArgs) {
  const post = data.post

  return [
    { title: post.title },
    { name: 'description', content: post.excerpt },

    // Open Graph
    { property: 'og:type', content: 'article' },
    { property: 'og:title', content: post.title },
    { property: 'og:description', content: post.excerpt },
    { property: 'og:image', content: post.coverImage },
    { property: 'og:url', content: `https://example.com/posts/${post.slug}` },

    // Twitter Card
    { name: 'twitter:card', content: 'summary_large_image' },
    { name: 'twitter:title', content: post.title },
    { name: 'twitter:description', content: post.excerpt },
    { name: 'twitter:image', content: post.coverImage },
  ]
}
```

## Canonical URLs

Set a canonical URL to prevent duplicate content issues:

```tsx
export function meta({ data, location }: MetaArgs) {
  return [
    { title: data.page.title },
    { tagName: 'link', rel: 'canonical', href: `https://example.com${location.pathname}` },
  ]
}
```

## Structured Data (JSON-LD)

Add structured data to help search engines understand your content. Return a `<script>` tag in the meta function:

```tsx
export function meta({ data }: MetaArgs) {
  const post = data.post

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: post.title,
    description: post.excerpt,
    author: {
      '@type': 'Person',
      name: post.author.name,
    },
    datePublished: post.publishedAt,
    dateModified: post.updatedAt,
    image: post.coverImage,
  }

  return [
    { title: post.title },
    { name: 'description', content: post.excerpt },
    {
      'script:ld+json': JSON.stringify(jsonLd),
    },
  ]
}
```

## Sitemap

Generate a sitemap as an API route:

```ts
// routes/sitemap.xml.ts
export async function GET() {
  const posts = await db.posts.findMany({
    where: { published: true },
    select: { slug: true, updatedAt: true },
  })

  const urls = [
    { loc: 'https://example.com/', priority: '1.0' },
    { loc: 'https://example.com/about', priority: '0.8' },
    ...posts.map((post) => ({
      loc: `https://example.com/posts/${post.slug}`,
      lastmod: post.updatedAt.toISOString(),
      priority: '0.6',
    })),
  ]

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map(
    (url) => `  <url>
    <loc>${url.loc}</loc>
    ${url.lastmod ? `<lastmod>${url.lastmod}</lastmod>` : ''}
    <priority>${url.priority}</priority>
  </url>`
  )
  .join('\n')}
</urlset>`

  return new Response(xml, {
    headers: { 'Content-Type': 'application/xml' },
  })
}
```

## robots.txt

Serve a `robots.txt` from an API route:

```ts
// routes/robots.txt.ts
export function GET() {
  const content = `User-agent: *
Allow: /
Disallow: /dashboard
Disallow: /api/

Sitemap: https://example.com/sitemap.xml`

  return new Response(content, {
    headers: { 'Content-Type': 'text/plain' },
  })
}
```

Or place a static `robots.txt` in your `public/` directory.

## SSR and SEO

EreoJS uses server-side rendering by default, which means search engines receive fully rendered HTML. This is the single most impactful thing for SEO -- no additional configuration needed.

For content-heavy pages that rarely change, consider using SSG for even faster load times:

```tsx
// routes/blog/[slug].tsx
export const config = {
  render: 'ssg',
  cache: { revalidate: 3600 }, // Rebuild hourly
}
```

For routes that should not be indexed (authenticated dashboards, admin panels), use CSR:

```tsx
// routes/dashboard.tsx
export const config = {
  render: 'csr',
}
```

See [Rendering Modes](/concepts/rendering-modes) for a full comparison of SSR, SSG, CSR, and Streaming.

## Best Practices

1. **Always set a title and description** -- These are the most important meta tags for SEO
2. **Use Open Graph tags** -- They control how your pages appear when shared on social media
3. **Add structured data** -- Helps search engines display rich results (star ratings, recipes, events)
4. **Submit a sitemap** -- Register it in Google Search Console and Bing Webmaster Tools
5. **Use canonical URLs** -- Prevent duplicate content when the same page is accessible at multiple URLs
6. **Prefer SSR or SSG** -- Client-side rendered pages are harder for search engines to index

## Related

- [Rendering Modes](/concepts/rendering-modes) -- SSR, SSG, CSR, and Streaming
- [Routing](/concepts/routing) -- Route metadata and file conventions
