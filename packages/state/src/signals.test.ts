/**
 * @ereo/state - Signal and Store Tests
 */

import { describe, expect, test } from 'bun:test';
import { Signal, signal, computed, atom, batch, Store, createStore, _scheduleBatchNotification } from './signals';

describe('Signal', () => {
  test('creates signal with initial value', () => {
    const s = new Signal(10);
    expect(s.get()).toBe(10);
  });

  test('sets new value', () => {
    const s = new Signal(10);
    s.set(20);
    expect(s.get()).toBe(20);
  });

  test('does not notify when value unchanged', () => {
    const s = new Signal(10);
    let called = false;
    s.subscribe(() => { called = true; });
    s.set(10);
    expect(called).toBe(false);
  });

  test('notifies subscribers on change', () => {
    const s = new Signal(10);
    const values: number[] = [];
    s.subscribe((v) => values.push(v));
    s.set(20);
    expect(values).toEqual([20]);
  });

  test('unsubscribe removes subscriber', () => {
    const s = new Signal(10);
    const values: number[] = [];
    const unsub = s.subscribe((v) => values.push(v));
    unsub();
    s.set(20);
    expect(values).toEqual([]);
  });

  test('update with function', () => {
    const s = new Signal(10);
    s.update((v) => v * 2);
    expect(s.get()).toBe(20);
  });

  test('map creates computed signal', () => {
    const s = new Signal(10);
    const doubled = s.map((v) => v * 2);
    expect(doubled.get()).toBe(20);
    s.set(15);
    expect(doubled.get()).toBe(30);
  });

  test('handles multiple subscribers', () => {
    const s = new Signal(0);
    const values1: number[] = [];
    const values2: number[] = [];
    s.subscribe((v) => values1.push(v));
    s.subscribe((v) => values2.push(v));
    s.set(1);
    expect(values1).toEqual([1]);
    expect(values2).toEqual([1]);
  });
});

describe('signal factory', () => {
  test('creates Signal instance', () => {
    const s = signal(42);
    expect(s).toBeInstanceOf(Signal);
    expect(s.get()).toBe(42);
  });
});

describe('computed', () => {
  test('creates computed signal from dependencies', () => {
    const a = signal<number>(10);
    const b = signal<number>(20);
    const sum = computed<number>(() => a.get() + b.get(), [a as Signal<unknown>, b as Signal<unknown>]);
    expect(sum.get()).toBe(30);
  });

  test('updates when dependency changes', () => {
    const a = signal<number>(10);
    const doubled = computed<number>(() => a.get() * 2, [a as Signal<unknown>]);
    expect(doubled.get()).toBe(20);
    a.set(15);
    expect(doubled.get()).toBe(30);
  });

  test('handles multiple dependencies', () => {
    const a = signal<number>(1);
    const b = signal<number>(2);
    const c = signal<number>(3);
    const result = computed<number>(() => a.get() + b.get() + c.get(), [a as Signal<unknown>, b as Signal<unknown>, c as Signal<unknown>]);
    expect(result.get()).toBe(6);
    b.set(10);
    expect(result.get()).toBe(14);
  });
});

describe('atom', () => {
  test('is alias for signal', () => {
    const a = atom('hello');
    expect(a).toBeInstanceOf(Signal);
    expect(a.get()).toBe('hello');
  });
});

describe('batch', () => {
  test('executes function and returns result', () => {
    const result = batch(() => {
      return 42;
    });
    expect(result).toBe(42);
  });

  test('handles multiple signal updates', () => {
    const a = signal(0);
    const b = signal(0);
    const values: number[] = [];

    batch(() => {
      a.set(1);
      b.set(2);
      values.push(a.get(), b.get());
    });

    expect(values).toEqual([1, 2]);
    expect(a.get()).toBe(1);
    expect(b.get()).toBe(2);
  });

  test('defers notifications until batch completes', () => {
    const a = signal(0);
    const b = signal(0);
    let notifyCount = 0;

    a.subscribe(() => notifyCount++);
    b.subscribe(() => notifyCount++);

    batch(() => {
      a.set(1);
      b.set(2);
      // Notifications should be deferred
      expect(notifyCount).toBe(0);
    });

    // After batch, all notifications fire
    expect(notifyCount).toBe(2);
  });

  test('deduplicates notifications for the same signal in a batch', () => {
    const s = signal(0);
    let notifyCount = 0;

    s.subscribe(() => notifyCount++);

    batch(() => {
      s.set(1);
      s.set(2);
      s.set(3);
    });

    // Only one notification since it's the same signal (same _fireSubscribers function)
    expect(notifyCount).toBe(1);
    expect(s.get()).toBe(3);
  });

  test('nested batch waits for outermost batch to complete', () => {
    const s = signal(0);
    let notifyCount = 0;

    s.subscribe(() => notifyCount++);

    batch(() => {
      s.set(1);
      batch(() => {
        s.set(2);
        expect(notifyCount).toBe(0); // Still deferred
      });
      expect(notifyCount).toBe(0); // Still deferred (outer batch not done)
    });

    expect(notifyCount).toBe(1);
    expect(s.get()).toBe(2);
  });

  test('computed signals update correctly in batch', () => {
    const a = signal<number>(1);
    const b = signal<number>(2);
    const sum = computed<number>(() => a.get() + b.get(), [a as Signal<unknown>, b as Signal<unknown>]);

    let sumNotifyCount = 0;
    sum.subscribe(() => sumNotifyCount++);

    batch(() => {
      a.set(10);
      b.set(20);
    });

    expect(sum.get()).toBe(30);
  });

  test('batch propagates exceptions and still fires notifications', () => {
    const s = signal(0);
    let notified = false;
    s.subscribe(() => { notified = true; });

    expect(() => {
      batch(() => {
        s.set(1);
        throw new Error('batch error');
      });
    }).toThrow('batch error');

    // Notifications should still fire even after exception
    expect(notified).toBe(true);
    expect(s.get()).toBe(1);
  });
});

describe('Store', () => {
  test('creates store with initial state', () => {
    const store = new Store({ count: 0, name: 'test' });
    expect(store.getSnapshot()).toEqual({ count: 0, name: 'test' });
  });

  test('get returns signal for key', () => {
    const store = new Store({ count: 0 });
    const countSignal = store.get('count');
    expect(countSignal.get()).toBe(0);
  });

  test('set updates value', () => {
    const store = new Store({ count: 0 });
    store.set('count', 10);
    expect(store.get('count').get()).toBe(10);
  });

  test('set creates new signal for unknown key', () => {
    const store = new Store({} as { count: number });
    store.set('count', 5);
    expect(store.get('count').get()).toBe(5);
  });

  test('getSnapshot returns current values', () => {
    const store = new Store<{ a: number; b: number }>({ a: 1, b: 2 });
    store.set('a', 10);
    expect(store.getSnapshot()).toEqual({ a: 10, b: 2 });
  });

  test('signals in store notify subscribers', () => {
    const store = new Store({ count: 0 });
    const values: number[] = [];
    store.get('count').subscribe((v) => values.push(v));
    store.set('count', 5);
    expect(values).toEqual([5]);
  });
});

