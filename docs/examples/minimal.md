# Minimal Example

The minimal example demonstrates the simplest possible EreoJS application.

## Source

Located at `/packages/examples/minimal` in the repository.

## Structure

```
minimal/
├── app/
│   └── routes/
│       ├── _layout.tsx
│       └── index.tsx
├── ereo.config.ts
├── package.json
└── .gitignore
```

## Files

### Configuration

EreoJS uses a configuration file instead of a manual entry point:

```ts
// ereo.config.ts
import { defineConfig } from '@ereo/core';

export default defineConfig({
  server: {
    port: 3000,
  },
});
```

### Layout

The root layout wraps all pages and sets up the HTML document:

```tsx
// app/routes/_layout.tsx
import type { RouteComponentProps } from '@ereo/core';

export default function RootLayout({ children }: RouteComponentProps) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>EreoJS Minimal</title>
      </head>
      <body>
        {children}
      </body>
    </html>
  );
}
```

### Home Page

The index page demonstrates the loader pattern for server-side data loading:

```tsx
// app/routes/index.tsx
import type { LoaderArgs } from '@ereo/core';

export async function loader({ request }: LoaderArgs) {
  return {
    message: 'Hello from EreoJS!',
  };
}

export default function HomePage({ loaderData }: { loaderData: { message: string } }) {
  return (
    <main>
      <h1>{loaderData.message}</h1>
    </main>
  );
}
```

## Dependencies

The minimal example uses these workspace packages:

```json
{
  "dependencies": {
    "@ereo/core": "workspace:*",
    "@ereo/router": "workspace:*",
    "@ereo/server": "workspace:*",
    "@ereo/client": "workspace:*",
    "@ereo/data": "workspace:*",
    "react": "^18.3.1",
    "react-dom": "^18.3.1"
  },
  "devDependencies": {
    "@ereo/cli": "workspace:*"
  }
}
```

## Running

```bash
cd packages/examples/minimal
bun install
bun run dev
```

Visit `http://localhost:3000` to see the app.

## What This Demonstrates

| Feature | Implementation |
|---------|----------------|
| Configuration | `defineConfig()` in `ereo.config.ts` |
| File-based routing | Files in `app/routes/` directory |
| Root layout | `_layout.tsx` with `RouteComponentProps` |
| Data loading | `loader` function with `LoaderArgs` type |
| Type safety | Full TypeScript support with typed props |

## Key Patterns

### Loader Pattern

The `loader` function runs on the server before rendering:

```tsx
export async function loader({ request }: LoaderArgs) {
  // Fetch data, access databases, etc.
  return { data: 'value' };
}

export default function Page({ loaderData }: { loaderData: { data: string } }) {
  // loaderData contains the loader's return value
  return <div>{loaderData.data}</div>;
}
```

### Layout Pattern

Layouts wrap child routes and use the `children` prop:

```tsx
export default function Layout({ children }: RouteComponentProps) {
  return (
    <div className="layout">
      <nav>Navigation</nav>
      <main>{children}</main>
    </div>
  );
}
```

## Related

- [Getting Started](/getting-started/)
- [Routing](/concepts/routing)
- [Data Loading](/concepts/data-loading)
- [Blog Example](/examples/blog) - More complete example
