# @ereo/client

Client-side runtime for the EreoJS framework. Includes islands architecture, client-side navigation, prefetching, forms, and error boundaries.

## Installation

```bash
bun add @ereo/client
```

## Quick Start

```typescript
// app/entry.client.ts
import { initClient } from '@ereo/client';

// Initialize the client runtime (hydrates islands, navigation, prefetching)
initClient();
```

### Data Access

Route components receive `loaderData` and `actionData` as props during SSR:

```tsx
// app/routes/users.tsx
export async function loader() {
  return { users: await db.user.findMany() };
}

export default function UsersPage({ loaderData }: { loaderData: { users: User[] } }) {
  return <ul>{loaderData.users.map(u => <li key={u.id}>{u.name}</li>)}</ul>;
}
```

For nested or child components, use hooks to access data without prop drilling:

```tsx
import { useLoaderData } from '@ereo/client';

function UserCount() {
  const { users } = useLoaderData<{ users: User[] }>();
  return <span>{users.length} users</span>;
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
import Chart from './Chart';

// Create an island wrapper for selective hydration
const InteractiveChart = createIsland(Chart, 'Chart');

// Use with hydration directives
function Page() {
  return (
    <div>
      <h1>Dashboard</h1>
      <InteractiveChart client:visible data={chartData} />
    </div>
  );
}
```

## Documentation

For full documentation, visit [https://ereojs.dev/docs/client](https://ereojs.dev/docs/client)

## Part of EreoJS

This package is part of the [EreoJS](https://github.com/ereoJS/ereoJS) monorepo - a modern full-stack framework built for Bun.

## License

MIT
