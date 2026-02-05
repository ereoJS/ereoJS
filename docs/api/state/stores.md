# Stores

Store-based state management for complex state.

## Import

```ts
import { Store, createStore } from '@ereo/state'
```

## createStore

Creates a store with multiple signals.

### Signature

```ts
function createStore<T extends Record<string, unknown>>(
  initialState: T
): Store<T>
```

### Store Interface

```ts
interface Store<T> {
  // Get a signal for a specific key
  get<K extends keyof T>(key: K): Signal<T[K]>

  // Set a value for a key
  set<K extends keyof T>(key: K, value: T[K]): void

  // Get a snapshot of all values
  getSnapshot(): T
}
```

### Basic Usage

```ts
import { createStore } from '@ereo/state'

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

// Get a signal
const userSignal = store.get('user')
console.log(userSignal.get()) // null

// Set a value
store.set('user', { id: '1', name: 'Alice' })
console.log(store.get('user').get()) // { id: '1', name: 'Alice' }

// Get snapshot
const state = store.getSnapshot()
// { user: { id: '1', name: 'Alice' }, theme: 'light', notifications: [] }
```

### Subscribing to Store Properties

```ts
const store = createStore({
  count: 0,
  name: 'Counter'
})

// Subscribe to count changes
const countSignal = store.get('count')
countSignal.subscribe((value) => {
  console.log('Count changed:', value)
})

// Updates trigger subscription
store.set('count', 5) // Logs: "Count changed: 5"
```

### In React Components

```tsx
import { createStore } from '@ereo/state'
import { useState, useEffect } from 'react'

const store = createStore({
  theme: 'light' as 'light' | 'dark',
  sidebarOpen: true
})

function useStoreValue<K extends keyof typeof store>(key: K) {
  const signal = store.get(key)
  const [value, setValue] = useState(signal.get())

  useEffect(() => {
    return signal.subscribe(setValue)
  }, [signal])

  return value
}

function ThemeToggle() {
  const theme = useStoreValue('theme')

  return (
    <button onClick={() => store.set('theme', theme === 'light' ? 'dark' : 'light')}>
      Theme: {theme}
    </button>
  )
}
```

## Patterns

### Module Store

```ts
// stores/user.ts
import { createStore } from '@ereo/state'

interface UserState {
  user: User | null
  loading: boolean
  error: string | null
}

const userStore = createStore<UserState>({
  user: null,
  loading: false,
  error: null
})

export const userSignal = userStore.get('user')
export const loadingSignal = userStore.get('loading')
export const errorSignal = userStore.get('error')

export async function login(credentials: Credentials) {
  userStore.set('loading', true)
  userStore.set('error', null)

  try {
    const user = await api.login(credentials)
    userStore.set('user', user)
  } catch (e) {
    userStore.set('error', (e as Error).message)
  } finally {
    userStore.set('loading', false)
  }
}

export function logout() {
  userStore.set('user', null)
}
```

### Feature Store

```ts
// stores/cart.ts
import { createStore, computed } from '@ereo/state'

interface CartItem {
  id: string
  name: string
  price: number
  quantity: number
}

const cartStore = createStore({
  items: [] as CartItem[],
  coupon: null as string | null,
  discount: 0
})

export const items = cartStore.get('items')
export const coupon = cartStore.get('coupon')

export const subtotal = computed(
  () => items.get().reduce((sum, item) => sum + item.price * item.quantity, 0),
  [items]
)

export const total = computed(
  () => subtotal.get() * (1 - cartStore.get('discount').get()),
  [subtotal, cartStore.get('discount')]
)

export function addItem(item: Omit<CartItem, 'quantity'>) {
  const currentItems = items.get()
  const existing = currentItems.find(i => i.id === item.id)

  if (existing) {
    items.set(
      currentItems.map(i =>
        i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i
      )
    )
  } else {
    items.set([...currentItems, { ...item, quantity: 1 }])
  }
}

export function removeItem(id: string) {
  items.set(items.get().filter(i => i.id !== id))
}

export function updateQuantity(id: string, quantity: number) {
  if (quantity <= 0) {
    removeItem(id)
  } else {
    items.set(
      items.get().map(i => (i.id === id ? { ...i, quantity } : i))
    )
  }
}

export async function applyCoupon(code: string) {
  const discount = await api.validateCoupon(code)
  coupon.set(code)
  cartStore.set('discount', discount)
}

export function clearCart() {
  items.set([])
  coupon.set(null)
  cartStore.set('discount', 0)
}
```

### Form Store

```ts
import { createStore, computed } from '@ereo/state'

interface FormState<T> {
  values: T
  errors: Partial<Record<keyof T, string>>
  touched: Partial<Record<keyof T, boolean>>
  submitting: boolean
}

function createFormStore<T extends Record<string, any>>(initialValues: T) {
  const store = createStore<FormState<T>>({
    values: initialValues,
    errors: {},
    touched: {},
    submitting: false
  })

  const values = store.get('values')
  const errors = store.get('errors')
  const touched = store.get('touched')

  const isValid = computed(
    () => Object.keys(errors.get()).length === 0,
    [errors]
  )

  function setValue<K extends keyof T>(field: K, value: T[K]) {
    values.set({ ...values.get(), [field]: value })
  }

  function setError<K extends keyof T>(field: K, error: string | null) {
    const current = errors.get()
    if (error) {
      errors.set({ ...current, [field]: error })
    } else {
      const { [field]: _, ...rest } = current
      errors.set(rest as any)
    }
  }

  function setTouched<K extends keyof T>(field: K) {
    touched.set({ ...touched.get(), [field]: true })
  }

  function reset() {
    values.set(initialValues)
    errors.set({})
    touched.set({})
    store.set('submitting', false)
  }

  return {
    values,
    errors,
    touched,
    isValid,
    submitting: store.get('submitting'),
    setValue,
    setError,
    setTouched,
    reset,
    setSubmitting: (v: boolean) => store.set('submitting', v)
  }
}

// Usage
const loginForm = createFormStore({
  email: '',
  password: ''
})
```

### Persisted Store

```ts
import { createStore } from '@ereo/state'

function createPersistedStore<T extends Record<string, any>>(
  key: string,
  initialState: T
) {
  // Load from storage
  const stored = localStorage.getItem(key)
  const initial = stored ? JSON.parse(stored) : initialState

  const store = createStore<T>(initial)

  // Subscribe to all changes and persist
  Object.keys(initial).forEach((k) => {
    const signal = store.get(k as keyof T)
    signal.subscribe(() => {
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

### DevTools Integration

```ts
function createDevToolsStore<T extends Record<string, any>>(
  name: string,
  initialState: T
) {
  const store = createStore(initialState)

  // Log all changes in development
  if (process.env.NODE_ENV === 'development') {
    Object.keys(initialState).forEach((k) => {
      store.get(k as keyof T).subscribe((value) => {
        console.log(`[${name}] ${k}:`, value)
      })
    })
  }

  return store
}
```

## Best Practices

1. **One store per feature** - Keep stores focused and manageable
2. **Export signals, not store** - Encapsulate store access
3. **Define actions alongside stores** - Colocate state and mutations
4. **Use computed for derivations** - Don't duplicate state
5. **Type your stores** - Use interfaces for state shape

## Related

- [Signals](/api/state/signals)
- [Islands](/core-concepts/islands)
