import type { LoaderArgs } from '@oreo/core';

export async function loader({ request }: LoaderArgs) {
  return {
    message: 'Welcome to Oreo!',
    timestamp: new Date().toISOString(),
  };
}

export default function HomePage({ loaderData }: { loaderData: { message: string; timestamp: string } }) {
  return (
    <main className="flex flex-col items-center justify-center min-h-screen p-8">
      <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
        {loaderData.message}
      </h1>
      <p className="text-gray-600 dark:text-gray-400">
        Server time: {loaderData.timestamp}
      </p>
    </main>
  );
}