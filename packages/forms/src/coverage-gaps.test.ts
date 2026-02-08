import { describe, expect, test } from 'bun:test';
import { setPath, deepClone, deepEqual, flattenToPaths, reconstructFromPaths, parsePath, getPath } from './utils';
import { composeSchemas, mergeFormConfigs } from './composition';
import { when, async as asyncValidator, compose, fileSize, fileType } from './validators';
import type { ValidationSchema } from './types';

// ─── utils.ts: coverage gaps ────────────────────────────────────────────────

describe('setPath: primitive at non-leaf', () => {
  test('replaces primitive with object container', () => {
    // If current value at intermediate path is a primitive, setPath should
    // create the appropriate container (object or array)
    const obj = { user: 'not-an-object' as any };
    const result = setPath(obj, 'user.name', 'Alice');
    expect(result.user.name).toBe('Alice');
  });

  test('replaces primitive with object container at leaf with numeric key', () => {
    // When parent is a primitive and we set a numeric-keyed leaf,
    // the parent becomes an object (not array) because the normalization
    // checks the NEXT segment, not the current one.
    const obj = { items: 'not-an-array' as any };
    const result = setPath(obj, 'items.0', 'first');
    // The '0' key is set on the normalized container
    expect(result.items[0]).toBe('first');
  });

  test('handles deeply nested primitive replacement', () => {
    const obj = { a: { b: 42 as any } };
    const result = setPath(obj, 'a.b.c', 'deep');
    expect(result.a.b.c).toBe('deep');
  });
});

describe('setPath: edge cases', () => {
  test('empty path returns value as T', () => {
    const result = setPath({ x: 1 }, '', 'replaced');
    expect(result).toBe('replaced');
  });

  test('sets value on null current', () => {
    const result = setPath(null as any, 'a.b', 'value');
    expect(result.a.b).toBe('value');
  });

  test('sets array element when current is array', () => {
    const arr = [1, 2, 3];
    const result = setPath(arr, '1', 'two');
    expect(result[1]).toBe('two');
    expect(result[0]).toBe(1);
  });

  test('handles bracket notation in setPath', () => {
    const obj = { items: [{ name: 'a' }] };
    const result = setPath(obj, 'items[0].name', 'b');
    expect(result.items[0].name).toBe('b');
  });
});

describe('deepClone: special types', () => {
  test('clones Date objects', () => {
    const date = new Date('2024-01-15');
    const cloned = deepClone(date);
    expect(cloned).toBeInstanceOf(Date);
    expect(cloned.getTime()).toBe(date.getTime());
    expect(cloned).not.toBe(date); // Different reference
  });

  test('clones RegExp objects', () => {
    const regex = /test/gi;
    const cloned = deepClone(regex);
    expect(cloned).toBeInstanceOf(RegExp);
    expect(cloned.source).toBe('test');
    expect(cloned.flags).toBe('gi');
    expect(cloned).not.toBe(regex);
  });

  test('clones Map objects', () => {
    const map = new Map([['a', 1], ['b', 2]]);
    const cloned = deepClone(map);
    expect(cloned).toBeInstanceOf(Map);
    expect(cloned.get('a')).toBe(1);
    expect(cloned.get('b')).toBe(2);
    expect(cloned).not.toBe(map);
  });

  test('clones Set objects', () => {
    const set = new Set([1, 2, 3]);
    const cloned = deepClone(set);
    expect(cloned).toBeInstanceOf(Set);
    expect(cloned.has(1)).toBe(true);
    expect(cloned.has(3)).toBe(true);
    expect(cloned).not.toBe(set);
  });

  test('clones nested objects with mixed types', () => {
    const obj = {
      date: new Date('2024-01-01'),
      items: [1, 2, 3],
      nested: { key: 'value' },
    };
    const cloned = deepClone(obj);
    expect(cloned.date.getTime()).toBe(obj.date.getTime());
    expect(cloned.items).toEqual([1, 2, 3]);
    expect(cloned.nested.key).toBe('value');
    expect(cloned).not.toBe(obj);
  });

  test('handles null and primitives', () => {
    expect(deepClone(null)).toBe(null);
    expect(deepClone(42)).toBe(42);
    expect(deepClone('hello')).toBe('hello');
    expect(deepClone(true)).toBe(true);
    expect(deepClone(undefined)).toBe(undefined);
  });
});

