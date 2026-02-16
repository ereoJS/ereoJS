/**
 * @ereo/data - Schema Adapters for Type Safety
 *
 * Wrappers that align Zod's runtime coercion with TypeScript types.
 * Solves the TanStack Start limitation where z.coerce types mismatch.
 *
 * Problem:
 * ```typescript
 * // In TanStack Start, this causes a type mismatch:
 * const schema = z.object({
 *   count: z.coerce.number()  // Runtime: number, but TS sees string input
 * });
 * ```
 *
 * Solution:
 * ```typescript
 * // Ereo's adapter aligns the types:
 * const schema = ereoSchema(z.object({
 *   count: z.coerce.number()  // Both runtime AND TypeScript see number
 * }));
 * ```
 */

// ============================================================================
// Generic Schema Interface
// ============================================================================

/**
 * Generic validation schema interface.
 * Compatible with Zod, Yup, Valibot, and other validation libraries.
 */
export interface ValidationSchema<TInput, TOutput = TInput> {
  /** Parse and validate input, throw on error */
  parse: (data: TInput) => TOutput;

  /** Parse and validate input, return result object */
  safeParse?: (
    data: TInput
  ) =>
    | { success: true; data: TOutput }
    | { success: false; error: ValidationError };
}

/**
 * Validation error shape.
 */
export interface ValidationError {
  errors: Array<{
    path: (string | number)[];
    message: string;
    code?: string;
  }>;
}

/**
 * Zod-compatible schema interface.
 */
export interface ZodLikeSchema<TOutput> {
  parse: (data: unknown) => TOutput;
  safeParse: (
    data: unknown
  ) =>
    | { success: true; data: TOutput }
    | { success: false; error: { errors: Array<{ path: (string | number)[]; message: string; code?: string }> } };
  _input?: unknown;
  _output?: TOutput;
}

// ============================================================================
// Ereo Schema Wrapper
// ============================================================================

/**
 * Wrapped schema that aligns input/output types.
 */
export interface EreoSchema<TOutput> {
  /** Parse and validate, throw on error */
  parse: (data: unknown) => TOutput;

  /** Parse and validate, return result */
  safeParse: (
    data: unknown
  ) =>
    | { success: true; data: TOutput }
    | { success: false; error: ValidationError };

  /** Original schema for introspection */
  _original: unknown;

  /** Type brand for identification */
  _ereoSchema: true;

  /** Inferred output type (for type extraction) */
  _output: TOutput;
}

/**
 * Wrap a Zod or compatible schema for proper type alignment.
 *
 * This wrapper ensures that:
 * 1. Coerced types (z.coerce.number()) are properly typed as their output type
 * 2. Transform types are properly typed as their transformed type
 * 3. Default values are reflected in the output type
 *
 * @example
 * ```typescript
 * import { z } from 'zod';
 * import { ereoSchema } from '@ereo/data';
 *
 * // Without ereoSchema - type mismatch with coerce
 * const rawSchema = z.object({
 *   count: z.coerce.number(),
 *   active: z.coerce.boolean(),
 * });
 * // TypeScript thinks input has string values
 *
 * // With ereoSchema - types align correctly
 * const schema = ereoSchema(z.object({
 *   count: z.coerce.number(),
 *   active: z.coerce.boolean(),
 * }));
 * // TypeScript correctly sees { count: number; active: boolean }
 *
 * // Use in loader/action
 * export const route = defineRoute('/api/items')
 *   .searchParams(schema)
 *   .loader(async ({ searchParams }) => {
 *     // searchParams.count is number, not string!
 *     return { items: await db.items.findMany({ take: searchParams.count }) };
 *   })
 *   .build();
 * ```
 */
export function ereoSchema<TOutput>(
  schema: ZodLikeSchema<TOutput>
): EreoSchema<TOutput> {
  return {
    parse: (data: unknown): TOutput => {
      return schema.parse(data);
    },

    safeParse: (
      data: unknown
    ):
      | { success: true; data: TOutput }
      | { success: false; error: ValidationError } => {
      const result = schema.safeParse(data);

      if (result.success) {
        return { success: true, data: result.data };
      }

      return {
        success: false,
        error: {
          errors: result.error.errors.map((err) => ({
            path: err.path,
            message: err.message,
            ...(err.code !== undefined && { code: err.code }),
          })),
        },
      };
    },

    _original: schema,
    _ereoSchema: true as const,
    _output: {} as TOutput,
  };
}

