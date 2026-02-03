# State Management

Fine-grained reactive state management for EreoJS.

## Import

```ts
import {
  Signal,
  Store,
  signal,
  atom,
  computed,
  batch,
  createStore
} from '@ereo/state'
```

## Overview

The `@ereo/state` package provides a signals-based reactivity system for managing application state. Signals are reactive primitives that automatically track dependencies and notify subscribers when values change.

Key features:

- Fine-grained reactivity with minimal overhead
- Automatic dependency tracking
- Computed values that derive from other signals
- Batched updates to prevent glitches
- Store abstraction for grouped state
- Framework-agnostic with React integration

## Signals and Reactivity

### What is a Signal?

A signal is a reactive container for a value. When the value changes, all subscribers are automatically notified.

```ts
import { signal } from '@ereo/state'

const count = signal(0)

// Read value
console.log(count.get()) // 0

// Write value
count.set(5)
console.log(count.get()) // 5

// React to changes
count.subscribe(value => {
  console.log('Count changed:', value)
})

count.set(10) // Logs: "Count changed: 10"
```

### Reactivity Model

```
Signal A ──┐
           ├──> Computed C ──> Subscriber
Signal B ──┘
```

When Signal A or B changes:
1. Computed C recalculates
2. Subscriber receives new value

This creates a dependency graph that automatically updates.

## API Reference

### Signal Class

The core reactive primitive.

#### Constructor

```ts
new Signal<T>(initialValue: T)
```

#### Methods

| Method | Signature | Description |
|--------|-----------|-------------|
| `get()` | `() => T` | Get the current value |
| `set(value)` | `(value: T) => void` | Set a new value |
| `update(fn)` | `(fn: (value: T) => T) => void` | Update value with a function |
| `subscribe(fn)` | `(fn: (value: T) => void) => () => void` | Subscribe to changes |
| `map(fn)` | `<U>(fn: (value: T) => U) => Signal<U>` | Create derived signal |

#### Example

```ts
const user = new Signal<User | null>(null)

// Get
const currentUser = user.get()

// Set
user.set({ id: '1', name: 'Alice' })

// Update
user.update(u => u ? { ...u, name: 'Bob' } : null)

// Subscribe
const unsubscribe = user.subscribe(u => {
  console.log('User:', u?.name)
})

// Unsubscribe
unsubscribe()

// Map
const userName = user.map(u => u?.name ?? 'Guest')
```

### signal

Creates a new signal.

#### Signature

```ts
function signal<T>(initialValue: T): Signal<T>
```

#### Parameters

| Name | Type | Description |
|------|------|-------------|
| `initialValue` | `T` | The initial value of the signal |

#### Returns

A new `Signal<T>` instance.

#### Example

```ts
import { signal } from '@ereo/state'

// Primitive values
const count = signal(0)
const name = signal('Alice')
const active = signal(true)

// Objects
const user = signal<User | null>(null)
const settings = signal({ theme: 'dark', lang: 'en' })

// Arrays
const items = signal<Item[]>([])
```

### atom

Alias for `signal`. Use for semantic naming of global state atoms.

#### Signature

```ts
function atom<T>(initialValue: T): Signal<T>
```

#### Example

```ts
import { atom } from '@ereo/state'

// Use atom for global state
export const userAtom = atom<User | null>(null)
export const themeAtom = atom<'light' | 'dark'>('light')
export const cartAtom = atom<CartItem[]>([])
```

### computed

Creates a computed signal derived from other signals.

#### Signature

```ts
function computed<T>(
  fn: () => T,
  deps: Signal<unknown>[]
): Signal<T>
```

#### Parameters

| Name | Type | Description |
|------|------|-------------|
| `fn` | `() => T` | Function that computes the value |
| `deps` | `Signal<unknown>[]` | Array of signal dependencies |

#### Returns

A new `Signal<T>` that automatically updates when dependencies change.

#### Example

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

### batch

Batches multiple signal updates into a single notification cycle.

#### Signature

```ts
function batch<T>(fn: () => T): T
```

#### Parameters

| Name | Type | Description |
|------|------|-------------|
| `fn` | `() => T` | Function containing multiple updates |

#### Returns

The return value of the function.

#### Example

```ts
import { signal, computed, batch } from '@ereo/state'

const a = signal(1)
const b = signal(2)
const sum = computed(() => a.get() + b.get(), [a, b])

sum.subscribe(value => console.log('Sum:', value))

// Without batch: two notifications
a.set(10) // Logs: "Sum: 12"
b.set(20) // Logs: "Sum: 30"

// With batch: one notification
batch(() => {
  a.set(100)
  b.set(200)
})
// Logs: "Sum: 300" (only once)
```

### Store Class

A container for multiple related signals.

#### Constructor

```ts
new Store<T extends Record<string, unknown>>(initialState: T)
```

#### Methods

| Method | Signature | Description |
|--------|-----------|-------------|
| `get(key)` | `<K extends keyof T>(key: K) => Signal<T[K]>` | Get signal for key |
| `set(key, value)` | `<K extends keyof T>(key: K, value: T[K]) => void` | Set value for key |
| `getSnapshot()` | `() => T` | Get snapshot of all values |

