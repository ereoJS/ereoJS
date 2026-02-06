# Blog Example

A blog application demonstrating EreoJS with Tailwind CSS, dynamic routing, and caching.

## Overview

This example showcases:

- File-based routing with nested routes
- Data loading with the `loader` pattern
- Dynamic route parameters
- Cache control with tags
- Tailwind CSS integration via plugin
- Dark mode support
- TypeScript type safety

## Source

Located at `/packages/examples/blog` in the repository.

## Project Structure

```
blog/
├── app/
│   └── routes/
│       ├── _layout.tsx         # Root layout with navigation
│       ├── index.tsx           # Homepage with featured posts
│       └── blog/
│           ├── index.tsx       # Blog posts list
│           └── [slug].tsx      # Dynamic post page
├── ereo.config.ts              # Configuration with Tailwind plugin
├── tailwind.config.js          # Tailwind CSS configuration
├── package.json
└── .gitignore
```

## Key Files

### Configuration

```ts
// ereo.config.ts
import { defineConfig } from '@ereo/core';
import tailwind from '@ereo/plugin-tailwind';

export default defineConfig({
  server: {
    port: 3000,
  },
  plugins: [
    tailwind(),
  ],
});
```

### Root Layout

The layout includes navigation, Tailwind CSS, and dark mode support:

```tsx
// app/routes/_layout.tsx
import type { RouteComponentProps } from '@ereo/core';

export default function RootLayout({ children }: RouteComponentProps) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>EreoJS Blog</title>
        <link rel="stylesheet" href="/__tailwind.css" />
      </head>
      <body className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <header className="bg-white dark:bg-gray-800 shadow-sm">
          <nav className="max-w-4xl mx-auto px-4 py-4">
            <div className="flex justify-between items-center">
              <a href="/" className="text-xl font-bold text-gray-900 dark:text-white">
                EreoJS Blog
              </a>
              <div className="flex gap-4">
                <a href="/" className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white">
                  Home
                </a>
                <a href="/blog" className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white">
                  Blog
                </a>
              </div>
            </div>
          </nav>
        </header>
        <main className="max-w-4xl mx-auto px-4 py-8">
          {children}
        </main>
        <footer className="max-w-4xl mx-auto px-4 py-8 text-center text-gray-500 dark:text-gray-400">
          Built with EreoJS Framework
        </footer>
      </body>
    </html>
  );
}
```

### Homepage

```tsx
// app/routes/index.tsx
import type { LoaderArgs } from '@ereo/core';

interface Post {
  slug: string;
  title: string;
  excerpt: string;
  date: string;
}

// Simulated database
const posts: Post[] = [
  {
    slug: 'getting-started-with-ereo',
    title: 'Getting Started with EreoJS',
    excerpt: 'Learn how to build modern web apps with the EreoJS framework.',
    date: '2024-01-15',
  },
  // ... more posts
];

export async function loader({ request, context }: LoaderArgs) {
  // Set caching with tags for invalidation
  context.cache.set({
    maxAge: 60,
    staleWhileRevalidate: 300,
    tags: ['posts'],
  });

  return { posts };
}

export default function HomePage({ loaderData }: { loaderData: { posts: Post[] } }) {
  return (
    <div>
      <section className="text-center py-12">
        <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
          Welcome to EreoJS Blog
        </h1>
        <p className="text-lg text-gray-600 dark:text-gray-300">
          A blog built with EreoJS - the React fullstack framework.
        </p>
      </section>

      <section>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
          Latest Posts
        </h2>
        <div className="space-y-6">
          {loaderData.posts.map((post) => (
            <article
              key={post.slug}
              className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 hover:shadow-md transition-shadow"
            >
              <a href={`/blog/${post.slug}`}>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2 hover:text-blue-600 dark:hover:text-blue-400">
                  {post.title}
                </h3>
              </a>
              <p className="text-gray-600 dark:text-gray-300 mb-4">
                {post.excerpt}
              </p>
              <time className="text-sm text-gray-500 dark:text-gray-400">
                {new Date(post.date).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </time>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
```

