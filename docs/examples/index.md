# Examples

EreoJS includes example applications demonstrating different features and patterns.

## Available Examples

| Example | Description | Features |
|---------|-------------|----------|
| [Minimal](/examples/minimal) | Simplest possible app | Routing, layouts, loaders |
| [Blog](/examples/blog) | Complete blog app | Tailwind, dynamic routes, caching |
| Tasks | Full-stack CRUD app | Auth, SQLite, Tailwind, CRUD |

## Quick Start

All examples are in the `/packages/examples/` directory:

```bash
# Run the minimal example
cd packages/examples/minimal
bun install
bun run dev

# Run the blog example
cd packages/examples/blog
bun install
bun run dev
```

To scaffold the tasks app as a new project:

```bash
bunx create-ereo@latest my-tasks --template tasks
cd my-tasks
bun run dev
```

## Feature Coverage

| Feature | Minimal | Blog | Tasks |
|---------|:-------:|:----:|:-----:|
| File-based routing | Yes | Yes | Yes |
| Layouts | Yes | Yes | Yes |
| Data loaders | Yes | Yes | Yes |
| TypeScript | Yes | Yes | Yes |
| Dynamic routes | - | Yes | Yes |
| Tailwind CSS | - | Yes | Yes |
| Caching | - | Yes | - |
| Dark mode | - | Yes | Yes |
| Authentication | - | - | Yes |
| SQLite database | - | - | Yes |
| CRUD operations | - | - | Yes |
| Form actions | - | - | Yes |

## Project Structure

Both examples follow the standard EreoJS structure:

```
example/
├── app/
│   └── routes/           # File-based routes
│       ├── _layout.tsx   # Root layout
│       ├── index.tsx     # Home page (/)
│       └── [dynamic]/    # Dynamic route segments
├── ereo.config.ts        # Framework configuration
├── package.json
└── tailwind.config.js    # (Blog only)
```

## Key Patterns Demonstrated

### Loader Pattern

Both examples demonstrate the loader pattern for server-side data fetching:

```tsx
import type { LoaderArgs } from '@ereo/core';

export async function loader({ request, context }: LoaderArgs) {
  return { data: 'value' };
}

export default function Page({ loaderData }) {
  return <div>{loaderData.data}</div>;
}
```

### Layout Pattern

Layouts wrap child routes and receive children via props:

```tsx
import type { RouteComponentProps } from '@ereo/core';

export default function Layout({ children }: RouteComponentProps) {
  return (
    <html>
      <body>{children}</body>
    </html>
  );
}
```

### Cache Control (Blog)

The blog example demonstrates cache control with tags:

```tsx
export async function loader({ context }: LoaderArgs) {
  context.cache.set({
    maxAge: 60,
    staleWhileRevalidate: 300,
    tags: ['posts'],
  });
  return { posts };
}
```

## Related Resources

- [Getting Started](/getting-started/) - Set up a new project
- [Routing](/concepts/routing) - File-based routing details
- [Data Loading](/concepts/data-loading) - Loaders and actions
- [Caching](/concepts/caching) - Cache strategies
- [Tailwind Plugin](/api/plugins/tailwind) - CSS integration
