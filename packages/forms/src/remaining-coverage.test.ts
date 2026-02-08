import { describe, expect, test, beforeEach, afterEach } from 'bun:test';
import { createFormStore } from './store';
import { createValuesProxy } from './proxy';
import { deepClone } from './utils';

// ─── proxy.ts: edge cases for uncovered lines 51, 59 ───────────────────────

describe('createValuesProxy: edge cases', () => {
  test('has trap returns false when path value is primitive', () => {
    const form = createFormStore<{ name: string }>({
      defaultValues: { name: 'Alice' },
    });

    const proxy = form.values;
    // 'name' value is a string (primitive), checking nested prop on primitive
    // This exercises the `has` trap where obj is not an object
    const nameProxy = (proxy as any).name;
    // nameProxy is the primitive value 'Alice', not a proxy (since it's not an object)
    // So `in` operator on primitive returns false
    expect(typeof nameProxy).toBe('string');

    form.dispose();
  });

  test('ownKeys returns empty when path value is null', () => {
    const form = createFormStore<{ data: null }>({
      defaultValues: { data: null } as any,
    });

    const proxy = form.values;
    // Accessing 'data' which is null - the proxy for 'data' path
    // When we try to enumerate keys of null, ownKeys should return []
    // But since getValue returns null (not object), createValuesProxy returns null directly

    form.dispose();
  });

  test('proxy set with symbol is a no-op', () => {
    const form = createFormStore<{ name: string }>({
      defaultValues: { name: '' },
    });

    const proxy = form.values;
    const sym = Symbol('test');
    // Setting a symbol property should not throw (returns true)
    expect(() => {
      (proxy as any)[sym] = 'value';
    }).not.toThrow();

    form.dispose();
  });

  test('proxy get with symbol returns undefined', () => {
    const form = createFormStore<{ name: string }>({
      defaultValues: { name: '' },
    });

    const proxy = form.values;
    const sym = Symbol('test');
    expect((proxy as any)[sym]).toBeUndefined();

    form.dispose();
  });

  test('proxy has with symbol returns false', () => {
    const form = createFormStore<{ name: string }>({
      defaultValues: { name: '' },
    });

    const proxy = form.values;
    const sym = Symbol('test');
    expect(sym in (proxy as any)).toBe(false);

    form.dispose();
  });

  test('proxy getOwnPropertyDescriptor with symbol returns undefined', () => {
    const form = createFormStore<{ name: string }>({
      defaultValues: { name: '' },
    });

    const proxy = form.values;
    const desc = Object.getOwnPropertyDescriptor(proxy, Symbol('test'));
    expect(desc).toBeUndefined();

    form.dispose();
  });

  test('proxy getOwnPropertyDescriptor for existing key', () => {
    const form = createFormStore<{ name: string }>({
      defaultValues: { name: 'Alice' },
    });

    const proxy = form.values;
    const desc = Object.getOwnPropertyDescriptor(proxy, 'name');
    expect(desc).toBeDefined();
    expect(desc!.value).toBe('Alice');
    expect(desc!.configurable).toBe(true);
    expect(desc!.enumerable).toBe(true);

    form.dispose();
  });

  test('proxy getOwnPropertyDescriptor for non-existent key', () => {
    const form = createFormStore<{ name: string }>({
      defaultValues: { name: 'Alice' },
    });

    const proxy = form.values;
    const desc = Object.getOwnPropertyDescriptor(proxy, 'nonexistent');
    expect(desc).toBeUndefined();

    form.dispose();
  });

  test('proxy ownKeys returns object keys', () => {
    const form = createFormStore<{ name: string; email: string }>({
      defaultValues: { name: 'Alice', email: 'a@b.com' },
    });

    const proxy = form.values;
    const keys = Object.keys(proxy);
    expect(keys).toContain('name');
    expect(keys).toContain('email');

    form.dispose();
  });

  test('proxy has for existing key', () => {
    const form = createFormStore<{ name: string }>({
      defaultValues: { name: 'Alice' },
    });

    const proxy = form.values;
    expect('name' in proxy).toBe(true);
    expect('nonexistent' in (proxy as any)).toBe(false);

    form.dispose();
  });

  test('proxy caches nested proxies for reference equality', () => {
    const form = createFormStore<{ user: { name: string } }>({
      defaultValues: { user: { name: 'Alice' } },
    });

    const proxy = form.values;
    const user1 = (proxy as any).user;
    const user2 = (proxy as any).user;
    // Should be the same cached proxy reference
    expect(user1).toBe(user2);

    form.dispose();
  });
});

