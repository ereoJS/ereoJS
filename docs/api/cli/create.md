# create

Creates a new EreoJS project via the CLI. This command provides the same functionality as `create-ereo` but is invoked through the `ereo` CLI.

## Usage

```bash
bun ereo create <project-name> [options]
```

Or via the standalone package:

```bash
bunx create-ereo@latest <project-name> [options]
```

## Options

| Option | Alias | Description | Default |
|--------|-------|-------------|---------|
| `--template` | `-t` | Template to use (minimal, default, tailwind) | `tailwind` |
| `--typescript` | | Enable TypeScript | `true` |
| `--no-typescript` | | Use JavaScript instead | |

## Templates

### tailwind

Full-featured template with Tailwind CSS and comprehensive examples:

```bash
bun ereo create my-app --template tailwind
```

Includes:
- Tailwind CSS with custom configuration
- Dark mode support
- Navigation component with mobile menu
- Blog with dynamic routes
- Contact form with actions
- Interactive counter island
- Error boundaries
- API health check route
- Middleware examples

### default

Alias for tailwind template:

```bash
bun ereo create my-app --template default
```

### minimal

Bare-bones setup for custom projects:

```bash
bun ereo create my-app --template minimal
```

Includes only:
- Root layout
- Index page
- Basic configuration
- Minimal dependencies

## Examples

### Create with Defaults

```bash
# TypeScript + Tailwind
bun ereo create my-app
```

### Create JavaScript Project

```bash
bun ereo create my-app --typescript=false
```

### Create Minimal Project

```bash
bun ereo create my-app --template minimal
```

## Generated Project Structure

### Tailwind Template Structure

```
my-app/
├── app/
│   ├── components/
│   │   ├── Counter.tsx         # Interactive island
│   │   ├── Footer.tsx          # Footer component
│   │   ├── Navigation.tsx      # Nav with mobile menu
│   │   └── PostCard.tsx        # Blog card component
│   ├── lib/
│   │   ├── data.ts             # Data helpers
│   │   └── types.ts            # Type definitions
│   ├── middleware/
│   │   └── logger.ts           # Request logging
│   ├── routes/
│   │   ├── _layout.tsx         # Root layout
│   │   ├── _error.tsx          # Error boundary
│   │   ├── index.tsx           # Home page
│   │   ├── about.tsx           # About page
│   │   ├── contact.tsx         # Contact form
│   │   ├── api/
│   │   │   └── health.ts       # API endpoint
│   │   └── blog/
│   │       ├── index.tsx       # Blog list
│   │       └── [slug].tsx      # Blog post
│   ├── entry.client.tsx        # Client entry
│   └── globals.css             # Tailwind styles
├── public/                      # Static files
├── ereo.config.ts              # Framework config
├── tailwind.config.js          # Tailwind config
├── tsconfig.json               # TypeScript config
├── package.json                # Dependencies
├── .env                        # Environment vars
├── .env.example                # Env template
└── .gitignore                  # Git ignores
```

## Generated Files

### ereo.config.ts

```ts
import { defineConfig } from '@ereo/core';
import tailwind from '@ereo/plugin-tailwind';

export default defineConfig({
  server: {
    port: 3000,
  },
  build: {
    target: 'bun',
  },
  plugins: [
    tailwind(),
  ],
});
```

### Environment File (.env)

```bash
# Server-only (never sent to browser)
DATABASE_URL=postgresql://localhost:5432/mydb
API_SECRET=your-secret-key

# Public (available in client code)
EREO_PUBLIC_APP_NAME=EreoJS App
EREO_PUBLIC_API_URL=http://localhost:3000/api
```

### Root Layout

```tsx
import type { ReactNode } from 'react';
import { Link } from '@ereo/client';

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="stylesheet" href="/app/globals.css" />
      </head>
      <body className="min-h-screen bg-white dark:bg-gray-900">
        <nav className="flex gap-4 p-4 border-b">
          <Link to="/">Home</Link>
          <Link to="/about">About</Link>
          <Link to="/blog">Blog</Link>
          <Link to="/contact">Contact</Link>
        </nav>
        {children}
        <script type="module" src="/@ereo/client-entry.js" />
      </body>
    </html>
  );
}
```

