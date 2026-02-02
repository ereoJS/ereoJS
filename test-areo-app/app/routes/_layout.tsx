import type { RouteComponentProps } from '@areo/core';

export default function RootLayout({ children }: RouteComponentProps) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Areo App</title>
        <link rel="stylesheet" href="/__tailwind.css" />
      </head>
      <body className="min-h-screen bg-white dark:bg-gray-900">
        {children}
      </body>
    </html>
  );
}