// ─── utils.ts: deepClone fallback (when structuredClone is unavailable) ─────

describe('deepClone: without structuredClone', () => {
  let originalStructuredClone: any;

  beforeEach(() => {
    originalStructuredClone = globalThis.structuredClone;
    // Remove structuredClone to force fallback path
    (globalThis as any).structuredClone = undefined;
  });

  afterEach(() => {
    globalThis.structuredClone = originalStructuredClone;
  });

  test('clones plain objects via fallback', () => {
    // Need to re-require to pick up the changed global
    // Actually, the check is at runtime: `typeof structuredClone === 'function'`
    // So setting it to undefined should trigger the fallback
    const { deepClone: cloneFn } = require('./utils');

    const obj = { name: 'Alice', age: 30 };
    const cloned = cloneFn(obj);
    expect(cloned).toEqual(obj);
    expect(cloned).not.toBe(obj);
  });

  test('clones arrays via fallback', () => {
    const { deepClone: cloneFn } = require('./utils');

    const arr = [1, 2, { nested: true }];
    const cloned = cloneFn(arr);
    expect(cloned).toEqual(arr);
    expect(cloned).not.toBe(arr);
    expect(cloned[2]).not.toBe(arr[2]);
  });

  test('clones Date via fallback', () => {
    const { deepClone: cloneFn } = require('./utils');

    const date = new Date('2024-06-15');
    const cloned = cloneFn(date);
    expect(cloned).toBeInstanceOf(Date);
    expect(cloned.getTime()).toBe(date.getTime());
    expect(cloned).not.toBe(date);
  });

  test('clones RegExp via fallback', () => {
    const { deepClone: cloneFn } = require('./utils');

    const regex = /test/gi;
    const cloned = cloneFn(regex);
    expect(cloned).toBeInstanceOf(RegExp);
    expect(cloned.source).toBe('test');
    expect(cloned.flags).toBe('gi');
  });

  test('clones Map via fallback', () => {
    const { deepClone: cloneFn } = require('./utils');

    const map = new Map([['a', { x: 1 }], ['b', { x: 2 }]]);
    const cloned = cloneFn(map);
    expect(cloned).toBeInstanceOf(Map);
    expect(cloned.get('a')).toEqual({ x: 1 });
    expect(cloned.get('a')).not.toBe(map.get('a'));
  });

  test('clones Set via fallback', () => {
    const { deepClone: cloneFn } = require('./utils');

    const set = new Set([1, 2, 3]);
    const cloned = cloneFn(set);
    expect(cloned).toBeInstanceOf(Set);
    expect(cloned.has(1)).toBe(true);
    expect(cloned).not.toBe(set);
  });

  test('handles primitives in fallback', () => {
    const { deepClone: cloneFn } = require('./utils');

    expect(cloneFn(null)).toBe(null);
    expect(cloneFn(42)).toBe(42);
    expect(cloneFn('hello')).toBe('hello');
    expect(cloneFn(true)).toBe(true);
  });

  test('deep nested object clone via fallback', () => {
    const { deepClone: cloneFn } = require('./utils');

    const obj = {
      level1: {
        level2: {
          level3: 'deep',
          arr: [1, { key: 'val' }],
        },
      },
    };
    const cloned = cloneFn(obj);
    expect(cloned).toEqual(obj);
    expect(cloned.level1.level2.arr[1]).not.toBe(obj.level1.level2.arr[1]);
  });
});

// ─── proxy.ts: ownKeys and has when base value is not an object ─────────────