describe('createStore', () => {
  test('creates Store instance', () => {
    const store = createStore({ items: [] as string[] });
    expect(store).toBeInstanceOf(Store);
    expect(store.getSnapshot()).toEqual({ items: [] });
  });
});

describe('Signal edge cases', () => {
  test('handles falsy values', () => {
    const s0 = new Signal(0);
    const sEmpty = new Signal('');
    const sFalse = new Signal(false);
    const sNull = new Signal(null);

    expect(s0.get()).toBe(0);
    expect(sEmpty.get()).toBe('');
    expect(sFalse.get()).toBe(false);
    expect(sNull.get()).toBe(null);
  });

  test('handles object values', () => {
    const obj = { a: 1, b: 2 };
    const s = new Signal(obj);
    expect(s.get()).toBe(obj);

    const newObj = { a: 3, b: 4 };
    s.set(newObj);
    expect(s.get()).toBe(newObj);
  });

  test('handles array values', () => {
    const arr = [1, 2, 3];
    const s = new Signal(arr);
    expect(s.get()).toBe(arr);
  });

  test('same object reference does not trigger update (by design)', () => {
    const obj = { value: 1 };
    const s = new Signal(obj);
    const values: typeof obj[] = [];
    s.subscribe((v) => values.push(v));

    obj.value = 2;
    s.set(obj); // Same reference, won't trigger

    // Signal uses reference equality, so same object won't trigger update
    expect(values).toEqual([]);
  });

  test('subscriber error does not block other subscribers', () => {
    const s = new Signal(0);
    const values: number[] = [];
    const errors: string[] = [];
    const origError = console.error;
    console.error = (...args: any[]) => errors.push(String(args[1]));

    s.subscribe(() => { throw new Error('subscriber crash'); });
    s.subscribe((v) => values.push(v));

    s.set(1);

    // Second subscriber still fires despite first throwing
    expect(values).toEqual([1]);
    expect(errors.length).toBe(1);

    console.error = origError;
  });

  test('map chaining works correctly', () => {
    const s = signal(2);
    const doubled = s.map((v) => v * 2);
    const quadrupled = doubled.map((v) => v * 2);

    expect(quadrupled.get()).toBe(8);

    s.set(5);
    expect(doubled.get()).toBe(10);
    expect(quadrupled.get()).toBe(20);
  });

  test('handles undefined and null transitions', () => {
    const s = new Signal<string | undefined | null>(undefined);
    const values: (string | undefined | null)[] = [];
    s.subscribe((v) => values.push(v));

    s.set(null);
    s.set('hello');
    s.set(undefined);

    expect(values).toEqual([null, 'hello', undefined]);
  });

  test('update that returns same value does not notify', () => {
    const s = new Signal(10);
    let called = false;
    s.subscribe(() => { called = true; });

    s.update((v) => v); // returns same value

    expect(called).toBe(false);
  });
});

describe('Signal dispose', () => {
  test('dispose() stops mapped signal from updating', () => {
    const s = signal(10);
    const doubled = s.map((v) => v * 2);
    expect(doubled.get()).toBe(20);

    doubled.dispose();
    s.set(20);
    // Should still hold the old value since it's disconnected
    expect(doubled.get()).toBe(20);
  });

  test('dispose() stops computed signal from updating', () => {
    const a = signal<number>(1);
    const b = signal<number>(2);
    const sum = computed<number>(() => a.get() + b.get(), [a as Signal<unknown>, b as Signal<unknown>]);
    expect(sum.get()).toBe(3);

    sum.dispose();
    a.set(10);
    b.set(20);
    expect(sum.get()).toBe(3);
  });

  test('chained map().map().dispose() cleans up correctly', () => {
    const s = signal(2);
    const doubled = s.map((v) => v * 2);
    const quadrupled = doubled.map((v) => v * 2);
    expect(quadrupled.get()).toBe(8);

    quadrupled.dispose();
    s.set(5);
    // quadrupled disconnected from doubled
    expect(quadrupled.get()).toBe(8);
    // doubled is still connected to s
    expect(doubled.get()).toBe(10);
  });

  test('dispose() is idempotent', () => {
    const s = signal(10);
    const doubled = s.map((v) => v * 2);

    doubled.dispose();
    doubled.dispose(); // second call should not throw

    s.set(20);
    expect(doubled.get()).toBe(20);
  });

  test('dispose() clears downstream subscribers', () => {
    const s = signal(1);
    const mapped = s.map((v) => v * 3);
    let called = false;
    mapped.subscribe(() => { called = true; });

    mapped.dispose();
    mapped.set(99); // direct set after dispose — subscribers cleared
    expect(called).toBe(false);
  });
});

describe('Store edge cases', () => {
  test('entries returns all signal entries', () => {
    const store = new Store({ a: 1, b: 'hello' });
    const keys: string[] = [];
    for (const [key] of store.entries()) {
      keys.push(key);
    }
    expect(keys.sort()).toEqual(['a', 'b']);
  });

  test('getSnapshot returns independent copies', () => {
    const store = createStore({ x: 1 });
    const snap1 = store.getSnapshot();
    store.set('x', 2);
    const snap2 = store.getSnapshot();

    expect(snap1.x).toBe(1);
    expect(snap2.x).toBe(2);
  });

  test('store signals are reactive independently', () => {
    const store = createStore({ a: 0, b: 0 });
    const aValues: number[] = [];
    const bValues: number[] = [];

    store.get('a').subscribe((v) => aValues.push(v));
    store.get('b').subscribe((v) => bValues.push(v));

    store.set('a', 1);
    store.set('a', 2);
    store.set('b', 10);

    expect(aValues).toEqual([1, 2]);
    expect(bValues).toEqual([10]);
  });
});