### Index Page with Loader

```tsx
import type { LoaderArgs, RouteConfig } from '@ereo/core';
import { Counter } from '../components/Counter';

export const config: RouteConfig = {
  middleware: ['logger'],
  cache: {
    edge: { maxAge: 60, staleWhileRevalidate: 300 },
    data: { tags: ['homepage'] },
  },
};

export async function loader({ context }: LoaderArgs) {
  const appName = context.env.EREO_PUBLIC_APP_NAME || 'EreoJS';
  return {
    message: `Welcome to ${appName}!`,
    timestamp: new Date().toISOString(),
  };
}

export function meta({ data }) {
  return [
    { title: data.message },
    { name: 'description', content: 'A React framework built on Bun' },
  ];
}

export default function HomePage({ loaderData }) {
  return (
    <main>
      <h1>{loaderData.message}</h1>
      <p>Server time: {loaderData.timestamp}</p>
      <Counter client:load initialCount={0} />
    </main>
  );
}
```

### Island Component

```tsx
'use client';

import { useState } from 'react';

export function Counter({ initialCount = 0 }: { initialCount?: number }) {
  const [count, setCount] = useState(initialCount);

  return (
    <div>
      <button onClick={() => setCount(c => c - 1)}>-</button>
      <span>{count}</span>
      <button onClick={() => setCount(c => c + 1)}>+</button>
    </div>
  );
}
```

### Contact Form with Action

```tsx
import type { ActionArgs, LoaderArgs } from '@ereo/core';
import { json } from '@ereo/data';
import { Form, useActionData, useNavigation } from '@ereo/client';

export async function loader({ context }: LoaderArgs) {
  return { csrfToken: crypto.randomUUID() };
}

export async function action({ request }: ActionArgs) {
  const formData = await request.formData();
  const name = formData.get('name') as string;
  const email = formData.get('email') as string;
  const message = formData.get('message') as string;

  // Validate
  const errors: Record<string, string> = {};
  if (!name || name.length < 2) errors.name = 'Name required';
  if (!email || !email.includes('@')) errors.email = 'Valid email required';
  if (!message || message.length < 10) errors.message = 'Message too short';

  if (Object.keys(errors).length > 0) {
    return json({ success: false, errors }, { status: 400 });
  }

  return json({ success: true, message: 'Thank you!' });
}

export default function ContactPage({ loaderData }) {
  const actionData = useActionData();
  const navigation = useNavigation();

  return (
    <Form method="post">
      <input type="hidden" name="csrf" value={loaderData.csrfToken} />
      <input name="name" required />
      <input name="email" type="email" required />
      <textarea name="message" required />
      <button disabled={navigation.status === 'submitting'}>
        {navigation.status === 'submitting' ? 'Sending...' : 'Send'}
      </button>
    </Form>
  );
}
```

### API Route

```ts
import type { LoaderArgs, ActionArgs } from '@ereo/core';
import { json } from '@ereo/data';

const startTime = Date.now();

export async function loader({ request }: LoaderArgs) {
  return json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: Math.floor((Date.now() - startTime) / 1000),
  });
}

export async function action({ request }: ActionArgs) {
  if (request.method !== 'POST') {
    return json({ error: 'Method not allowed' }, { status: 405 });
  }
  return json({ received: true });
}
```

## Post-Creation Steps

After running `ereo create`:

```bash
cd my-app
bun install        # Install dependencies
bun run dev        # Start dev server
```

Open http://localhost:3000

## Programmatic Usage

```ts
import { create } from '@ereo/cli';

await create('my-app', {
  template: 'tailwind',
  typescript: true,
});
```

## Comparison with create-ereo

| Feature | `ereo create` | `bunx create-ereo@latest` |
|---------|---------------|-------------------|
| Git initialization | No | Yes (default) |
| Auto-install | No | Yes (default) |
| Interactive mode | No | Yes |
| Template options | Same | Same |

For full scaffolding with git and auto-install, use `bunx create-ereo@latest`.

## Related

- [create-ereo](/api/create-ereo) - Standalone scaffolding tool
- [dev](/api/cli/dev) - Development server
- [build](/api/cli/build) - Production build
- [deploy](/api/cli/deploy) - Deployment