/**
 * Check if a value is an EreoSchema.
 */
export function isEreoSchema<T>(value: unknown): value is EreoSchema<T> {
  return (
    typeof value === 'object' &&
    value !== null &&
    '_ereoSchema' in value &&
    (value as EreoSchema<T>)._ereoSchema === true
  );
}

// ============================================================================
// Type Extraction Utilities
// ============================================================================

/**
 * Extract the output type from a schema.
 */
export type InferSchemaOutput<T> = T extends EreoSchema<infer O>
  ? O
  : T extends ZodLikeSchema<infer O>
    ? O
    : T extends ValidationSchema<unknown, infer O>
      ? O
      : never;

/**
 * Extract the input type from a schema (before coercion/transform).
 */
export type InferSchemaInput<T> = T extends ZodLikeSchema<unknown>
  ? T extends { _input: infer I }
    ? I
    : unknown
  : unknown;

// ============================================================================
// Common Schema Patterns
// ============================================================================

/**
 * Schema for pagination search params.
 *
 * @example
 * ```typescript
 * const schema = paginationSchema();
 * // { page?: number; limit?: number; offset?: number }
 *
 * const schema = paginationSchema({ defaultLimit: 20, maxLimit: 100 });
 * ```
 */
export interface PaginationParams {
  page?: number;
  limit?: number;
  offset?: number;
}

export interface PaginationSchemaOptions {
  defaultPage?: number;
  defaultLimit?: number;
  maxLimit?: number;
}

/**
 * Create a pagination schema with sensible defaults.
 * Works with any Zod-compatible library.
 */
export function createPaginationParser(
  options: PaginationSchemaOptions = {}
): ValidationSchema<unknown, PaginationParams> {
  const { defaultPage = 1, defaultLimit = 10, maxLimit = 100 } = options;

  return {
    parse: (data: unknown): PaginationParams => {
      const input = data as Record<string, unknown>;

      const page = parseNumber(input.page, defaultPage);
      const limit = Math.min(parseNumber(input.limit, defaultLimit), maxLimit);
      const offset = parseNumber(input.offset, undefined);

      return {
        page: page > 0 ? page : defaultPage,
        limit: limit > 0 ? limit : defaultLimit,
        offset: offset !== undefined && offset >= 0 ? offset : undefined,
      };
    },

    safeParse: (
      data: unknown
    ):
      | { success: true; data: PaginationParams }
      | { success: false; error: ValidationError } => {
      try {
        const result = createPaginationParser(options).parse(data);
        return { success: true, data: result };
      } catch (error) {
        return {
          success: false,
          error: {
            errors: [
              {
                path: [],
                message: error instanceof Error ? error.message : 'Invalid pagination params',
              },
            ],
          },
        };
      }
    },
  };
}

/**
 * Schema for sort search params.
 *
 * @example
 * ```typescript
 * const schema = sortSchema(['name', 'createdAt', 'updatedAt']);
 * // { sortBy?: 'name' | 'createdAt' | 'updatedAt'; sortOrder?: 'asc' | 'desc' }
 * ```
 */
export interface SortParams<T extends string = string> {
  sortBy?: T;
  sortOrder?: 'asc' | 'desc';
}

export function createSortParser<T extends string>(
  allowedFields: T[],
  defaultField?: T,
  defaultOrder: 'asc' | 'desc' = 'asc'
): ValidationSchema<unknown, SortParams<T>> {
  return {
    parse: (data: unknown): SortParams<T> => {
      const input = data as Record<string, unknown>;

      const sortBy = allowedFields.includes(input.sortBy as T)
        ? (input.sortBy as T)
        : defaultField;

      const sortOrder =
        input.sortOrder === 'asc' || input.sortOrder === 'desc'
          ? input.sortOrder
          : defaultOrder;

      return { sortBy, sortOrder };
    },

    safeParse: (
      data: unknown
    ):
      | { success: true; data: SortParams<T> }
      | { success: false; error: ValidationError } => {
      try {
        const result = createSortParser(allowedFields, defaultField, defaultOrder).parse(data);
        return { success: true, data: result };
      } catch (error) {
        return {
          success: false,
          error: {
            errors: [
              {
                path: [],
                message: error instanceof Error ? error.message : 'Invalid sort params',
              },
            ],
          },
        };
      }
    },
  };
}

