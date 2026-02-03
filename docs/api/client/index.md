# @ereo/client

Client-side runtime for the EreoJS framework. Provides islands architecture, client-side navigation, data loading hooks, form handling, and error boundaries.

## Installation

```bash
bun add @ereo/client
```

## Overview

The `@ereo/client` package provides:

- **Islands Architecture** - Selective hydration for interactive components
- **Client Navigation** - SPA-style navigation with prefetching
- **Data Hooks** - Access loader and action data in components
- **Form Handling** - Progressive enhancement forms with `useFetcher`
- **Error Boundaries** - Catch and handle runtime errors gracefully
- **Type-Safe APIs** - End-to-end type safety for routing and navigation

## Quick Start

```tsx
// app/entry.client.tsx
import { initClient } from '@ereo/client';

// Initialize the client runtime
initClient();
```

```tsx
// app/routes/index.tsx
import { useLoaderData, Link } from '@ereo/client';

export default function Home() {
  const { posts } = useLoaderData<typeof loader>();
  
  return (
    <div>
      <h1>Posts</h1>
      {posts.map(post => (
        <Link key={post.id} to={`/posts/${post.id}`}>
          {post.title}
        </Link>
      ))}
    </div>
  );
}
```

---

## API Reference

### Client Initialization

#### initClient()

Initializes the client runtime with HMR, scroll restoration, and prefetching.

```tsx
import { initClient } from '@ereo/client';

// Call once in your client entry
initClient();
```

This sets up:
- Island hydration
- Scroll restoration on navigation
- Auto-prefetch on link hover

---

## Islands

Islands are interactive components that hydrate independently on the client.

### Creating Islands

```tsx
// app/islands/Counter.tsx
import { useState } from 'react';

export default function Counter({ initial = 0 }) {
  const [count, setCount] = useState(initial);
  return (
    <button onClick={() => setCount(c => c + 1)}>
      Count: {count}
    </button>
  );
}
```

### Using Islands

```tsx
// app/routes/index.tsx
import Counter from '../islands/Counter';

export default function Page() {
  return (
    <div>
      <h1>Static Content</h1>
      <Counter client:load initial={5} />
    </div>
  );
}
```

### Hydration Directives

| Directive | Description |
|-----------|-------------|
| `client:load` | Hydrate immediately on page load |
| `client:idle` | Hydrate when browser is idle |
| `client:visible` | Hydrate when scrolled into view |
| `client:media="(max-width: 768px)"` | Hydrate when media query matches |

See [Islands](/api/client/islands) for detailed documentation.

---

## Navigation

### Link Component

```tsx
import { Link, NavLink } from '@ereo/client';

// Basic link
<Link to="/about">About</Link>

// With prefetch
<Link to="/dashboard" prefetch="intent">Dashboard</Link>

// Active state styling
<NavLink 
  to="/profile"
  className={({ isActive }) => isActive ? 'active' : ''}
>
  Profile
</NavLink>
```

### Programmatic Navigation

```tsx
import { navigate, useTypedNavigate } from '@ereo/client';

// Direct navigation
await navigate('/dashboard');

// With options
await navigate('/login', { replace: true });

// Typed navigation (with autocomplete)
const navigate = useTypedNavigate();
navigate('/users/:id', { params: { id: '123' } });
```

### Prefetching

```tsx
import { prefetch, setupLinkPrefetch } from '@ereo/client';

// Prefetch a route manually
await prefetch('/dashboard');

// Setup prefetch on all links
setupLinkPrefetch({ strategy: 'hover' });
```

See [Navigation](/api/client/navigation) and [Prefetch](/api/client/prefetch) for details.

---

## Data Hooks

### useLoaderData

Access data from the route's loader function.

```tsx
import { useLoaderData } from '@ereo/client';
import type { loader } from './loader.server';

export default function Page() {
  const data = useLoaderData<typeof loader>();
  // data is fully typed
  return <div>{data.title}</div>;
}
```

### useActionData

Access data from the last form submission.

```tsx
import { useActionData, Form } from '@ereo/client';
import type { action } from './action.server';

export default function ContactForm() {
  const actionData = useActionData<typeof action>();
  
  return (
    <Form method="post">
      <input name="email" />
      {actionData?.errors?.email && (
        <span>{actionData.errors.email}</span>
      )}
      <button type="submit">Send</button>
    </Form>
  );
}
```

### useNavigation

Track navigation state for loading indicators.

```tsx
import { useNavigation } from '@ereo/client';

export default function Page() {
  const navigation = useNavigation();
  const isSubmitting = navigation.state === 'submitting';
  
  return (
    <button disabled={isSubmitting}>
      {isSubmitting ? 'Saving...' : 'Save'}
    </button>
  );
}
```

See [Hooks](/api/client/hooks) for all available hooks.

---

## Form Handling

### Form Component

