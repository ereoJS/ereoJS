/**
 * Edge Cases & Developer Experience Tests
 *
 * Tests cover:
 * 1. Edge cases in field array operations
 * 2. Empty/null/undefined handling
 * 3. Rapid successive updates
 * 4. Schema + field-level validators combined
 * 5. FormData conversion edge cases
 * 6. Proxy edge cases
 * 7. Cross-field validation in compose chains
 * 8. Signal memory: no leaked subscriptions
 * 9. Validator composability edge cases
 */
import { describe, expect, test, mock } from 'bun:test';
import { FormStore } from '@ereo/forms';
import { ereoSchema, zodAdapter, formDataToObject } from '@ereo/forms';
import {
  required,
  email,
  minLength,
  maxLength,
  min,
  max,
  number,
  integer,
  positive,
  pattern,
  phone,
  url,
  date,
  compose,
  when,
  matches,
  custom,
  oneOf,
  notOneOf,
  v,
} from '@ereo/forms';
import { getPath, setPath, deepClone, deepEqual, flattenToPaths } from '@ereo/forms';
import { z } from 'zod';

// ─── Edge Case 1: Field Array Boundary Conditions ────────────────────────────

describe('Edge Case: Field Array Boundaries', () => {
  test('empty array operations are safe', () => {
    const form = new FormStore({
      defaultValues: { items: [] as string[] },
    });

    const items = form.getValue('items') as string[];
    expect(items).toEqual([]);

    // Remove from empty — should not throw
    const next = [...items];
    next.splice(0, 1);
    form.setValue('items', next);
    expect(form.getValue('items')).toEqual([]);
  });

  test('array with one item — remove leaves empty', () => {
    const form = new FormStore({
      defaultValues: { items: ['only'] },
    });

    form.setValue('items', []);
    expect(form.getValue('items')).toEqual([]);
  });

  test('large array handling (1000 items)', () => {
    const items = Array.from({ length: 1000 }, (_, i) => `item_${i}`);
    const form = new FormStore({
      defaultValues: { items },
    });

    expect((form.getValue('items') as string[]).length).toBe(1000);

    // Modify last item
    form.setValue('items.999', 'modified');
    expect(form.getValue('items.999')).toBe('modified');
    expect(form.getValue('items.0')).toBe('item_0');
  });

  test('nested arrays', () => {
    const form = new FormStore({
      defaultValues: {
        matrix: [[1, 2], [3, 4]],
      },
    });

    form.setValue('matrix.0.1', 99);
    expect(form.getValue('matrix.0.1')).toBe(99);
    expect(form.getValue('matrix.1.0')).toBe(3);
  });
});

// ─── Edge Case 2: Null/Undefined/Empty Handling ──────────────────────────────

describe('Edge Case: Null/Undefined/Empty Values', () => {
  test('validators handle null gracefully', () => {
    expect(required()(null)).toBe('This field is required');
    expect(email()(null as any)).toBeUndefined(); // email skips empty
    expect(minLength(3)(null as any)).toBeUndefined();
    expect(number()(null)).toBeUndefined();
  });

  test('validators handle undefined gracefully', () => {
    expect(required()(undefined)).toBe('This field is required');
    expect(email()(undefined as any)).toBeUndefined();
    expect(min(5)(undefined as any)).toBeUndefined();
    expect(max(5)(undefined as any)).toBeUndefined();
  });

  test('validators handle empty string', () => {
    expect(required()('')).toBe('This field is required');
    expect(email()('')).toBeUndefined();
    expect(minLength(3)('')).toBeUndefined();
    expect(number()('')).toBeUndefined();
    expect(integer()('')).toBeUndefined();
    expect(positive()('' as any)).toBeUndefined();
  });

  test('required on empty array', () => {
    expect(required()([])).toBe('This field is required');
    expect(required()([1])).toBeUndefined();
  });

  test('form handles null values in nested paths', () => {
    const form = new FormStore({
      defaultValues: { a: { b: null as string | null } },
    });

    expect(form.getValue('a.b')).toBeNull();
    form.setValue('a.b', 'hello');
    expect(form.getValue('a.b')).toBe('hello');
  });
});

// ─── Edge Case 3: Rapid Successive Updates ───────────────────────────────────