/**
 * Schema for filter search params.
 *
 * @example
 * ```typescript
 * const schema = filterSchema({
 *   status: ['active', 'inactive', 'pending'],
 *   category: ['tech', 'business', 'lifestyle'],
 * });
 * ```
 */
export interface FilterParams {
  [key: string]: string | string[] | undefined;
}

export function createFilterParser<T extends Record<string, string[]>>(
  allowedFilters: T
): ValidationSchema<unknown, { [K in keyof T]?: T[K][number] | T[K][number][] }> {
  type Result = { [K in keyof T]?: T[K][number] | T[K][number][] };

  return {
    parse: (data: unknown): Result => {
      const input = data as Record<string, unknown>;
      const result: Record<string, unknown> = {};

      for (const [key, allowedValues] of Object.entries(allowedFilters)) {
        const value = input[key];

        if (value === undefined) continue;

        if (Array.isArray(value)) {
          const validValues = value.filter((v) =>
            (allowedValues as string[]).includes(String(v))
          );
          if (validValues.length > 0) {
            result[key] = validValues;
          }
        } else if ((allowedValues as string[]).includes(String(value))) {
          result[key] = value;
        }
      }

      return result as Result;
    },

    safeParse: (
      data: unknown
    ):
      | { success: true; data: Result }
      | { success: false; error: ValidationError } => {
      try {
        const res = createFilterParser(allowedFilters).parse(data);
        return { success: true, data: res as Result };
      } catch (error) {
        return {
          success: false,
          error: {
            errors: [
              {
                path: [],
                message: error instanceof Error ? error.message : 'Invalid filter params',
              },
            ],
          },
        };
      }
    },
  };
}

// ============================================================================
// Coercion Utilities
// ============================================================================

/**
 * Parse a value as a number with fallback.
 */
function parseNumber(value: unknown, fallback: number): number;
function parseNumber(value: unknown, fallback: undefined): number | undefined;
function parseNumber(value: unknown, fallback: number | undefined): number | undefined {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }

  const num = Number(value);
  return isNaN(num) ? fallback : num;
}

/**
 * Parse a value as a boolean with fallback.
 */
export function parseBoolean(value: unknown, fallback = false): boolean {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }

  if (typeof value === 'boolean') {
    return value;
  }

  const str = String(value).toLowerCase();
  if (str === 'true' || str === '1' || str === 'yes') {
    return true;
  }
  if (str === 'false' || str === '0' || str === 'no') {
    return false;
  }

  return fallback;
}

/**
 * Parse a value as a string array.
 */
export function parseStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map(String);
  }

  if (typeof value === 'string') {
    // Handle comma-separated values
    if (value.includes(',')) {
      return value.split(',').map((s) => s.trim());
    }
    return [value];
  }

  return [];
}

/**
 * Parse a value as a date.
 */
export function parseDate(value: unknown, fallback?: Date): Date | undefined {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }

  if (value instanceof Date) {
    return isNaN(value.getTime()) ? fallback : value;
  }

  const date = new Date(String(value));
  return isNaN(date.getTime()) ? fallback : date;
}

/**
 * Parse a value as an enum member.
 */
export function parseEnum<T extends string>(
  value: unknown,
  allowedValues: readonly T[],
  fallback?: T
): T | undefined {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }

  const str = String(value) as T;
  return allowedValues.includes(str) ? str : fallback;
}

// ============================================================================
// Composable Schema Builder
// ============================================================================

/**
 * Simple schema builder for common use cases without Zod dependency.
 *
 * @example
 * ```typescript
 * const searchSchema = schemaBuilder()
 *   .string('q')
 *   .number('page', { default: 1 })
 *   .boolean('includeInactive')
 *   .enum('status', ['active', 'inactive', 'pending'])
 *   .build();
 * ```
 */
export function schemaBuilder(): SchemaBuilder<{}> {
  return new SchemaBuilderImpl<{}>({});
}

interface SchemaBuilder<T> {
  string<K extends string>(
    key: K,
    options?: { default?: string; optional?: boolean }
  ): SchemaBuilder<T & { [P in K]: string }>;

