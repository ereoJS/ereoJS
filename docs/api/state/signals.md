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

```tsx
import { signal } from '@ereo/state'
import { useState, useEffect } from 'react'

const count = signal(0)

function Counter() {
  const [value, setValue] = useState(count.get())

  useEffect(() => {
    return count.subscribe(setValue)
  }, [])

  return (
    <button onClick={() => count.update(c => c + 1)}>
      Count: {value}
    </button>
  )
}
```

### useSignal Hook (Custom)

```ts
import { useState, useEffect } from 'react'
import type { Signal } from '@ereo/state'

function useSignal<T>(signal: Signal<T>): T {
  const [value, setValue] = useState(signal.get())

  useEffect(() => {
    return signal.subscribe(setValue)
  }, [signal])

  return value
}

// Usage
function Counter() {
  const value = useSignal(count)
  return <span>{value}</span>
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

Batches multiple signal updates into a single notification.

### Signature

```ts
function batch<T>(fn: () => T): T
```

### Example

```ts
import { signal, batch } from '@ereo/state'

const firstName = signal('John')
const lastName = signal('Doe')

// Without batch: subscribers notified twice
firstName.set('Jane')
lastName.set('Smith')

// With batch: subscribers notified once
batch(() => {
  firstName.set('Jane')
  lastName.set('Smith')
})
```

### Prevents Glitches

```ts
const a = signal(1)
const b = signal(2)
const sum = computed(() => a.get() + b.get(), [a, b])

// Without batch: sum briefly shows inconsistent state
a.set(10) // sum = 12
b.set(20) // sum = 30

// With batch: sum updates atomically
batch(() => {
  a.set(10)
  b.set(20)
})
// sum = 30 (no intermediate state)
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

export default function Detail() {
  const id = useSignal(selectedId)

  if (!id) return <p>Select an item</p>

  return <ItemDetail id={id} />
}
```

## Related

- [Stores](/api/state/stores)
- [Islands](/core-concepts/islands)