### Dynamic Post Page

```tsx
// app/routes/blog/[slug].tsx
import type { LoaderArgs } from '@ereo/core';

interface Post {
  slug: string;
  title: string;
  content: string;
  date: string;
  author: string;
}

// Simulated database
const postsData: Record<string, Post> = {
  'getting-started-with-ereo': {
    slug: 'getting-started-with-ereo',
    title: 'Getting Started with EreoJS',
    content: '...',
    date: '2024-01-15',
    author: 'EreoJS Team',
  },
  // ... more posts
};

export async function loader({ params, context }: LoaderArgs<{ slug: string }>) {
  const post = postsData[params.slug];

  if (!post) {
    throw new Response('Not Found', { status: 404 });
  }

  // Cache with post-specific tag
  context.cache.set({
    maxAge: 300,
    tags: [`post:${params.slug}`],
  });

  return { post };
}

export default function BlogPost({ loaderData }: { loaderData: { post: Post } }) {
  const { post } = loaderData;

  return (
    <article className="max-w-2xl mx-auto">
      <header className="mb-8">
        <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
          {post.title}
        </h1>
        <div className="flex items-center gap-4 text-gray-600 dark:text-gray-400">
          <span>{post.author}</span>
          <span>-</span>
          <time>
            {new Date(post.date).toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
          </time>
        </div>
      </header>

      <div className="prose prose-lg dark:prose-invert">
        {post.content}
      </div>

      <footer className="mt-12 pt-8 border-t border-gray-200 dark:border-gray-700">
        <a
          href="/blog"
          className="text-blue-600 dark:text-blue-400 hover:underline"
        >
          Back to all posts
        </a>
      </footer>
    </article>
  );
}
```

## Dependencies

```json
{
  "dependencies": {
    "@ereo/core": "workspace:*",
    "@ereo/router": "workspace:*",
    "@ereo/server": "workspace:*",
    "@ereo/client": "workspace:*",
    "@ereo/data": "workspace:*",
    "@ereo/plugin-tailwind": "workspace:*",
    "react": "^18.3.1",
    "react-dom": "^18.3.1"
  },
  "devDependencies": {
    "@ereo/cli": "workspace:*",
    "tailwindcss": "^3.4.0"
  }
}
```

## Running the Example

```bash
cd packages/examples/blog
bun install
bun run dev
```

Visit `http://localhost:3000` to see the blog.

## Key Concepts Demonstrated

| Feature | Implementation |
|---------|----------------|
| Tailwind plugin | `tailwind()` in config, `/__tailwind.css` link |
| Dynamic routes | `[slug].tsx` with `params.slug` |
| Cache control | `context.cache.set()` with `maxAge` and `tags` |
| 404 handling | `throw new Response('Not Found', { status: 404 })` |
| Nested routes | `blog/index.tsx` and `blog/[slug].tsx` |
| Dark mode | Tailwind's `dark:` prefix |
| Type safety | `LoaderArgs<{ slug: string }>` for typed params |

## Cache API

The blog demonstrates EreoJS's cache API:

```tsx
export async function loader({ context }: LoaderArgs) {
  context.cache.set({
    maxAge: 60,              // Cache for 60 seconds
    staleWhileRevalidate: 300, // Serve stale for 5 minutes while revalidating
    tags: ['posts'],         // Tag for cache invalidation
  });

  return { data };
}
```

### Cache Options

| Option | Type | Description |
|--------|------|-------------|
| `maxAge` | `number` | Seconds to cache the response |
| `staleWhileRevalidate` | `number` | Seconds to serve stale content while revalidating |
| `tags` | `string[]` | Tags for targeted cache invalidation |

## Related

- [Minimal Example](/examples/minimal) - Simpler starting point
- [Routing](/concepts/routing) - File-based routing details
- [Data Loading](/concepts/data-loading) - Loader patterns
- [Caching](/concepts/caching) - Cache strategies
- [Tailwind Plugin](/api/plugins/tailwind) - Tailwind CSS integration