```tsx
import { Form } from '@ereo/client';

// Basic form
<Form method="post" action="/contact">
  <input name="name" />
  <button type="submit">Submit</button>
</Form>

// With fetcher (no navigation)
function LikeButton({ postId }) {
  const fetcher = useFetcher();
  
  return (
    <fetcher.Form method="post" action={`/posts/${postId}/like`}>
      <button type="submit">
        {fetcher.data?.liked ? 'Unlike' : 'Like'}
      </button>
    </fetcher.Form>
  );
}
```

### useFetcher

For submitting forms without navigation.

```tsx
import { useFetcher } from '@ereo/client';

function AddToCart({ productId }) {
  const fetcher = useFetcher();
  const isAdding = fetcher.state !== 'idle';
  
  return (
    <fetcher.Form method="post" action="/cart">
    <input type="hidden" name="productId" value={productId} />
      <button disabled={isAdding}>
        {isAdding ? 'Adding...' : 'Add to Cart'}
      </button>
    </fetcher.Form>
  );
}
```

See [Form](/api/client/form) for complete documentation.

---

## Error Boundaries

### RouteErrorBoundary

Handle errors at the route level.

```tsx
// app/routes/dashboard.tsx
import { RouteErrorBoundary } from '@ereo/client';

export function ErrorBoundary() {
  const error = useRouteError();
  
  if (error.status === 404) {
    return <NotFound />;
  }
  
  return (
    <div>
      <h1>Error</h1>
      <p>{error.message}</p>
    </div>
  );
}
```

### ErrorBoundary Component

For component-level error handling.

```tsx
import { ErrorBoundary } from '@ereo/client';

<ErrorBoundary 
  fallback={<ErrorMessage />}
  onError={(error) => logError(error)}
>
  <RiskyComponent />
</ErrorBoundary>
```

See [Error Boundary](/api/client/error-boundary) for details.

---

## Type-Safe APIs

### TypedLink

Link component with compile-time path validation.

```tsx
import { TypedLink } from '@ereo/client';

// TypeScript validates the path exists
<TypedLink to="/users/:id" params={{ id: '123' }}>
  View User
</TypedLink>

// Search params are also typed
<TypedLink 
  to="/search" 
  search={{ q: 'query', page: 1 }}
>
  Search
</TypedLink>
```

### useTypedNavigate

Type-safe programmatic navigation.

```tsx
import { useTypedNavigate } from '@ereo/client';

const navigate = useTypedNavigate();

// Autocomplete for paths
navigate('/users/:id', { 
  params: { id: '123' },
  search: { tab: 'profile' }
});
```

See [Typed Link](/api/client/typed-link) and [Typed Navigation](/api/client/typed-navigation) for full API.

---

## Complete Example

```tsx
// app/routes/posts.$id.tsx
import { 
  useLoaderData, 
  useActionData,
  useNavigation,
  Form,
  Link,
  json
} from '@ereo/client';
import type { LoaderArgs, ActionArgs } from '@ereo/core';

// Server-side loader
export async function loader({ params }: LoaderArgs) {
  const post = await db.posts.findById(params.id);
  if (!post) throw new Response('Not found', { status: 404 });
  return json({ post });
}

// Server-side action
export async function action({ request, params }: ActionArgs) {
  const formData = await request.formData();
  const comment = formData.get('comment');
  
  await db.comments.create({
    postId: params.id,
    content: comment
  });
  
  return json({ success: true });
}

// Client component
export default function PostPage() {
  const { post } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === 'submitting';
  
  return (
    <article>
      <h1>{post.title}</h1>
      <p>{post.content}</p>
      
      <Form method="post">
        <textarea name="comment" required />
        <button disabled={isSubmitting}>
          {isSubmitting ? 'Posting...' : 'Post Comment'}
        </button>
      </Form>
      
      {actionData?.success && <p>Comment posted!</p>}
      
      <Link to="/posts">← Back to posts</Link>
    </article>
  );
}

// Error handling
export function ErrorBoundary() {
  const error = useRouteError();
  
  return (
    <div>
      <h1>Error loading post</h1>
      <p>{error.message}</p>
      <Link to="/posts">View all posts</Link>
    </div>
  );
}
```

---

## Submodules

| Module | Description |
|--------|-------------|
| [`hooks`](/api/client/hooks) | Data loading and navigation hooks |
| [`islands`](/api/client/islands) | Island component utilities |
| [`navigation`](/api/client/navigation) | Client-side navigation |
| [`link`](/api/client/link) | Link components |
| [`typed-link`](/api/client/typed-link) | Type-safe link components |
| [`typed-navigation`](/api/client/typed-navigation) | Type-safe navigation utilities |
| [`form`](/api/client/form) | Form components and utilities |
| [`prefetch`](/api/client/prefetch) | Route prefetching |
| [`error-boundary`](/api/client/error-boundary) | Error handling components |

---

## Related

- [@ereo/core](/api/core) - Core framework types and utilities
- [@ereo/client-sdk](/api/client-sdk) - Type-safe API client
- [Data Loading](/api/data/loaders) - Server-side data loading
- [Actions](/api/data/actions) - Form handling server-side
