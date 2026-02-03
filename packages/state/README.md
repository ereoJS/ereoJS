# @ereo/state

Signals and reactivity system for the EreoJS framework. Provides fine-grained reactive state management with a simple API.

## Installation

```bash
bun add @ereo/state
```

## Quick Start

```typescript
import { signal, computed, createStore } from '@ereo/state';

// Create a signal
const count = signal(0);

// Read value
console.log(count.get()); // 0

// Update value
count.set(1);
count.update(n => n + 1);

// Subscribe to changes
const unsubscribe = count.subscribe(value => {
  console.log('Count changed:', value);
});

// Create computed signals
const doubled = computed(() => count.get() * 2, [count]);
```

## Using Stores

```typescript
import { createStore } from '@ereo/state';

interface AppState {
  user: string | null;
  theme: 'light' | 'dark';
  count: number;
}

const store = createStore<AppState>({
  user: null,
  theme: 'light',
  count: 0,
});

// Get signal for a specific key
const userSignal = store.get('user');

// Set value
store.set('theme', 'dark');

// Get snapshot of all values
const snapshot = store.getSnapshot();
```

## Key Features

- **Signals**: Fine-grained reactive primitives with automatic change detection
- **Computed Values**: Derived state that updates automatically when dependencies change
- **Stores**: Centralized state management with key-value access
- **Subscriptions**: React to state changes with subscribe/unsubscribe pattern
- **Batch Updates**: Group multiple updates to minimize re-renders
- **Map Transform**: Transform signals with the `map()` method
- **TypeScript Support**: Full type inference and safety

## API Reference

- `signal<T>(value)` - Create a reactive signal
- `atom<T>(value)` - Alias for signal
- `computed<T>(fn, deps)` - Create a computed signal
- `batch(fn)` - Batch multiple updates
- `createStore<T>(state)` - Create a reactive store

## Documentation

For full documentation, visit the [EreoJS Documentation](https://ereojs.dev/docs/state).

## Part of EreoJS

This package is part of the [EreoJS](https://github.com/ereojs/ereo) monorepo - a modern full-stack JavaScript framework.

## License

MIT
