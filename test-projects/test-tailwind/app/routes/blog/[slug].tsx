import { getPostBySlug, simulateDelay } from '~/lib/data';

/**
 * Loader for individual blog posts.
 * The [slug] in the filename creates a dynamic route parameter.
 */
export async function loader({ params }: { params: { slug: string } }) {
  await simulateDelay(50);

  const post = getPostBySlug(params.slug);

  if (!post) {
    throw new Response('Post not found', { status: 404 });
  }

  return { post };
}

interface BlogPostProps {
  loaderData: {
    post: {
      slug: string;
      title: string;
      content: string;
      author: string;
      date: string;
      readTime: string;
      tags: string[];
    };
  };
}

export default function BlogPost({ loaderData }: BlogPostProps) {
  const { post } = loaderData;

  return (
    <article>
      {/* Post Header */}
      <header className="mb-8">
        <div className="flex flex-wrap gap-2 mb-4">
          {post.tags.map((tag) => (
            <span
              key={tag}
              className="px-3 py-1 text-sm font-medium bg-primary-100 dark:bg-primary-900 text-primary-700 dark:text-primary-300 rounded-full"
            >
              {tag}
            </span>
          ))}
        </div>
        <h1 className="text-4xl font-bold mb-4">{post.title}</h1>
        <div className="flex items-center gap-4 text-gray-500 dark:text-gray-400">
          <span>{post.author}</span>
          <span>&bull;</span>
          <span>{post.date}</span>
          <span>&bull;</span>
          <span>{post.readTime}</span>
        </div>
      </header>

      {/* Post Content */}
      <div className="prose dark:prose-invert prose-lg max-w-none">
        {/* In a real app, you'd use a markdown renderer here */}
        <div className="whitespace-pre-wrap font-serif leading-relaxed">
          {post.content}
        </div>
      </div>

      {/* Back Link */}
      <div className="mt-12 pt-8 border-t border-gray-200 dark:border-gray-700">
        <a href="/blog" className="text-primary-600 hover:underline">
          &larr; Back to all posts
        </a>
      </div>
    </article>
  );
}

/**
 * Error boundary for this route.
 * Shown when the loader throws an error (e.g., post not found).
 */
export function ErrorBoundary({ error }: { error: Error }) {
  return (
    <div className="text-center py-12">
      <h1 className="text-4xl font-bold mb-4">Post Not Found</h1>
      <p className="text-gray-600 dark:text-gray-400 mb-8">
        The blog post you're looking for doesn't exist.
      </p>
      <a href="/blog" className="btn btn-primary">
        Back to Blog
      </a>
    </div>
  );
}