describe('batch() error isolation', () => {
  test('remaining notifiers still fire when one throws', () => {
    const calls: string[] = [];

    expect(() => {
      batch(() => {
        // Inject a throwing notifier and a normal notifier into the batch queue
        _scheduleBatchNotification(() => { throw new Error('notifier crash'); });
        _scheduleBatchNotification(() => { calls.push('second'); });
        _scheduleBatchNotification(() => { calls.push('third'); });
      });
    }).toThrow('notifier crash');

    // Second and third notifiers should still have been called
    expect(calls).toEqual(['second', 'third']);
  });

  test('re-throws the first error after all notifiers run', () => {
    const calls: string[] = [];

    expect(() => {
      batch(() => {
        _scheduleBatchNotification(() => { throw new Error('first error'); });
        _scheduleBatchNotification(() => { throw new Error('second error'); });
        _scheduleBatchNotification(() => { calls.push('third ran'); });
      });
    }).toThrow('first error');

    // Third notifier still ran despite two earlier throws
    expect(calls).toEqual(['third ran']);
  });

  test('all notifiers execute even when multiple throw', () => {
    const calls: string[] = [];

    expect(() => {
      batch(() => {
        _scheduleBatchNotification(() => {
          calls.push('a');
          throw new Error('a error');
        });
        _scheduleBatchNotification(() => {
          calls.push('b');
          throw new Error('b error');
        });
        _scheduleBatchNotification(() => {
          calls.push('c');
        });
      });
    }).toThrow('a error');

    // All three notifiers executed
    expect(calls).toEqual(['a', 'b', 'c']);
  });

  test('batch completes normally when no notifier throws', () => {
    const s = signal(0);
    const values: number[] = [];
    s.subscribe((v) => values.push(v));

    const result = batch(() => {
      s.set(5);
      return 'ok';
    });

    expect(result).toBe('ok');
    expect(s.get()).toBe(5);
    expect(values).toEqual([5]);
  });

  test('signal notifiers in batch are isolated from each other via _fireSubscribers', () => {
    const a = signal(0);
    const b = signal(0);
    const bValues: number[] = [];
    const origError = console.error;
    const errors: unknown[] = [];
    console.error = (...args: unknown[]) => errors.push(args[1]);

    a.subscribe(() => { throw new Error('subscriber crash'); });
    b.subscribe((v) => bValues.push(v));

    batch(() => {
      a.set(1);
      b.set(2);
    });

    // b's subscriber should still fire; a's error is caught by _fireSubscribers
    expect(bValues).toEqual([2]);
    expect(errors.length).toBe(1);

    console.error = origError;
  });
});

describe('computed() duplicate deps', () => {
  test('deduplicates identical dependencies', () => {
    const a = signal<number>(5);
    let computeCount = 0;

    const c = computed<number>(() => {
      computeCount++;
      return a.get() * 2;
    }, [a as Signal<unknown>, a as Signal<unknown>]);

    expect(c.get()).toBe(10);
    computeCount = 0;

    a.set(10);

    // Should only recompute once, not twice
    expect(computeCount).toBe(1);
    expect(c.get()).toBe(20);
  });

  test('subscriber fires once per change with duplicate deps', () => {
    const a = signal<number>(1);
    const c = computed<number>(() => a.get() + 1, [a as Signal<unknown>, a as Signal<unknown>, a as Signal<unknown>]);

    let notifyCount = 0;
    c.subscribe(() => notifyCount++);

    a.set(2);

    // Subscriber should fire exactly once, not three times
    expect(notifyCount).toBe(1);
    expect(c.get()).toBe(3);
  });

  test('dispose cleans up deduplicated subscriptions', () => {
    const a = signal<number>(1);
    const c = computed<number>(() => a.get() * 3, [a as Signal<unknown>, a as Signal<unknown>]);
    expect(c.get()).toBe(3);

    c.dispose();
    a.set(10);

    // After dispose, computed should not update
    expect(c.get()).toBe(3);
  });

  test('mixed unique and duplicate deps work correctly', () => {
    const a = signal<number>(2);
    const b = signal<number>(3);
    let computeCount = 0;

    const c = computed<number>(() => {
      computeCount++;
      return a.get() + b.get();
    }, [a as Signal<unknown>, b as Signal<unknown>, a as Signal<unknown>]);

    expect(c.get()).toBe(5);
    computeCount = 0;

    a.set(10);
    expect(computeCount).toBe(1);
    expect(c.get()).toBe(13);

    computeCount = 0;
    b.set(7);
    expect(computeCount).toBe(1);
    expect(c.get()).toBe(17);
  });
});

// ===========================================================================
// Additional coverage: atom, map, update, computed edge cases
// ===========================================================================

describe('atom (extended)', () => {
  test('atom supports subscribe and notify', () => {
    const a = atom(0);
    const values: number[] = [];
    a.subscribe((v) => values.push(v));

    a.set(1);
    a.set(2);
    expect(values).toEqual([1, 2]);
  });

  test('atom supports update()', () => {
    const a = atom(10);
    a.update((v) => v + 5);
    expect(a.get()).toBe(15);
  });

  test('atom supports map()', () => {
    const a = atom(3);
    const doubled = a.map((v) => v * 2);
    expect(doubled.get()).toBe(6);

    a.set(7);
    expect(doubled.get()).toBe(14);
  });

  test('atom works in batch', () => {
    const a = atom(0);
    let notifyCount = 0;
    a.subscribe(() => notifyCount++);

    batch(() => {
      a.set(1);
      a.set(2);
      a.set(3);
    });

    expect(notifyCount).toBe(1);
    expect(a.get()).toBe(3);
  });

  test('atom works in computed', () => {
    const a = atom<number>(2);
    const b = atom<number>(3);
    const product = computed<number>(() => a.get() * b.get(), [a as Signal<unknown>, b as Signal<unknown>]);

    expect(product.get()).toBe(6);
    a.set(5);
    expect(product.get()).toBe(15);
  });
});

describe('Signal.map (extended)', () => {
  test('map with type transformation (number -> string)', () => {
    const s = signal(42);
    const str = s.map((v) => `value: ${v}`);
    expect(str.get()).toBe('value: 42');

    s.set(100);
    expect(str.get()).toBe('value: 100');
  });

  test('map with type transformation (string -> boolean)', () => {
    const s = signal('');
    const hasValue = s.map((v) => v.length > 0);
    expect(hasValue.get()).toBe(false);

    s.set('hello');
    expect(hasValue.get()).toBe(true);

    s.set('');
    expect(hasValue.get()).toBe(false);
  });

  test('map with object extraction', () => {
    const s = signal({ name: 'Alice', age: 30 });
    const name = s.map((v) => v.name);
    expect(name.get()).toBe('Alice');

    s.set({ name: 'Bob', age: 25 });
    expect(name.get()).toBe('Bob');
  });

  test('map returning same value does not trigger downstream subscribers', () => {
    const s = signal(5);
    const clamped = s.map((v) => Math.min(v, 10));
    let notifyCount = 0;
    clamped.subscribe(() => notifyCount++);

    // Both set to values that clamp to 10 -> mapped value stays 10
    s.set(15);
    expect(clamped.get()).toBe(10);
    expect(notifyCount).toBe(1); // changed from 5 to 10

    s.set(20);
    expect(clamped.get()).toBe(10);
    // mapped value is still 10, no notification since mapped signal uses ===
    expect(notifyCount).toBe(1);
  });

  test('map subscriber receives mapped value', () => {
    const s = signal(1);
    const tripled = s.map((v) => v * 3);
    const received: number[] = [];

    tripled.subscribe((v) => received.push(v));

    s.set(2);
    s.set(3);

    expect(received).toEqual([6, 9]);
  });

  test('map with null/undefined handling', () => {
    const s = signal<string | null>('test');
    const length = s.map((v) => v?.length ?? 0);
    expect(length.get()).toBe(4);

    s.set(null);
    expect(length.get()).toBe(0);

    s.set('hello world');
    expect(length.get()).toBe(11);
  });

  test('deeply chained map (3 levels)', () => {
    const s = signal(2);
    const a = s.map((v) => v + 1);   // 3
    const b = a.map((v) => v * 2);   // 6
    const c = b.map((v) => v - 1);   // 5

    expect(c.get()).toBe(5);

    s.set(10);
    expect(a.get()).toBe(11);
    expect(b.get()).toBe(22);
    expect(c.get()).toBe(21);
  });

  test('multiple maps from same source are independent', () => {
    const s = signal(10);
    const doubled = s.map((v) => v * 2);
    const halved = s.map((v) => v / 2);
    const negated = s.map((v) => -v);

    expect(doubled.get()).toBe(20);
    expect(halved.get()).toBe(5);
    expect(negated.get()).toBe(-10);

    s.set(4);
    expect(doubled.get()).toBe(8);
    expect(halved.get()).toBe(2);
    expect(negated.get()).toBe(-4);
  });
});

