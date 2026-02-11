import {
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
} from "@remix-run/react";

export default function App() {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
        <title>Remix Benchmark</title>
      </head>
      <body>
        <nav>
          <a href="/">Home</a>
          <a href="/ssr">SSR</a>
          <a href="/products">Products</a>
          <a href="/dashboard">Dashboard</a>
        </nav>
        <main>
          <Outlet />
        </main>
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}
