import { describe, expect, test } from 'bun:test';
import { isStandardSchema, standardSchemaAdapter } from './schema';
import { FormStore } from './store';

// ─── Helper ──────────────────────────────────────────────────────────────────

function createMockStandardSchema(validateFn: (value: unknown) => any) {
  return {
    '~standard': {
      version: 1,
      vendor: 'test',
      validate: validateFn,
    },
  };
}

// ─── isStandardSchema ────────────────────────────────────────────────────────

describe('isStandardSchema', () => {
  test('detects a valid Standard Schema object', () => {
    const schema = createMockStandardSchema(() => ({ value: 1 }));
    expect(isStandardSchema(schema)).toBe(true);
  });

  test('returns false for empty object', () => {
    expect(isStandardSchema({})).toBe(false);
  });

  test('returns false for null', () => {
    expect(isStandardSchema(null)).toBe(false);
  });

  test('returns false for object with only parse method (not Standard Schema)', () => {
    expect(isStandardSchema({ parse: () => {} })).toBe(false);
  });
});

// ─── standardSchemaAdapter: safeParse ────────────────────────────────────────

describe('standardSchemaAdapter safeParse', () => {
  test('converts success results', () => {
    const schema = createMockStandardSchema(() => ({
      value: { name: 'Alice' },
    }));
    const adapter = standardSchemaAdapter(schema);
    const result = adapter.safeParse!({ name: 'Alice' });

    expect(result).toEqual({
      success: true,
      data: { name: 'Alice' },
    });
  });

  test('converts failure results with path normalization', () => {
    const schema = createMockStandardSchema(() => ({
      issues: [{ message: 'Required', path: ['name'] }],
    }));
    const adapter = standardSchemaAdapter(schema);
    const result = adapter.safeParse!({});

    expect(result).toEqual({
      success: false,
      error: {
        issues: [{ path: ['name'], message: 'Required' }],
      },
    });
  });

  test('handles { key: PropertyKey } path format', () => {
    const schema = createMockStandardSchema(() => ({
      issues: [
        {
          message: 'City is required',
          path: [{ key: 'address' }, { key: 'city' }],
        },
      ],
    }));
    const adapter = standardSchemaAdapter(schema);
    const result = adapter.safeParse!({});

    expect(result).toEqual({
      success: false,
      error: {
        issues: [{ path: ['address', 'city'], message: 'City is required' }],
      },
    });
  });

  test('handles numeric path segments', () => {
    const schema = createMockStandardSchema(() => ({
      issues: [
        {
          message: 'Name required',
          path: [{ key: 0 }, { key: 'name' }],
        },
      ],
    }));
    const adapter = standardSchemaAdapter(schema);
    const result = adapter.safeParse!({});

    expect(result).toEqual({
      success: false,
      error: {
        issues: [{ path: [0, 'name'], message: 'Name required' }],
      },
    });
  });
});

// ─── standardSchemaAdapter: parse ────────────────────────────────────────────

describe('standardSchemaAdapter parse', () => {
  test('throws on failure with the issue message', () => {
    const schema = createMockStandardSchema(() => ({
      issues: [{ message: 'Name is required' }],
    }));
    const adapter = standardSchemaAdapter(schema);

    expect(() => adapter.parse({})).toThrow('Name is required');
  });

  test('throws with concatenated messages on multiple issues', () => {
    const schema = createMockStandardSchema(() => ({
      issues: [
        { message: 'Name is required' },
        { message: 'Email is required' },
      ],
    }));
    const adapter = standardSchemaAdapter(schema);

    expect(() => adapter.parse({})).toThrow('Name is required, Email is required');
  });

  test('returns value on success', () => {
    const data = { name: 'Bob', age: 30 };
    const schema = createMockStandardSchema(() => ({ value: data }));
    const adapter = standardSchemaAdapter(schema);

    expect(adapter.parse({})).toEqual(data);
  });
});

// ─── Non-Standard-Schema detection ──────────────────────────────────────────

describe('Non-Standard-Schema objects are not auto-detected', () => {
  test('object with parse and safeParse is not a Standard Schema', () => {
    const zodLike = {
      parse: (data: unknown) => data,
      safeParse: (data: unknown) => ({ success: true, data }),
    };
    expect(isStandardSchema(zodLike)).toBe(false);
  });
});

// ─── Integration with FormStore ─────────────────────────────────────────────

describe('Integration: Standard Schema as FormConfig.schema', () => {
  test('store.validate() succeeds with a passing Standard Schema', async () => {
    const schema = createMockStandardSchema((value) => ({
      value,
    }));

    const store = new FormStore({
      defaultValues: { name: 'Alice', email: 'alice@test.com' },
      schema,
    });

    const isValid = await store.validate();
    expect(isValid).toBe(true);
    expect(store.getErrors('name' as any).get()).toEqual([]);
    expect(store.getErrors('email' as any).get()).toEqual([]);

    store.dispose();
  });

  test('store.validate() fails and sets errors with a failing Standard Schema', async () => {
    const schema = createMockStandardSchema(() => ({
      issues: [
        { message: 'Name is required', path: ['name'] },
        { message: 'Invalid email', path: ['email'] },
      ],
    }));

    const store = new FormStore({
      defaultValues: { name: '', email: '' },
      schema,
    });

    const isValid = await store.validate();
    expect(isValid).toBe(false);
    expect(store.getErrors('name' as any).get()).toContain('Name is required');
    expect(store.getErrors('email' as any).get()).toContain('Invalid email');

    store.dispose();
  });

  test('store.validate() populates nested path errors from Standard Schema', async () => {
    const schema = createMockStandardSchema(() => ({
      issues: [
        {
          message: 'City is required',
          path: [{ key: 'address' }, { key: 'city' }],
        },
      ],
    }));

    const store = new FormStore({
      defaultValues: { address: { city: '', zip: '' } },
      schema,
    });

    const isValid = await store.validate();
    expect(isValid).toBe(false);
    expect(store.getErrors('address.city' as any).get()).toContain('City is required');

    store.dispose();
  });
});