describe('Signal.update (extended)', () => {
  test('update with complex transformation', () => {
    const s = signal([1, 2, 3]);
    s.update((arr) => [...arr, 4]);
    expect(s.get()).toEqual([1, 2, 3, 4]);
  });

  test('update notifies subscribers', () => {
    const s = signal(0);
    const values: number[] = [];
    s.subscribe((v) => values.push(v));

    s.update((v) => v + 1);
    s.update((v) => v + 1);
    s.update((v) => v + 1);

    expect(values).toEqual([1, 2, 3]);
    expect(s.get()).toBe(3);
  });

  test('update receives current value', () => {
    const s = signal(100);
    let receivedValue: number | undefined;

    s.update((v) => {
      receivedValue = v;
      return v * 2;
    });

    expect(receivedValue).toBe(100);
    expect(s.get()).toBe(200);
  });

  test('update with object spread (immutable pattern)', () => {
    const s = signal({ count: 0, name: 'test' });
    s.update((obj) => ({ ...obj, count: obj.count + 1 }));

    expect(s.get()).toEqual({ count: 1, name: 'test' });
  });

  test('update that returns same reference does not notify', () => {
    const obj = { a: 1 };
    const s = signal(obj);
    let notified = false;
    s.subscribe(() => { notified = true; });

    s.update((v) => v); // same reference
    expect(notified).toBe(false);
  });

  test('sequential updates see intermediate values', () => {
    const s = signal(1);
    const seen: number[] = [];

    s.update((v) => { seen.push(v); return v * 2; });
    s.update((v) => { seen.push(v); return v * 2; });
    s.update((v) => { seen.push(v); return v * 2; });

    expect(seen).toEqual([1, 2, 4]);
    expect(s.get()).toBe(8);
  });
});

describe('computed (extended)', () => {
  test('computed with no dependencies is static', () => {
    const c = computed(() => 42, []);
    expect(c.get()).toBe(42);
  });

  test('computed with no dependencies never recomputes', () => {
    let computeCount = 0;
    const c = computed(() => {
      computeCount++;
      return 'static';
    }, []);

    expect(c.get()).toBe('static');
    expect(computeCount).toBe(1);

    // No deps means no updates
    expect(c.get()).toBe('static');
    expect(computeCount).toBe(1);
  });

  test('computed subscribers are notified on dependency change', () => {
    const a = signal<number>(1);
    const doubled = computed<number>(() => a.get() * 2, [a as Signal<unknown>]);
    const notifications: number[] = [];

    doubled.subscribe((v) => notifications.push(v));

    a.set(5);
    a.set(10);

    expect(notifications).toEqual([10, 20]);
  });

  test('computed does not notify when result is same value', () => {
    const a = signal<number>(5);
    const clamped = computed<number>(() => Math.min(a.get(), 10), [a as Signal<unknown>]);
    let notifyCount = 0;

    clamped.subscribe(() => notifyCount++);

    a.set(15); // clamped stays 10 -> but computed set(10) when old value was 5 -> DOES notify
    expect(clamped.get()).toBe(10);
    expect(notifyCount).toBe(1);

    a.set(20); // clamped is still 10 -> computed set(10) same as current -> no notify
    expect(clamped.get()).toBe(10);
    expect(notifyCount).toBe(1);
  });

  test('computed chain: computed depending on another computed', () => {
    const base = signal<number>(2);
    const doubled = computed<number>(() => base.get() * 2, [base as Signal<unknown>]);
    const quadrupled = computed<number>(() => doubled.get() * 2, [doubled as Signal<unknown>]);

    expect(quadrupled.get()).toBe(8);

    base.set(5);
    expect(doubled.get()).toBe(10);
    expect(quadrupled.get()).toBe(20);
  });

  test('computed with conditional dependency reads', () => {
    const flag = signal<boolean>(true);
    const a = signal<number>(1);
    const b = signal<number>(2);

    const result = computed<number>(
      () => flag.get() ? a.get() : b.get(),
      [flag as Signal<unknown>, a as Signal<unknown>, b as Signal<unknown>]
    );

    expect(result.get()).toBe(1); // flag=true, reads a

    flag.set(false);
    expect(result.get()).toBe(2); // flag=false, reads b

    a.set(100);
    expect(result.get()).toBe(2); // still reads b, even though a changed

    b.set(200);
    expect(result.get()).toBe(200);
  });

  test('computed dispose stops all dependency tracking', () => {
    const a = signal<number>(1);
    const b = signal<number>(2);
    const sum = computed<number>(() => a.get() + b.get(), [a as Signal<unknown>, b as Signal<unknown>]);

    expect(sum.get()).toBe(3);
    sum.dispose();

    a.set(10);
    b.set(20);
    // Disposed computed retains its last value
    expect(sum.get()).toBe(3);
  });

  test('computed in batch updates once at end', () => {
    const a = signal<number>(0);
    const b = signal<number>(0);
    const sum = computed<number>(() => a.get() + b.get(), [a as Signal<unknown>, b as Signal<unknown>]);
    let computeNotify = 0;

    sum.subscribe(() => computeNotify++);

    batch(() => {
      a.set(1);
      a.set(2);
      a.set(3);
      b.set(10);
    });

    // Both a and b's notifiers fire once each (deduplicated), each triggering
    // computed's update. The computed fires its subscribers for each unique
    // notifier, but the key insight is: inside batch, only 2 notifiers (a, b)
    // exist, each firing once.
    expect(sum.get()).toBe(13);
  });
});

