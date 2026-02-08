/**
 * @ereo/state - React Integration Tests
 *
 * Tests for useSignal, useStoreKey, and useStore hooks.
 * We simulate what useSyncExternalStore does by calling subscribe + getSnapshot
 * directly, avoiding mock.module('react') which poisons the global module cache.
 */

import { describe, expect, test } from 'bun:test';
import { signal, computed, batch, createStore, Signal } from './signals';
import type { Store } from './signals';

// ---------------------------------------------------------------------------
// Local hook simulators — replicate what React's useSyncExternalStore does
// when called by our hooks, without globally mocking the 'react' module.
// ---------------------------------------------------------------------------

function simulateUseSignal<T>(sig: Signal<T>): T {
  // useSignal calls useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
  // Our simulation: subscribe (mirroring what React would do), then return get()
  const unsub = sig.subscribe(() => {});
  const value = sig.get();
  unsub();
  return value;
}

function simulateUseStoreKey<T extends Record<string, unknown>, K extends keyof T>(
  store: Store<T>,
  key: K
): T[K] {
  return simulateUseSignal(store.get(key));
}

function simulateUseStore<T extends Record<string, unknown>>(store: Store<T>): T {
  // useStore subscribes to all store signals, then returns getSnapshot()
  const unsubs: (() => void)[] = [];
  for (const [, sig] of store.entries()) {
    unsubs.push(sig.subscribe(() => {}));
  }
  const snapshot = store.getSnapshot();
  unsubs.forEach((u) => u());
  return snapshot;
}

// ===========================================================================
// Section 1 - useSignal hook
// ===========================================================================

describe('useSignal', () => {
  test('returns the current signal value', () => {
    const s = signal(42);
    const value = simulateUseSignal(s);
    expect(value).toBe(42);
  });

  test('returns updated value after set', () => {
    const s = signal('hello');
    s.set('world');
    const value = simulateUseSignal(s);
    expect(value).toBe('world');
  });

  test('works with different signal types', () => {
    const numSig = signal(0);
    const strSig = signal('test');
    const boolSig = signal(true);
    const arrSig = signal([1, 2, 3]);
    const objSig = signal({ key: 'val' });

    expect(simulateUseSignal(numSig)).toBe(0);
    expect(simulateUseSignal(strSig)).toBe('test');
    expect(simulateUseSignal(boolSig)).toBe(true);
    expect(simulateUseSignal(arrSig)).toEqual([1, 2, 3]);
    expect(simulateUseSignal(objSig)).toEqual({ key: 'val' });
  });

  test('works with null and undefined values', () => {
    const nullSig = signal<string | null>(null);
    const undefSig = signal<number | undefined>(undefined);

    expect(simulateUseSignal(nullSig)).toBe(null);
    expect(simulateUseSignal(undefSig)).toBe(undefined);
  });

  test('subscribe callback from useSignal triggers on signal changes', () => {
    const s = signal(0);

    // Test the subscribe/get contract that useSignal relies on:
    const values: number[] = [];
    const unsub = s.subscribe(() => {
      values.push(s.get());
    });

    s.set(10);
    s.set(20);

    expect(values).toEqual([10, 20]);
    unsub();
  });

  test('works with computed signals', () => {
    const a = signal(3);
    const b = signal(4);
    const sum = computed(() => a.get() + b.get(), [a as Signal<unknown>, b as Signal<unknown>]);

    expect(simulateUseSignal(sum)).toBe(7);

    a.set(10);
    expect(simulateUseSignal(sum)).toBe(14);
  });

  test('works with mapped signals', () => {
    const s = signal(5);
    const doubled = s.map((v) => v * 2);

    expect(simulateUseSignal(doubled)).toBe(10);

    s.set(10);
    expect(simulateUseSignal(doubled)).toBe(20);
  });
});

// ===========================================================================
// Section 2 - useStoreKey hook
// ===========================================================================

