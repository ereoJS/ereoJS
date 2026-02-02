import type { LoaderArgs } from '@oreo/core';

interface Post {
  slug: string;
  title: string;
  content: string;
  date: string;
  author: string;
}

const postsData: Record<string, Post> = {
  'getting-started-with-oreo': {
    slug: 'getting-started-with-oreo',
    title: 'Getting Started with Oreo',
    content: `
Oreo is a React fullstack framework built on Bun that prioritizes simplicity,
performance, and developer experience.

## Installation

\`\`\`bash
bunx create-oreo my-app
cd my-app
bun run dev
\`\`\`

## Key Features

- **File-based routing** - Just create files in \`app/routes\`
- **Data loading** - Simple \`loader\` and \`action\` pattern
- **Islands architecture** - Selective hydration for optimal performance
- **Bun-first** - 5-6x faster than Node.js

Get started today!
    `.trim(),
    date: '2024-01-15',
    author: 'Oreo Team',
  },
  'islands-architecture': {
    slug: 'islands-architecture',
    title: 'Understanding Islands Architecture',
    content: `
Islands architecture lets you choose exactly which components need JavaScript.

## How It Works

By default, components render as static HTML. Add hydration directives to make them interactive:

\`\`\`tsx
<SearchBar client:load />      // Hydrate immediately
<Comments client:visible />    // Hydrate when visible
<Chart client:idle />          // Hydrate when browser is idle
\`\`\`

## Benefits

- **Faster page loads** - Less JavaScript to download
- **Better performance** - Only hydrate what needs interactivity
- **SEO friendly** - Static HTML for search engines
    `.trim(),
    date: '2024-01-10',
    author: 'Oreo Team',
  },
  'bun-performance': {
    slug: 'bun-performance',
    title: 'Why Bun Makes Oreo Fast',
    content: `
Bun is a new JavaScript runtime that's significantly faster than Node.js.

## Performance Benefits

- **5-6x faster HTTP server** - Bun.serve() is incredibly fast
- **Native bundling** - No need for Webpack or Vite
- **Built-in TypeScript** - Zero-config TypeScript support
- **Fast file I/O** - Native system calls

## Real-World Impact

With Oreo on Bun, you get:

- Sub-100ms HMR updates
- Fast production builds
- Lower server costs
- Better developer experience
    `.trim(),
    date: '2024-01-05',
    author: 'Oreo Team',
  },
};

export async function loader({ params, context }: LoaderArgs<{ slug: string }>) {
  const post = postsData[params.slug];

  if (!post) {
    throw new Response('Not Found', { status: 404 });
  }

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
          <span>•</span>
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
        <pre className="whitespace-pre-wrap text-gray-700 dark:text-gray-300">
          {post.content}
        </pre>
      </div>

      <footer className="mt-12 pt-8 border-t border-gray-200 dark:border-gray-700">
        <a
          href="/blog"
          className="text-blue-600 dark:text-blue-400 hover:underline"
        >
          ← Back to all posts
        </a>
      </footer>
    </article>
  );
}