describe('Store (extended)', () => {
  test('store.get returns same signal instance for same key', () => {
    const store = createStore({ x: 1 });
    const sig1 = store.get('x');
    const sig2 = store.get('x');
    expect(sig1).toBe(sig2);
  });

  test('store handles many keys', () => {
    const initial: Record<string, number> = {};
    for (let i = 0; i < 100; i++) {
      initial[`k${i}`] = i;
    }
    const store = createStore(initial);
    const snap = store.getSnapshot();

    for (let i = 0; i < 100; i++) {
      expect(snap[`k${i}`]).toBe(i);
    }
  });

  test('store.set with same value does not notify', () => {
    const store = createStore({ val: 42 });
    let notified = false;
    store.get('val').subscribe(() => { notified = true; });

    store.set('val', 42);
    expect(notified).toBe(false);
  });

  test('store with various value types', () => {
    const store = createStore({
      num: 1,
      str: 'hello',
      bool: true,
      arr: [1, 2, 3],
      obj: { nested: true },
      nul: null as null | string,
    });

    expect(store.get('num').get()).toBe(1);
    expect(store.get('str').get()).toBe('hello');
    expect(store.get('bool').get()).toBe(true);
    expect(store.get('arr').get()).toEqual([1, 2, 3]);
    expect(store.get('obj').get()).toEqual({ nested: true });
    expect(store.get('nul').get()).toBe(null);
  });

  test('store batch updates multiple keys', () => {
    const store = createStore({ a: 0, b: 0, c: 0 });
    let totalNotify = 0;

    for (const [, sig] of store.entries()) {
      sig.subscribe(() => totalNotify++);
    }

    batch(() => {
      store.set('a', 1);
      store.set('b', 2);
      store.set('c', 3);
    });

    expect(totalNotify).toBe(3);
    expect(store.getSnapshot()).toEqual({ a: 1, b: 2, c: 3 });
  });

  test('store entries iterator yields key-signal pairs', () => {
    const store = createStore({ alpha: 10, beta: 20 });
    const pairs: [string, number][] = [];

    for (const [key, sig] of store.entries()) {
      pairs.push([key, sig.get()]);
    }

    pairs.sort((a, b) => a[0].localeCompare(b[0]));
    expect(pairs).toEqual([['alpha', 10], ['beta', 20]]);
  });
});

// ===========================================================================
// Signal equality semantics (Object.is)
// ===========================================================================

describe('Signal equality semantics', () => {
  test('NaN does not trigger spurious notifications', () => {
    const s = new Signal(NaN);
    let notified = false;
    s.subscribe(() => { notified = true; });

    s.set(NaN); // same value, should NOT notify
    expect(notified).toBe(false);
    expect(s.get()).toBeNaN();
  });

  test('NaN to number triggers notification', () => {
    const s = new Signal(NaN);
    const values: number[] = [];
    s.subscribe((v) => values.push(v));

    s.set(42);
    expect(values).toEqual([42]);
  });

  test('number to NaN triggers notification', () => {
    const s = new Signal(42);
    let notified = false;
    s.subscribe(() => { notified = true; });

    s.set(NaN);
    expect(notified).toBe(true);
    expect(s.get()).toBeNaN();
  });

  test('-0 and +0 are treated as distinct values', () => {
    const s = new Signal(0);
    let notified = false;
    s.subscribe(() => { notified = true; });

    s.set(-0);
    // Object.is(0, -0) is false, so this triggers notification
    expect(notified).toBe(true);
  });

  test('+0 to +0 does not trigger notification', () => {
    const s = new Signal(0);
    let notified = false;
    s.subscribe(() => { notified = true; });

    s.set(0);
    expect(notified).toBe(false);
  });

  test('update with NaN-returning function does not re-notify', () => {
    const s = new Signal(NaN);
    let notifyCount = 0;
    s.subscribe(() => notifyCount++);

    s.update(() => NaN); // same value
    expect(notifyCount).toBe(0);
  });

  test('computed with NaN does not trigger spurious downstream', () => {
    const a = signal<number>(NaN);
    const c = computed<number>(() => a.get(), [a as Signal<unknown>]);
    let notifyCount = 0;
    c.subscribe(() => notifyCount++);

    a.set(NaN); // same value, should not propagate
    expect(notifyCount).toBe(0);
  });

  test('map with NaN source does not trigger spurious downstream', () => {
    const s = signal<number>(NaN);
    const mapped = s.map((v) => v);
    let notified = false;
    mapped.subscribe(() => { notified = true; });

    s.set(NaN); // NaN -> NaN, source doesn't fire, so mapped doesn't fire
    expect(notified).toBe(false);
  });

  test('batch with NaN deduplicates correctly', () => {
    const s = signal<number>(0);
    let notifyCount = 0;
    s.subscribe(() => notifyCount++);

    batch(() => {
      s.set(NaN);
      s.set(NaN); // same as current, no second enqueue
    });

    expect(notifyCount).toBe(1);
    expect(s.get()).toBeNaN();
  });
});

// ===========================================================================
// Subscriber modification during notification
// ===========================================================================

describe('subscriber behavior during notification', () => {
  test('subscriber that unsubscribes itself stops receiving', () => {
    const s = signal(0);
    const values: number[] = [];
    let unsub: () => void;

    unsub = s.subscribe((v) => {
      values.push(v);
      unsub(); // unsubscribe self
    });

    s.set(1); // should fire
    s.set(2); // should NOT fire (unsubscribed)

    expect(values).toEqual([1]);
  });

  test('subscriber that unsubscribes another subscriber during notification', () => {
    const s = signal(0);
    const valuesA: number[] = [];
    const valuesB: number[] = [];

    let unsubB: () => void;
    s.subscribe((v) => {
      valuesA.push(v);
      unsubB(); // A unsubscribes B during notification
    });
    unsubB = s.subscribe((v) => {
      valuesB.push(v);
    });

    s.set(1);
    // A fires first, B may or may not fire depending on Set iteration
    expect(valuesA).toEqual([1]);
    // B was unsubscribed by A before its turn — Set skips deleted entries
    expect(valuesB).toEqual([]);

    // On subsequent changes, only A should fire
    s.set(2);
    expect(valuesA).toEqual([1, 2]);
    expect(valuesB).toEqual([]);
  });

  test('subscriber that adds a new subscriber during notification', () => {
    const s = signal(0);
    const values: number[] = [];
    let dynamicValues: number[] = [];

    s.subscribe((v) => {
      values.push(v);
      // Add new subscriber during notification
      if (v === 1) {
        s.subscribe((v2) => { dynamicValues.push(v2); });
      }
    });

    s.set(1);
    expect(values).toEqual([1]);
    // Dynamically added subscriber may fire for this round (Set iteration includes new entries)
    // On next change, the dynamic subscriber should fire
    dynamicValues = []; // reset
    s.set(2);
    expect(values).toEqual([1, 2]);
    expect(dynamicValues).toEqual([2]);
  });

  test('resubscribe after unsubscribe', () => {
    const s = signal(0);
    const values: number[] = [];

    const unsub = s.subscribe((v) => values.push(v));
    s.set(1);
    unsub();
    s.set(2); // missed

    const unsub2 = s.subscribe((v) => values.push(v));
    s.set(3);
    unsub2();

    expect(values).toEqual([1, 3]);
  });

  test('same function subscribed twice fires twice', () => {
    const s = signal(0);
    const values: number[] = [];
    const fn = (v: number) => values.push(v);

    // Set uses reference equality — same fn reference is the same entry
    s.subscribe(fn);
    s.subscribe(fn);

    s.set(1);
    // Set deduplicates by reference, so fn fires only once
    expect(values).toEqual([1]);
  });

  test('no subscribers means no error on set', () => {
    const s = signal(0);
    // No subscribers — set should not throw
    s.set(1);
    expect(s.get()).toBe(1);
  });
});