describe('deepEqual: edge cases', () => {
  test('Date vs non-Date returns false', () => {
    expect(deepEqual(new Date(), {})).toBe(false);
    expect(deepEqual({}, new Date())).toBe(false);
  });

  test('RegExp vs non-RegExp returns false', () => {
    expect(deepEqual(/test/, {})).toBe(false);
    expect(deepEqual({}, /test/)).toBe(false);
  });

  test('Map comparison: different sizes', () => {
    const a = new Map([['a', 1]]);
    const b = new Map([['a', 1], ['b', 2]]);
    expect(deepEqual(a, b)).toBe(false);
  });

  test('Map comparison: different values', () => {
    const a = new Map([['a', 1]]);
    const b = new Map([['a', 2]]);
    expect(deepEqual(a, b)).toBe(false);
  });

  test('Map comparison: missing key', () => {
    const a = new Map([['a', 1]]);
    const b = new Map([['b', 1]]);
    expect(deepEqual(a, b)).toBe(false);
  });

  test('Set comparison: different sizes', () => {
    const a = new Set([1, 2]);
    const b = new Set([1, 2, 3]);
    expect(deepEqual(a, b)).toBe(false);
  });

  test('Set comparison: different values', () => {
    const a = new Set([1, 2]);
    const b = new Set([1, 3]);
    expect(deepEqual(a, b)).toBe(false);
  });

  test('array vs non-array returns false', () => {
    expect(deepEqual([1], { 0: 1 })).toBe(false);
    expect(deepEqual({ 0: 1 }, [1])).toBe(false);
  });

  test('different length arrays', () => {
    expect(deepEqual([1, 2], [1, 2, 3])).toBe(false);
  });

  test('different types returns false', () => {
    expect(deepEqual(42, '42')).toBe(false);
    expect(deepEqual(null, undefined)).toBe(false);
  });

  test('NaN equality', () => {
    expect(deepEqual(NaN, NaN)).toBe(true);
    expect(deepEqual({ x: NaN }, { x: NaN })).toBe(true);
  });

  test('objects with different key counts', () => {
    expect(deepEqual({ a: 1 }, { a: 1, b: 2 })).toBe(false);
  });
});

describe('flattenToPaths: edge cases', () => {
  test('primitive at root with prefix', () => {
    const result = flattenToPaths(42, 'root');
    expect(result.get('root')).toBe(42);
  });

  test('null at root with prefix', () => {
    const result = flattenToPaths(null, 'root');
    expect(result.get('root')).toBe(null);
  });

  test('empty array', () => {
    const result = flattenToPaths([], 'items');
    expect(result.get('items')).toEqual([]);
  });

  test('nested arrays', () => {
    const result = flattenToPaths({ matrix: [[1, 2], [3, 4]] });
    expect(result.has('matrix')).toBe(true);
    expect(result.has('matrix.0')).toBe(true);
    expect(result.has('matrix.0.0')).toBe(true);
  });
});

describe('reconstructFromPaths', () => {
  test('reconstructs flat paths to object', () => {
    const paths = new Map<string, unknown>([
      ['name', 'Alice'],
      ['age', 30],
    ]);
    const result = reconstructFromPaths(paths);
    expect(result.name).toBe('Alice');
    expect(result.age).toBe(30);
  });

  test('handles null values', () => {
    const paths = new Map<string, unknown>([['x', null]]);
    const result = reconstructFromPaths(paths);
    expect(result.x).toBe(null);
  });

  test('handles nested paths', () => {
    const paths = new Map<string, unknown>([
      ['user.name', 'Alice'],
      ['user.age', 30],
    ]);
    const result = reconstructFromPaths(paths);
    expect(result.user.name).toBe('Alice');
    expect(result.user.age).toBe(30);
  });
});

describe('parsePath: edge cases', () => {
  test('empty brackets are skipped', () => {
    const result = parsePath('items[]');
    // [] has empty string inside, parseInt returns NaN, indexStr is empty → skipped
    expect(result).toEqual(['items']);
  });

  test('string key in brackets', () => {
    const result = parsePath('items[key]');
    expect(result).toEqual(['items', 'key']);
  });

  test('mixed notation', () => {
    const result = parsePath('a[0].b[1].c');
    expect(result).toEqual(['a', 0, 'b', 1, 'c']);
  });

  test('consecutive dots produce no empty segments', () => {
    // The parser checks `if (current)` before pushing
    const result = parsePath('a..b');
    expect(result).toEqual(['a', 'b']);
  });
});

// ─── composition.ts: coverage gaps ──────────────────────────────────────────

