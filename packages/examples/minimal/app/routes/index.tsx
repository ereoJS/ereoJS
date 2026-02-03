import type { LoaderArgs } from '@ereo/core';

export async function loader({ request }: LoaderArgs) {
  return {
    message: 'Hello from Ereo!',
  };
}

export default function HomePage({ loaderData }: { loaderData: { message: string } }) {
  return (
    <main>
      <h1>{loaderData.message}</h1>
    </main>
  );
}