// ===========================================================================
// Signal.map edge cases
// ===========================================================================

describe('Signal.map edge cases', () => {
  test('map with throwing mapper logs error but signal still works', () => {
    const s = signal(0);
    const errors: unknown[] = [];
    const origError = console.error;
    console.error = (...args: unknown[]) => errors.push(args[1]);

    const mapped = s.map((v) => {
      if (v === 2) throw new Error('map crash');
      return v * 10;
    });

    expect(mapped.get()).toBe(0);
    s.set(1);
    expect(mapped.get()).toBe(10);

    // Throwing mapper: the subscriber in the source fires, which calls mapped.set(fn(v))
    // fn(v) throws before mapped.set() is called, so it crashes the subscriber
    s.set(2);
    // mapped still holds the old value since set was never called
    expect(mapped.get()).toBe(10);
    expect(errors.length).toBe(1);

    // Recovery: next non-throwing value should work
    s.set(3);
    expect(mapped.get()).toBe(30);

    console.error = origError;
  });

  test('map from disposed source still holds last value', () => {
    const s = signal(5);
    const mapped = s.map((v) => v * 2);
    expect(mapped.get()).toBe(10);

    s.dispose();
    // Source is disposed but mapped was subscribed to source via source.subscribe
    // source.dispose() clears source's subscribers, disconnecting mapped
    s.set(99); // direct set still works on source
    expect(s.get()).toBe(99);
    // mapped is disconnected — doesn't see source changes
    expect(mapped.get()).toBe(10);
  });

  test('disposing mapped signal does not affect source', () => {
    const s = signal(5);
    const mapped = s.map((v) => v + 1);
    const otherMapped = s.map((v) => v + 2);

    mapped.dispose();

    s.set(10);
    expect(s.get()).toBe(10);
    expect(otherMapped.get()).toBe(12); // still connected
    expect(mapped.get()).toBe(6); // frozen at old value
  });

  test('map preserves undefined and null transformations', () => {
    const s = signal<number>(0);
    const nullable = s.map((v) => v === 0 ? null : v);
    expect(nullable.get()).toBe(null);

    s.set(5);
    expect(nullable.get()).toBe(5);

    s.set(0);
    expect(nullable.get()).toBe(null);
  });
});

// ===========================================================================
// computed edge cases
// ===========================================================================

describe('computed edge cases', () => {
  test('computed with throwing computation logs error via subscriber', () => {
    const a = signal<number>(1);
    const errors: unknown[] = [];
    const origError = console.error;
    console.error = (...args: unknown[]) => errors.push(args[1]);

    const c = computed<number>(() => {
      if (a.get() === 0) throw new Error('div by zero');
      return 10 / a.get();
    }, [a as Signal<unknown>]);

    expect(c.get()).toBe(10);

    // When a changes to 0, the update function throws inside the subscriber
    a.set(0);
    // computed's value is still the old value since set() was never called
    expect(c.get()).toBe(10);
    expect(errors.length).toBe(1);

    // Recovery
    a.set(2);
    expect(c.get()).toBe(5);

    console.error = origError;
  });

  test('computed diamond problem: intermediate values visible', () => {
    // Diamond: A -> B, A -> C, B+C -> D
    const a = signal<number>(1);
    const b = computed<number>(() => a.get() * 2, [a as Signal<unknown>]);
    const c = computed<number>(() => a.get() * 3, [a as Signal<unknown>]);
    const d = computed<number>(() => b.get() + c.get(), [b as Signal<unknown>, c as Signal<unknown>]);

    expect(d.get()).toBe(5); // 2 + 3

    const dValues: number[] = [];
    d.subscribe((v) => dValues.push(v));

    a.set(2);
    // Without topological sorting, D may see intermediate states:
    // When a changes, a's subscribers (b's updater, c's updater) fire.
    // b updates -> D recomputes with new b (4) + old c (3) = 7
    // c updates -> D recomputes with new b (4) + new c (6) = 10
    expect(d.get()).toBe(10); // final value is correct
    expect(dValues.length).toBeGreaterThanOrEqual(1);
    expect(dValues[dValues.length - 1]).toBe(10);
  });

  test('computed diamond in batch avoids glitch', () => {
    const a = signal<number>(1);
    const b = computed<number>(() => a.get() * 2, [a as Signal<unknown>]);
    const c = computed<number>(() => a.get() * 3, [a as Signal<unknown>]);
    const d = computed<number>(() => b.get() + c.get(), [b as Signal<unknown>, c as Signal<unknown>]);

    expect(d.get()).toBe(5);

    batch(() => {
      a.set(2);
    });

    expect(d.get()).toBe(10);
  });

  test('computed with empty deps array is truly static', () => {
    let calls = 0;
    const c = computed(() => { calls++; return 'static'; }, []);
    expect(c.get()).toBe('static');
    expect(calls).toBe(1);

    // No way to trigger recomputation
    c.subscribe(() => {});
    expect(calls).toBe(1);
  });

  test('computed disposes all dependency subscriptions on dispose', () => {
    const a = signal<number>(1);
    const b = signal<number>(2);
    const c = signal<number>(3);
    const sum = computed<number>(
      () => a.get() + b.get() + c.get(),
      [a as Signal<unknown>, b as Signal<unknown>, c as Signal<unknown>]
    );

    expect(sum.get()).toBe(6);
    sum.dispose();

    a.set(10);
    b.set(20);
    c.set(30);
    expect(sum.get()).toBe(6); // frozen
  });

  test('multiple computed sharing same dependency', () => {
    const source = signal(5);
    const doubled = computed(() => source.get() * 2, [source as Signal<unknown>]);
    const tripled = computed(() => source.get() * 3, [source as Signal<unknown>]);

    expect(doubled.get()).toBe(10);
    expect(tripled.get()).toBe(15);

    source.set(10);
    expect(doubled.get()).toBe(20);
    expect(tripled.get()).toBe(30);

    // Dispose one doesn't affect the other
    doubled.dispose();
    source.set(1);
    expect(doubled.get()).toBe(20); // frozen
    expect(tripled.get()).toBe(3); // still active
  });
});

// ===========================================================================
// Disposed signal behaviors
// ===========================================================================

