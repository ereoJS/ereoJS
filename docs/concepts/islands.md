# Islands Architecture

Islands architecture lets you ship minimal JavaScript by selectively hydrating only the interactive parts of your page. Most of your page remains static HTML, while "islands" of interactivity get the JavaScript they need.

## The Concept

Traditional SSR hydrates the entire page, sending JavaScript for every component. Islands architecture only hydrates components that need interactivity.

```
Traditional SSR:
┌─────────────────────────────────────┐
│ Header (hydrated)                   │
├─────────────────────────────────────┤
│ Navigation (hydrated)               │
├─────────────────────────────────────┤
│ Article Content (hydrated)          │
├─────────────────────────────────────┤
│ Comment Section (hydrated)          │
├─────────────────────────────────────┤
│ Footer (hydrated)                   │
└─────────────────────────────────────┘
JavaScript: ~150KB

Islands Architecture:
┌─────────────────────────────────────┐
│ Header (static HTML)                │
├─────────────────────────────────────┤
│ Navigation (static HTML)            │
├─────────────────────────────────────┤
│ ┌─────────────────────────────────┐ │
│ │ Search Box (island - hydrated)  │ │
│ └─────────────────────────────────┘ │
│ Article Content (static HTML)       │
├─────────────────────────────────────┤
│ ┌─────────────────────────────────┐ │
│ │ Comment Form (island - hydrated)│ │
│ └─────────────────────────────────┘ │
├─────────────────────────────────────┤
│ Footer (static HTML)                │
└─────────────────────────────────────┘
JavaScript: ~25KB
```

## Two Ways to Create Islands

EreoJS supports two approaches for creating interactive islands. Pick the one that fits your needs.

### Approach 1: `'use client'` Directive (Recommended for Most Cases)

Add `'use client'` at the top of a component file. EreoJS automatically marks it for client-side hydration — no registration or special attributes needed.

```tsx
// app/components/Counter.tsx
'use client';

import { useState } from 'react';

export function Counter({ initialCount = 0 }) {
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

Use it directly in your route:

```tsx
// app/routes/index.tsx
import { Counter } from '~/components/Counter';

export default function Home() {
  return (
    <div>
      <h1>Welcome</h1>
      <p>This heading and paragraph are static HTML — no JavaScript.</p>

      {/* Only this component ships JavaScript to the client */}
      <Counter initialCount={0} />
    </div>
  );
}
```

> **This is the approach used in the `create-ereo` starter templates.** It's the simplest way to add interactivity and works well for most applications.

### Approach 2: `createIsland()` Wrapper (Advanced)

For fine-grained control over **when** an island hydrates (immediately, on idle, when visible, etc.), use `createIsland()` to wrap your component and `client:*` directives to control hydration timing.

```tsx
// app/components/SearchBox.tsx
import { useState } from 'react'

export default function SearchBox({ placeholder }) {
  const [query, setQuery] = useState('')
  return <input value={query} onChange={e => setQuery(e.target.value)} placeholder={placeholder} />
}
```

Wrap the component with `createIsland()` and use `client:*` directives in your route:

```tsx
// app/routes/index.tsx
import { createIsland } from '@ereo/client'
import SearchBoxBase from '~/components/SearchBox'

const SearchBox = createIsland(SearchBoxBase, 'SearchBox')