describe('useStoreKey', () => {
  test('returns value for specific store key', () => {
    const store = createStore({ count: 0, name: 'test' });
    expect(simulateUseStoreKey(store, 'count')).toBe(0);
    expect(simulateUseStoreKey(store, 'name')).toBe('test');
  });

  test('returns updated value after store.set', () => {
    const store = createStore({ count: 0 });
    store.set('count', 42);
    expect(simulateUseStoreKey(store, 'count')).toBe(42);
  });

  test('different keys are independent', () => {
    const store = createStore({ a: 1, b: 2 });
    store.set('a', 100);
    expect(simulateUseStoreKey(store, 'a')).toBe(100);
    expect(simulateUseStoreKey(store, 'b')).toBe(2);
  });

  test('works with various value types', () => {
    const store = createStore({
      num: 42,
      str: 'hello',
      bool: false,
      arr: [1, 2],
      obj: { nested: true },
    });

    expect(simulateUseStoreKey(store, 'num')).toBe(42);
    expect(simulateUseStoreKey(store, 'str')).toBe('hello');
    expect(simulateUseStoreKey(store, 'bool')).toBe(false);
    expect(simulateUseStoreKey(store, 'arr')).toEqual([1, 2]);
    expect(simulateUseStoreKey(store, 'obj')).toEqual({ nested: true });
  });
});

// ===========================================================================
// Section 3 - useStore hook
// ===========================================================================

describe('useStore', () => {
  test('returns snapshot of entire store', () => {
    const store = createStore({ count: 0, name: 'test' });
    const snapshot = simulateUseStore(store);
    expect(snapshot).toEqual({ count: 0, name: 'test' });
  });

  test('returns updated snapshot after store changes', () => {
    const store = createStore({ a: 1, b: 2 });
    store.set('a', 10);
    const snapshot = simulateUseStore(store);
    expect(snapshot).toEqual({ a: 10, b: 2 });
  });

  test('snapshot reflects all key changes', () => {
    const store = createStore({ x: 0, y: 0, z: 0 });
    store.set('x', 1);
    store.set('y', 2);
    store.set('z', 3);
    expect(simulateUseStore(store)).toEqual({ x: 1, y: 2, z: 3 });
  });

  test('store subscribe/unsubscribe lifecycle for all keys', () => {
    const store = createStore({ a: 1, b: 2, c: 3 });
    const callbacks: (() => void)[] = [];

    // Subscribe to all store signals (mimicking what useStore does)
    const unsubscribers: (() => void)[] = [];
    for (const [, sig] of store.entries()) {
      unsubscribers.push(sig.subscribe(() => {
        callbacks.push(() => {});
      }));
    }

    store.set('a', 10);
    expect(callbacks.length).toBe(1);

    store.set('b', 20);
    expect(callbacks.length).toBe(2);

    // Cleanup all subscriptions
    unsubscribers.forEach((unsub) => unsub());

    store.set('c', 30);
    // No new callbacks after cleanup
    expect(callbacks.length).toBe(2);
  });

  test('snapshot caching invalidation on signal change', () => {
    // Simulate the caching logic that useStore implements:
    // cachedSnapshot is set to null on each signal change, then rebuilt on getSnapshot()
    const store = createStore({ val: 1 });

    let cachedSnapshot: { val: number } | null = null;
    let version = 0;

    const subscribe = (callback: () => void) => {
      const unsubscribers: (() => void)[] = [];
      for (const [, sig] of store.entries()) {
        unsubscribers.push(sig.subscribe(() => {
          version++;
          cachedSnapshot = null;
          callback();
        }));
      }
      return () => unsubscribers.forEach((unsub) => unsub());
    };

    const getSnapshot = () => {
      if (cachedSnapshot === null) {
        cachedSnapshot = store.getSnapshot();
      }
      return cachedSnapshot;
    };

    const unsub = subscribe(() => {});

    // Initial snapshot
    const snap1 = getSnapshot();
    expect(snap1).toEqual({ val: 1 });

    // Calling again returns same cached object
    const snap1b = getSnapshot();
    expect(snap1b).toBe(snap1);

    // After change, cache is invalidated
    store.set('val', 2);
    expect(cachedSnapshot).toBe(null);

    const snap2 = getSnapshot();
    expect(snap2).toEqual({ val: 2 });
    expect(snap2).not.toBe(snap1);

    unsub();
  });
});

// ===========================================================================
// Section 4 - Signal subscribe/get contract for useSyncExternalStore
// ===========================================================================

