# Installation

## Quick Start

The fastest way to start is with the `create-ereo` CLI:

```bash
bunx create-ereo@latest my-app
cd my-app
bun dev
```

This creates a new project with:
- TypeScript configuration
- Basic project structure
- Example routes
- Development scripts

### Templates

```bash
# Use the minimal template (bare-bones starter)
bunx create-ereo@latest my-app --template minimal

# Skip TypeScript
bunx create-ereo@latest my-app --no-typescript
```

See [`create-ereo`](/api/create-ereo/) for all available templates and options.

## Manual Installation

If you prefer to set up manually:

```bash
mkdir my-app && cd my-app
bun init -y
bun add @ereo/core @ereo/router @ereo/client @ereo/data @ereo/server
bun add react react-dom
bun add -d @ereo/cli @types/react @types/react-dom typescript
```

Create the configuration file:

```ts
// ereo.config.ts
import { defineConfig } from '@ereo/core'

export default defineConfig({
  server: {
    port: 3000,
  },
})
```

Create your first route:

```tsx
// app/routes/index.tsx
import type { LoaderArgs } from '@ereo/core'

export async function loader({ request }: LoaderArgs) {
  return { message: 'Hello from EreoJS!' }
}

export default function Home({ loaderData }: { loaderData: { message: string } }) {
  return <h1>{loaderData.message}</h1>
}
```

Create a root layout:

```tsx
// app/routes/_layout.tsx
import type { RouteComponentProps } from '@ereo/core'

export default function RootLayout({ children }: RouteComponentProps) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>My EreoJS App</title>
      </head>
      <body>{children}</body>
    </html>
  )
}
```

## Development Server

Start the development server:

```bash
bun dev
```

This starts the server at `http://localhost:3000` with:
- Hot module replacement (HMR)
- TypeScript compilation
- Error overlay
- Fast refresh for React components

## Building for Production

Build your application:

```bash
bun run build
```

This creates an optimized production build in the `.ereo` directory (configurable via `ereo.config.ts`).

## Running in Production

Start the production server:

```bash
bun start
```

## Next Steps

- [Understand the project structure](/getting-started/project-structure)
- [Build your first app](/getting-started/your-first-app)
- [Learn about routing](/concepts/routing)
- [Understand data loading](/concepts/data-loading)
