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
    
    const newObj = { a: 3 };
    s.set(newObj);
    expect(s.get()).toBe(newObj);
  });

  test('handles array values', () => {
    const arr = [1, 2, 3];
    const s = new Signal(arr);
    expect(s.get()).toBe(arr);
  });

  test('same object reference triggers update', () => {
    const obj = { value: 1 };
    const s = new Signal(obj);
    const values: typeof obj[] = [];
    s.subscribe((v) => values.push(v));
    
    obj.value = 2;
    s.set(obj);
    
    expect(values).toEqual([obj]);
  });
});
