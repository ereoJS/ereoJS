# Signals

Reactive state management with signals.

## Import

```ts
import {
  Signal,
  signal,
  computed,
  atom,
  batch
} from '@ereo/state'
```

## signal

Creates a reactive signal.

### Signature

```ts
function signal<T>(initialValue: T): Signal<T>
```

### Signal Interface

```ts
interface Signal<T> {
  // Get the current value
  get(): T

  // Set a new value
  set(value: T): void

  // Update value with a function
  update(updater: (current: T) => T): void

  // Subscribe to changes
  subscribe(subscriber: (value: T) => void): () => void

  // Create derived signal
  map<U>(fn: (value: T) => U): Signal<U>
}
```

### Basic Usage

```ts
import { signal } from '@ereo/state'

const count = signal(0)

// Get value
console.log(count.get()) // 0

// Set value
count.set(5)
console.log(count.get()) // 5

// Update with function
count.update(c => c + 1)
console.log(count.get()) // 6
```

### Subscribing to Changes

```ts
const count = signal(0)

// Subscribe returns unsubscribe function
const unsubscribe = count.subscribe((value) => {
  console.log('Count changed:', value)
})

count.set(1) // Logs: "Count changed: 1"
count.set(2) // Logs: "Count changed: 2"

// Stop listening
unsubscribe()
count.set(3) // No log
```

### In React Components

The `@ereo/state` package exports a `useSignal` hook that integrates signals with React using `useSyncExternalStore`. This is the recommended way to use signals in React components:

```tsx
import { signal, useSignal } from '@ereo/state'

const count = signal(0)

function Counter() {
  const value = useSignal(count)

  return (
    <button onClick={() => count.update(c => c + 1)}>
      Count: {value}
    </button>
  )
}
```

`useSignal` uses React's `useSyncExternalStore` under the hood, which means it is compatible with React Compiler, concurrent features, and SSR. You do not need to write your own hook — just import `useSignal` from `@ereo/state`.

For stores, use `useStoreKey` (for a single key) or `useStore` (for the full snapshot):

```tsx
import { createStore, useStoreKey, useStore } from '@ereo/state'

const store = createStore({ count: 0, name: 'Alice' })

// Only re-renders when 'count' changes
function Counter() {
  const count = useStoreKey(store, 'count')
  return <button onClick={() => store.set('count', count + 1)}>{count}</button>
}

// Re-renders when any key changes
function Dashboard() {
  const state = useStore(store)
  return <div>{state.count} - {state.name}</div>
}
```

## computed

Creates a computed signal derived from other signals.

### Signature

```ts
function computed<T>(
  fn: () => T,
  deps: Signal<unknown>[]
): Signal<T>
```

### Example

```ts
import { signal, computed } from '@ereo/state'

const firstName = signal('John')
const lastName = signal('Doe')

const fullName = computed(
  () => `${firstName.get()} ${lastName.get()}`,
  [firstName, lastName]
)

console.log(fullName.get()) // "John Doe"

firstName.set('Jane')
console.log(fullName.get()) // "Jane Doe"
```

### Complex Computations

```ts
const items = signal([
  { name: 'Apple', price: 1.00, quantity: 3 },
  { name: 'Banana', price: 0.50, quantity: 5 }
])

const total = computed(
  () => items.get().reduce(
    (sum, item) => sum + item.price * item.quantity,
    0
  ),
  [items]
)

console.log(total.get()) // 5.50
```

### Chained Computations

```ts
const celsius = signal(20)

const fahrenheit = computed(
  () => celsius.get() * 9/5 + 32,
  [celsius]
)

const description = computed(
  () => {
    const f = fahrenheit.get()
    if (f < 32) return 'Freezing'
    if (f < 60) return 'Cold'
    if (f < 80) return 'Warm'
    return 'Hot'
  },
  [fahrenheit]
)

console.log(fahrenheit.get()) // 68
console.log(description.get()) // "Warm"
```

## atom

Alias for signal. Use for semantic naming.

### Signature

```ts
function atom<T>(initialValue: T): Signal<T>
```

### Example

```ts
import { atom } from '@ereo/state'

// Use atom for global state
const userAtom = atom<User | null>(null)
const themeAtom = atom<'light' | 'dark'>('light')
```

## batch

Wraps multiple signal updates for future batching support.

> **Note:** The current implementation executes the function immediately without batching. This is a placeholder API. Use it to mark code that should batch when the feature is fully implemented.

