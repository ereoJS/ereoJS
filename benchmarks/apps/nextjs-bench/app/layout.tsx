import type { ReactNode } from 'react';

export const metadata = {
  title: 'Next.js Benchmark',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
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
