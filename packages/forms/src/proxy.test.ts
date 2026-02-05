import { describe, expect, test } from 'bun:test';
import { FormStore } from './store';
import { createValuesProxy } from './proxy';

describe('createValuesProxy', () => {
  test('reads top-level values', () => {
    const store = new FormStore({ defaultValues: { name: 'Alice', age: 30 } });
    const proxy = createValuesProxy(store);
    expect(proxy.name).toBe('Alice');
    expect(proxy.age).toBe(30);
  });

  test('reads nested values', () => {
    const store = new FormStore({
      defaultValues: { user: { name: 'Alice', address: { city: 'NYC' } } },
    });
    const proxy = createValuesProxy(store);
    expect(proxy.user.name).toBe('Alice');
    expect(proxy.user.address.city).toBe('NYC');
  });

  test('writes top-level values', () => {
    const store = new FormStore({ defaultValues: { name: '' } });
    const proxy = createValuesProxy(store);
    proxy.name = 'Bob';
    expect(store.getValue('name')).toBe('Bob');
  });

  test('has operator works', () => {
    const store = new FormStore({ defaultValues: { name: 'Alice' } });
    const proxy = createValuesProxy(store);
    expect('name' in proxy).toBe(true);
  });

  test('ownKeys returns object keys', () => {
    const store = new FormStore({ defaultValues: { a: 1, b: 2, c: 3 } });
    const proxy = createValuesProxy(store);
    expect(Object.keys(proxy)).toEqual(['a', 'b', 'c']);
  });

  test('getOwnPropertyDescriptor returns for existing keys', () => {
    const store = new FormStore({ defaultValues: { name: 'Alice' } });
    const proxy = createValuesProxy(store);
    const desc = Object.getOwnPropertyDescriptor(proxy, 'name');
    expect(desc?.value).toBe('Alice');
    expect(desc?.enumerable).toBe(true);
  });

  test('returns undefined for symbol properties', () => {
    const store = new FormStore({ defaultValues: { name: 'Alice' } });
    const proxy = createValuesProxy(store);
    expect((proxy as any)[Symbol('test')]).toBeUndefined();
  });

  test('nested proxy preserves reference equality', () => {
    const store = new FormStore({
      defaultValues: { user: { name: 'Alice', address: { city: 'NYC' } } },
    });
    const proxy = createValuesProxy(store);
    const user1 = proxy.user;
    const user2 = proxy.user;
    expect(user1).toBe(user2);

    const addr1 = proxy.user.address;
    const addr2 = proxy.user.address;
    expect(addr1).toBe(addr2);
  });

  test('nested proxy reflects signal updates', () => {
    const store = new FormStore({
      defaultValues: { user: { name: 'Alice' } },
    });
    const proxy = createValuesProxy(store);

    store.setValue('user.name', 'Bob');
    expect(proxy.user.name).toBe('Bob');
  });
});