export default function Home() {
  return (
    <div>
      {/* Static - no JavaScript */}
      <header>
        <h1>Welcome</h1>
      </header>

      {/* Island - hydrated only when the browser is idle */}
      <SearchBox client:idle placeholder="Search..." />

      {/* Static content */}
      <article>
        <h2>Latest News</h2>
        <p>This is static HTML, no JavaScript needed.</p>
      </article>
    </div>
  )
}
```

`createIsland()` automatically registers the component and produces the `data-island` markers needed for client-side hydration.

### When to Use Which Approach

| | `'use client'` | `createIsland()` |
|---|---|---|
| **Setup** | Add directive to file | Wrap component with `createIsland()` |
| **Hydration timing** | Uses `client:load` by default, supports all `client:*` directives | You choose: `client:load`, `client:idle`, `client:visible`, `client:media` |
| **Best for** | Most interactive components | Performance-critical pages, below-fold content, conditional hydration |

> **Tip:** Start with `'use client'`. If you need to defer hydration for performance (e.g., a comment section that should only hydrate when scrolled into view), switch that component to the `createIsland()` approach.

## Hydration Strategies

The `client:*` directives control when an island hydrates. These work with both `'use client'` components and `createIsland()` wrapped components:

### `client:load`

Hydrate immediately when the page loads:

```tsx
<Counter client:load />
```

Use for: Critical interactive elements, above-the-fold content. This is the default for `'use client'` components.

### `client:idle`

Hydrate when the browser is idle (requestIdleCallback):

```tsx
<SearchBox client:idle />
```

Use for: Important but not critical interactivity

### `client:visible`

Hydrate when the element enters the viewport (IntersectionObserver):

```tsx
<CommentSection client:visible />
```

Use for: Below-the-fold content, lazy-loaded sections

### `client:media`

Hydrate based on a media query:

```tsx
<MobileMenu client:media="(max-width: 768px)" />
```

Use for: Device-specific interactions

### No directive

Omitting all `client:*` directives means the component will be server-rendered but never hydrated on the client:

```tsx
<StaticWidget />
```

## Passing Props to Islands

Props are serialized to JSON and passed to the client:

```tsx
// Server-rendered route — UserCard uses 'use client' or createIsland()
<UserCard
  client:visible
  user={{ id: 1, name: 'Alice' }}
  showBio={true}
/>
```

```tsx
// islands/UserCard.tsx
interface UserCardProps {
  user: { id: number; name: string }
  showBio: boolean
}

export default function UserCard({ user, showBio }: UserCardProps) {
  const [following, setFollowing] = useState(false)

  return (
    <div>
      <h3>{user.name}</h3>
      {showBio && <Bio userId={user.id} />}
      <button onClick={() => setFollowing(!following)}>
        {following ? 'Following' : 'Follow'}
      </button>
    </div>
  )
}
```

**Important:** Only serializable data can be passed as props. Functions, class instances, and circular references won't work.

## Island-Only State

Islands have their own isolated state:

```tsx
// islands/ShoppingCart.tsx
import { useState, useEffect } from 'react'

export default function ShoppingCart() {
  const [items, setItems] = useState([])
  const [isOpen, setIsOpen] = useState(false)

  // Fetch cart from API on mount
  useEffect(() => {
    fetch('/api/cart')
      .then(r => r.json())
      .then(setItems)
  }, [])

  return (
    <div>
      <button onClick={() => setIsOpen(!isOpen)}>
        Cart ({items.length})
      </button>
      {isOpen && <CartDropdown items={items} />}
    </div>
  )
}
```

## Nested Islands

Islands can contain other islands:

```tsx
// app/routes/dashboard.tsx
// FilterPanel and Chart both use 'use client'
import { FilterPanel } from '~/components/FilterPanel'
import { Chart } from '~/components/Chart'

export default function Dashboard({ loaderData }) {
  return (
    <div>
      <FilterPanel client:load />
      <Chart client:visible data={loaderData.chartData} />
    </div>
  )
}
```

> **Note:** Since each island has its own React tree, you cannot pass functions (like `onChange`) between islands. Use `@ereo/state` signals for cross-island communication instead.

## Islands with Forms

Combine islands with EreoJS's form handling:

```tsx
// islands/CommentForm.tsx
import { Form, useFetcher } from '@ereo/client'

export default function CommentForm({ postId }) {
  const fetcher = useFetcher()
  const isSubmitting = fetcher.state === 'submitting'

  return (
    <fetcher.Form method="post" action={`/posts/${postId}/comments`}>
      <textarea name="content" required disabled={isSubmitting} />
      <button type="submit" disabled={isSubmitting}>
        {isSubmitting ? 'Posting...' : 'Post Comment'}
      </button>
    </fetcher.Form>
  )
}
```

## Using EreoJS State in Islands

For shared state across islands, use `@ereo/state`:

```tsx
// lib/store.ts
import { signal } from '@ereo/state'

