import type { RouteComponentProps } from '@ereo/core';

export default function RootLayout({ children }: RouteComponentProps) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>EreoJS Blog</title>
        <link rel="stylesheet" href="/__tailwind.css" />
      </head>
      <body className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <header className="bg-white dark:bg-gray-800 shadow-sm">
          <nav className="max-w-4xl mx-auto px-4 py-4">
            <div className="flex justify-between items-center">
              <a href="/" className="text-xl font-bold text-gray-900 dark:text-white">
                EreoJS Blog
              </a>
              <div className="flex gap-4">
                <a href="/" className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white">
                  Home
                </a>
                <a href="/blog" className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white">
                  Blog
                </a>
              </div>
            </div>
          </nav>
        </header>
        <main className="max-w-4xl mx-auto px-4 py-8">
          {children}
        </main>
        <footer className="max-w-4xl mx-auto px-4 py-8 text-center text-gray-500 dark:text-gray-400">
          Built with EreoJS Framework
        </footer>
      </body>
    </html>
  );
}