### Signature

```ts
function batch<T>(fn: () => T): T
```

### Current Behavior

```ts
import { signal, batch } from '@ereo/state'

const firstName = signal('John')
const lastName = signal('Doe')

firstName.subscribe(v => console.log('First:', v))
lastName.subscribe(v => console.log('Last:', v))

// Currently: still triggers two notifications
batch(() => {
  firstName.set('Jane') // Logs: "First: Jane"
  lastName.set('Smith') // Logs: "Last: Smith"
})
```

### Workaround for Atomic Updates

Use a single signal with an object for truly atomic updates:

```ts
const name = signal({ first: 'John', last: 'Doe' })

// Single notification
name.update(n => ({ ...n, first: 'Jane', last: 'Smith' }))
```

## Signal.map

Creates a derived signal with a transformation.

### Signature

```ts
map<U>(fn: (value: T) => U): Signal<U>
```

### Example

```ts
const count = signal(5)

const doubled = count.map(c => c * 2)
const isEven = count.map(c => c % 2 === 0)

console.log(doubled.get()) // 10
console.log(isEven.get()) // false

count.set(6)
console.log(doubled.get()) // 12
console.log(isEven.get()) // true
```

## Patterns

### Global State

```ts
// lib/store.ts
import { signal, computed } from '@ereo/state'

// User state
export const user = signal<User | null>(null)
export const isLoggedIn = computed(() => user.get() !== null, [user])

// Cart state
export const cartItems = signal<CartItem[]>([])
export const cartTotal = computed(
  () => cartItems.get().reduce((sum, item) => sum + item.price * item.quantity, 0),
  [cartItems]
)
export const cartCount = computed(
  () => cartItems.get().reduce((sum, item) => sum + item.quantity, 0),
  [cartItems]
)

// Theme state
export const theme = signal<'light' | 'dark'>('light')
```

### Actions

```ts
// lib/actions.ts
import { user, cartItems } from './store'

export function login(userData: User) {
  user.set(userData)
}

export function logout() {
  user.set(null)
}

export function addToCart(item: CartItem) {
  cartItems.update(items => [...items, item])
}

export function removeFromCart(itemId: string) {
  cartItems.update(items => items.filter(i => i.id !== itemId))
}

export function clearCart() {
  cartItems.set([])
}
```

### Persistence

```ts
import { signal } from '@ereo/state'

function persistedSignal<T>(key: string, initialValue: T): Signal<T> {
  // Load from localStorage
  const stored = localStorage.getItem(key)
  const initial = stored ? JSON.parse(stored) : initialValue

  const sig = signal(initial)

  // Save on changes
  sig.subscribe((value) => {
    localStorage.setItem(key, JSON.stringify(value))
  })

  return sig
}

// Usage
const theme = persistedSignal('theme', 'light')
```

### Async State

```ts
import { signal } from '@ereo/state'

interface AsyncState<T> {
  loading: boolean
  data: T | null
  error: Error | null
}

function asyncSignal<T>(fetcher: () => Promise<T>) {
  const state = signal<AsyncState<T>>({
    loading: false,
    data: null,
    error: null
  })

  const load = async () => {
    state.set({ loading: true, data: null, error: null })

    try {
      const data = await fetcher()
      state.set({ loading: false, data, error: null })
    } catch (error) {
      state.set({ loading: false, data: null, error: error as Error })
    }
  }

  return { state, load }
}

// Usage
const { state: users, load: loadUsers } = asyncSignal(() =>
  fetch('/api/users').then(r => r.json())
)

loadUsers()
```

### Island Communication

```ts
// lib/shared.ts
import { signal } from '@ereo/state'
export const selectedId = signal<string | null>(null)

// islands/List.tsx
import { selectedId } from '../lib/shared'

export default function List({ items }) {
  return (
    <ul>
      {items.map(item => (
        <li
          key={item.id}
          onClick={() => selectedId.set(item.id)}
        >
          {item.name}
        </li>
      ))}
    </ul>
  )
}

// islands/Detail.tsx
import { selectedId } from '../lib/shared'
import { useSignal } from '@ereo/state'

export default function Detail() {
  const id = useSignal(selectedId)

  if (!id) return <p>Select an item</p>

  return <ItemDetail id={id} />
}
```

## Related

- [Stores](/api/state/stores)
- [Islands](/core-concepts/islands)