export const cartItems = signal([])
export const user = signal(null)
```

```tsx
// islands/CartButton.tsx
import { cartItems } from '../lib/store'

export default function CartButton() {
  const items = cartItems.get()

  return (
    <button>
      Cart ({items.length})
    </button>
  )
}
```

```tsx
// islands/AddToCart.tsx
import { cartItems } from '../lib/store'

export default function AddToCart({ product }) {
  const addItem = () => {
    cartItems.update(items => [...items, product])
  }

  return <button onClick={addItem}>Add to Cart</button>
}
```

## Route-Level Island Configuration

Configure islands at the route level:

```tsx
export const config = {
  islands: {
    // Default hydration strategy for all islands in this route
    strategy: 'idle',

    // Preload island chunks
    preload: ['SearchBox', 'CommentForm'],

    // Maximum concurrent hydrations
    maxConcurrent: 3
  }
}
```

## Performance Tips

### 1. Keep Islands Small

```tsx
// Good: Small, focused island
<LikeButton client:visible postId={post.id} />

// Avoid: Large island with mostly static content
<EntireArticle client:load />
```

### 2. Defer Non-Critical Islands

```tsx
{/* Critical - hydrate immediately */}
<SearchBox client:load />

{/* Non-critical - wait for idle */}
<Newsletter client:idle />

{/* Below fold - wait for visible */}
<RelatedPosts client:visible />
```

### 3. Avoid Hydration Waterfalls

```tsx
// Bad: Parent hydrates, then children
<Dashboard client:load>
  <Chart client:load />
</Dashboard>

// Good: Independent islands
<DashboardLayout>
  <Chart client:load />
  <Stats client:load />
</DashboardLayout>
```

### 4. Use Skeleton Loading

Show meaningful content before hydration:

```tsx
// The server renders the initial state
<Counter client:visible initialCount={0} />
```

```tsx
// islands/Counter.tsx
export default function Counter({ initialCount = 0 }) {
  const [count, setCount] = useState(initialCount)

  // Before hydration, shows initialCount
  // After hydration, becomes interactive
  return <button onClick={() => setCount(c => c + 1)}>{count}</button>
}
```

## Debugging Islands

Enable island debugging in development:

```tsx
// ereo.config.ts
export default defineConfig({
  dev: {
    islands: {
      debug: true  // Logs hydration timing
    }
  }
})
```

This logs:
```
[Islands] Hydrated SearchBox in 12ms (strategy: idle)
[Islands] Hydrated Counter in 3ms (strategy: visible)
```

## Anti-Patterns

### Making everything an island

If every component is an island, you've recreated full-page hydration. Only mark components as islands when they need client-side interactivity (event handlers, state, effects).

```tsx
// Bad: static content doesn't need to be an island
'use client'
export function Footer() {
  return <footer>© 2024 My App</footer>
}

// Good: only interactive components
'use client'
export function ThemeToggle() {
  const [dark, setDark] = useState(false)
  return <button onClick={() => setDark(!dark)}>Toggle</button>
}
```

### Passing non-serializable props

Island props are serialized to JSON for SSR hydration. Functions, class instances, Dates, and other non-serializable values will be lost:

```tsx
// Bad: function prop won't survive serialization
<MyIsland onSave={(data) => save(data)} />

// Good: use a string identifier and handle logic inside the island
<MyIsland saveEndpoint="/api/posts" />
```

### Large islands that should be split

A single large island hydrates all its JavaScript at once. Split into smaller islands so less-critical parts can hydrate later:

```tsx
// Bad: one large island
<DashboardIsland />

// Good: separate islands with different hydration strategies
<DashboardHeader client:load />       {/* hydrates on load */}
<DashboardCharts client:visible />   {/* hydrates when scrolled into view */}
<DashboardNotifications client:idle />  {/* hydrates when idle */}
```

## Edge Cases

### Islands inside Suspense boundaries

Islands inside a Suspense boundary hydrate after the Suspense resolves. If you use `defer` for data, islands that depend on that data won't hydrate until the data streams in.

### Nested island state isolation

Each island has its own React tree. State in one island is not accessible from another. Use `@ereo/state` signals for cross-island communication.
