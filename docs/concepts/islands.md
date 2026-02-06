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

### Approach 2: `data-island` / `data-hydrate` Attributes (Advanced)

For fine-grained control over **when** an island hydrates (immediately, on idle, when visible, etc.), use the explicit `data-island` and `data-hydrate` attributes. This approach requires registering your components.

```tsx
// app/components/SearchBox.tsx
import { useState } from 'react'

export default function SearchBox({ placeholder }) {
  const [query, setQuery] = useState('')
  return <input value={query} onChange={e => setQuery(e.target.value)} placeholder={placeholder} />
}
```

Register the island in your client entry point:

```tsx
// app/entry.client.ts
import { registerIslandComponent } from '@ereo/client'
import SearchBox from './components/SearchBox'

registerIslandComponent('SearchBox', SearchBox)
```

Then use it in a route with hydration attributes:

```tsx
// app/routes/index.tsx
import SearchBox from '~/components/SearchBox'

export default function Home() {
  return (
    <div>
      {/* Static - no JavaScript */}
      <header>
        <h1>Welcome</h1>
      </header>

      {/* Island - hydrated only when the browser is idle */}
      <SearchBox
        data-island="SearchBox"
        data-hydrate="idle"
        placeholder="Search..."
      />

      {/* Static content */}
      <article>
        <h2>Latest News</h2>
        <p>This is static HTML, no JavaScript needed.</p>
      </article>
    </div>
  )
}
```

### When to Use Which Approach

| | `'use client'` | `data-island` / `data-hydrate` |
|---|---|---|
| **Setup** | Add directive to file | Register component + add attributes |
| **Hydration timing** | Automatic (hydrates on load) | You choose: `load`, `idle`, `visible`, `media`, `never` |
| **Best for** | Most interactive components | Performance-critical pages, below-fold content, conditional hydration |

> **Tip:** Start with `'use client'`. If you need to defer hydration for performance (e.g., a comment section that should only hydrate when scrolled into view), switch that component to the `data-island` approach.

## Hydration Strategies

The `data-hydrate` attribute controls when an island hydrates:

### `load`

Hydrate immediately when the page loads:

```tsx
<Counter data-island="Counter" data-hydrate="load" />
```

Use for: Critical interactive elements, above-the-fold content

### `idle`

Hydrate when the browser is idle (requestIdleCallback):

```tsx
<SearchBox data-island="SearchBox" data-hydrate="idle" />
```

Use for: Important but not critical interactivity

### `visible`

Hydrate when the element enters the viewport (IntersectionObserver):

```tsx
<CommentSection data-island="CommentSection" data-hydrate="visible" />
```

Use for: Below-the-fold content, lazy-loaded sections

### `media`

Hydrate based on a media query:

```tsx
<MobileMenu
  data-island="MobileMenu"
  data-hydrate="media"
  data-media="(max-width: 768px)"
/>
```

Use for: Device-specific interactions

### `never`

Never hydrate (useful for SSR-only interactivity):

```tsx
<StaticWidget data-island="StaticWidget" data-hydrate="never" />
```

## Passing Props to Islands

Props are serialized to JSON and passed to the client:

```tsx
// Server-rendered route
<UserCard
  data-island="UserCard"
  data-hydrate="visible"
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
// islands/Dashboard.tsx
import Chart from './Chart'
import FilterPanel from './FilterPanel'

export default function Dashboard({ data }) {
  const [filters, setFilters] = useState({})

  return (
    <div>
      <FilterPanel
        data-island="FilterPanel"
        data-hydrate="load"
        onChange={setFilters}
      />
      <Chart
        data-island="Chart"
        data-hydrate="visible"
        data={data}
        filters={filters}
      />
    </div>
  )
}
```

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
<LikeButton data-island="LikeButton" data-hydrate="visible" postId={post.id} />

// Avoid: Large island with mostly static content
<EntireArticle data-island="EntireArticle" data-hydrate="load" />
```

### 2. Defer Non-Critical Islands

```tsx
{/* Critical - hydrate immediately */}
<SearchBox data-island="SearchBox" data-hydrate="load" />

{/* Non-critical - wait for idle */}
<Newsletter data-island="Newsletter" data-hydrate="idle" />

{/* Below fold - wait for visible */}
<RelatedPosts data-island="RelatedPosts" data-hydrate="visible" />
```

### 3. Avoid Hydration Waterfalls

```tsx
// Bad: Parent hydrates, then children
<Dashboard data-island="Dashboard" data-hydrate="load">
  <Chart data-island="Chart" data-hydrate="load" />
</Dashboard>

// Good: Independent islands
<DashboardLayout>
  <Chart data-island="Chart" data-hydrate="load" />
  <Stats data-island="Stats" data-hydrate="load" />
</DashboardLayout>
```

### 4. Use Skeleton Loading

Show meaningful content before hydration:

```tsx
// The server renders the initial state
<Counter
  data-island="Counter"
  data-hydrate="visible"
  initialCount={0}
/>
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
<DashboardHeader />           {/* 'use client' — hydrates on load */}
<DashboardCharts />           {/* data-island="visible" — hydrates when scrolled into view */}
<DashboardNotifications />    {/* data-island="idle" — hydrates when idle */}
```

## Edge Cases

### Islands inside Suspense boundaries

Islands inside a Suspense boundary hydrate after the Suspense resolves. If you use `defer` for data, islands that depend on that data won't hydrate until the data streams in.

### Nested island state isolation

Each island has its own React tree. State in one island is not accessible from another. Use `@ereo/state` signals for cross-island communication.
