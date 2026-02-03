# @ereo/client

Client-side runtime for the EreoJS framework. Includes islands architecture, client-side navigation, prefetching, forms, and error boundaries.

## Installation

```bash
bun add @ereo/client
```

## Quick Start

```typescript
import { initClient, Link, useLoaderData } from '@ereo/client';

// Initialize the client runtime
initClient();

// Use loader data in components
function UserProfile() {
  const { user } = useLoaderData<typeof loader>();
  return <h1>{user.name}</h1>;
}

// Client-side navigation with prefetching
function Nav() {
  return <Link to="/dashboard" prefetch="hover">Dashboard</Link>;
}
```

## Key Features

- **Islands Architecture** - Partial hydration with `createIsland` and `hydrateIslands`
- **Client Navigation** - SPA-like navigation with `navigate`, `goBack`, `goForward`
- **Prefetching** - Smart prefetching with `prefetch`, hover and viewport strategies
- **Data Hooks** - `useLoaderData`, `useActionData`, `useNavigation`, `useError`
- **Link Components** - `Link` and `NavLink` with active state detection
- **Forms** - Enhanced forms with `Form`, `useSubmit`, `useFetcher`
- **Error Boundaries** - Graceful error handling with `ErrorBoundary` and `RouteErrorBoundary`
- **Scroll Restoration** - Automatic scroll position management

## Forms Example

```tsx
import { Form, useSubmit, useNavigation } from '@ereo/client';

function ContactForm() {
  const submit = useSubmit();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === 'submitting';

  return (
    <Form method="post" action="/contact">
      <input name="email" type="email" required />
      <button disabled={isSubmitting}>
        {isSubmitting ? 'Sending...' : 'Send'}
      </button>
    </Form>
  );
}
```

## Islands

```tsx
import { createIsland } from '@ereo/client';

// Only hydrate this component on the client
const InteractiveChart = createIsland(() => import('./Chart'), {
  hydrate: 'visible', // 'load' | 'idle' | 'visible' | 'media'
});
```

## Documentation

For full documentation, visit [https://ereojs.dev/docs/client](https://ereojs.dev/docs/client)

## Part of EreoJS

This package is part of the [EreoJS](https://github.com/ereojs/ereo) monorepo - a modern full-stack framework built for Bun.

## License

MIT
