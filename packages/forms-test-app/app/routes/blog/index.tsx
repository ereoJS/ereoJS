import { PostCard } from '~/components/PostCard';
import { getAllPosts, simulateDelay } from '~/lib/data';

/**
 * Loader for the blog index page.
 */
export async function loader() {
  await simulateDelay(50);
  const posts = getAllPosts();
  return { posts };
}

interface BlogIndexProps {
  loaderData: {
    posts: Array<{
      slug: string;
      title: string;
      excerpt: string;
      author: string;
      date: string;
      readTime: string;
      tags: string[];
    }>;
  };
}

export default function BlogIndex({ loaderData }: BlogIndexProps) {
  const { posts } = loaderData;

  return (
    <div>
      <div className="grid gap-6">
        {posts.map((post) => (
          <PostCard key={post.slug} post={post} />
        ))}
      </div>
    </div>
  );
}