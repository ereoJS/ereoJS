import type { Post } from '~/lib/types';

interface PostCardProps {
  post: Post;
}

export function PostCard({ post }: PostCardProps) {
  return (
    <article className="card hover:shadow-xl transition-shadow">
      <div className="flex flex-wrap gap-2 mb-3">
        {post.tags.map((tag) => (
          <span
            key={tag}
            className="px-2 py-1 text-xs font-medium bg-primary-100 dark:bg-primary-900 text-primary-700 dark:text-primary-300 rounded"
          >
            {tag}
          </span>
        ))}
      </div>
      <h2 className="text-xl font-bold mb-2">
        <a href={`/blog/${post.slug}`} className="hover:text-primary-600 transition-colors">
          {post.title}
        </a>
      </h2>
      <p className="text-gray-600 dark:text-gray-400 mb-4">{post.excerpt}</p>
      <div className="flex items-center justify-between text-sm text-gray-500 dark:text-gray-500">
        <span>{post.author}</span>
        <div className="flex items-center gap-3">
          <span>{post.date}</span>
          <span>{post.readTime}</span>
        </div>
      </div>
    </article>
  );
}