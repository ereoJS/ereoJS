import { describe, expect, test } from 'bun:test';
import { parsePath, getPath, setPath, deepClone, deepEqual, flattenToPaths } from './utils';

describe('parsePath', () => {
  test('simple key', () => {
    expect(parsePath('name')).toEqual(['name']);
  });

  test('dot-separated path', () => {
    expect(parsePath('user.name')).toEqual(['user', 'name']);
  });

  test('numeric segments become numbers', () => {
    expect(parsePath('tags.0')).toEqual(['tags', 0]);
  });

  test('bracket notation', () => {
    expect(parsePath('tags[0]')).toEqual(['tags', 0]);
  });

  test('mixed dot and bracket', () => {
    expect(parsePath('users[0].name')).toEqual(['users', 0, 'name']);
  });

  test('deeply nested', () => {
    expect(parsePath('a.b.c.d.e')).toEqual(['a', 'b', 'c', 'd', 'e']);
  });

  test('bracket with string key', () => {
    expect(parsePath('data[key]')).toEqual(['data', 'key']);
  });
});

describe('getPath', () => {
  const obj = {
    user: { name: 'Alice', address: { city: 'NYC' } },
    tags: ['a', 'b', 'c'],
    items: [{ id: 1 }, { id: 2 }],
  };

  test('top-level key', () => {
    expect(getPath(obj, 'tags')).toEqual(['a', 'b', 'c']);
  });

  test('nested key', () => {
    expect(getPath(obj, 'user.name')).toBe('Alice');
  });

  test('deeply nested', () => {
    expect(getPath(obj, 'user.address.city')).toBe('NYC');
  });

  test('array index', () => {
    expect(getPath(obj, 'tags.0')).toBe('a');
    expect(getPath(obj, 'tags.2')).toBe('c');
  });

  test('array of objects', () => {
    expect(getPath(obj, 'items.0.id')).toBe(1);
    expect(getPath(obj, 'items.1.id')).toBe(2);
  });

  test('missing path returns undefined', () => {
    expect(getPath(obj, 'user.nonexistent')).toBeUndefined();
    expect(getPath(obj, 'nope.deep')).toBeUndefined();
  });

  test('null obj returns undefined', () => {
    expect(getPath(null, 'a')).toBeUndefined();
  });
});

describe('setPath', () => {
  test('sets top-level key immutably', () => {
    const obj = { a: 1, b: 2 };
    const result = setPath(obj, 'a', 10);
    expect(result).toEqual({ a: 10, b: 2 });
    expect(obj.a).toBe(1); // original unchanged
  });

  test('sets nested key', () => {
    const obj = { user: { name: 'Alice' } };
    const result = setPath(obj, 'user.name', 'Bob');
    expect(result).toEqual({ user: { name: 'Bob' } });
    expect(obj.user.name).toBe('Alice');
  });

  test('sets array index', () => {
    const obj = { tags: ['a', 'b', 'c'] };
    const result = setPath(obj, 'tags.1', 'x');
    expect(result).toEqual({ tags: ['a', 'x', 'c'] });
    expect(obj.tags[1]).toBe('b');
  });

  test('creates intermediate objects', () => {
    const obj = {};
    const result = setPath(obj, 'a.b.c', 42);
    expect(result).toEqual({ a: { b: { c: 42 } } });
  });

  test('creates intermediate arrays for numeric segments', () => {
    const obj = {};
    const result = setPath(obj, 'items.0', 'first');
    expect(result).toEqual({ items: ['first'] });
  });
});

describe('deepClone', () => {
  test('clones primitives', () => {
    expect(deepClone(42)).toBe(42);
    expect(deepClone('hello')).toBe('hello');
    expect(deepClone(null)).toBe(null);
  });

  test('clones objects deeply', () => {
    const obj = { a: { b: { c: 1 } } };
    const clone = deepClone(obj);
    expect(clone).toEqual(obj);
    expect(clone).not.toBe(obj);
    expect(clone.a).not.toBe(obj.a);
    expect(clone.a.b).not.toBe(obj.a.b);
  });

  test('clones arrays', () => {
    const arr = [1, [2, 3], { a: 4 }];
    const clone = deepClone(arr);
    expect(clone).toEqual(arr);
    expect(clone).not.toBe(arr);
    expect(clone[1]).not.toBe(arr[1]);
  });
});

describe('deepEqual', () => {
  test('primitives', () => {
    expect(deepEqual(1, 1)).toBe(true);
    expect(deepEqual(1, 2)).toBe(false);
    expect(deepEqual('a', 'a')).toBe(true);
    expect(deepEqual(true, true)).toBe(true);
    expect(deepEqual(null, null)).toBe(true);
    expect(deepEqual(null, undefined)).toBe(false);
  });

  test('objects', () => {
    expect(deepEqual({ a: 1 }, { a: 1 })).toBe(true);
    expect(deepEqual({ a: 1 }, { a: 2 })).toBe(false);
    expect(deepEqual({ a: 1, b: 2 }, { a: 1 })).toBe(false);
  });

  test('nested objects', () => {
    expect(deepEqual({ a: { b: 1 } }, { a: { b: 1 } })).toBe(true);
    expect(deepEqual({ a: { b: 1 } }, { a: { b: 2 } })).toBe(false);
  });

  test('arrays', () => {
    expect(deepEqual([1, 2, 3], [1, 2, 3])).toBe(true);
    expect(deepEqual([1, 2], [1, 2, 3])).toBe(false);
    expect(deepEqual([1, 2, 3], [1, 3, 2])).toBe(false);
  });

  test('mixed types', () => {
    expect(deepEqual(1, '1')).toBe(false);
    expect(deepEqual({}, [])).toBe(false);
  });
});

describe('flattenToPaths', () => {
  test('simple object', () => {
    const result = flattenToPaths({ a: 1, b: 'hello' });
    expect(result.get('a')).toBe(1);
    expect(result.get('b')).toBe('hello');
  });

  test('nested object', () => {
    const result = flattenToPaths({ user: { name: 'Alice', age: 30 } });
    expect(result.get('user.name')).toBe('Alice');
    expect(result.get('user.age')).toBe(30);
    expect(result.has('user')).toBe(true);
  });

  test('array values', () => {
    const result = flattenToPaths({ tags: ['a', 'b'] });
    expect(result.get('tags.0')).toBe('a');
    expect(result.get('tags.1')).toBe('b');
    expect(result.has('tags')).toBe(true);
  });
});
