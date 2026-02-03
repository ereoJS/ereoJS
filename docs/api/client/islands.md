# Islands

APIs for working with the islands architecture.

## Import

```ts
import {
  islandRegistry,
  hydrateIslands,
  registerIslandComponent,
  getIslandComponent,
  registerIslandComponents,
  createIsland,
  initializeIslands,
  cleanupIslands
} from '@ereo/client'
```

## registerIslandComponent

Registers a component for island hydration.

### Signature

```ts
function registerIslandComponent(
  name: string,
  component: ComponentType<any>
): void
```

### Example

```ts
// src/client.ts
import { registerIslandComponent } from '@ereo/client'
import Counter from './islands/Counter'
import SearchBox from './islands/SearchBox'

registerIslandComponent('Counter', Counter)
registerIslandComponent('SearchBox', SearchBox)
```

## registerIslandComponents

Registers multiple components at once.

### Signature

```ts
function registerIslandComponents(
  components: Record<string, ComponentType<any>>
): void
```

### Example

```ts
import { registerIslandComponents } from '@ereo/client'
import * as Islands from './islands'

registerIslandComponents({
  Counter: Islands.Counter,
  SearchBox: Islands.SearchBox,
  ShoppingCart: Islands.ShoppingCart,
  ThemeToggle: Islands.ThemeToggle
})
```

## getIslandComponent

Retrieves a registered component by name.

### Signature

```ts
function getIslandComponent(name: string): ComponentType<any> | undefined
```

### Example

```ts
const Counter = getIslandComponent('Counter')

if (Counter) {
  // Component is registered
}
```

## hydrateIslands

Hydrates all islands matching a selector.

### Signature

```ts
function hydrateIslands(selector?: string): Promise<void>
```

### Example

```ts
// Hydrate all islands
await hydrateIslands()

// Hydrate specific islands
await hydrateIslands('[data-island="Counter"]')
```

## initializeIslands

Initializes the islands system. Called automatically by `initClient()`.

### Signature

```ts
function initializeIslands(): void
```

### Example

```ts
// Usually handled by initClient()
import { initializeIslands } from '@ereo/client'

initializeIslands()
```

## cleanupIslands

Cleans up all hydrated islands.

### Signature

```ts
function cleanupIslands(): void
```

### Example

```ts
// Cleanup before unmounting
cleanupIslands()
```

## createIsland

Creates island markup on the server.

### Signature

```ts
function createIsland(
  component: ComponentType<any>,
  props: Record<string, any>
): string
```

### Example

```ts
// Server-side
const html = createIsland(Counter, { initialCount: 5 })
// Returns: <div data-island="Counter" data-props='{"initialCount":5}'>...</div>
```

## islandRegistry

The global island registry instance.

### Properties

```ts
interface IslandRegistry {
  components: Map<string, ComponentType<any>>
  hydrated: Set<Element>
  register(name: string, component: ComponentType<any>): void
  get(name: string): ComponentType<any> | undefined
  has(name: string): boolean
  clear(): void
}
```

### Example

```ts
// Check registry status
console.log(`${islandRegistry.components.size} islands registered`)
console.log(`${islandRegistry.hydrated.size} islands hydrated`)

// Check if component is registered
if (islandRegistry.has('Counter')) {
  console.log('Counter is available')
}
```

## Island Component Pattern

### Basic Island

```tsx
// islands/Counter.tsx
import { useState } from 'react'

export default function Counter({ initialCount = 0 }) {
  const [count, setCount] = useState(initialCount)

  return (
    <button onClick={() => setCount(c => c + 1)}>
      Count: {count}
    </button>
  )
}
```

### Using in Routes

```tsx
// routes/index.tsx
import Counter from '../islands/Counter'

export default function Home() {
  return (
    <div>
      <h1>Welcome</h1>

      {/* This island will hydrate when visible */}
      <Counter
        data-island="Counter"
        data-hydrate="visible"
        initialCount={5}
      />
    </div>
  )
}
```

## Hydration Attributes

### data-island

Specifies the component name to hydrate.

```tsx
<Counter data-island="Counter" />
```

### data-hydrate

Specifies when to hydrate.

```tsx
// Hydrate immediately on load
<Counter data-island="Counter" data-hydrate="load" />

// Hydrate when browser is idle
<Counter data-island="Counter" data-hydrate="idle" />

// Hydrate when visible in viewport
<Counter data-island="Counter" data-hydrate="visible" />

// Hydrate on media query match
<Counter data-island="Counter" data-hydrate="media" data-media="(max-width: 768px)" />

// Never hydrate (SSR only)
<Counter data-island="Counter" data-hydrate="never" />
```

### data-props

Pass serialized props (used internally).

```tsx
<div data-island="Counter" data-props='{"initialCount":5}'></div>
```

## Advanced Patterns

### Conditional Registration

```ts
// Only register on client
if (typeof window !== 'undefined') {
  registerIslandComponent('Counter', Counter)
}
```

### Lazy Loading Islands

```ts
// Lazy load island components
const LazyCounter = lazy(() => import('./islands/Counter'))

registerIslandComponent('Counter', LazyCounter)
```

### Island with Context

```tsx
// islands/ThemedButton.tsx
import { useContext } from 'react'
import { ThemeContext } from '../context/theme'

export default function ThemedButton({ children }) {
  const theme = useContext(ThemeContext)

  return (
    <button className={theme === 'dark' ? 'btn-dark' : 'btn-light'}>
      {children}
    </button>
  )
}
```

Wrap with provider:

```tsx
// client.ts
function ThemedButtonWrapper(props) {
  return (
    <ThemeProvider>
      <ThemedButton {...props} />
    </ThemeProvider>
  )
}

registerIslandComponent('ThemedButton', ThemedButtonWrapper)
```

### Shared State Between Islands

```tsx
// lib/store.ts
import { signal } from '@ereo/state'
export const count = signal(0)

// islands/CounterDisplay.tsx
import { count } from '../lib/store'

export default function CounterDisplay() {
  return <span>{count.get()}</span>
}

// islands/CounterButton.tsx
import { count } from '../lib/store'

export default function CounterButton() {
  return (
    <button onClick={() => count.set(count.get() + 1)}>
      Increment
    </button>
  )
}
```

### Custom Hydration Strategy

```ts
// Hydrate based on user interaction
function hydrateOnInteraction(element: Element) {
  const events = ['click', 'touchstart', 'focus']

  const handler = () => {
    hydrateIslands(`[data-island="${element.dataset.island}"]`)
    events.forEach(e => element.removeEventListener(e, handler))
  }

  events.forEach(e => element.addEventListener(e, handler, { once: true }))
}
```

## Debugging

Enable island debugging:

```ts
// In development
if (process.env.NODE_ENV === 'development') {
  window.__EREO_ISLAND_DEBUG__ = true
}
```

This logs:
```
[Islands] Registered: Counter
[Islands] Hydrating: Counter (strategy: idle)
[Islands] Hydrated: Counter in 12ms
```

## Related

- [Islands Concepts](/core-concepts/islands)
- [initClient](/api/client/init)
- [State Management](/api/state/signals)