#### Example

```ts
interface AppState {
  user: User | null
  theme: 'light' | 'dark'
  count: number
}

const store = new Store<AppState>({
  user: null,
  theme: 'light',
  count: 0
})

// Get signal
const userSignal = store.get('user')
userSignal.subscribe(user => console.log('User:', user))

// Set value
store.set('theme', 'dark')
store.set('count', 42)

// Get snapshot
const state = store.getSnapshot()
// { user: null, theme: 'dark', count: 42 }
```

### createStore

Factory function to create a store.

#### Signature

```ts
function createStore<T extends Record<string, unknown>>(
  initialState: T
): Store<T>
```

#### Parameters

| Name | Type | Description |
|------|------|-------------|
| `initialState` | `T` | Object with initial values |

#### Returns

A new `Store<T>` instance.

#### Example

```ts
import { createStore } from '@ereo/state'

const store = createStore({
  user: null as User | null,
  notifications: [] as Notification[],
  settings: {
    theme: 'light',
    language: 'en'
  }
})
```

## Creating and Using Signals

### Basic Patterns

```ts
// Counter
const count = signal(0)
count.set(count.get() + 1)
// or
count.update(c => c + 1)

// Toggle
const active = signal(false)
active.update(a => !a)

// List operations
const items = signal<string[]>([])
items.update(list => [...list, 'new item'])
items.update(list => list.filter(i => i !== 'remove'))

// Object updates
const user = signal({ name: 'Alice', age: 30 })
user.update(u => ({ ...u, age: 31 }))
```

### Type-Safe Signals

```ts
interface User {
  id: string
  name: string
  email: string
}

// Nullable signal
const currentUser = signal<User | null>(null)

// Union types
const status = signal<'idle' | 'loading' | 'success' | 'error'>('idle')

// Generic signals
function createLoadingSignal<T>() {
  return signal<{
    loading: boolean
    data: T | null
    error: Error | null
  }>({
    loading: false,
    data: null,
    error: null
  })
}
```

## Computed Values and Effects

### Derived State

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

const itemCount = computed(
  () => items.get().reduce((sum, item) => sum + item.quantity, 0),
  [items]
)

console.log(total.get())     // 5.50
console.log(itemCount.get()) // 8
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

celsius.set(35)
console.log(fahrenheit.get())  // 95
console.log(description.get()) // "Hot"
```

### Effects with Subscriptions

```ts
const theme = signal<'light' | 'dark'>('light')

// Effect: update DOM
const unsubscribe = theme.subscribe(value => {
  document.documentElement.setAttribute('data-theme', value)
})

// Effect: log changes
theme.subscribe(value => {
  console.log('Theme changed to:', value)
})

// Cleanup when done
unsubscribe()
```

## State Persistence

### localStorage Persistence

```ts
function persistedSignal<T>(key: string, initialValue: T): Signal<T> {
  // Load from storage
  const stored = localStorage.getItem(key)
  const initial = stored ? JSON.parse(stored) : initialValue

  const sig = signal(initial)

  // Save on changes
  sig.subscribe(value => {
    localStorage.setItem(key, JSON.stringify(value))
  })

  return sig
}

// Usage
const theme = persistedSignal('theme', 'light')
const favorites = persistedSignal<string[]>('favorites', [])
```

### Session Storage

```ts
function sessionSignal<T>(key: string, initialValue: T): Signal<T> {
  const stored = sessionStorage.getItem(key)
  const initial = stored ? JSON.parse(stored) : initialValue

  const sig = signal(initial)

  sig.subscribe(value => {
    sessionStorage.setItem(key, JSON.stringify(value))
  })

  return sig
}
```

### Persisted Store

```ts
function createPersistedStore<T extends Record<string, unknown>>(
  key: string,
  initialState: T
): Store<T> {
  const stored = localStorage.getItem(key)
  const initial = stored ? JSON.parse(stored) : initialState

  const store = createStore<T>(initial)

  // Subscribe to all keys
  Object.keys(initial).forEach(k => {
    store.get(k as keyof T).subscribe(() => {
      localStorage.setItem(key, JSON.stringify(store.getSnapshot()))
    })
  })

  return store
}

// Usage
const settings = createPersistedStore('settings', {
  theme: 'light',
  language: 'en',
  notifications: true
})
```

## Integration with Components

### React Hook Integration

```tsx
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

  return (
    <button onClick={() => count.update(c => c + 1)}>
      Count: {value}
    </button>
  )
}
```

### Two-Way Binding Hook

```tsx
function useSignalState<T>(
  signal: Signal<T>
): [T, (value: T) => void] {
  const value = useSignal(signal)
  return [value, signal.set.bind(signal)]
}

// Usage
function NameInput() {
  const [name, setName] = useSignalState(nameSignal)

  return (
    <input
      value={name}
      onChange={e => setName(e.target.value)}
    />
  )
}
```

### Store Hook

```tsx
function useStoreValue<T extends Record<string, unknown>, K extends keyof T>(
  store: Store<T>,
  key: K
): T[K] {
  const signal = store.get(key)
  return useSignal(signal)
}