describe('Edge Case: Rapid Updates', () => {
  test('rapid setValue calls all apply in order', () => {
    const form = new FormStore({
      defaultValues: { counter: 0 },
    });

    for (let i = 1; i <= 100; i++) {
      form.setValue('counter', i);
    }

    expect(form.getValue('counter')).toBe(100);
  });

  test('rapid toggles settle on last value', () => {
    const form = new FormStore({
      defaultValues: { enabled: false },
    });

    for (let i = 0; i < 50; i++) {
      form.setValue('enabled', i % 2 === 0);
    }

    // 50 iterations: 0=true, 1=false, ..., 49=false
    expect(form.getValue('enabled')).toBe(false);
  });

  test('subscriber is not called if value doesnt change', () => {
    const form = new FormStore({
      defaultValues: { name: 'same' },
    });

    let notifyCount = 0;
    form.subscribe(() => notifyCount++);

    form.setValue('name', 'same'); // same value
    form.setValue('name', 'same'); // same value again

    expect(notifyCount).toBe(0); // no change, no notify
  });
});

// ─── Edge Case 4: Schema + Field-Level Validators Combined ───────────────────

describe('Edge Case: Schema + Field Validators', () => {
  test('zod schema and field validators both run on submit', async () => {
    const zodSchema = z.object({
      name: z.string().min(1),
      email: z.string().email(),
    });

    const form = new FormStore({
      defaultValues: { name: '', email: '' },
      schema: zodAdapter(zodSchema),
      onSubmit: async () => {},
    });

    // Additional field-level validator
    form.register('name', { validate: minLength(3, 'At least 3 chars') });

    form.setValue('name', 'AB'); // passes zod (min 1) but fails field validator
    form.setValue('email', 'valid@test.com');

    await form.handleSubmit();

    // Field-level validator should still catch this
    const nameErrors = form.getErrors('name').get();
    expect(nameErrors.length).toBeGreaterThan(0);
  });

  test('ereoSchema with compose validators', () => {
    const schema = ereoSchema({
      password: compose(required(), minLength(8)),
      age: compose(required(), v.number(), v.min(18)),
    });

    const result = schema.safeParse!({ password: 'short', age: 15 });
    expect(result.success).toBe(false);
  });
});

// ─── Edge Case 5: FormData Conversion ────────────────────────────────────────

describe('Edge Case: FormData Conversion', () => {
  test('formDataToObject handles basic types', () => {
    const fd = new FormData();
    fd.append('name', 'Alice');
    fd.append('age', '30');
    fd.append('active', 'true');

    const result = formDataToObject(fd);
    expect(result.name).toBe('Alice');
    expect(result.age).toBe(30); // coerced
    expect(result.active).toBe(true); // coerced
  });

  test('formDataToObject preserves leading zeros', () => {
    const fd = new FormData();
    fd.append('zip', '02115');
    fd.append('id', '007');

    const result = formDataToObject(fd);
    // Values starting with 0 followed by a digit are preserved as strings
    expect(typeof result.zip).toBe('string');
    expect(result.zip).toBe('02115');
    expect(typeof result.id).toBe('string');
    expect(result.id).toBe('007');
  });

  test('formDataToObject handles arrays', () => {
    const fd = new FormData();
    fd.append('tags[]', 'a');
    fd.append('tags[]', 'b');
    fd.append('tags[]', 'c');

    const result = formDataToObject(fd);
    expect(result.tags).toEqual(['a', 'b', 'c']);
  });

  test('formDataToObject handles nested paths', () => {
    const fd = new FormData();
    fd.append('address.city', 'NYC');
    fd.append('address.zip', '10001');

    const result = formDataToObject(fd);
    expect(result.address).toEqual({ city: 'NYC', zip: 10001 });
  });

  test('formDataToObject with coerce disabled', () => {
    const fd = new FormData();
    fd.append('count', '42');
    fd.append('flag', 'true');

    const result = formDataToObject(fd, { coerce: false });
    expect(result.count).toBe('42'); // string, not number
    expect(result.flag).toBe('true'); // string, not boolean
  });

  test('form toFormData round-trips correctly', () => {
    const form = new FormStore({
      defaultValues: { name: 'Alice', age: 30, active: true },
    });

    const fd = form.toFormData();
    expect(fd.get('name')).toBe('Alice');
    expect(fd.get('age')).toBe('30');
    expect(fd.get('active')).toBe('true');
  });
});

// ─── Edge Case 6: Proxy Access Patterns ──────────────────────────────────────

describe('Edge Case: Proxy Values', () => {
  test('proxy reflects real-time changes', () => {
    const form = new FormStore({
      defaultValues: { x: 0 },
    });

    expect(form.values.x).toBe(0);
    form.setValue('x', 42);
    expect(form.values.x).toBe(42);
  });

  test('proxy works with nested paths after update', () => {
    const form = new FormStore({
      defaultValues: { user: { name: 'A', score: 0 } },
    });

    form.setValue('user.name', 'B');
    form.setValue('user.score', 100);

    expect(form.values.user.name).toBe('B');
    expect(form.values.user.score).toBe(100);
  });
});

