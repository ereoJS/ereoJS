import type { LoaderArgs } from '@areo/core';

interface Post {
  slug: string;
  title: string;
  excerpt: string;
  date: string;
}

// Simulated database
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

export async function loader({ request, context }: LoaderArgs) {
  // Set caching
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
          Welcome to Areo Blog
        </h1>
        <p className="text-lg text-gray-600 dark:text-gray-300">
          A blog built with Areo - the React fullstack framework.
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
