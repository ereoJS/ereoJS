import type { RouteComponentProps } from '@oreo/core';

export default function RootLayout({ children }: RouteComponentProps) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Oreo Minimal</title>
      </head>
      <body>
        {children}
      </body>
    </html>
  );
}
