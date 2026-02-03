/**
 * Dashboard Route - Tests the new data pipeline feature
 */

import { createPipeline, dataSource, cachedSource, optionalSource, formatMetrics } from '@ereo/data';
import type { LoaderArgs } from '@ereo/core';

// Simulated data fetchers
const fetchUser = async () => {
  await sleep(50); // Simulate DB call
  return { id: 1, name: 'John Doe', email: 'john@example.com' };
};

const fetchPosts = async () => {
  await sleep(80); // Simulate API call
  return [
    { id: 1, title: 'Getting Started with Ereo', views: 120 },
    { id: 2, title: 'Data Pipeline Tutorial', views: 85 },
  ];
};

const fetchComments = async (postIds: number[]) => {
  await sleep(30); // Simulate API call
  return postIds.flatMap(id => [
    { postId: id, author: 'Alice', text: 'Great post!' },
    { postId: id, author: 'Bob', text: 'Very helpful' },
  ]);
};

const fetchSettings = async () => {
  await sleep(20);
  return { theme: 'dark', notifications: true };
};

// Create a data pipeline with automatic parallelization
const dashboardPipeline = createPipeline({
  loaders: {
    user: cachedSource(fetchUser, { tags: ['user'], ttl: 300 }),
    posts: cachedSource(fetchPosts, { tags: ['posts'], ttl: 60 }),
    comments: {
      load: async ({ data }) => {
        const postIds = (data as any).posts?.map((p: any) => p.id) || [];
        return fetchComments(postIds);
      },
    },
    settings: optionalSource(fetchSettings, { theme: 'light', notifications: false }),
  },
  dependencies: {
    // comments depend on posts
    comments: ['posts'],
  },
  metrics: true,
});

// Loader using the pipeline
export async function loader({ request, params, context }: LoaderArgs) {
  const result = await dashboardPipeline.execute({
    request,
    params,
    context,
  });

  // Log metrics in development
  if (process.env.NODE_ENV === 'development') {
    console.log('\n' + formatMetrics(result.metrics));
  }

  return {
    user: result.data.user,
    posts: result.data.posts,
    comments: result.data.comments,
    settings: result.data.settings,
    metrics: {
      total: result.metrics.total,
      parallelEfficiency: result.metrics.parallelEfficiency,
    },
  };
}

// Dashboard component
export default function DashboardPage({ loaderData }: { loaderData: Awaited<ReturnType<typeof loader>> }) {
  const { user, posts, comments, settings, metrics } = loaderData;

  return (
    <main className="min-h-screen p-8 bg-gray-50 dark:bg-gray-900">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Dashboard
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Testing the Ereo Data Pipeline
          </p>
        </div>

        {/* Metrics Card */}
        <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
          <h2 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">
            Pipeline Metrics
          </h2>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-600 dark:text-gray-400">Total Time:</span>
              <span className="ml-2 font-mono text-blue-700 dark:text-blue-300">
                {metrics.total.toFixed(1)}ms
              </span>
            </div>
            <div>
              <span className="text-gray-600 dark:text-gray-400">Parallel Efficiency:</span>
              <span className="ml-2 font-mono text-blue-700 dark:text-blue-300">
                {(metrics.parallelEfficiency * 100).toFixed(0)}%
              </span>
            </div>
          </div>
        </div>

        {/* User Card */}
        <div className="mb-6 p-4 bg-white dark:bg-gray-800 rounded-lg shadow">
          <h2 className="font-semibold text-gray-900 dark:text-white mb-2">User</h2>
          <p className="text-gray-700 dark:text-gray-300">{user.name}</p>
          <p className="text-sm text-gray-500 dark:text-gray-400">{user.email}</p>
        </div>

        {/* Posts */}
        <div className="mb-6">
          <h2 className="font-semibold text-gray-900 dark:text-white mb-4">Posts</h2>
          <div className="space-y-4">
            {posts.map((post: any) => (
              <div key={post.id} className="p-4 bg-white dark:bg-gray-800 rounded-lg shadow">
                <h3 className="font-medium text-gray-900 dark:text-white">{post.title}</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">{post.views} views</p>
                <div className="mt-2 pl-4 border-l-2 border-gray-200 dark:border-gray-700">
                  {comments
                    .filter((c: any) => c.postId === post.id)
                    .map((comment: any, i: number) => (
                      <p key={i} className="text-sm text-gray-600 dark:text-gray-400">
                        <strong>{comment.author}:</strong> {comment.text}
                      </p>
                    ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Settings */}
        <div className="p-4 bg-white dark:bg-gray-800 rounded-lg shadow">
          <h2 className="font-semibold text-gray-900 dark:text-white mb-2">Settings</h2>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Theme: {settings.theme} | Notifications: {settings.notifications ? 'On' : 'Off'}
          </p>
        </div>
      </div>
    </main>
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
