import { Counter } from '~/components/Counter';
import { getAllPosts, simulateDelay } from '~/lib/data';

/**
 * Loader function - runs on the server before rendering.
 * Fetches data and passes it to the component.
 */
export async function loader() {
  await simulateDelay(50);

  const posts = getAllPosts();
  const featuredPost = posts[0];

  return {
    featuredPost,
    stats: {
      posts: posts.length,
      serverTime: new Date().toLocaleTimeString(),
    },
  };
}

interface HomePageProps {
  loaderData: {
    featuredPost: {
      slug: string;
      title: string;
      excerpt: string;
    };
    stats: {
      posts: number;
      serverTime: string;
    };
  };
}

export default function HomePage({ loaderData }: HomePageProps) {
  const { featuredPost, stats } = loaderData;

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="py-20 px-4 bg-gradient-to-br from-primary-500 to-purple-600 text-white">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-5xl md:text-6xl font-bold mb-6">
            Welcome to EreoJS
          </h1>
          <p className="text-xl md:text-2xl mb-8 text-primary-100">
            A React fullstack framework built on Bun.
            <br />
            Fast, simple, and powerful.
          </p>
          <div className="flex flex-wrap gap-4 justify-center">
            <a href="/blog" className="btn bg-white text-primary-600 hover:bg-primary-50">
              Read the Blog
            </a>
            <a
              href="https://github.com/ereo-js/ereo"
              target="_blank"
              rel="noopener"
              className="btn border-2 border-white text-white hover:bg-white/10"
            >
              View on GitHub
            </a>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-16 px-4">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-12">Why EreoJS?</h2>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="card text-center">
              <div className="text-4xl mb-4">⚡</div>
              <h3 className="text-xl font-bold mb-2">Blazing Fast</h3>
              <p className="text-gray-600 dark:text-gray-400">
                Built on Bun for exceptional performance. Server-side rendering with streaming support.
              </p>
            </div>
            <div className="card text-center">
              <div className="text-4xl mb-4">🎯</div>
              <h3 className="text-xl font-bold mb-2">Simple Data Loading</h3>
              <p className="text-gray-600 dark:text-gray-400">
                One pattern for data fetching. Loaders and actions make it easy to build dynamic apps.
              </p>
            </div>
            <div className="card text-center">
              <div className="text-4xl mb-4">🏝️</div>
              <h3 className="text-xl font-bold mb-2">Islands Architecture</h3>
              <p className="text-gray-600 dark:text-gray-400">
                Selective hydration means smaller bundles and faster interactivity where it matters.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Interactive Demo Section */}
      <section className="py-16 px-4 bg-gray-50 dark:bg-gray-800">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl font-bold mb-4">Interactive Islands</h2>
          <p className="text-gray-600 dark:text-gray-400 mb-8">
            This counter component is an "island" - only this part of the page is hydrated with JavaScript.
          </p>
          <div className="flex justify-center">
            <Counter initialCount={0} />
          </div>
        </div>
      </section>

      {/* Server Data Section */}
      <section className="py-16 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="card">
            <h2 className="text-2xl font-bold mb-6">Server-Side Data</h2>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              This data was loaded on the server using a loader function:
            </p>
            <div className="grid md:grid-cols-2 gap-6">
              <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">Blog Posts</div>
                <div className="text-3xl font-bold">{stats.posts}</div>
              </div>
              <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">Rendered At</div>
                <div className="text-3xl font-bold">{stats.serverTime}</div>
              </div>
            </div>
            {featuredPost && (
              <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
                <div className="text-sm text-gray-500 dark:text-gray-400 mb-2">Featured Post</div>
                <h3 className="text-xl font-bold mb-2">
                  <a href={`/blog/${featuredPost.slug}`} className="hover:text-primary-600">
                    {featuredPost.title}
                  </a>
                </h3>
                <p className="text-gray-600 dark:text-gray-400">{featuredPost.excerpt}</p>
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}