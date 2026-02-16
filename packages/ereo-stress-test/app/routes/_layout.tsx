import { Navigation } from '~/components/Navigation';
import { Footer } from '~/components/Footer';
import { getAuth } from '@ereo/auth';

interface RootLayoutProps {
  children: React.ReactNode;
  context: any;
}

export async function loader({ context }: { context: any }) {
  let user = null;
  try {
    const auth = getAuth(context);
    if (auth.isAuthenticated()) {
      user = auth.getUser();
    }
  } catch {
    // Not authenticated
  }
  return { user };
}

export default function RootLayout({ children, loaderData }: RootLayoutProps & { loaderData: { user: any } }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="description" content="ereo-stress-test — A task management app built with EreoJS" />
        <title>ereo-stress-test</title>
        <link rel="stylesheet" href="/__tailwind.css" />
      </head>
      <body className="min-h-screen flex flex-col bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white">
        <Navigation user={loaderData?.user} />
        <main className="flex-1">
          {children}
        </main>
        <Footer />
      </body>
    </html>
  );
}