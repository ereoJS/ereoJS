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

## Creating Islands

Islands are React components that require client-side JavaScript:

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

Register the island in your entry point:

```tsx
// src/client.ts
import { registerIslandComponent } from '@ereo/client'
import Counter from './islands/Counter'
import SearchBox from './islands/SearchBox'

registerIslandComponent('Counter', Counter)
registerIslandComponent('SearchBox', SearchBox)
```

## Using Islands in Routes

Mark components as islands with `data-island` and `data-hydrate`:

```tsx
// routes/index.tsx
import Counter from '../islands/Counter'
import SearchBox from '../islands/SearchBox'

export default function Home() {
  return (
    <div>
      {/* Static - no JavaScript */}
      <header>
        <h1>Welcome</h1>
        <nav>
          <a href="/about">About</a>
          <a href="/contact">Contact</a>
        </nav>
      </header>

      {/* Island - hydrated on the client */}
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

      {/* Another island */}
      <Counter
        data-island="Counter"
        data-hydrate="visible"
        initialCount={5}
      />

      {/* Static footer */}
      <footer>
        <p>&copy; 2024</p>
      </footer>
    </div>
  )
}
```

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
