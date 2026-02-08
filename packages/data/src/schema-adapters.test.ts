import { describe, expect, test } from 'bun:test';
import {
  ereoSchema,
  isEreoSchema,
  createPaginationParser,
  createSortParser,
  createFilterParser,
  parseBoolean,
  parseStringArray,
  parseDate,
  parseEnum,
  schemaBuilder,
} from './schema-adapters';
import type { ZodLikeSchema, EreoSchema } from './schema-adapters';

describe('@ereo/data - Schema Adapters', () => {
  // ===========================================================================
  // ereoSchema
  // ===========================================================================
  describe('ereoSchema', () => {
    const mockZodSchema: ZodLikeSchema<{ name: string; age: number }> = {
      parse: (data: unknown) => {
        const d = data as { name: string; age: number };
        if (!d.name) throw new Error('Name required');
        return d;
      },
      safeParse: (data: unknown) => {
        const d = data as { name?: string; age?: number };
        if (!d.name) {
          return {
            success: false as const,
            error: { errors: [{ path: ['name'], message: 'Name is required' }] },
          };
        }
        return { success: true as const, data: d as { name: string; age: number } };
      },
    };

    test('wraps a zod-like schema', () => {
      const wrapped = ereoSchema(mockZodSchema);

      expect(wrapped._ereoSchema).toBe(true);
      expect(wrapped._original).toBe(mockZodSchema);
    });

    test('parse delegates to the underlying schema', () => {
      const wrapped = ereoSchema(mockZodSchema);
      const result = wrapped.parse({ name: 'John', age: 30 });

      expect(result).toEqual({ name: 'John', age: 30 });
    });

    test('parse throws when underlying schema throws', () => {
      const wrapped = ereoSchema(mockZodSchema);

      expect(() => wrapped.parse({ name: '', age: 0 })).toThrow('Name required');
    });

    test('safeParse returns success result', () => {
      const wrapped = ereoSchema(mockZodSchema);
      const result = wrapped.safeParse({ name: 'Jane', age: 25 });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual({ name: 'Jane', age: 25 });
      }
    });

    test('safeParse returns error result with mapped errors', () => {
      const wrapped = ereoSchema(mockZodSchema);
      const result = wrapped.safeParse({ age: 25 });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.errors).toHaveLength(1);
        expect(result.error.errors[0].path).toEqual(['name']);
        expect(result.error.errors[0].message).toBe('Name is required');
      }
    });

    test('safeParse maps multiple errors correctly', () => {
      const schemaWithMultipleErrors: ZodLikeSchema<{ name: string }> = {
        parse: () => ({ name: '' }),
        safeParse: () => ({
          success: false as const,
          error: {
            errors: [
              { path: ['name'], message: 'Required' },
              { path: ['name'], message: 'Min length 2' },
              { path: ['email'], message: 'Invalid email' },
            ],
          },
        }),
      };

      const wrapped = ereoSchema(schemaWithMultipleErrors);
      const result = wrapped.safeParse({});

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.errors).toHaveLength(3);
        // Errors should be mapped with just path and message (no extra fields)
        expect(result.error.errors[0]).toEqual({ path: ['name'], message: 'Required' });
        expect(result.error.errors[1]).toEqual({ path: ['name'], message: 'Min length 2' });
        expect(result.error.errors[2]).toEqual({ path: ['email'], message: 'Invalid email' });
      }
    });
  });

  // ===========================================================================
  // isEreoSchema
  // ===========================================================================
  describe('isEreoSchema', () => {
    test('returns true for ereoSchema-wrapped schemas', () => {
      const wrapped = ereoSchema({
        parse: (d: unknown) => d as string,
        safeParse: (d: unknown) => ({ success: true as const, data: d as string }),
      });

      expect(isEreoSchema(wrapped)).toBe(true);
    });

    test('returns false for null', () => {
      expect(isEreoSchema(null)).toBe(false);
    });

    test('returns false for undefined', () => {
      expect(isEreoSchema(undefined)).toBe(false);
    });

    test('returns false for primitive values', () => {
      expect(isEreoSchema('string')).toBe(false);
      expect(isEreoSchema(42)).toBe(false);
      expect(isEreoSchema(true)).toBe(false);
    });

    test('returns false for plain objects', () => {
      expect(isEreoSchema({})).toBe(false);
      expect(isEreoSchema({ parse: () => {} })).toBe(false);
    });

    test('returns false for objects with _ereoSchema set to false', () => {
      expect(isEreoSchema({ _ereoSchema: false })).toBe(false);
    });

    test('returns true for objects that look like EreoSchema', () => {
      const manualSchema = {
        parse: () => {},
        safeParse: () => ({ success: true as const, data: null }),
        _original: null,
        _ereoSchema: true as const,
        _output: null,
      };

      expect(isEreoSchema(manualSchema)).toBe(true);
    });
  });

  // ===========================================================================
  // createPaginationParser
  // ===========================================================================
  describe('createPaginationParser', () => {
    test('returns defaults when no data provided', () => {
      const parser = createPaginationParser();
      const result = parser.parse({});

      expect(result.page).toBe(1);
      expect(result.limit).toBe(10);
      expect(result.offset).toBeUndefined();
    });

    test('parses valid pagination params', () => {
      const parser = createPaginationParser();
      const result = parser.parse({ page: 3, limit: 20, offset: 40 });

      expect(result.page).toBe(3);
      expect(result.limit).toBe(20);
      expect(result.offset).toBe(40);
    });

    test('parses string values', () => {
      const parser = createPaginationParser();
      const result = parser.parse({ page: '2', limit: '15', offset: '10' });

      expect(result.page).toBe(2);
      expect(result.limit).toBe(15);
      expect(result.offset).toBe(10);
    });

    test('uses custom defaults', () => {
      const parser = createPaginationParser({
        defaultPage: 0,
        defaultLimit: 25,
      });
      const result = parser.parse({});

      // page 0 is not > 0, so it falls back to defaultPage
      expect(result.page).toBe(0);
      expect(result.limit).toBe(25);
    });

    test('enforces maxLimit', () => {
      const parser = createPaginationParser({ maxLimit: 50 });
      const result = parser.parse({ limit: 200 });

      expect(result.limit).toBe(50);
    });

    test('clamps negative page to default', () => {
      const parser = createPaginationParser();
      const result = parser.parse({ page: -1 });

      expect(result.page).toBe(1); // falls back to defaultPage
    });

    test('clamps negative limit to default', () => {
      const parser = createPaginationParser();
      const result = parser.parse({ limit: -5 });

      expect(result.limit).toBe(10); // falls back to defaultLimit
    });

    test('ignores negative offset', () => {
      const parser = createPaginationParser();
      const result = parser.parse({ offset: -1 });

      expect(result.offset).toBeUndefined();
    });

    test('handles NaN values', () => {
      const parser = createPaginationParser();
      const result = parser.parse({ page: 'abc', limit: 'xyz' });

      expect(result.page).toBe(1);
      expect(result.limit).toBe(10);
    });

    test('safeParse returns success', () => {
      const parser = createPaginationParser();
      const result = parser.safeParse!({ page: 2, limit: 20 });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.page).toBe(2);
        expect(result.data.limit).toBe(20);
      }
    });

    test('handles zero offset', () => {
      const parser = createPaginationParser();
      const result = parser.parse({ offset: 0 });

      expect(result.offset).toBe(0);
    });

    test('handles undefined/null/empty values', () => {
      const parser = createPaginationParser();
      const result = parser.parse({ page: undefined, limit: null, offset: '' });

      expect(result.page).toBe(1);
      expect(result.limit).toBe(10);
      expect(result.offset).toBeUndefined();
    });
  });

  // ===========================================================================
  // createSortParser
  // ===========================================================================
  describe('createSortParser', () => {
    test('returns defaults when no data provided', () => {
      const parser = createSortParser(['name', 'date'], 'name');
      const result = parser.parse({});

      expect(result.sortBy).toBe('name');
      expect(result.sortOrder).toBe('asc');
    });

    test('parses valid sort params', () => {
      const parser = createSortParser(['name', 'date']);
      const result = parser.parse({ sortBy: 'date', sortOrder: 'desc' });

      expect(result.sortBy).toBe('date');
      expect(result.sortOrder).toBe('desc');
    });

    test('rejects invalid sortBy field', () => {
      const parser = createSortParser(['name', 'date'], 'name');
      const result = parser.parse({ sortBy: 'invalid' });

      expect(result.sortBy).toBe('name'); // falls back to default
    });

    test('rejects invalid sortOrder', () => {
      const parser = createSortParser(['name'], 'name');
      const result = parser.parse({ sortOrder: 'invalid' });

      expect(result.sortOrder).toBe('asc'); // falls back to default
    });

    test('uses custom default order', () => {
      const parser = createSortParser(['name'], 'name', 'desc');
      const result = parser.parse({});

      expect(result.sortOrder).toBe('desc');
    });

    test('returns undefined sortBy when no default and invalid field', () => {
      const parser = createSortParser(['name', 'date']);
      const result = parser.parse({ sortBy: 'invalid' });

      expect(result.sortBy).toBeUndefined();
    });

    test('safeParse returns success', () => {
      const parser = createSortParser(['name', 'date']);
      const result = parser.safeParse!({ sortBy: 'name', sortOrder: 'asc' });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.sortBy).toBe('name');
        expect(result.data.sortOrder).toBe('asc');
      }
    });
  });

  // ===========================================================================
  // createFilterParser
  // ===========================================================================
  describe('createFilterParser', () => {
    test('returns empty object when no matching filters', () => {
      const parser = createFilterParser({
        status: ['active', 'inactive'],
      });
      const result = parser.parse({});

      expect(result).toEqual({});
    });

    test('parses valid single filter value', () => {
      const parser = createFilterParser({
        status: ['active', 'inactive'],
      });
      const result = parser.parse({ status: 'active' });

      expect(result.status).toBe('active');
    });

    test('rejects invalid filter value', () => {
      const parser = createFilterParser({
        status: ['active', 'inactive'],
      });
      const result = parser.parse({ status: 'unknown' });

      expect(result.status).toBeUndefined();
    });

    test('filters array values to only allowed ones', () => {
      const parser = createFilterParser({
        tags: ['react', 'vue', 'angular'],
      });
      const result = parser.parse({ tags: ['react', 'invalid', 'vue'] });

      expect(result.tags).toEqual(['react', 'vue']);
    });

    test('returns undefined for empty filtered array', () => {
      const parser = createFilterParser({
        tags: ['react', 'vue'],
      });
      const result = parser.parse({ tags: ['invalid1', 'invalid2'] });

      // Empty array after filtering means no result
      expect(result.tags).toBeUndefined();
    });

    test('ignores unknown filter keys', () => {
      const parser = createFilterParser({
        status: ['active', 'inactive'],
      });
      const result = parser.parse({ status: 'active', unknown: 'value' });

      expect(result.status).toBe('active');
      expect((result as any).unknown).toBeUndefined();
    });

    test('handles multiple filter categories', () => {
      const parser = createFilterParser({
        status: ['active', 'inactive'],
        category: ['tech', 'business'],
      });
      const result = parser.parse({
        status: 'active',
        category: 'tech',
      });

      expect(result.status).toBe('active');
      expect(result.category).toBe('tech');
    });

    test('safeParse returns success', () => {
      const parser = createFilterParser({
        status: ['active', 'inactive'],
      });
      const result = parser.safeParse!({ status: 'active' });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.status).toBe('active');
      }
    });

    test('coerces array values to strings for comparison', () => {
      const parser = createFilterParser({
        ids: ['1', '2', '3'],
      });
      const result = parser.parse({ ids: [1, 2, 4] });

      // Values get coerced via String()
      expect(result.ids).toEqual([1, 2]);
    });
  });

  // ===========================================================================
  // parseBoolean
  // ===========================================================================
  describe('parseBoolean', () => {
    test('returns true for truthy strings', () => {
      expect(parseBoolean('true')).toBe(true);
      expect(parseBoolean('1')).toBe(true);
      expect(parseBoolean('yes')).toBe(true);
      expect(parseBoolean('TRUE')).toBe(true);
      expect(parseBoolean('Yes')).toBe(true);
    });

    test('returns false for falsy strings', () => {
      expect(parseBoolean('false')).toBe(false);
      expect(parseBoolean('0')).toBe(false);
      expect(parseBoolean('no')).toBe(false);
      expect(parseBoolean('FALSE')).toBe(false);
      expect(parseBoolean('No')).toBe(false);
    });

    test('returns boolean values directly', () => {
      expect(parseBoolean(true)).toBe(true);
      expect(parseBoolean(false)).toBe(false);
    });

    test('returns fallback for undefined/null/empty', () => {
      expect(parseBoolean(undefined)).toBe(false);
      expect(parseBoolean(null)).toBe(false);
      expect(parseBoolean('')).toBe(false);
    });

    test('returns custom fallback', () => {
      expect(parseBoolean(undefined, true)).toBe(true);
      expect(parseBoolean(null, true)).toBe(true);
      expect(parseBoolean('', true)).toBe(true);
    });

    test('returns fallback for unrecognized strings', () => {
      expect(parseBoolean('maybe')).toBe(false);
      expect(parseBoolean('2')).toBe(false);
      expect(parseBoolean('maybe', true)).toBe(true);
    });
  });

  // ===========================================================================
  // parseStringArray
  // ===========================================================================
  describe('parseStringArray', () => {
    test('returns array as-is converted to strings', () => {
      expect(parseStringArray(['a', 'b', 'c'])).toEqual(['a', 'b', 'c']);
    });

    test('converts non-string array elements to strings', () => {
      expect(parseStringArray([1, 2, 3])).toEqual(['1', '2', '3']);
    });

    test('splits comma-separated string', () => {
      expect(parseStringArray('a,b,c')).toEqual(['a', 'b', 'c']);
    });

    test('trims spaces around comma-separated values', () => {
      expect(parseStringArray('a, b , c')).toEqual(['a', 'b', 'c']);
    });

    test('wraps single string in array', () => {
      expect(parseStringArray('single')).toEqual(['single']);
    });

    test('returns empty array for non-string/non-array', () => {
      expect(parseStringArray(undefined)).toEqual([]);
      expect(parseStringArray(null)).toEqual([]);
      expect(parseStringArray(42)).toEqual([]);
      expect(parseStringArray(true)).toEqual([]);
    });

    test('handles empty string', () => {
      // Empty string has no commas, so wraps in array
      expect(parseStringArray('')).toEqual(['']);
    });
  });

  // ===========================================================================
  // parseDate
  // ===========================================================================
  describe('parseDate', () => {
    test('returns undefined for undefined/null/empty', () => {
      expect(parseDate(undefined)).toBeUndefined();
      expect(parseDate(null)).toBeUndefined();
      expect(parseDate('')).toBeUndefined();
    });

    test('returns fallback for undefined/null/empty', () => {
      const fallback = new Date('2024-01-01');
      expect(parseDate(undefined, fallback)).toBe(fallback);
      expect(parseDate(null, fallback)).toBe(fallback);
      expect(parseDate('', fallback)).toBe(fallback);
    });

    test('returns Date instance directly if valid', () => {
      const date = new Date('2024-06-15');
      expect(parseDate(date)).toBe(date);
    });

    test('returns fallback for invalid Date instance', () => {
      const fallback = new Date('2024-01-01');
      const invalid = new Date('invalid');
      expect(parseDate(invalid, fallback)).toBe(fallback);
    });

    test('parses valid date string', () => {
      const result = parseDate('2024-06-15');
      expect(result).toBeInstanceOf(Date);
      expect(result!.getFullYear()).toBe(2024);
    });

    test('parses valid datetime string', () => {
      const result = parseDate('2024-06-15T10:30:00Z');
      expect(result).toBeInstanceOf(Date);
    });

    test('returns fallback for invalid date string', () => {
      const fallback = new Date('2024-01-01');
      expect(parseDate('not-a-date', fallback)).toBe(fallback);
    });

    test('returns undefined for invalid date string without fallback', () => {
      expect(parseDate('not-a-date')).toBeUndefined();
    });
  });

  // ===========================================================================
  // parseEnum
  // ===========================================================================
  describe('parseEnum', () => {
    const allowed = ['active', 'inactive', 'pending'] as const;

    test('returns value if it is in allowed values', () => {
      expect(parseEnum('active', allowed)).toBe('active');
      expect(parseEnum('inactive', allowed)).toBe('inactive');
      expect(parseEnum('pending', allowed)).toBe('pending');
    });

    test('returns fallback for invalid value', () => {
      expect(parseEnum('unknown', allowed, 'active')).toBe('active');
    });

    test('returns undefined for invalid value without fallback', () => {
      expect(parseEnum('unknown', allowed)).toBeUndefined();
    });

    test('returns fallback for undefined/null/empty', () => {
      expect(parseEnum(undefined, allowed, 'active')).toBe('active');
      expect(parseEnum(null, allowed, 'active')).toBe('active');
      expect(parseEnum('', allowed, 'active')).toBe('active');
    });

    test('returns undefined for undefined without fallback', () => {
      expect(parseEnum(undefined, allowed)).toBeUndefined();
    });

    test('coerces value to string', () => {
      // If someone passes a number that happens to match
      expect(parseEnum(42, ['42', '43'] as const)).toBe('42');
    });
  });

  // ===========================================================================
  // schemaBuilder
  // ===========================================================================
  describe('schemaBuilder', () => {
    test('builds a schema with string field', () => {
      const schema = schemaBuilder()
        .string('name')
        .build();

      const result = schema.parse({ name: 'John' });
      expect((result as any).name).toBe('John');
    });

    test('string field uses default', () => {
      const schema = schemaBuilder()
        .string('name', { default: 'unknown' })
        .build();

      const result = schema.parse({});
      expect((result as any).name).toBe('unknown');
    });

    test('string field coerces non-string values', () => {
      const schema = schemaBuilder()
        .string('count')
        .build();

      const result = schema.parse({ count: 42 });
      expect((result as any).count).toBe('42');
    });

    test('builds a schema with number field', () => {
      const schema = schemaBuilder()
        .number('count')
        .build();

      const result = schema.parse({ count: '42' });
      expect((result as any).count).toBe(42);
    });

    test('number field uses default', () => {
      const schema = schemaBuilder()
        .number('count', { default: 10 })
        .build();

      const result = schema.parse({});
      expect((result as any).count).toBe(10);
    });

    test('number field clamps to min', () => {
      const schema = schemaBuilder()
        .number('count', { min: 1 })
        .build();

      const result = schema.parse({ count: -5 });
      expect((result as any).count).toBe(1);
    });

    test('number field clamps to max', () => {
      const schema = schemaBuilder()
        .number('count', { max: 100 })
        .build();

      const result = schema.parse({ count: 500 });
      expect((result as any).count).toBe(100);
    });

    test('builds a schema with boolean field', () => {
      const schema = schemaBuilder()
        .boolean('active')
        .build();

      const result = schema.parse({ active: 'true' });
      expect((result as any).active).toBe(true);
    });

    test('boolean field uses default', () => {
      const schema = schemaBuilder()
        .boolean('active', { default: true })
        .build();

      const result = schema.parse({});
      expect((result as any).active).toBe(true);
    });

    test('builds a schema with enum field', () => {
      const schema = schemaBuilder()
        .enum('status', ['active', 'inactive'])
        .build();

      const result = schema.parse({ status: 'active' });
      expect((result as any).status).toBe('active');
    });

    test('enum field uses default', () => {
      const schema = schemaBuilder()
        .enum('status', ['active', 'inactive'], { default: 'active' })
        .build();

      const result = schema.parse({});
      expect((result as any).status).toBe('active');
    });

    test('enum field rejects invalid values', () => {
      const schema = schemaBuilder()
        .enum('status', ['active', 'inactive'], { default: 'active' })
        .build();

      const result = schema.parse({ status: 'unknown' });
      expect((result as any).status).toBe('active');
    });

    test('builds a schema with array field', () => {
      const schema = schemaBuilder()
        .array('tags')
        .build();

      const result = schema.parse({ tags: 'a,b,c' });
      expect((result as any).tags).toEqual(['a', 'b', 'c']);
    });

    test('array field with number type', () => {
      const schema = schemaBuilder()
        .array('ids', { of: 'number' })
        .build();

      const result = schema.parse({ ids: '1,2,3' });
      expect((result as any).ids).toEqual([1, 2, 3]);
    });

    test('array field filters NaN when of=number', () => {
      const schema = schemaBuilder()
        .array('ids', { of: 'number' })
        .build();

      const result = schema.parse({ ids: '1,abc,3' });
      expect((result as any).ids).toEqual([1, 3]);
    });

    test('builds a complex schema with multiple fields', () => {
      const schema = schemaBuilder()
        .string('q')
        .number('page', { default: 1 })
        .boolean('includeInactive')
        .enum('status', ['active', 'inactive'], { default: 'active' })
        .array('tags')
        .build();

      const result = schema.parse({
        q: 'search term',
        page: '3',
        includeInactive: 'true',
        status: 'inactive',
        tags: 'react,vue',
      });

      expect((result as any).q).toBe('search term');
      expect((result as any).page).toBe(3);
      expect((result as any).includeInactive).toBe(true);
      expect((result as any).status).toBe('inactive');
      expect((result as any).tags).toEqual(['react', 'vue']);
    });

    test('handles null/undefined data input', () => {
      const schema = schemaBuilder()
        .string('name', { default: 'default' })
        .number('count', { default: 0 })
        .build();

      const result = schema.parse(null);

      expect((result as any).name).toBe('default');
      expect((result as any).count).toBe(0);
    });

    test('handles empty object input', () => {
      const schema = schemaBuilder()
        .string('name', { default: 'default' })
        .build();

      const result = schema.parse({});

      expect((result as any).name).toBe('default');
    });

    test('string field returns undefined for missing field without default', () => {
      const schema = schemaBuilder()
        .string('name')
        .build();

      const result = schema.parse({});
      expect((result as any).name).toBeUndefined();
    });

    test('safeParse returns success', () => {
      const schema = schemaBuilder()
        .string('name')
        .build();

      const result = schema.safeParse!({ name: 'John' });
      expect(result.success).toBe(true);
    });
  });
});