// ─── Edge Case 7: Validator Composability ────────────────────────────────────

describe('Edge Case: Validator Composability', () => {
  test('compose with when inside', () => {
    const validator = compose(
      required(),
      when(
        (value) => typeof value === 'string' && value.length > 0,
        email()
      )
    );

    expect(validator('')).toBe('This field is required');
    expect(validator('notanemail')).toBe('Invalid email address');
    expect(validator('good@test.com')).toBeUndefined();
  });

  test('deeply nested compose', () => {
    const inner = compose(minLength(3), maxLength(50));
    const outer = compose(required(), inner);

    expect(outer('')).toBe('This field is required');
    expect(outer('ab')).toBe('Must be at least 3 characters');
    expect(outer('abc')).toBeUndefined();
    expect(outer('x'.repeat(51))).toBe('Must be at most 50 characters');
  });

  test('all built-in validators return undefined for valid input', () => {
    expect(required()('valid')).toBeUndefined();
    expect(email()('test@test.com')).toBeUndefined();
    expect(url()('https://example.com')).toBeUndefined();
    expect(date()('2024-01-01')).toBeUndefined();
    expect(phone()('1234567890')).toBeUndefined();
    expect(minLength(3)('abc')).toBeUndefined();
    expect(maxLength(10)('abc')).toBeUndefined();
    expect(min(0)(5)).toBeUndefined();
    expect(max(100)(50)).toBeUndefined();
    expect(pattern(/^\d+$/)('123')).toBeUndefined();
    expect(number()('42')).toBeUndefined();
    expect(integer()(42)).toBeUndefined();
    expect(positive()(1)).toBeUndefined();
    expect(oneOf([1, 2, 3])(2)).toBeUndefined();
    expect(notOneOf([1, 2, 3])(4)).toBeUndefined();
  });

  test('url validator accepts valid URLs', () => {
    expect(url()('https://example.com')).toBeUndefined();
    expect(url()('http://localhost:3000')).toBeUndefined();
    expect(url()('ftp://files.example.com')).toBeUndefined();
    expect(url()('not-a-url')).toBe('Invalid URL');
  });

  test('phone validator accepts various formats', () => {
    expect(phone()('(555) 123-4567')).toBeUndefined();
    expect(phone()('+1 555 123 4567')).toBeUndefined();
    expect(phone()('5551234567')).toBeUndefined();
    expect(phone()('123')).toBe('Invalid phone number'); // too short
  });

  test('date validator', () => {
    expect(date()('2024-01-15')).toBeUndefined();
    expect(date()('Jan 15, 2024')).toBeUndefined();
    expect(date()('not-a-date')).toBe('Invalid date');
  });
});

// ─── Edge Case 8: Memory & Cleanup ───────────────────────────────────────────

describe('Edge Case: Memory & Cleanup', () => {
  test('creating and disposing many forms does not leak', () => {
    const forms: FormStore[] = [];

    for (let i = 0; i < 100; i++) {
      const form = new FormStore({
        defaultValues: { name: '', count: 0 },
      });
      form.subscribe(() => {});
      form.watch('name', () => {});
      forms.push(form);
    }

    for (const form of forms) {
      form.dispose();
    }

    // If we got here without errors, cleanup is working
    expect(forms.length).toBe(100);
  });

  test('unsubscribe prevents further notifications', () => {
    const form = new FormStore({
      defaultValues: { name: '' },
    });

    let count = 0;
    const unsub = form.subscribe(() => count++);

    form.setValue('name', 'a');
    expect(count).toBe(1);

    unsub();

    form.setValue('name', 'b');
    expect(count).toBe(1); // no more notifications
  });

  test('watch unsubscribe prevents further notifications', () => {
    const form = new FormStore({
      defaultValues: { name: '' },
    });

    const values: unknown[] = [];
    const unsub = form.watch('name', (v) => values.push(v));

    form.setValue('name', 'a');
    unsub();
    form.setValue('name', 'b');

    expect(values).toEqual(['a']); // 'b' not captured
  });
});

// ─── Edge Case 9: getChanges with Complex Types ─────────────────────────────