describe('useSyncExternalStore contract compliance', () => {
  test('subscribe callback is called on every update', () => {
    const s = signal(0);
    const calls: number[] = [];

    s.subscribe((v) => calls.push(v));

    s.set(1);
    s.set(2);
    s.set(3);

    expect(calls).toEqual([1, 2, 3]);
  });

  test('getSnapshot (signal.get) is consistent with subscribe', () => {
    const s = signal('initial');
    let lastSubscribedValue = s.get();

    s.subscribe((v) => {
      lastSubscribedValue = v;
    });

    s.set('updated');
    expect(s.get()).toBe('updated');
    expect(lastSubscribedValue).toBe('updated');
  });

  test('subscribe returns stable unsubscribe function', () => {
    const s = signal(0);
    const unsub = s.subscribe(() => {});
    expect(typeof unsub).toBe('function');

    // Calling unsubscribe multiple times should not throw
    unsub();
    unsub();
  });

  test('getSnapshot returns same reference when value has not changed', () => {
    const obj = { x: 1 };
    const s = signal(obj);

    const snap1 = s.get();
    const snap2 = s.get();
    expect(snap1).toBe(snap2);
  });

  test('getSnapshot returns new reference when value changes', () => {
    const s = signal({ x: 1 });
    const snap1 = s.get();

    s.set({ x: 2 });
    const snap2 = s.get();

    expect(snap1).not.toBe(snap2);
  });

  test('subscribe fires synchronously (required by useSyncExternalStore)', () => {
    const s = signal(0);
    let fired = false;

    s.subscribe(() => {
      fired = true;
    });

    s.set(1);
    // Must be synchronous - useSyncExternalStore requires immediate notification
    expect(fired).toBe(true);
  });

  test('handles rapid updates without losing any', () => {
    const s = signal(0);
    const values: number[] = [];

    s.subscribe((v) => values.push(v));

    for (let i = 1; i <= 100; i++) {
      s.set(i);
    }

    expect(values.length).toBe(100);
    expect(values[values.length - 1]).toBe(100);
  });

  test('unsubscribe prevents memory leaks', () => {
    const s = signal(0);
    const values: number[] = [];

    const unsub = s.subscribe((v) => values.push(v));
    s.set(1);
    unsub();

    // Create and destroy many subscribers
    for (let i = 0; i < 1000; i++) {
      const tempUnsub = s.subscribe(() => {});
      tempUnsub();
    }

    s.set(2);
    expect(values).toEqual([1]);
  });

  test('multiple subscribers each get their own unsubscribe', () => {
    const s = signal(0);
    const calls1: number[] = [];
    const calls2: number[] = [];
    const calls3: number[] = [];

    const unsub1 = s.subscribe((v) => calls1.push(v));
    const unsub2 = s.subscribe((v) => calls2.push(v));
    const unsub3 = s.subscribe((v) => calls3.push(v));

    s.set(1);
    expect(calls1).toEqual([1]);
    expect(calls2).toEqual([1]);
    expect(calls3).toEqual([1]);

    unsub2();
    s.set(2);
    expect(calls1).toEqual([1, 2]);
    expect(calls2).toEqual([1]); // unsubscribed
    expect(calls3).toEqual([1, 2]);

    unsub1();
    unsub3();
    s.set(3);
    expect(calls1).toEqual([1, 2]);
    expect(calls2).toEqual([1]);
    expect(calls3).toEqual([1, 2]);
  });

  test('subscriber receives the new value, not old', () => {
    const s = signal('old');
    let received: string | undefined;

    s.subscribe((v) => {
      received = v;
      // At this point, s.get() should also return the new value
      expect(s.get()).toBe(v);
    });

    s.set('new');
    expect(received).toBe('new');
  });
});

// ===========================================================================
// Section 5 - Store subscribe/get contract for useStore
// ===========================================================================

