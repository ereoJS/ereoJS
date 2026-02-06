# Core Concepts

EreoJS is built on a few fundamental concepts that work together to create a cohesive full-stack development experience. Understanding these concepts will help you build applications effectively.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                      Browser                            │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐  │
│  │   Islands   │  │ Navigation  │  │  Form Actions   │  │
│  │  (Hydrated) │  │  (SPA-like) │  │  (Progressive)  │  │
│  └─────────────┘  └─────────────┘  └─────────────────┘  │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│                     EreoJS Server                         │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐  │
│  │   Router    │  │   Loaders   │  │    Actions      │  │
│  │  (File-based)│ │ (Data fetch)│  │  (Mutations)    │  │
│  └─────────────┘  └─────────────┘  └─────────────────┘  │
│                                                         │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐  │
│  │  Middleware │  │   Cache     │  │   Streaming     │  │
│  └─────────────┘  └─────────────┘  └─────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

## Core Principles

### Web Standards First

EreoJS uses standard web APIs throughout:

- **Request/Response** - All data flows through standard HTTP primitives
- **FormData** - Forms use the platform's native form handling
- **URLSearchParams** - Query strings use standard parsing
- **Headers** - HTTP headers are manipulated with the Headers API

This means your knowledge transfers directly to other tools and platforms.

### Progressive Enhancement

Applications work without JavaScript and enhance when it's available:

1. **HTML first** - Server renders complete HTML
2. **Forms work** - Standard forms submit without JS
3. **JS enhances** - Client-side navigation, optimistic updates
4. **Islands hydrate** - Only interactive components get JavaScript

### Explicit Over Magic

EreoJS prefers explicit configuration over conventions that hide behavior:

- **Caching is opt-in** - You decide what gets cached
- **Hydration is explicit** - You mark what needs JavaScript
- **Data loading is visible** - Loaders are functions you write

## The Request Lifecycle

```
Request → Router → Middleware → Loader → Render → Response
              ↓
           Cache (if configured)
```

1. **Request arrives** at the Bun server
2. **Router matches** the URL to a route file
3. **Middleware runs** (auth, logging, etc.)
4. **Loader executes** to fetch data (may use cache)
5. **Component renders** with loader data
6. **Response streams** HTML to the browser

For mutations:

```
Form Submit → Router → Middleware → Action → Revalidate → Response
```

## Key Concepts

### [Routing](/core-concepts/routing)

File-based routing that maps your directory structure to URLs:

```
routes/
├── index.tsx        → /
├── about.tsx        → /about
├── posts/
│   ├── index.tsx    → /posts
│   └── [id].tsx     → /posts/:id
```

### [Data Loading](/core-concepts/data-loading)

Loaders fetch data before rendering:

```tsx
export const loader = createLoader(async ({ params }) => {
  const post = await db.posts.find(params.id)
  return { post }
})
```

Actions handle form submissions:

```tsx
export const action = createAction(async ({ request }) => {
  const data = await request.formData()
  await db.posts.create(data)
  return redirect('/posts')
})
```

### [Rendering Modes](/core-concepts/rendering-modes)

Choose how each route renders:

- **SSR** - Server-side rendering (default)
- **SSG** - Static site generation at build time
- **CSR** - Client-side rendering
- **Streaming** - Progressive HTML streaming with Suspense

### [Islands Architecture](/core-concepts/islands)

Selective hydration for interactive components. Add `'use client'` to mark a component for client-side hydration:

```tsx
// app/components/Counter.tsx
'use client';

import { useState } from 'react';

export function Counter() {
  const [count, setCount] = useState(0);
  return <button onClick={() => setCount(c => c + 1)}>{count}</button>;
}
```

Only island components ship JavaScript — the rest of the page is static HTML.

### [Caching](/core-concepts/caching)

Tag-based cache invalidation:

```tsx
export const config = {
  cache: {
    maxAge: 3600,
    tags: ['posts', `post-${id}`]
  }
}

// Invalidate when needed
await revalidateTag('posts')
```

### [Middleware](/core-concepts/middleware)

Request/response processing pipeline:

```tsx
export const middleware = [
  'auth',        // Named middleware
  'rateLimit',
  async (request, context, next) => {  // Inline function
    console.log(request.url)
    return next()
  }
]
```

## Data Flow

```
┌──────────────────────────────────────────────────────────┐
│                        Server                            │
│                                                          │
│  loader() ──────────────────────────► { data }          │
│      │                                    │              │
│      │                                    ▼              │
│      │                             Component(data)       │
│      │                                    │              │
│      ▼                                    ▼              │
│   Cache                               HTML Stream        │
│                                                          │
└──────────────────────────────────────────────────────────┘
                         │
                         ▼
┌──────────────────────────────────────────────────────────┐
│                       Browser                            │
│                                                          │
│  HTML ──► Islands Hydrate ──► Interactive Components    │
│                                                          │
│  Form Submit ──► action() ──► Revalidate ──► Re-render  │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

## Component Model

### Route Components

Export a default function component:

```tsx
// routes/posts/[id].tsx
export default function Post({ loaderData, params }) {
  return <h1>{loaderData.post.title}</h1>
}
```

Props available:
- `loaderData` - Data from the loader
- `actionData` - Result from the action
- `params` - URL parameters
- `searchParams` - Query string parameters

### Layout Components

Wrap child routes:

```tsx
// routes/_layout.tsx
export default function Layout({ children }) {
  return (
    <div>
      <nav>...</nav>
      <main>{children}</main>
    </div>
  )
}
```

### Island Components

Interactive components that hydrate on the client. Mark them with `'use client'`:

```tsx
// app/components/Counter.tsx
'use client';

import { useState } from 'react';

export function Counter({ initialCount = 0 }) {
  const [count, setCount] = useState(initialCount);
  return <button onClick={() => setCount(c => c + 1)}>{count}</button>;
}
```

Use them directly in routes:

```tsx
import { Counter } from '~/components/Counter';

export default function Home() {
  return (
    <div>
      <h1>Static HTML</h1>
      <Counter initialCount={0} />  {/* Only this hydrates */}
    </div>
  );
}
```

## Type Safety

EreoJS provides full TypeScript support:

```tsx
import type { LoaderFunction, ActionFunction } from '@ereo/core'

interface Post {
  id: string
  title: string
}

export const loader: LoaderFunction<{ post: Post }> = async ({ params }) => {
  const post = await getPost(params.id)
  return { post }
}

export default function Post({ loaderData }: { loaderData: { post: Post } }) {
  return <h1>{loaderData.post.title}</h1>
}
```

## Next Steps

Dive deeper into each concept:

- [Routing](/core-concepts/routing) - File-based routing patterns
- [Data Loading](/core-concepts/data-loading) - Loaders and actions
- [Rendering Modes](/core-concepts/rendering-modes) - SSR, SSG, streaming
- [Islands](/core-concepts/islands) - Selective hydration
- [Caching](/core-concepts/caching) - Cache strategies
- [Middleware](/core-concepts/middleware) - Request processing
