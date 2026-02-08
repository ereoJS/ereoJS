/**
 * @ereo/state - Signal and Store Tests
 */

import { describe, expect, test } from 'bun:test';
import { Signal, signal, computed, atom, batch, Store, createStore } from './signals';

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
