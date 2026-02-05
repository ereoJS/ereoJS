import { describe, expect, test } from 'bun:test';
import {
  zodAdapter,
  valibotAdapter,
  createSchemaValidator,
  ereoSchema,
  isEreoSchema,
  formDataToObject,
} from './schema';
import { required, minLength } from './validators';

describe('zodAdapter', () => {
  // Mock zod-like schema
  const mockZodSchema = {
    parse: (data: unknown) => {
      const obj = data as any;
      if (!obj.name) throw { issues: [{ path: ['name'], message: 'Required' }] };
      return obj;
    },
    safeParse: (data: unknown) => {
      const obj = data as any;
      if (!obj.name) {
        return {
          success: false,
          error: { issues: [{ path: ['name'], message: 'Required' }] },
        };
      }
      return { success: true, data: obj };
    },
  };

  test('parse succeeds', () => {
    const adapter = zodAdapter(mockZodSchema);
    const result = adapter.parse({ name: 'Alice' });
    expect(result).toEqual({ name: 'Alice' });
  });

  test('safeParse succeeds', () => {
    const adapter = zodAdapter(mockZodSchema);
    const result = adapter.safeParse!({ name: 'Alice' });
    expect(result.success).toBe(true);
  });

  test('safeParse fails with mapped issues', () => {
    const adapter = zodAdapter(mockZodSchema);
    const result = adapter.safeParse!({ name: '' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues).toHaveLength(1);
      expect(result.error.issues[0].path).toEqual(['name']);
      expect(result.error.issues[0].message).toBe('Required');
    }
  });
});

describe('createSchemaValidator', () => {
  test('parse succeeds', () => {
    const schema = createSchemaValidator({
      validate: (data) => {
        const obj = data as any;
        if (obj.name) return { success: true, data: obj };
        return { success: false, errors: { name: ['Required'] } };
      },
    });
    expect(schema.parse({ name: 'Alice' })).toEqual({ name: 'Alice' });
  });

  test('parse throws on failure', () => {
    const schema = createSchemaValidator({
      validate: () => ({ success: false, errors: { name: ['Required'] } }),
    });
    expect(() => schema.parse({})).toThrow('Validation failed');
  });

  test('safeParse returns errors', () => {
    const schema = createSchemaValidator({
      validate: () => ({ success: false, errors: { name: ['Required'] } }),
    });
    const result = schema.safeParse!({});
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].path).toEqual(['name']);
      expect(result.error.issues[0].message).toBe('Required');
    }
  });
});

describe('ereoSchema', () => {
  test('validates with built-in validators', () => {
    const schema = ereoSchema({
      name: required(),
      email: required(),
    });

    const result = schema.safeParse!({ name: 'Alice', email: 'a@b.com' });
    expect(result.success).toBe(true);
  });

  test('returns errors for invalid data', () => {
    const schema = ereoSchema({
      name: required(),
    });

    const result = schema.safeParse!({ name: '' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].path).toEqual(['name']);
    }
  });

  test('supports validator arrays', () => {
    const schema = ereoSchema({
      name: [required(), minLength(2)],
    });

    // Empty fails on required
    const r1 = schema.safeParse!({ name: '' });
    expect(r1.success).toBe(false);

    // Short fails on minLength
    const r2 = schema.safeParse!({ name: 'A' });
    expect(r2.success).toBe(false);

    // Valid passes
    const r3 = schema.safeParse!({ name: 'Al' });
    expect(r3.success).toBe(true);
  });

  test('supports nested definitions', () => {
    const schema = ereoSchema({
      user: {
        name: required(),
      },
    });

    const result = schema.safeParse!({ user: { name: '' } });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].path).toEqual(['user', 'name']);
    }
  });

  test('isEreoSchema detects schemas', () => {
    const schema = ereoSchema({ name: required() });
    expect(isEreoSchema(schema)).toBe(true);
    expect(isEreoSchema({})).toBe(false);
    expect(isEreoSchema(null)).toBe(false);
  });

  test('parse throws with message on failure', () => {
    const schema = ereoSchema({ name: required() });
    expect(() => schema.parse({ name: '' })).toThrow('Validation failed');
  });
});

describe('formDataToObject', () => {
  test('simple key-value pairs', () => {
    const fd = new FormData();
    fd.append('name', 'Alice');
    fd.append('email', 'alice@test.com');

    const result = formDataToObject(fd);
    expect(result.name).toBe('Alice');
    expect(result.email).toBe('alice@test.com');
  });

  test('coerces booleans', () => {
    const fd = new FormData();
    fd.append('active', 'true');
    fd.append('deleted', 'false');

    const result = formDataToObject(fd);
    expect(result.active).toBe(true);
    expect(result.deleted).toBe(false);
  });

  test('coerces numbers', () => {
    const fd = new FormData();
    fd.append('age', '30');
    fd.append('price', '9.99');

    const result = formDataToObject(fd);
    expect(result.age).toBe(30);
    expect(result.price).toBe(9.99);
  });

  test('coerces null', () => {
    const fd = new FormData();
    fd.append('value', 'null');

    const result = formDataToObject(fd);
    expect(result.value).toBeNull();
  });

  test('array fields with [] suffix', () => {
    const fd = new FormData();
    fd.append('tags[]', 'a');
    fd.append('tags[]', 'b');
    fd.append('tags[]', 'c');

    const result = formDataToObject(fd);
    expect(result.tags).toEqual(['a', 'b', 'c']);
  });

  test('nested dot notation', () => {
    const fd = new FormData();
    fd.append('user.name', 'Alice');
    fd.append('user.email', 'alice@test.com');

    const result = formDataToObject(fd);
    expect(result.user).toEqual({ name: 'Alice', email: 'alice@test.com' });
  });

  test('bracket notation', () => {
    const fd = new FormData();
    fd.append('items[0]', 'first');
    fd.append('items[1]', 'second');

    const result = formDataToObject(fd);
    expect(result.items).toEqual(['first', 'second']);
  });

  test('skips coercion when disabled', () => {
    const fd = new FormData();
    fd.append('age', '30');
    fd.append('active', 'true');

    const result = formDataToObject(fd, { coerce: false });
    expect(result.age).toBe('30');
    expect(result.active).toBe('true');
  });

  test('explicit array fields option', () => {
    const fd = new FormData();
    fd.append('color', 'red');
    fd.append('color', 'blue');

    const result = formDataToObject(fd, { arrays: ['color'] });
    expect(result.color).toEqual(['red', 'blue']);
  });
});
