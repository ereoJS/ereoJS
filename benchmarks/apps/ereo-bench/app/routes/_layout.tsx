import type { RouteComponentProps } from '@ereo/core';

export default function RootLayout({ children }: RouteComponentProps) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Ereo Benchmark</title>
      </head>
      <body>
        <nav>
          <a href="/">Home</a>
          <a href="/ssr">SSR</a>
          <a href="/products">Products</a>
          <a href="/dashboard">Dashboard</a>
        </nav>
        <main>{children}</main>
      </body>
    </html>
  );
}