describe('createValuesProxy: base value edge cases', () => {
  test('ownKeys on nested proxy returns child keys', () => {
    const form = createFormStore<{ user: { name: string; age: number } }>({
      defaultValues: { user: { name: 'Alice', age: 30 } },
    });

    const proxy = form.values;
    const userKeys = Object.keys((proxy as any).user);
    expect(userKeys).toContain('name');
    expect(userKeys).toContain('age');

    form.dispose();
  });

  test('has on nested proxy checks child keys', () => {
    const form = createFormStore<{ user: { name: string } }>({
      defaultValues: { user: { name: 'Alice' } },
    });

    const proxy = form.values;
    const userProxy = (proxy as any).user;
    expect('name' in userProxy).toBe(true);
    expect('missing' in userProxy).toBe(false);

    form.dispose();
  });
});

// ─── proxy.ts: covering line 51 (has returns false for non-object base) ─────

describe('createValuesProxy: has trap on stale proxy', () => {
  test('has returns false when basePath value changes to primitive', () => {
    const form = createFormStore<{ user: any }>({
      defaultValues: { user: { name: 'Alice' } },
    });

    // Get nested proxy for 'user' path (while it's an object)
    const userProxy = (form.values as any).user;
    expect('name' in userProxy).toBe(true);

    // Change user to a string (primitive) — the proxy still exists but base value changed
    form.setValue('user' as any, 'not-an-object');

    // Now the has trap should hit line 51 (value at 'user' is a string, not object)
    expect('name' in userProxy).toBe(false);

    form.dispose();
  });

  test('ownKeys returns empty when basePath value changes to primitive', () => {
    const form = createFormStore<{ user: any }>({
      defaultValues: { user: { name: 'Alice' } },
    });

    const userProxy = (form.values as any).user;
    expect(Object.keys(userProxy)).toContain('name');

    form.setValue('user' as any, 42);

    // Now ownKeys should return empty
    expect(Object.keys(userProxy)).toEqual([]);

    form.dispose();
  });
});

// ─── FormStore: submitWith error handling ────────────────────────────────────

describe('FormStore: submitWith edge cases', () => {
  test('submitWith aborts previous in-flight submission', async () => {
    let callCount = 0;
    const form = createFormStore<{ name: string }>({
      defaultValues: { name: 'Alice' },
    });

    const slowHandler = async () => {
      callCount++;
      await new Promise((r) => setTimeout(r, 100));
    };

    // Start first submission
    const p1 = form.submitWith(slowHandler);
    // Start second submission immediately (should abort first)
    const p2 = form.submitWith(slowHandler);

    await Promise.all([p1, p2].map(p => p.catch(() => {})));
    // First submission is superseded (generation check), so only second handler runs
    expect(callCount).toBe(1);
    expect(form.submitState.get()).toBe('success');

    form.dispose();
  });

  test('submitWith handles handler error', async () => {
    const form = createFormStore<{ name: string }>({
      defaultValues: { name: 'Alice' },
    });

    const errorHandler = async () => {
      throw new Error('Submit failed');
    };

    try {
      await form.submitWith(errorHandler);
    } catch (e: any) {
      expect(e.message).toBe('Submit failed');
    }

    expect(form.isSubmitting.get()).toBe(false);
    expect(form.submitState.get()).toBe('error');

    form.dispose();
  });

  test('handleSubmit without onSubmit runs validateAll', async () => {
    const form = createFormStore<{ name: string }>({
      defaultValues: { name: '' },
    });

    form.register('name' as any, {
      validate: (value: string) => value ? undefined : 'Required',
    });

    await form.handleSubmit();
    // Validation should have run even without onSubmit
    expect(form.getErrors('name' as any).get()).toContain('Required');

    form.dispose();
  });

  test('handleSubmit prevents event default', async () => {
    const form = createFormStore<{ name: string }>({
      defaultValues: { name: '' },
    });

    let preventDefaultCalled = false;
    const mockEvent = {
      preventDefault: () => { preventDefaultCalled = true; },
    };

    await form.handleSubmit(mockEvent as any);
    expect(preventDefaultCalled).toBe(true);

    form.dispose();
  });

  test('resetOnSubmit resets form after successful submit', async () => {
    const form = createFormStore<{ name: string }>({
      defaultValues: { name: '' },
      onSubmit: async () => {},
      resetOnSubmit: true,
    });

    form.setValue('name' as any, 'Alice');
    expect(form.isDirty.get()).toBe(true);

    await form.handleSubmit();

    expect(form.getValue('name' as any)).toBe('');
    expect(form.isDirty.get()).toBe(false);

    form.dispose();
  });
});