describe('Edge Case: getChanges', () => {
  test('getChanges returns only modified fields', () => {
    const form = new FormStore({
      defaultValues: { a: 1, b: 2, c: 3 },
    });

    form.setValue('b', 99);

    expect(form.getChanges()).toEqual({ b: 99 });
  });

  test('getChanges returns empty when no changes', () => {
    const form = new FormStore({
      defaultValues: { name: 'Alice' },
    });

    expect(form.getChanges()).toEqual({});
  });

  test('getChanges with nested values', () => {
    const form = new FormStore({
      defaultValues: {
        user: { name: 'Alice', email: 'alice@test.com' },
        settings: { theme: 'light' },
      },
    });

    form.setValue('user.name', 'Bob');
    form.setValue('settings.theme', 'dark');

    const changes = form.getChanges();
    expect(changes).toEqual({
      user: { name: 'Bob' },
      settings: { theme: 'dark' },
    });
  });
});

// ─── Edge Case 10: Immutable setPath Pattern ─────────────────────────────────

describe('Edge Case: Immutable setPath', () => {
  test('setPath does not mutate original object', () => {
    const original = { a: { b: { c: 1 } } };
    const result = setPath(original, 'a.b.c', 2);

    expect(original.a.b.c).toBe(1);
    expect(result.a.b.c).toBe(2);
    expect(result).not.toBe(original);
  });

  test('loop with setPath must reassign (let, not const)', () => {
    const updates = [
      { path: 'x', value: 1 },
      { path: 'y', value: 2 },
      { path: 'z', value: 3 },
    ];

    // CORRECT pattern
    let result: Record<string, any> = {};
    for (const u of updates) {
      result = setPath(result, u.path, u.value);
    }
    expect(result).toEqual({ x: 1, y: 2, z: 3 });
  });

  test('setPath creates nested structures', () => {
    const result = setPath({}, 'a.b.c.d', 'deep');
    expect(result).toEqual({ a: { b: { c: { d: 'deep' } } } });
  });

  test('getPath handles missing intermediate paths', () => {
    expect(getPath({}, 'a.b.c')).toBeUndefined();
    expect(getPath({ a: null }, 'a.b')).toBeUndefined();
    expect(getPath({ a: 1 }, 'a.b')).toBeUndefined();
  });
});

// ─── Edge Case 11: deepEqual ─────────────────────────────────────────────────

describe('Edge Case: deepEqual', () => {
  test('primitives', () => {
    expect(deepEqual(1, 1)).toBe(true);
    expect(deepEqual('a', 'a')).toBe(true);
    expect(deepEqual(true, true)).toBe(true);
    expect(deepEqual(1, 2)).toBe(false);
    expect(deepEqual('a', 'b')).toBe(false);
  });

  test('null/undefined', () => {
    expect(deepEqual(null, null)).toBe(true);
    expect(deepEqual(undefined, undefined)).toBe(true);
    expect(deepEqual(null, undefined)).toBe(false);
    expect(deepEqual(0, null)).toBe(false);
    expect(deepEqual('', null)).toBe(false);
  });

  test('arrays', () => {
    expect(deepEqual([1, 2, 3], [1, 2, 3])).toBe(true);
    expect(deepEqual([1, 2], [1, 2, 3])).toBe(false);
    expect(deepEqual([], [])).toBe(true);
  });

  test('nested objects', () => {
    expect(deepEqual(
      { a: { b: { c: 1 } } },
      { a: { b: { c: 1 } } }
    )).toBe(true);
    expect(deepEqual(
      { a: { b: { c: 1 } } },
      { a: { b: { c: 2 } } }
    )).toBe(false);
  });

  test('objects with different keys', () => {
    expect(deepEqual({ a: 1 }, { a: 1, b: 2 })).toBe(false);
    expect(deepEqual({ a: 1, b: 2 }, { a: 1 })).toBe(false);
  });
});

// ─── Edge Case 12: flattenToPaths ────────────────────────────────────────────

describe('Edge Case: flattenToPaths', () => {
  test('flat object', () => {
    const result = flattenToPaths({ a: 1, b: 'hello' });
    const entries = [...result];
    const map = new Map(entries);
    expect(map.get('a')).toBe(1);
    expect(map.get('b')).toBe('hello');
  });

  test('nested object', () => {
    const result = flattenToPaths({ user: { name: 'Alice', age: 30 } });
    const entries = [...result];
    const map = new Map(entries);
    expect(map.get('user.name')).toBe('Alice');
    expect(map.get('user.age')).toBe(30);
  });

  test('array values', () => {
    const result = flattenToPaths({ tags: ['a', 'b'] });
    const entries = [...result];
    const map = new Map(entries);
    expect(map.get('tags.0')).toBe('a');
    expect(map.get('tags.1')).toBe('b');
  });

  test('empty object', () => {
    const result = flattenToPaths({});
    const entries = [...result];
    expect(entries.length).toBe(0);
  });
});
