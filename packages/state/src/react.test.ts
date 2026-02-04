/**
 * @ereo/state - React Integration Tests
 */

import { describe, expect, test } from 'bun:test';
import { signal, createStore } from './signals';

describe('React Integration (useSyncExternalStore)', () => {
  describe('Signal subscribe/get integration', () => {
    test('signal.subscribe returns unsubscribe function', () => {
      const s = signal(10);
      const values: number[] = [];

      const unsub = s.subscribe((v) => values.push(v));
      expect(typeof unsub).toBe('function');

      s.set(20);
      expect(values).toEqual([20]);

      unsub();
      s.set(30);
      expect(values).toEqual([20]);
    });

    test('signal.get returns current value', () => {
      const s = signal(42);
      expect(s.get()).toBe(42);

      s.set(100);
      expect(s.get()).toBe(100);
    });

    test('multiple signals work independently', () => {
      const s1 = signal(1);
      const s2 = signal(2);

      expect(s1.get()).toBe(1);
      expect(s2.get()).toBe(2);

      s1.set(10);
      expect(s1.get()).toBe(10);
      expect(s2.get()).toBe(2);
    });
  });

  describe('Store integration with signals', () => {
    test('store.get returns signal that works with subscribe/get', () => {
      const store = createStore({ count: 0, name: 'test' });
      const countSignal = store.get('count');

      expect(countSignal.get()).toBe(0);

      const values: number[] = [];
      const unsub = countSignal.subscribe((v) => values.push(v));

      store.set('count', 5);
      expect(values).toEqual([5]);
      expect(countSignal.get()).toBe(5);

      unsub();
    });

    test('store.getSnapshot returns current state', () => {
      const store = createStore({ a: 1, b: 2 });
      expect(store.getSnapshot()).toEqual({ a: 1, b: 2 });

      store.set('a', 10);
      expect(store.getSnapshot()).toEqual({ a: 10, b: 2 });
    });

    test('different store keys have independent signals', () => {
      const store = createStore({ x: 0, y: 0 });
      const xValues: number[] = [];
      const yValues: number[] = [];

      const unsubX = store.get('x').subscribe((v) => xValues.push(v));
      const unsubY = store.get('y').subscribe((v) => yValues.push(v));

      store.set('x', 5);
      expect(xValues).toEqual([5]);
      expect(yValues).toEqual([]);

      store.set('y', 10);
      expect(xValues).toEqual([5]);
      expect(yValues).toEqual([10]);

      unsubX();
      unsubY();
    });
  });

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

    test('getSnapshot is consistent with subscribe', () => {
      const s = signal('initial');
      let lastSubscribedValue = s.get();

      s.subscribe((v) => {
        lastSubscribedValue = v;
      });

      s.set('updated');
      expect(s.get()).toBe('updated');
      expect(lastSubscribedValue).toBe('updated');
    });

    test('handles rapid updates', () => {
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

      // Create many new subscribers to check for leaks
      for (let i = 0; i < 1000; i++) {
        const tempUnsub = s.subscribe(() => {});
        tempUnsub();
      }

      s.set(2);
      // Original subscriber should not be called after unsubscribe
      expect(values).toEqual([1]);
    });
  });
});
