# Islands

APIs for working with the islands architecture - selective hydration for interactive components.

> **Note:** For most use cases, you can use the `'use client'` directive to mark components for hydration without manual registration. The APIs below are for the advanced `data-island` approach, which gives you control over hydration timing (idle, visible, media, etc.). See [Islands Architecture](/concepts/islands) for when to use each approach.

## Import

```ts
import {
  // Island registration and hydration
  islandRegistry,
  hydrateIslands,
  registerIslandComponent,
  getIslandComponent,
  registerIslandComponents,
  createIsland,
  initializeIslands,
  cleanupIslands,

  // Hydration utilities
  parseHydrationDirective,
  createHydrationTrigger,
  stripHydrationProps,
  generateIslandId,
  resetIslandCounter,
  getIslandCount,
  shouldHydrate,
} from '@ereo/client'

// Types
import type { IslandRegistration, HydrationProps } from '@ereo/client'
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

Hydrates all islands on the page. Finds elements with `data-island` attribute and hydrates them based on their strategy.

### Signature

```ts
function hydrateIslands(): Promise<void>
```

### Example

```ts
import { hydrateIslands } from '@ereo/client'

// Hydrate all islands on the page
await hydrateIslands()
```

### How It Works

1. Finds all elements with `[data-island]` attribute
2. Reads component name from `data-component`
3. Parses props from `data-props` (JSON)
4. Gets hydration strategy from `data-strategy`
5. Creates appropriate hydration trigger based on strategy
6. Hydrates with React when trigger fires

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

Creates an island wrapper component for SSR. This registers the component and returns a wrapper that adds hydration data attributes.

### Signature

```ts
function createIsland<P extends Record<string, unknown>>(
  component: ComponentType<P>,
  name: string
): ComponentType<P & HydrationProps>
```

### Example

```tsx
import { createIsland } from '@ereo/client'
import Counter from './Counter'

// Create an island wrapper
const CounterIsland = createIsland(Counter, 'Counter')

// Use in your components
function Page() {
  return (
    <div>
      <h1>Static Content</h1>
      <CounterIsland initialCount={5} client:visible />
    </div>
  )
}
```

### HydrationProps

```ts
interface HydrationProps {
  'client:load'?: boolean    // Hydrate immediately on page load
  'client:idle'?: boolean    // Hydrate when browser is idle
  'client:visible'?: boolean // Hydrate when element is visible
  'client:media'?: string    // Hydrate when media query matches
  'client:only'?: boolean    // Only render on client (no SSR)
}
```

## islandRegistry

The global island registry instance that tracks all islands on the page.

### Interface

```ts
interface IslandRegistration {
  id: string
  component: ComponentType<any>
  props: Record<string, unknown>
  strategy: 'load' | 'idle' | 'visible' | 'media' | 'none'
  media?: string
  element: Element
  hydrated: boolean
}

class IslandRegistry {
  // Register an island for hydration
  register(
    id: string,
    component: ComponentType<any>,
    props: Record<string, unknown>,
    strategy: HydrationStrategy,
    element: Element,
    media?: string
  ): void

  // Get an island by ID
  get(id: string): IslandRegistration | undefined

  // Mark an island as hydrated
  markHydrated(id: string): void

  // Check if an island is hydrated
  isHydrated(id: string): boolean

  // Set cleanup function for an island
  setCleanup(id: string, cleanup: () => void): void

  // Cleanup a specific island
  cleanup(id: string): void

  // Cleanup all islands
  cleanupAll(): void

  // Get all registered islands
  getAll(): IslandRegistration[]

  // Get islands by strategy
  getByStrategy(strategy: HydrationStrategy): IslandRegistration[]

  // Get pending (not hydrated) islands
  getPending(): IslandRegistration[]
}
```

### Example

```ts
import { islandRegistry } from '@ereo/client'

// Get all registered islands
const allIslands = islandRegistry.getAll()
console.log(`${allIslands.length} islands registered`)

// Get pending islands
const pending = islandRegistry.getPending()
console.log(`${pending.length} islands waiting to hydrate`)

// Check specific island
if (islandRegistry.isHydrated('island-1')) {
  console.log('Island is hydrated')
}

// Get islands by strategy
const visibleIslands = islandRegistry.getByStrategy('visible')
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

## Hydration Utilities

These utilities are used internally but are exported for advanced use cases.

### parseHydrationDirective

Parses hydration props to determine the strategy.

```ts
function parseHydrationDirective(props: HydrationProps): {
  strategy: 'load' | 'idle' | 'visible' | 'media' | 'none'
  media?: string
}
```

```ts
const result = parseHydrationDirective({ 'client:visible': true })
// { strategy: 'visible' }

const result2 = parseHydrationDirective({ 'client:media': '(max-width: 768px)' })
// { strategy: 'media', media: '(max-width: 768px)' }
```

### createHydrationTrigger

Creates a trigger that calls the hydration callback based on the strategy.

```ts
function createHydrationTrigger(
  strategy: HydrationStrategy,
  element: Element,
  onHydrate: () => void,
  media?: string
): () => void  // Returns cleanup function
```

```ts
const cleanup = createHydrationTrigger(
  'visible',
  document.querySelector('[data-island]')!,
  () => console.log('Hydrating!'),
)

// Clean up observer when done
cleanup()
```

### stripHydrationProps

Removes hydration directive props from component props.

```ts
function stripHydrationProps<P extends HydrationProps>(
  props: P
): Omit<P, keyof HydrationProps>
```

```ts
const props = { 'client:visible': true, initialCount: 5 }
const cleanProps = stripHydrationProps(props)
// { initialCount: 5 }
```

### shouldHydrate

Determines if a component should hydrate based on strategy.

```ts
function shouldHydrate(
  strategy: HydrationStrategy,
  media?: string
): boolean | (() => boolean)
```

```ts
shouldHydrate('load')     // true
shouldHydrate('idle')     // false (resolved by idle callback)
shouldHydrate('visible')  // false (resolved by intersection observer)
shouldHydrate('media', '(max-width: 768px)')  // () => window.matchMedia('...').matches
```

### Island ID Utilities

```ts
// Generate a unique island ID
function generateIslandId(): string
// 'island-1', 'island-2', etc.

// Reset the counter (for testing)
function resetIslandCounter(): void

// Get the current count
function getIslandCount(): number
```

## Related

- [Islands Concepts](/concepts/islands)
- [Client Hooks](/api/client/hooks)
- [State Management](/api/state/signals)