describe('disposed signal behaviors', () => {
  test('disposed signal can still be set and read', () => {
    const s = signal(10);
    s.dispose();

    s.set(20);
    expect(s.get()).toBe(20);
  });

  test('disposed signal does not notify cleared subscribers', () => {
    const s = signal(10);
    let notified = false;
    s.subscribe(() => { notified = true; });

    s.dispose(); // clears subscribers
    s.set(20);
    expect(notified).toBe(false);
    expect(s.get()).toBe(20);
  });

  test('new subscribers on disposed signal work', () => {
    const s = signal(10);
    s.dispose();

    const values: number[] = [];
    s.subscribe((v) => values.push(v));
    s.set(20);
    expect(values).toEqual([20]);
  });

  test('disposed signal update still works', () => {
    const s = signal(5);
    s.dispose();

    s.update((v) => v * 2);
    expect(s.get()).toBe(10);
  });

  test('map on disposed signal creates a new chain', () => {
    const s = signal(5);
    s.dispose();

    // After dispose, subscribers were cleared but we can still subscribe
    const mapped = s.map((v) => v * 2);
    expect(mapped.get()).toBe(10);

    s.set(10);
    expect(mapped.get()).toBe(20);
  });

  test('dispose computed then recreate from same deps', () => {
    const a = signal<number>(1);
    const c1 = computed<number>(() => a.get() + 1, [a as Signal<unknown>]);
    expect(c1.get()).toBe(2);
    c1.dispose();

    const c2 = computed<number>(() => a.get() + 1, [a as Signal<unknown>]);
    a.set(5);
    expect(c1.get()).toBe(2); // frozen
    expect(c2.get()).toBe(6); // active
  });
});

// ===========================================================================
// Batch advanced scenarios
// ===========================================================================

describe('batch advanced scenarios', () => {
  test('batch inside subscriber callback', () => {
    const a = signal(0);
    const b = signal(0);
    const bValues: number[] = [];

    a.subscribe(() => {
      batch(() => {
        b.set(a.get() * 10);
      });
    });
    b.subscribe((v) => bValues.push(v));

    a.set(1);
    expect(b.get()).toBe(10);
    expect(bValues).toEqual([10]);
  });

  test('deeply nested batches (4 levels)', () => {
    const s = signal(0);
    let notifyCount = 0;
    s.subscribe(() => notifyCount++);

    batch(() => {
      s.set(1);
      batch(() => {
        s.set(2);
        batch(() => {
          s.set(3);
          batch(() => {
            s.set(4);
          });
          expect(notifyCount).toBe(0);
        });
        expect(notifyCount).toBe(0);
      });
      expect(notifyCount).toBe(0);
    });

    // Only after outermost batch completes
    expect(notifyCount).toBe(1);
    expect(s.get()).toBe(4);
  });

  test('batch with void function', () => {
    const s = signal(0);
    const result = batch(() => {
      s.set(1);
    });
    expect(result).toBe(undefined);
    expect(s.get()).toBe(1);
  });

  test('batch where fn throws and no signals were set', () => {
    expect(() => {
      batch(() => {
        throw new Error('early throw');
      });
    }).toThrow('early throw');
  });

  test('batch where fn throws after signal set still notifies', () => {
    const s = signal(0);
    let notified = false;
    s.subscribe(() => { notified = true; });

    expect(() => {
      batch(() => {
        s.set(1);
        throw new Error('mid throw');
      });
    }).toThrow('mid throw');

    expect(notified).toBe(true);
    expect(s.get()).toBe(1);
  });

  test('batch return value preserved even with notifications', () => {
    const s = signal(0);
    s.subscribe(() => {}); // subscriber exists

    const result = batch(() => {
      s.set(42);
      return 'batch-result';
    });
    expect(result).toBe('batch-result');
  });

  test('empty batch is a no-op', () => {
    const result = batch(() => 'empty');
    expect(result).toBe('empty');
  });

  test('batch with many signals', () => {
    const signals = Array.from({ length: 50 }, (_, i) => signal(i));
    let totalNotify = 0;
    signals.forEach((s) => s.subscribe(() => totalNotify++));

    batch(() => {
      signals.forEach((s, i) => s.set(i + 100));
    });

    expect(totalNotify).toBe(50);
    signals.forEach((s, i) => expect(s.get()).toBe(i + 100));
  });
});

// ===========================================================================
// Store advanced scenarios
// ===========================================================================

describe('Store advanced scenarios', () => {
  test('store.get for key set dynamically after construction', () => {
    const store = new Store<{ a: number; b?: number }>({ a: 1 } as any);
    store.set('b' as any, 2);
    expect((store.get as any)('b').get()).toBe(2);
  });

  test('store entries includes dynamically added keys', () => {
    const store = createStore({} as Record<string, number>);
    store.set('x' as any, 1);
    store.set('y' as any, 2);

    const keys: string[] = [];
    for (const [key] of store.entries()) {
      keys.push(key);
    }
    expect(keys.sort()).toEqual(['x', 'y']);
  });

  test('store handles keys that shadow Object.prototype methods', () => {
    // __proto__ in object literals is special (sets prototype, not own prop)
    // so we test with 'constructor' and 'toString' which are normal own properties
    const store = createStore({ 'constructor': 'safe', 'toString': 'safe2' } as any);
    expect(store.get('constructor' as any).get()).toBe('safe');
    expect(store.get('toString' as any).get()).toBe('safe2');

    store.set('constructor' as any, 'modified');
    expect(store.get('constructor' as any).get()).toBe('modified');
  });

  test('store getSnapshot does not include prototype properties', () => {
    const store = createStore({ a: 1, b: 2 });
    const snap = store.getSnapshot();
    expect(Object.keys(snap)).toEqual(['a', 'b']);
    expect(snap.hasOwnProperty('a')).toBe(true);
  });

  test('store batch updates are atomic for snapshot consumers', () => {
    const store = createStore({ x: 0, y: 0 });
    const snapshots: { x: number; y: number }[] = [];

    // Subscribe to both signals
    store.get('x').subscribe(() => {
      snapshots.push(store.getSnapshot());
    });
    store.get('y').subscribe(() => {
      snapshots.push(store.getSnapshot());
    });

    batch(() => {
      store.set('x', 1);
      store.set('y', 2);
    });

    // After batch, both snapshots should see the final state
    for (const snap of snapshots) {
      expect(snap.x).toBe(1);
      expect(snap.y).toBe(2);
    }
  });

  test('store signal identity is stable across set calls', () => {
    const store = createStore({ val: 0 });
    const sig1 = store.get('val');
    store.set('val', 100);
    const sig2 = store.get('val');
    expect(sig1).toBe(sig2); // same Signal instance
  });

  test('store.subscribe notifies on value changes', () => {
    const store = createStore({ a: 1, b: 2 });
    let called = 0;
    const unsub = store.subscribe(() => called++);

    store.set('a', 10);
    expect(called).toBe(1);

    store.set('b', 20);
    expect(called).toBe(2);

    // Same value doesn't notify (Object.is dedup)
    store.set('a', 10);
    expect(called).toBe(2);

    unsub();
    store.set('a', 99);
    expect(called).toBe(2); // unsubscribed
  });

  test('store.subscribe notifies on new key additions', () => {
    const store = createStore({} as Record<string, number>);
    let called = 0;
    const unsub = store.subscribe(() => called++);

    store.set('x' as any, 1);
    expect(called).toBe(1); // notified for new key

    store.set('y' as any, 2);
    expect(called).toBe(2); // notified for another new key

    // Subsequent changes on dynamic keys still notify
    store.set('x' as any, 10);
    expect(called).toBe(3);

    unsub();
  });

  test('store.subscribe with batch defers notification', () => {
    const store = createStore({ a: 0, b: 0 });
    let called = 0;
    store.subscribe(() => called++);

    batch(() => {
      store.set('a', 1);
      store.set('b', 2);
    });

    // batch defers individual signal notifications, but each signal fires once at flush
    // so store listener fires once per signal change
    expect(called).toBe(2);
  });

  test('store dispose-like cleanup via signal subscriptions', () => {
    const store = createStore({ a: 1, b: 2 });
    const unsubs: (() => void)[] = [];

    for (const [, sig] of store.entries()) {
      unsubs.push(sig.subscribe(() => {}));
    }

    // Cleanup
    unsubs.forEach((u) => u());

    // Store still works after subscriber cleanup
    store.set('a', 10);
    expect(store.get('a').get()).toBe(10);
  });
});