describe('Store useSyncExternalStore contract', () => {
  test('subscribing to all store signals detects any key change', () => {
    const store = createStore({ a: 1, b: 2, c: 3 });
    let changeCount = 0;

    const unsubs: (() => void)[] = [];
    for (const [, sig] of store.entries()) {
      unsubs.push(sig.subscribe(() => changeCount++));
    }

    store.set('a', 10);
    expect(changeCount).toBe(1);

    store.set('b', 20);
    expect(changeCount).toBe(2);

    store.set('c', 30);
    expect(changeCount).toBe(3);

    // Same value does not trigger
    store.set('c', 30);
    expect(changeCount).toBe(3);

    unsubs.forEach((u) => u());
  });

  test('store getSnapshot returns new object each time values differ', () => {
    const store = createStore({ x: 0 });
    const snap1 = store.getSnapshot();
    store.set('x', 1);
    const snap2 = store.getSnapshot();

    expect(snap1).not.toBe(snap2);
    expect(snap1.x).toBe(0);
    expect(snap2.x).toBe(1);
  });

  test('store getSnapshot returns different object even for same values', () => {
    // getSnapshot always creates a new object -- important for React
    const store = createStore({ x: 1 });
    const snap1 = store.getSnapshot();
    const snap2 = store.getSnapshot();

    // They are structurally equal but different references
    expect(snap1).toEqual(snap2);
    expect(snap1).not.toBe(snap2);
  });

  test('batch updates to store trigger single notification per signal', () => {
    const store = createStore({ a: 0, b: 0 });
    let aNotify = 0;
    let bNotify = 0;

    store.get('a').subscribe(() => aNotify++);
    store.get('b').subscribe(() => bNotify++);

    batch(() => {
      store.set('a', 1);
      store.set('a', 2);
      store.set('a', 3);
      store.set('b', 10);
    });

    // Batch deduplicates notifications per signal
    expect(aNotify).toBe(1);
    expect(bNotify).toBe(1);
    expect(store.get('a').get()).toBe(3);
    expect(store.get('b').get()).toBe(10);
  });

  test('store with empty initial state', () => {
    const store = createStore({} as Record<string, number>);
    expect(store.getSnapshot()).toEqual({});

    // entries should be empty
    const keys: string[] = [];
    for (const [key] of store.entries()) {
      keys.push(key);
    }
    expect(keys).toEqual([]);
  });

  test('store set on new key creates accessible signal', () => {
    const store = createStore({} as { count: number });
    store.set('count', 42);
    expect(store.get('count').get()).toBe(42);
    expect(store.getSnapshot()).toEqual({ count: 42 });
  });
});

// ===========================================================================
// Section 6 - useSignal with batched updates
// ===========================================================================

describe('useSignal with batch', () => {
  test('signal value reflects final batch state', () => {
    const s = signal(0);

    batch(() => {
      s.set(1);
      s.set(2);
      s.set(3);
    });

    // After batch, useSignal should see the latest value
    expect(simulateUseSignal(s)).toBe(3);
  });

  test('computed signal reflects batch result', () => {
    const a = signal(1);
    const b = signal(2);
    const sum = computed(() => a.get() + b.get(), [a as Signal<unknown>, b as Signal<unknown>]);

    batch(() => {
      a.set(10);
      b.set(20);
    });

    expect(simulateUseSignal(sum)).toBe(30);
  });
});

// ===========================================================================
// Section 7 - Edge cases for React integration
// ===========================================================================

describe('React integration edge cases', () => {
  test('signal with function value', () => {
    const fn = () => 42;
    const s = signal(fn);
    const result = simulateUseSignal(s);
    expect(result).toBe(fn);
    expect(result()).toBe(42);
  });

  test('signal with deeply nested object', () => {
    const deep = { a: { b: { c: { d: 'deep' } } } };
    const s = signal(deep);
    expect(simulateUseSignal(s)).toBe(deep);
    expect(simulateUseSignal(s).a.b.c.d).toBe('deep');
  });

  test('signal value type narrowing with undefined', () => {
    const s = signal<string | undefined>(undefined);
    expect(simulateUseSignal(s)).toBe(undefined);

    s.set('defined');
    expect(simulateUseSignal(s)).toBe('defined');

    s.set(undefined);
    expect(simulateUseSignal(s)).toBe(undefined);
  });

  test('store with single key', () => {
    const store = createStore({ only: 'value' });
    expect(simulateUseStoreKey(store, 'only')).toBe('value');
    expect(simulateUseStore(store)).toEqual({ only: 'value' });
  });

  test('store with many keys', () => {
    const initial: Record<string, number> = {};
    for (let i = 0; i < 50; i++) {
      initial[`key${i}`] = i;
    }
    const store = createStore(initial);
    const snapshot = simulateUseStore(store);

    for (let i = 0; i < 50; i++) {
      expect(snapshot[`key${i}`]).toBe(i);
    }
  });

  test('useSignal after signal dispose still returns last value', () => {
    const source = signal(10);
    const mapped = source.map((v) => v * 3);

    expect(simulateUseSignal(mapped)).toBe(30);

    mapped.dispose();
    source.set(20);

    // Disposed signal retains its last value
    expect(simulateUseSignal(mapped)).toBe(30);
  });

  test('concurrent signal and store usage', () => {
    const standalone = signal(100);
    const store = createStore({ count: 0 });

    expect(simulateUseSignal(standalone)).toBe(100);
    expect(simulateUseStoreKey(store, 'count')).toBe(0);

    standalone.set(200);
    store.set('count', 50);

    expect(simulateUseSignal(standalone)).toBe(200);
    expect(simulateUseStoreKey(store, 'count')).toBe(50);
  });
});
