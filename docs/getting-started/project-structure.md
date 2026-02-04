# Project Structure

EreoJS uses conventions to minimize configuration. Understanding the project structure helps you organize your code effectively.

## Directory Layout

```
my-app/
├── app/
│   └── routes/              # File-based routes
│       ├── _layout.tsx      # Root layout
│       ├── index.tsx        # Home page (/)
│       ├── about.tsx        # /about
│       ├── (auth)/          # Route group (no URL segment)
│       │   ├── _layout.tsx  # Auth layout
│       │   ├── login.tsx    # /login
│       │   └── register.tsx # /register
│       ├── posts/
│       │   ├── _layout.tsx  # Posts layout
│       │   ├── index.tsx    # /posts
│       │   ├── [id].tsx     # /posts/:id (dynamic)
│       │   └── [...slug].tsx # /posts/* (catch-all)
│       └── api/
│           └── users.ts     # /api/users (API route)
├── components/              # Shared React components
├── islands/                 # Interactive island components
├── lib/                     # Utility functions
├── public/                  # Static assets (served at /)
├── dist/                    # Production build output
├── ereo.config.ts           # Framework configuration
├── package.json
├── tsconfig.json
└── .env                     # Environment variables
```

## Routes Directory

The `app/routes` directory defines your application's routes through file system conventions. This is the default location - it can be customized in `ereo.config.ts`.

### Page Routes

Each `.tsx` file becomes a route:

| File | URL |
|------|-----|
| `app/routes/index.tsx` | `/` |
| `app/routes/about.tsx` | `/about` |
| `app/routes/posts/index.tsx` | `/posts` |
| `app/routes/posts/[id].tsx` | `/posts/:id` |

### Special Files

| File | Purpose |
|------|---------|
| `_layout.tsx` | Layout wrapper for sibling and nested routes |
| `_error.tsx` | Error boundary for the route segment |
| `_loading.tsx` | Loading UI for the route segment |
| `_middleware.ts` | Middleware for the route segment |

### Dynamic Routes

Use square brackets for dynamic segments:

```
app/routes/
├── posts/
│   ├── [id].tsx          # /posts/123
│   └── [id]/
│       └── comments.tsx  # /posts/123/comments
```

Access parameters in your component:

```tsx
// app/routes/posts/[id].tsx
import type { LoaderArgs } from '@ereo/core'

export async function loader({ params }: LoaderArgs<{ id: string }>) {
  const post = await getPost(params.id) // params.id = "123"
  return { post }
}
```

### Catch-All Routes

Use `[...slug]` for catch-all routes:

```
app/routes/
└── docs/
    └── [...slug].tsx     # /docs/a, /docs/a/b, /docs/a/b/c
```

```tsx
// app/routes/docs/[...slug].tsx
import type { LoaderArgs } from '@ereo/core'

export async function loader({ params }: LoaderArgs<{ slug: string[] }>) {
  // params.slug = ["a", "b", "c"] for /docs/a/b/c
  const path = params.slug.join('/')
  return { path }
}
```

### Route Groups

Parentheses create groups without affecting the URL:

```
app/routes/
├── (marketing)/
│   ├── _layout.tsx      # Marketing layout
│   ├── about.tsx        # /about
│   └── pricing.tsx      # /pricing
└── (dashboard)/
    ├── _layout.tsx      # Dashboard layout
    └── settings.tsx     # /settings
```

### API Routes

Files that export only HTTP method handlers become API routes:

```ts
// app/routes/api/users.ts
export async function GET(request: Request) {
  const users = await db.users.findMany()
  return Response.json(users)
}

export async function POST(request: Request) {
  const body = await request.json()
  const user = await db.users.create(body)
  return Response.json(user, { status: 201 })
}
```

## Components Directory

Shared components that aren't routes:

```
components/
├── Button.tsx
├── Card.tsx
├── Header.tsx
└── Footer.tsx
```

Import in routes or other components:

```tsx
import { Button } from '../components/Button'
```

## Islands Directory

Interactive components that hydrate on the client:

```
islands/
├── Counter.tsx
├── SearchBox.tsx
└── ThemeToggle.tsx
```

Islands must be registered and used with hydration directives:

```tsx
// islands/Counter.tsx
import { useState } from 'react'

export default function Counter() {
  const [count, setCount] = useState(0)
  return (
    <button onClick={() => setCount(c => c + 1)}>
      Count: {count}
    </button>
  )
}
```

```tsx
// app/routes/index.tsx
import Counter from '../islands/Counter'

export default function Home() {
  return (
    <div>
      <h1>Welcome</h1>
      <Counter data-island="Counter" data-hydrate="idle" />
    </div>
  )
}
```

## Configuration Files

### ereo.config.ts

Framework configuration:

```ts
import { defineConfig } from '@ereo/core'

export default defineConfig({
  server: {
    port: 3000,
    host: 'localhost'
  },
  build: {
    target: 'bun',
    outDir: 'dist',
    minify: true
  },
  plugins: [
    // Add plugins here
  ]
})
```

### tsconfig.json

TypeScript configuration:

```json
{
  "compilerOptions": {
    "target": "ESNext",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "noEmit": true,
    "paths": {
      "@/*": ["./app/*"]
    }
  },
  "include": ["app", "components", "islands", "lib"]
}
```

### Environment Files

```
.env                 # Loaded in all environments
.env.local           # Local overrides (gitignored)
.env.development     # Development only
.env.production      # Production only
```

## Public Directory

Static assets served at the root:

```
public/
├── favicon.ico      # /favicon.ico
├── robots.txt       # /robots.txt
└── images/
    └── logo.png     # /images/logo.png
```

## Build Output

After `bun run build`:

```
dist/
├── server/          # Server bundle
│   └── index.js
├── client/          # Client bundles
│   ├── index.js
│   └── chunks/
└── static/          # Static assets
```

## Best Practices

1. **Keep routes focused** - Routes should handle routing concerns (loading data, rendering). Extract business logic to `lib/`.

2. **Colocate related files** - Keep tests, styles, and utilities near the code they relate to.

3. **Use path aliases** - Configure `@/` to avoid deep relative imports.

4. **Separate concerns** - Islands for interactivity, components for UI, lib for logic.

5. **Organize by feature** - For large apps, consider organizing by feature rather than type:

```
app/
├── routes/
│   ├── index.tsx
│   └── ...
├── features/
│   ├── auth/
│   │   ├── components/
│   │   └── lib/
│   └── posts/
│       ├── components/
│       └── lib/
└── shared/
    └── components/
```