// Usage
function ThemeToggle() {
  const theme = useStoreValue(appStore, 'theme')

  return (
    <button onClick={() => appStore.set('theme', theme === 'light' ? 'dark' : 'light')}>
      Theme: {theme}
    </button>
  )
}
```

### Island Communication

Signals enable communication between separate islands:

```tsx
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
import { useSignal } from '../hooks/useSignal'

export default function Detail() {
  const id = useSignal(selectedId)

  if (!id) return <p>Select an item</p>

  return <ItemDetail id={id} />
}
```

## Patterns

### Global State Module

```ts
// lib/store.ts
import { signal, computed } from '@ereo/state'

// State
export const user = signal<User | null>(null)
export const cartItems = signal<CartItem[]>([])
export const theme = signal<'light' | 'dark'>('light')

// Derived state
export const isLoggedIn = computed(() => user.get() !== null, [user])
export const cartTotal = computed(
  () => cartItems.get().reduce((sum, item) => sum + item.price * item.quantity, 0),
  [cartItems]
)
export const cartCount = computed(
  () => cartItems.get().reduce((sum, item) => sum + item.quantity, 0),
  [cartItems]
)
```

### Actions Module

```ts
// lib/actions.ts
import { user, cartItems, theme } from './store'

export function login(userData: User) {
  user.set(userData)
}

export function logout() {
  user.set(null)
  cartItems.set([])
}

export function addToCart(item: CartItem) {
  cartItems.update(items => {
    const existing = items.find(i => i.id === item.id)
    if (existing) {
      return items.map(i =>
        i.id === item.id
          ? { ...i, quantity: i.quantity + 1 }
          : i
      )
    }
    return [...items, { ...item, quantity: 1 }]
  })
}

export function removeFromCart(itemId: string) {
  cartItems.update(items => items.filter(i => i.id !== itemId))
}

export function toggleTheme() {
  theme.update(t => t === 'light' ? 'dark' : 'light')
}
```

### Async State Pattern

```ts
interface AsyncState<T> {
  loading: boolean
  data: T | null
  error: Error | null
}

function createAsyncSignal<T>(fetcher: () => Promise<T>) {
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

  const reset = () => {
    state.set({ loading: false, data: null, error: null })
  }

  return { state, load, reset }
}

// Usage
const { state: users, load: loadUsers } = createAsyncSignal(() =>
  fetch('/api/users').then(r => r.json())
)

loadUsers()
```

### Form State Pattern

```ts
function createFormSignal<T extends Record<string, unknown>>(initialValues: T) {
  const values = signal(initialValues)
  const errors = signal<Partial<Record<keyof T, string>>>({})
  const touched = signal<Partial<Record<keyof T, boolean>>>({})

  const isValid = computed(
    () => Object.keys(errors.get()).length === 0,
    [errors]
  )

  return {
    values,
    errors,
    touched,
    isValid,

    setValue<K extends keyof T>(field: K, value: T[K]) {
      values.update(v => ({ ...v, [field]: value }))
    },

    setError<K extends keyof T>(field: K, error: string | null) {
      errors.update(e => {
        if (error) {
          return { ...e, [field]: error }
        }
        const { [field]: _, ...rest } = e
        return rest as typeof e
      })
    },

    setTouched<K extends keyof T>(field: K) {
      touched.update(t => ({ ...t, [field]: true }))
    },

    reset() {
      values.set(initialValues)
      errors.set({})
      touched.set({})
    }
  }
}
```

## Best Practices

### 1. Keep Signals Granular

Create separate signals for independent values:

```ts
// Good: granular signals
const firstName = signal('')
const lastName = signal('')
const email = signal('')

// Avoid: monolithic signal
const form = signal({ firstName: '', lastName: '', email: '' })
```

### 2. Use Computed for Derivations

Never duplicate state:

```ts
// Good: derived from source
const items = signal<Item[]>([])
const total = computed(() => items.get().reduce((s, i) => s + i.price, 0), [items])

// Avoid: separate state that can drift
const items = signal<Item[]>([])
const total = signal(0) // must be manually kept in sync
```

### 3. Batch Related Updates

Prevent intermediate states:

```ts
// Good: atomic update
batch(() => {
  firstName.set('Jane')
  lastName.set('Smith')
})

// Avoid: separate updates cause multiple re-renders
firstName.set('Jane')
lastName.set('Smith')
```

### 4. Clean Up Subscriptions

Always unsubscribe when done:

```ts
// In React
useEffect(() => {
  return signal.subscribe(setValue) // cleanup on unmount
}, [])

// Manual cleanup
const unsubscribe = signal.subscribe(handler)
// Later...
unsubscribe()
```

### 5. Type Your State

Use TypeScript for safety:

```ts
interface AppState {
  user: User | null
  theme: 'light' | 'dark'
  notifications: Notification[]
}

const store = createStore<AppState>({
  user: null,
  theme: 'light',
  notifications: []
})
```

## Related

- [Signals API](/api/state/signals)
- [Stores API](/api/state/stores)
- [Islands](/api/client/islands)
- [Client Hooks](/api/client/hooks)