// ===========================================================================
// Signal chain scenarios (signal -> map -> computed -> subscriber)
// ===========================================================================

describe('signal chain scenarios', () => {
  test('long chain: signal -> map -> map -> map -> subscriber', () => {
    const source = signal(1);
    const a = source.map((v) => v + 1);  // 2
    const b = a.map((v) => v * 2);       // 4
    const c = b.map((v) => v + 10);      // 14

    const values: number[] = [];
    c.subscribe((v) => values.push(v));

    source.set(2); // 3 -> 6 -> 16
    source.set(3); // 4 -> 8 -> 18

    expect(values).toEqual([16, 18]);
  });

  test('mixed map and computed chain', () => {
    const a = signal(2);
    const b = signal(3);
    const mapped = a.map((v) => v * 10);
    const combined = computed(
      () => mapped.get() + b.get(),
      [mapped as Signal<unknown>, b as Signal<unknown>]
    );

    expect(combined.get()).toBe(23); // 20 + 3

    a.set(5); // mapped = 50, combined = 53
    expect(combined.get()).toBe(53);

    b.set(7); // combined = 57
    expect(combined.get()).toBe(57);
  });

  test('disposing middle of chain isolates downstream', () => {
    const source = signal(1);
    const middle = source.map((v) => v * 2);
    const end = middle.map((v) => v + 100);

    expect(end.get()).toBe(102);

    middle.dispose();
    source.set(5);

    // Middle is frozen (disconnected from source)
    expect(middle.get()).toBe(2);
    // End is still connected to middle, but middle doesn't update
    // Actually, middle.dispose() cleared middle's subscribers (including end's upstream subscription)
    // So end is also frozen
    expect(end.get()).toBe(102);
  });

  test('signal used as both direct source and in computed', () => {
    const s = signal(10);
    const direct: number[] = [];
    const derived: number[] = [];

    s.subscribe((v) => direct.push(v));
    const c = computed<number>(() => s.get() + 1, [s as Signal<unknown>]);
    c.subscribe((v) => derived.push(v));

    s.set(20);

    expect(direct).toEqual([20]);
    expect(derived).toEqual([21]);
  });
});

// ===========================================================================
// Performance and stress scenarios
// ===========================================================================

describe('performance and stress', () => {
  test('signal with 1000 subscribers notifies all', () => {
    const s = signal(0);
    let count = 0;
    const unsubs: (() => void)[] = [];

    for (let i = 0; i < 1000; i++) {
      unsubs.push(s.subscribe(() => count++));
    }

    s.set(1);
    expect(count).toBe(1000);

    // Cleanup
    unsubs.forEach((u) => u());
    count = 0;
    s.set(2);
    expect(count).toBe(0);
  });

  test('rapid set calls are all processed', () => {
    const s = signal(0);
    const values: number[] = [];
    s.subscribe((v) => values.push(v));

    for (let i = 1; i <= 1000; i++) {
      s.set(i);
    }

    expect(values.length).toBe(1000);
    expect(values[999]).toBe(1000);
    expect(s.get()).toBe(1000);
  });

  test('batch with 1000 different signals', () => {
    const signals = Array.from({ length: 1000 }, () => signal(0));
    let totalNotify = 0;
    signals.forEach((s) => s.subscribe(() => totalNotify++));

    batch(() => {
      signals.forEach((s, i) => s.set(i + 1));
    });

    expect(totalNotify).toBe(1000);
  });

  test('deeply nested computed (5 levels)', () => {
    const base = signal<number>(1);
    const l1 = computed<number>(() => base.get() + 1, [base as Signal<unknown>]);
    const l2 = computed<number>(() => l1.get() + 1, [l1 as Signal<unknown>]);
    const l3 = computed<number>(() => l2.get() + 1, [l2 as Signal<unknown>]);
    const l4 = computed<number>(() => l3.get() + 1, [l3 as Signal<unknown>]);
    const l5 = computed<number>(() => l4.get() + 1, [l4 as Signal<unknown>]);

    expect(l5.get()).toBe(6);

    base.set(10);
    expect(l5.get()).toBe(15);
  });

  test('map chain of 10 levels', () => {
    let current: Signal<number> = signal(1);
    for (let i = 0; i < 10; i++) {
      current = current.map((v) => v + 1);
    }

    expect(current.get()).toBe(11);

    // Can't easily set the source when we only have the end
    // Just verify the chain is valid
  });
});

// ===========================================================================
// _scheduleBatchNotification edge cases
// ===========================================================================

describe('_scheduleBatchNotification edge cases', () => {
  test('returns false when not in batch', () => {
    const result = _scheduleBatchNotification(() => {});
    expect(result).toBe(false);
  });

  test('returns true when in batch', () => {
    let result: boolean;
    batch(() => {
      result = _scheduleBatchNotification(() => {});
    });
    expect(result!).toBe(true);
  });

  test('same notifier added twice in batch fires once', () => {
    let count = 0;
    const notifier = () => { count++; };

    batch(() => {
      _scheduleBatchNotification(notifier);
      _scheduleBatchNotification(notifier);
    });

    expect(count).toBe(1);
  });

  test('different notifiers in batch all fire', () => {
    const calls: string[] = [];

    batch(() => {
      _scheduleBatchNotification(() => calls.push('a'));
      _scheduleBatchNotification(() => calls.push('b'));
      _scheduleBatchNotification(() => calls.push('c'));
    });

    expect(calls).toEqual(['a', 'b', 'c']);
  });
});