  number<K extends string>(
    key: K,
    options?: { default?: number; min?: number; max?: number }
  ): SchemaBuilder<T & { [P in K]: number }>;

  boolean<K extends string>(
    key: K,
    options?: { default?: boolean }
  ): SchemaBuilder<T & { [P in K]: boolean }>;

  enum<K extends string, E extends string>(
    key: K,
    values: readonly E[],
    options?: { default?: E }
  ): SchemaBuilder<T & { [P in K]: E }>;

  array<K extends string>(
    key: K,
    options?: { of?: 'string' | 'number' }
  ): SchemaBuilder<T & { [P in K]: string[] | number[] }>;

  build(): ValidationSchema<unknown, T>;
}

class SchemaBuilderImpl<T> implements SchemaBuilder<T> {
  constructor(private fields: Record<string, FieldConfig>) {}

  string<K extends string>(
    key: K,
    options?: { default?: string; optional?: boolean }
  ): SchemaBuilder<T & { [P in K]: string }> {
    return new SchemaBuilderImpl<T & { [P in K]: string }>({
      ...this.fields,
      [key]: { type: 'string', ...options },
    });
  }

  number<K extends string>(
    key: K,
    options?: { default?: number; min?: number; max?: number }
  ): SchemaBuilder<T & { [P in K]: number }> {
    return new SchemaBuilderImpl<T & { [P in K]: number }>({
      ...this.fields,
      [key]: { type: 'number', ...options },
    });
  }

  boolean<K extends string>(
    key: K,
    options?: { default?: boolean }
  ): SchemaBuilder<T & { [P in K]: boolean }> {
    return new SchemaBuilderImpl<T & { [P in K]: boolean }>({
      ...this.fields,
      [key]: { type: 'boolean', ...options },
    });
  }

  enum<K extends string, E extends string>(
    key: K,
    values: readonly E[],
    options?: { default?: E }
  ): SchemaBuilder<T & { [P in K]: E }> {
    return new SchemaBuilderImpl<T & { [P in K]: E }>({
      ...this.fields,
      [key]: { type: 'enum', values: [...values] as string[], ...options },
    });
  }

  array<K extends string>(
    key: K,
    options?: { of?: 'string' | 'number' }
  ): SchemaBuilder<T & { [P in K]: string[] | number[] }> {
    return new SchemaBuilderImpl<T & { [P in K]: string[] | number[] }>({
      ...this.fields,
      [key]: { type: 'array', ...options },
    });
  }

  build(): ValidationSchema<unknown, T> {
    const fields = this.fields;

    return {
      parse: (data: unknown): T => {
        const input = (data || {}) as Record<string, unknown>;
        const result: Record<string, unknown> = {};

        for (const [key, config] of Object.entries(fields)) {
          const value = input[key];

          switch (config.type) {
            case 'string':
              result[key] =
                value !== undefined ? String(value) : config.default;
              break;

            case 'number': {
              const num = parseNumber(value, config.default as number);
              if (config.min !== undefined && num !== undefined && num < config.min) {
                result[key] = config.min;
              } else if (config.max !== undefined && num !== undefined && num > config.max) {
                result[key] = config.max;
              } else {
                result[key] = num;
              }
              break;
            }

            case 'boolean':
              result[key] = parseBoolean(value, config.default as boolean);
              break;

            case 'enum':
              result[key] = parseEnum(
                value,
                config.values as string[],
                config.default as string
              );
              break;

            case 'array': {
              const arr = parseStringArray(value);
              result[key] =
                config.of === 'number' ? arr.map(Number).filter((n) => !isNaN(n)) : arr;
              break;
            }
          }
        }

        return result as T;
      },

      safeParse: (
        data: unknown
      ):
        | { success: true; data: T }
        | { success: false; error: ValidationError } => {
        try {
          const parsed = new SchemaBuilderImpl<T>(fields).build().parse(data);
          return { success: true, data: parsed };
        } catch (error) {
          return {
            success: false,
            error: {
              errors: [
                {
                  path: [],
                  message: error instanceof Error ? error.message : 'Validation failed',
                },
              ],
            },
          };
        }
      },
    };
  }
}

interface FieldConfig {
  type: 'string' | 'number' | 'boolean' | 'enum' | 'array';
  default?: unknown;
  optional?: boolean;
  min?: number;
  max?: number;
  values?: string[];
  of?: 'string' | 'number';
}
