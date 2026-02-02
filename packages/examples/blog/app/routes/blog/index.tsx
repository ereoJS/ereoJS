import type { LoaderArgs } from '@areo/core';

interface Post {
  slug: string;
  title: string;
  excerpt: string;
  date: string;
}

const posts: Post[] = [
  {
    slug: 'getting-started-with-areo',
    title: 'Getting Started with Areo',
    excerpt: 'Learn how to build modern web apps with the Areo framework.',
    date: '2024-01-15',
  },
  {
    slug: 'islands-architecture',
    title: 'Understanding Islands Architecture',
    excerpt: 'How selective hydration makes your apps faster.',
    date: '2024-01-10',
  },
  {
    slug: 'bun-performance',
    title: 'Why Bun Makes Areo Fast',
    excerpt: 'Explore the performance benefits of building on Bun.',
    date: '2024-01-05',
  },
];

export async function loader({ context }: LoaderArgs) {
  context.cache.set({
    maxAge: 60,
    tags: ['posts'],
  });

  return { posts };
}

export default function BlogIndex({ loaderData }: { loaderData: { posts: Post[] } }) {
  return (
    <div>
      <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-8">
        All Posts
      </h1>
      <div className="space-y-6">
        {loaderData.posts.map((post) => (
          <article
            key={post.slug}
            className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6"
          >
            <a href={`/blog/${post.slug}`}>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2 hover:text-blue-600">
                {post.title}
              </h2>
            </a>
            <p className="text-gray-600 dark:text-gray-300 mb-4">
              {post.excerpt}
            </p>
            <time className="text-sm text-gray-500">
              {new Date(post.date).toLocaleDateString()}
            </time>
          </article>
        ))}
      </div>
    </div>
  );
}
