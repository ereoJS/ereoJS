import { describe, expect, test, beforeEach } from 'bun:test';
import { FormStore } from './store';

interface TestForm {
  name: string;
  email: string;
  age: number;
  address: {
    city: string;
    zip: string;
  };
}

const defaultValues: TestForm = {
  name: '',
  email: '',
  age: 0,
  address: {
    city: '',
    zip: '',
  },
};

describe('Watch (store-level API for useWatch)', () => {
  let store: FormStore<TestForm>;

  beforeEach(() => {
    store = new FormStore<TestForm>({ defaultValues });
  });

  describe('getSignal (single field watch)', () => {
    test('getSignal returns a signal that tracks field value', () => {
      const sig = store.getSignal('name');
      expect(sig.get()).toBe('');

      store.setValue('name', 'Alice');
      expect(sig.get()).toBe('Alice');
    });

    test('getSignal for nested path tracks nested value', () => {
      const sig = store.getSignal('address.city');
      expect(sig.get()).toBe('');

      store.setValue('address.city', 'NYC');
      expect(sig.get()).toBe('NYC');
    });

    test('signal subscription notifies on value change', () => {
      const sig = store.getSignal('name');
      const values: string[] = [];

      const unsub = sig.subscribe(() => {
        values.push(sig.get());
      });

      store.setValue('name', 'Alice');
      store.setValue('name', 'Bob');

      expect(values).toEqual(['Alice', 'Bob']);
      unsub();
    });

    test('signal subscription does not fire after unsubscribe', () => {
      const sig = store.getSignal('name');
      let callCount = 0;

      const unsub = sig.subscribe(() => { callCount++; });
      store.setValue('name', 'Alice');
      expect(callCount).toBe(1);

      unsub();
      store.setValue('name', 'Bob');
      expect(callCount).toBe(1);
    });
  });

  describe('multi-signal subscription (for useWatch multi-field)', () => {
    test('multiple signals can be subscribed to independently', () => {
      const nameSig = store.getSignal('name');
      const emailSig = store.getSignal('email');

      const snapshots: Array<{ name: string; email: string }> = [];

      const unsub1 = nameSig.subscribe(() => {
        snapshots.push({ name: nameSig.get(), email: emailSig.get() });
      });
      const unsub2 = emailSig.subscribe(() => {
        snapshots.push({ name: nameSig.get(), email: emailSig.get() });
      });

      store.setValue('name', 'Alice');
      store.setValue('email', 'alice@test.com');

      expect(snapshots.length).toBe(2);
      expect(snapshots[0]).toEqual({ name: 'Alice', email: '' });
      expect(snapshots[1]).toEqual({ name: 'Alice', email: 'alice@test.com' });

      unsub1();
      unsub2();
    });

    test('getValue returns current value for snapshot', () => {
      store.setValue('name', 'Alice');
      store.setValue('email', 'alice@test.com');

      const snapshot = ['name', 'email'].map((p) =>
        store.getValue(p as any)
      );

      expect(snapshot).toEqual(['Alice', 'alice@test.com']);
    });
  });

  describe('watch (store-level callback API)', () => {
    test('watch notifies callback when field value changes', () => {
      const values: unknown[] = [];
      const unsub = store.watch('name', (value) => {
        values.push(value);
      });

      store.setValue('name', 'Alice');
      store.setValue('name', 'Bob');

      expect(values).toEqual(['Alice', 'Bob']);
      unsub();
    });

    test('watchFields notifies for any of the watched paths', () => {
      const changes: Array<{ value: unknown; path: string }> = [];
      const unsub = store.watchFields(['name', 'email'], (value, path) => {
        changes.push({ value, path });
      });

      store.setValue('name', 'Alice');
      store.setValue('email', 'alice@test.com');

      expect(changes).toEqual([
        { value: 'Alice', path: 'name' },
        { value: 'alice@test.com', path: 'email' },
      ]);

      unsub();
    });

    test('watch cleanup after dispose', () => {
      let called = false;
      store.watch('name', () => { called = true; });

      store.dispose();
      store.setValue('name', 'test');

      expect(called).toBe(false);
    });
  });

  describe('signal cleanup on dispose', () => {
    test('subscriptions created via getSignal survive dispose (signals still work)', () => {
      const sig = store.getSignal('name');
      // Signal itself is not disposed — it's an independent reactive primitive
      // But watchers are cleared
      store.dispose();
      // Signal still works
      store.setValue('name', 'test');
      expect(sig.get()).toBe('test');
    });
  });
});