describe('composeSchemas: schemas without safeParse', () => {
  test('uses parse fallback when schema1 has no safeParse', () => {
    const schema1: ValidationSchema<unknown, any> = {
      parse: (data: unknown) => {
        const obj = data as any;
        if (!obj?.name) throw { issues: [{ path: ['name'], message: 'Required' }] };
        return obj;
      },
    };

    const schema2: ValidationSchema<unknown, any> = {
      parse: (data: unknown) => data,
      safeParse: (data: unknown) => ({ success: true as const, data }),
    };

    const composed = composeSchemas('user', schema1, 'contact', schema2);

    // Schema1 has no safeParse, so it uses parse. Invalid data should produce errors.
    const result = composed.safeParse!({
      user: { name: '' }, // will fail
      contact: { email: 'a@b.com' },
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      const paths = result.error.issues.map((i: any) => i.path.join('.'));
      expect(paths).toContain('user.name');
    }
  });

  test('uses parse fallback when schema2 has no safeParse', () => {
    const schema1: ValidationSchema<unknown, any> = {
      parse: (data: unknown) => data,
      safeParse: (data: unknown) => ({ success: true as const, data }),
    };

    const schema2: ValidationSchema<unknown, any> = {
      parse: (data: unknown) => {
        const obj = data as any;
        if (!obj?.email) throw { issues: [{ path: ['email'], message: 'Required' }] };
        return obj;
      },
    };

    const composed = composeSchemas('user', schema1, 'contact', schema2);

    const result = composed.safeParse!({
      user: { name: 'Alice' },
      contact: { email: '' },
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      const paths = result.error.issues.map((i: any) => i.path.join('.'));
      expect(paths).toContain('contact.email');
    }
  });

  test('parse fallback rethrows non-issues errors', () => {
    const schema1: ValidationSchema<unknown, any> = {
      parse: () => { throw new Error('Generic error'); },
    };

    const schema2: ValidationSchema<unknown, any> = {
      parse: (data: unknown) => data,
      safeParse: (data: unknown) => ({ success: true as const, data }),
    };

    const composed = composeSchemas('user', schema1, 'contact', schema2);

    expect(() => composed.safeParse!({ user: {}, contact: {} })).toThrow('Generic error');
  });

  test('both schemas succeed without safeParse (parse fallback)', () => {
    const schema1: ValidationSchema<unknown, any> = {
      parse: (data: unknown) => data,
    };

    const schema2: ValidationSchema<unknown, any> = {
      parse: (data: unknown) => data,
    };

    const composed = composeSchemas('a', schema1, 'b', schema2);
    const result = composed.safeParse!({ a: { x: 1 }, b: { y: 2 } });

    expect(result.success).toBe(true);
  });

  test('parse fallback with issues missing path array', () => {
    const schema1: ValidationSchema<unknown, any> = {
      parse: () => {
        throw { issues: [{ message: 'Bad', path: undefined }] };
      },
    };

    const schema2: ValidationSchema<unknown, any> = {
      parse: (data: unknown) => data,
      safeParse: (data: unknown) => ({ success: true as const, data }),
    };

    const composed = composeSchemas('user', schema1, 'contact', schema2);
    const result = composed.safeParse!({ user: {}, contact: {} });

    expect(result.success).toBe(false);
  });

  test('parse with null data', () => {
    const schema1: ValidationSchema<unknown, any> = {
      parse: (data: unknown) => data ?? {},
      safeParse: (data: unknown) => ({ success: true as const, data: data ?? {} }),
    };
    const schema2: ValidationSchema<unknown, any> = {
      parse: (data: unknown) => data ?? {},
      safeParse: (data: unknown) => ({ success: true as const, data: data ?? {} }),
    };

    const composed = composeSchemas('a', schema1, 'b', schema2);
    const result = composed.parse(null);
    expect(result).toBeDefined();
  });
});

describe('mergeFormConfigs: edge cases', () => {
  test('handles both configs without validators', () => {
    const result = mergeFormConfigs(
      { defaultValues: { a: 1 } },
      { defaultValues: { b: 2 } }
    );
    expect(result.validators).toBeUndefined();
  });

  test('handles configA without validators', () => {
    const result = mergeFormConfigs(
      { defaultValues: { a: 1 } },
      { defaultValues: { b: 2 }, validators: { b: (() => undefined) as any } }
    );
    expect(result.validators).toBeDefined();
  });

  test('handles configB without validators', () => {
    const result = mergeFormConfigs(
      { defaultValues: { a: 1 }, validators: { a: (() => undefined) as any } },
      { defaultValues: { b: 2 } }
    );
    expect(result.validators).toBeDefined();
  });

  test('merges array validators from A with single from B', () => {
    const v1 = () => undefined;
    const v2 = () => undefined;
    const v3 = () => undefined;

    const result = mergeFormConfigs(
      { defaultValues: { x: '' }, validators: { x: [v1, v2] as any } },
      { defaultValues: { x: '' }, validators: { x: v3 as any } }
    );

    expect(Array.isArray((result.validators as any).x)).toBe(true);
    expect((result.validators as any).x).toHaveLength(3);
  });

  test('B schema overrides A schema', () => {
    const schemaA = { parse: () => {} };
    const schemaB = { parse: () => {} };

    const result = mergeFormConfigs(
      { defaultValues: { x: '' }, schema: schemaA as any },
      { defaultValues: { y: '' }, schema: schemaB as any }
    );

    expect(result.schema).toBe(schemaB);
  });

  test('preserves A schema when B has none', () => {
    const schemaA = { parse: () => {} };

    const result = mergeFormConfigs(
      { defaultValues: { x: '' }, schema: schemaA as any },
      { defaultValues: { y: '' } }
    );

    expect(result.schema).toBe(schemaA);
  });

  test('merges resetOnSubmit and validateOnMount', () => {
    const result = mergeFormConfigs(
      { defaultValues: { x: '' }, resetOnSubmit: true, validateOnMount: true },
      { defaultValues: { y: '' } }
    );

    expect(result.resetOnSubmit).toBe(true);
    expect(result.validateOnMount).toBe(true);
  });
});

// ─── validators.ts: coverage gaps ───────────────────────────────────────────

describe('when: async validator path', () => {
  test('when() with async validator creates async wrapper', async () => {
    const asyncRule = asyncValidator(
      async (value: string) => value === 'bad' ? 'Not allowed' : undefined
    );

    const conditional = when(
      (value: string) => value.length > 0,
      asyncRule
    );

    expect(conditional._isAsync).toBe(true);

    // Condition true → runs async validator
    const result = await conditional('bad');
    expect(result).toBe('Not allowed');

    // Condition false → skips
    const result2 = await conditional('');
    expect(result2).toBeUndefined();
  });

  test('when() with sync validator creates sync wrapper', () => {
    const syncRule = (value: string) => value ? undefined : 'Required';

    const conditional = when(
      () => true,
      syncRule
    );

    expect(conditional._isAsync).toBeUndefined();
    expect(conditional('hello')).toBeUndefined();
    expect(conditional('')).toBe('Required');
  });

  test('when() preserves crossField flag', () => {
    const rule = (value: unknown) => undefined;
    rule._crossField = true;

    const conditional = when(() => true, rule);
    expect(conditional._crossField).toBe(true);
  });
});

describe('compose: edge cases', () => {
  test('compose with mixed sync and async preserves flags', () => {
    const syncRule = (v: any) => undefined;
    syncRule._isRequired = true;

    const asyncRule = asyncValidator(async () => undefined);
    asyncRule._crossField = true;

    const composed = compose(syncRule, asyncRule);
    expect(composed._isAsync).toBe(true);
    expect(composed._isRequired).toBe(true);
    expect(composed._crossField).toBe(true);
  });

  test('compose propagates max debounce', () => {
    const r1 = asyncValidator(async () => undefined, { debounce: 100 });
    const r2 = asyncValidator(async () => undefined, { debounce: 300 });
    const r3 = asyncValidator(async () => undefined, { debounce: 200 });

    const composed = compose(r1, r2, r3);
    expect(composed._debounce).toBe(300);
  });

  test('compose returns first error in async path', async () => {
    const r1 = asyncValidator(async () => undefined);
    const r2 = asyncValidator(async () => 'Second error');
    const r3 = asyncValidator(async () => 'Third error');

    const composed = compose(r1, r2, r3);
    const result = await composed('test');
    expect(result).toBe('Second error');
  });
});

describe('fileSize and fileType validators', () => {
  test('fileSize passes for small file', () => {
    const validate = fileSize(1024);
    const file = { size: 500 } as File;
    expect(validate(file)).toBeUndefined();
  });

  test('fileSize fails for large file', () => {
    const validate = fileSize(1024);
    const file = { size: 2048 } as File;
    expect(validate(file)).toBeDefined();
  });

  test('fileSize with custom message', () => {
    const validate = fileSize(1024, 'Too big');
    const file = { size: 2048 } as File;
    expect(validate(file)).toBe('Too big');
  });

  test('fileSize skips null value', () => {
    const validate = fileSize(1024);
    expect(validate(null as any)).toBeUndefined();
  });

  test('fileSize skips file without size', () => {
    const validate = fileSize(1024);
    expect(validate({} as File)).toBeUndefined();
  });

  test('fileType passes for matching type', () => {
    const validate = fileType(['image/png', 'image/jpeg']);
    const file = { type: 'image/png' } as File;
    expect(validate(file)).toBeUndefined();
  });

  test('fileType fails for non-matching type', () => {
    const validate = fileType(['image/png']);
    const file = { type: 'application/pdf' } as File;
    expect(validate(file)).toBeDefined();
  });

  test('fileType with custom message', () => {
    const validate = fileType(['image/png'], 'Wrong format');
    const file = { type: 'text/plain' } as File;
    expect(validate(file)).toBe('Wrong format');
  });

  test('fileType skips null value', () => {
    const validate = fileType(['image/png']);
    expect(validate(null as any)).toBeUndefined();
  });

  test('fileType skips file without type', () => {
    const validate = fileType(['image/png']);
    expect(validate({} as File)).toBeUndefined();
  });
});
