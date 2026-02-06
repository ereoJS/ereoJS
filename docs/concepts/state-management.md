# State Management

EreoJS includes `@ereo/state`, a signals-based reactive state library for shared and cross-component state. Signals provide fine-grained reactivity without full component re-renders.

## Mental Model

A signal is a reactive box that holds a value. When the value changes, only direct subscribers update -- not the entire component tree.

```
React useState:   setState() → Re-render component tree → DOM update
Signals:          signal.set() → Notify subscribers → Only affected nodes update
```

Signals live outside the component lifecycle. They can be defined at module scope, in stores, or anywhere in your app. Components opt in via `useSignal`.

```tsx
import { signal } from '@ereo/state'
import { useSignal } from '@ereo/state'

// Shared state — exists outside any component
export const count = signal(0)

function Counter() {
  const value = useSignal(count)
  return <button onClick={() => count.set(value + 1)}>{value}</button>
}
```

## API Overview

```tsx
import { signal, computed, batch, atom } from '@ereo/state'

// Create, read, write
const name = signal('Alice')
name.get()                          // 'Alice'
name.set('Bob')                     // sets to 'Bob'
name.update(n => n.toUpperCase())   // sets to 'BOB'

// Computed — derives from other signals, recalculates on change
const firstName = signal('Jane')
const lastName = signal('Doe')
const fullName = computed(
  ([first, last]) => `${first} ${last}`,
  [firstName, lastName]
)

// Batch — group updates so subscribers fire once
batch(() => {
  firstName.set('John')
  lastName.set('Smith')
})

// Subscribe — for side effects (always clean up)
const unsubscribe = name.subscribe((value) => console.log(value))
unsubscribe()  // clean up when done

// Derived signal via .map()
const price = signal(100)
const formatted = price.map(p => `$${p.toFixed(2)}`)

// Atom — simpler API for primitive values
const darkMode = atom(false)
```

## React Integration

`useSignal` subscribes a component to a signal via `useSyncExternalStore`, so it works with concurrent features and SSR.

```tsx
import { signal } from '@ereo/state'
import { useSignal } from '@ereo/state'

const count = signal(0)

function Counter() {
  const value = useSignal(count)
  return (
    <div>
      <p>Count: {value}</p>
      <button onClick={() => count.update(c => c + 1)}>+</button>
    </div>
  )
}
```

## When to Use What

| Scenario | Use | Why |
|----------|-----|-----|
| Dropdown open/closed, form input toggle | `useState` | Local to one component |
| Theme, locale, feature flags | `signal` | Shared across many components |
| Derived value from multiple signals | `computed` | Updates automatically |
| Shopping cart, auth session | `signal` / store | Survives route changes |
| Animation frame counter, hover state | `useState` | Ephemeral, high-frequency |

**Rule of thumb:** If the state is local to one component and resets on unmount, use `useState`. If it is shared, persists across navigations, or is read by unrelated components, use a signal.

## Anti-Patterns

### 1. Subscribing Without Cleanup

Leaked subscriptions cause memory issues in long-lived components and wizards.

```tsx
// BAD                                    // GOOD
useEffect(() => {                         useEffect(() => {
  theme.subscribe(v => setLocal(v))         const unsub = theme.subscribe(v => setLocal(v))
}, [])                                      return unsub
                                          }, [])
```

### 2. Mutating Signal Values Directly

Signals compare by reference. Mutating in place means subscribers never fire.

```tsx
// BAD: mutates existing array
items.get().push('c')

// GOOD: create a new array
items.update(prev => [...prev, 'c'])
```

### 3. Using Signals for Purely Local State

If only one component reads and writes a value, `useState` is simpler.

```tsx
// OVERKILL: signal for a local toggle     // BETTER: React state
const isOpen = signal(false)               function Dropdown() {
function Dropdown() {                        const [open, setOpen] = useState(false)
  const open = useSignal(isOpen)             return <div>{open && <Menu />}</div>
  return <div>{open && <Menu />}</div>     }
}
```

### 4. Creating Signals Inside Components

Signals defined in a component body are re-created every render. Define them at module scope or in a store.

```tsx
// BAD                                    // GOOD
function Counter() {                      const count = signal(0)
  const count = signal(0) // new each     function Counter() {
  // render                                 const value = useSignal(count)
}                                         }
```

### 5. Skipping `batch` for Related Updates

Updating multiple signals that feed the same `computed` without batching causes redundant recalculations.

## Next Steps

- [Signals API Reference](/api/state/signals) -- Full `Signal` class API
- [Stores API Reference](/api/state/stores) -- Structured state containers
- [Forms Concept](/concepts/forms) -- How `@ereo/forms` uses signals internally
- [Type Safety](/concepts/type-safety) -- Typing signals and computed values