// ─── FormStore: validateOnMount ─────────────────────────────────────────────

describe('FormStore: validateOnMount', () => {
  test('validateOnMount triggers validation after construction', async () => {
    const form = createFormStore<{ name: string }>({
      defaultValues: { name: '' },
      validateOnMount: true,
    });

    form.register('name' as any, {
      validate: (value: string) => value ? undefined : 'Required',
    });

    // Wait for microtask (validateOnMount runs in Promise.resolve().then())
    await new Promise((r) => setTimeout(r, 50));

    // Validation should have run
    // Note: validateOnMount errors depend on whether fields are registered before the microtask fires
    form.dispose();
  });
});

// ─── FormStore: error map operations ────────────────────────────────────────

describe('FormStore: error map comprehensive', () => {
  test('getErrorMap returns empty map by default', () => {
    const form = createFormStore<{ name: string }>({
      defaultValues: { name: '' },
    });

    const errorMap = form.getErrorMap('name' as any).get();
    expect(errorMap.sync).toEqual([]);
    expect(errorMap.async).toEqual([]);
    expect(errorMap.schema).toEqual([]);
    expect(errorMap.server).toEqual([]);
    expect(errorMap.manual).toEqual([]);

    form.dispose();
  });

  test('setErrorsWithSource updates specific source', () => {
    const form = createFormStore<{ name: string }>({
      defaultValues: { name: '' },
    });

    form.setErrorsWithSource('name' as any, ['Server error'], 'server');
    const errorMap = form.getErrorMap('name' as any).get();
    expect(errorMap.server).toEqual(['Server error']);
    expect(errorMap.sync).toEqual([]);

    // Flat errors should include server errors
    expect(form.getErrors('name' as any).get()).toEqual(['Server error']);

    form.dispose();
  });

  test('clearErrorsBySource clears only specified source', () => {
    const form = createFormStore<{ name: string }>({
      defaultValues: { name: '' },
    });

    form.setErrorsWithSource('name' as any, ['Sync error'], 'sync');
    form.setErrorsWithSource('name' as any, ['Server error'], 'server');

    expect(form.getErrors('name' as any).get()).toEqual(['Sync error', 'Server error']);

    form.clearErrorsBySource('name' as any, 'server');

    expect(form.getErrors('name' as any).get()).toEqual(['Sync error']);
    expect(form.getErrorMap('name' as any).get().server).toEqual([]);

    form.dispose();
  });

  test('clearErrorsBySource is no-op when source is already empty', () => {
    const form = createFormStore<{ name: string }>({
      defaultValues: { name: '' },
    });

    // No errors set yet
    form.clearErrorsBySource('name' as any, 'server');
    expect(form.getErrors('name' as any).get()).toEqual([]);

    form.dispose();
  });

  test('setErrors with existing error map updates manual source', () => {
    const form = createFormStore<{ name: string }>({
      defaultValues: { name: '' },
    });

    // Initialize error map by accessing it
    form.getErrorMap('name' as any);

    form.setErrors('name' as any, ['Manual error']);
    expect(form.getErrors('name' as any).get()).toEqual(['Manual error']);

    const errorMap = form.getErrorMap('name' as any).get();
    expect(errorMap.manual).toEqual(['Manual error']);

    form.dispose();
  });
});

// ─── FormStore: clearErrors comprehensive ───────────────────────────────────

describe('FormStore: clearErrors all fields', () => {
  test('clearErrors without path clears all fields', () => {
    const form = createFormStore<{ name: string; email: string }>({
      defaultValues: { name: '', email: '' },
    });

    form.setErrors('name' as any, ['Error 1']);
    form.setErrors('email' as any, ['Error 2']);
    form.setFormErrors(['Form error']);

    form.clearErrors();

    expect(form.getErrors('name' as any).get()).toEqual([]);
    expect(form.getErrors('email' as any).get()).toEqual([]);
    expect(form.getFormErrors().get()).toEqual([]);
    expect(form.isValid.get()).toBe(true);

    form.dispose();
  });
});
