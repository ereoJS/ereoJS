# Minimal Example

The minimal example demonstrates the simplest possible Ereo application.

## Source

Located at `/packages/examples/minimal` in the repository.

## Structure

```
minimal/
├── src/
│   ├── routes/
│   │   ├── _layout.tsx
│   │   └── index.tsx
│   └── index.ts
├── package.json
└── tsconfig.json
```

## Files

### Entry Point

```ts
// src/index.ts
import { createApp } from '@ereo/core'
import { createFileRouter } from '@ereo/router'
import { createServer } from '@ereo/server'

async function main() {
  const app = createApp()
  const router = await createFileRouter({ routesDir: './src/routes' })
  app.setRoutes(router.getRoutes())

  const server = createServer(app)
  server.listen(3000, () => {
    console.log('Server running at http://localhost:3000')
  })
}

main()
```

### Layout

```tsx
// src/routes/_layout.tsx
export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Ereo App</title>
      </head>
      <body>{children}</body>
    </html>
  )
}
```

### Home Page

```tsx
// src/routes/index.tsx
export default function Home() {
  return (
    <div>
      <h1>Welcome to Ereo</h1>
      <p>A React fullstack framework built on Bun.</p>
    </div>
  )
}
```

## Running

```bash
cd packages/examples/minimal
bun install
bun dev
```

## What This Demonstrates

- Basic project setup
- File-based routing
- Root layout
- Simple page component
