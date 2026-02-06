import type { ValidationSchema, ValidatorFunction, CrossFieldValidationContext } from './types';
import { getPath } from './utils';

// ─── Standard Schema V1 Support ──────────────────────────────────────────

interface StandardSchemaV1<Input = unknown, Output = Input> {
  readonly '~standard': {
    readonly version: number;
    readonly vendor: string;
    readonly validate: (value: unknown) =>
      StandardResult<Output> | Promise<StandardResult<Output>>;
  };
}

type StandardResult<T> =
  | { readonly value: T; readonly issues?: undefined }
  | { readonly issues: ReadonlyArray<StandardIssue> };

interface StandardIssue {
  readonly message: string;
  readonly path?: ReadonlyArray<PropertyKey | { readonly key: PropertyKey }>;
}

export function isStandardSchema(value: unknown): value is StandardSchemaV1 {
  return value !== null && typeof value === 'object' && '~standard' in value;
}

function normalizePath(path?: ReadonlyArray<PropertyKey | { readonly key: PropertyKey }>): (string | number)[] {
  if (!path) return [];
  return path.map((segment) => {
    if (typeof segment === 'object' && segment !== null && 'key' in segment) {
      return typeof segment.key === 'number' ? segment.key : String(segment.key);
    }
    return typeof segment === 'number' ? segment : String(segment);
  });
}

export function standardSchemaAdapter<T>(schema: StandardSchemaV1<unknown, T>): ValidationSchema<unknown, T> {
  return {
    parse: (data) => {
      const result = schema['~standard'].validate(data);
      if (result instanceof Promise) {
        throw new Error('Async Standard Schema validation not supported in parse()');
      }
      if ('issues' in result && result.issues) {
        const msgs = result.issues.map(i => i.message).join(', ');
        throw new Error(msgs);
      }
      return (result as { value: T }).value;
    },
    safeParse: (data) => {
      const result = schema['~standard'].validate(data);
      if (result instanceof Promise) {
        throw new Error('Async Standard Schema validation not supported in safeParse()');
      }
      if ('issues' in result && result.issues) {
        return {
          success: false,
          error: {
            issues: result.issues.map(issue => ({
              path: normalizePath(issue.path),
              message: issue.message,
            })),
          },
        };
      }
      return { success: true, data: (result as { value: T }).value };
    },
  };
}

// ─── Zod Adapter ─────────────────────────────────────────────────────────────

export function zodAdapter<T>(zodSchema: {
  parse: (data: unknown) => T;
  safeParse: (data: unknown) => any;
}): ValidationSchema<unknown, T> {
  return {
    parse: (data) => zodSchema.parse(data),
    safeParse: (data) => {
      const result = zodSchema.safeParse(data);
      if (result.success) {
        return { success: true, data: result.data };
      }
      return {
        success: false,
        error: {
          issues: result.error.issues.map((issue: any) => ({
            path: issue.path,
            message: issue.message,
          })),
        },
      };
    },
  };
}

// ─── Valibot Adapter ─────────────────────────────────────────────────────────

export function valibotAdapter<T>(
  schema: unknown,
  parse: (schema: unknown, data: unknown) => T,
  safeParse: (schema: unknown, data: unknown) => any
): ValidationSchema<unknown, T> {
  return {
    parse: (data) => parse(schema, data),
    safeParse: (data) => {
      const result = safeParse(schema, data);
      if (result.success) {
        return { success: true, data: result.output };
      }
      return {
        success: false,
        error: {
          issues: (result.issues || []).map((issue: any) => ({
            path: (issue.path || []).map((p: any) => p.key),
            message: issue.message,
          })),
        },
      };
    },
  };
}

// ─── Plain Function Adapter ──────────────────────────────────────────────────

export function createSchemaValidator<T>(opts: {
  validate: (data: unknown) => { success: true; data: T } | { success: false; errors: Record<string, string[]> };
}): ValidationSchema<unknown, T> {
  return {
    parse: (data) => {
      const result = opts.validate(data);
      if (result.success) return result.data;
      throw new Error('Validation failed');
    },
    safeParse: (data) => {
      const result = opts.validate(data);
      if (result.success) {
        return { success: true, data: result.data };
      }
      return {
        success: false,
        error: {
          issues: Object.entries(result.errors).flatMap(([path, messages]) =>
            messages.map((message) => ({
              path: path.split('.'),
              message,
            }))
          ),
        },
      };
    },
  };
}

// ─── Ereo Schema DSL ─────────────────────────────────────────────────────────

const EREO_SCHEMA_MARKER = Symbol('ereo-schema');

interface EreoSchemaDefinition {
  [key: string]: ValidatorFunction | ValidatorFunction[] | EreoSchemaDefinition;
}

interface EreoSchema<T> extends ValidationSchema<unknown, T> {
  [EREO_SCHEMA_MARKER]: true;
}

export function ereoSchema<T>(definition: EreoSchemaDefinition): EreoSchema<T> {
  const schema: EreoSchema<T> = {
    [EREO_SCHEMA_MARKER]: true,
    parse: (data) => {
      const result = schema.safeParse!(data);
      if (result.success) return result.data;
      const messages = result.error.issues.map(
        (i: any) => `${i.path.join('.')}: ${i.message}`
      );
      throw new Error(`Validation failed:\n${messages.join('\n')}`);
    },
    safeParse: (data) => {
      const context: CrossFieldValidationContext<unknown> = {
        getValue: (path: string) => getPath(data, path),
        getValues: () => data,
      };
      const errors = validateDefinition(definition, data as Record<string, unknown>, '', context);
      if (errors.length === 0) {
        return { success: true, data: data as T };
      }
      return {
        success: false,
        error: { issues: errors },
      };
    },
  };
  return schema;
}

function validateDefinition(
  definition: EreoSchemaDefinition,
  data: Record<string, unknown>,
  basePath: string,
  context?: CrossFieldValidationContext<unknown>
): Array<{ path: (string | number)[]; message: string }> {
  const issues: Array<{ path: (string | number)[]; message: string }> = [];

  for (const [key, rule] of Object.entries(definition)) {
    const path = basePath ? `${basePath}.${key}` : key;
    const value = data?.[key];

    if (typeof rule === 'function') {
      // Skip async validators — they'll be handled by the validation engine at field level
      if (rule._isAsync) continue;
      const result = rule(value, context);
      if (typeof result === 'string') {
        issues.push({ path: path.split('.'), message: result });
      }
    } else if (Array.isArray(rule)) {
      for (const validator of rule) {
        if (typeof validator === 'function') {
          // Skip async validators
          if (validator._isAsync) continue;
          const result = validator(value, context);
          if (typeof result === 'string') {
            issues.push({ path: path.split('.'), message: result });
            break; // Stop on first error for this field
          }
        }
      }
    } else if (typeof rule === 'object' && rule !== null) {
      const nested = validateDefinition(
        rule as EreoSchemaDefinition,
        value as Record<string, unknown>,
        path,
        context
      );
      issues.push(...nested);
    }
  }

  return issues;
}

export function isEreoSchema(value: unknown): value is EreoSchema<unknown> {
  return (
    value !== null &&
    typeof value === 'object' &&
    EREO_SCHEMA_MARKER in (value as any)
  );
}

// ─── FormData Conversion ─────────────────────────────────────────────────────

export interface FormDataToObjectOptions {
  coerce?: boolean;
  arrays?: string[];
}

export function formDataToObject<T extends Record<string, any> = Record<string, any>>(
  formData: FormData,
  opts?: FormDataToObjectOptions
): T {
  const result: Record<string, any> = {};
  const arrayFields = new Set(opts?.arrays ?? []);

  for (const [key, value] of formData.entries()) {
    const isArray = key.endsWith('[]') || arrayFields.has(key);
    const cleanKey = key.replace(/\[\]$/, '');
    const coerced = opts?.coerce !== false ? coerceValue(value) : value;

    if (isArray) {
      if (!result[cleanKey]) result[cleanKey] = [];
      result[cleanKey].push(coerced);
    } else if (cleanKey.includes('.') || cleanKey.includes('[')) {
      setNestedValue(result, cleanKey, coerced);
    } else {
      result[cleanKey] = coerced;
    }
  }

  return result as T;
}

function coerceValue(value: FormDataEntryValue): unknown {
  if (value instanceof File) return value;
  const str = String(value);

  if (str === 'true') return true;
  if (str === 'false') return false;
  if (str === 'null') return null;
  if (str === '') return '';

  // Only coerce to number if it doesn't have leading zeros (preserves zip codes, IDs)
  const trimmed = str.trim();
  if (trimmed !== '' && !/^0\d/.test(trimmed)) {
    const num = Number(trimmed);
    if (!isNaN(num)) return num;
  }

  // ISO date detection
  if (/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})?)?$/.test(str)) {
    const d = new Date(str);
    if (!isNaN(d.getTime())) return d.toISOString();
  }

  return str;
}

function setNestedValue(
  obj: Record<string, any>,
  path: string,
  value: unknown
): void {
  const segments: (string | number)[] = [];
  let current = '';

  for (let i = 0; i < path.length; i++) {
    const char = path[i];
    if (char === '.') {
      if (current) {
        segments.push(current);
        current = '';
      }
    } else if (char === '[') {
      if (current) {
        segments.push(current);
        current = '';
      }
      const close = path.indexOf(']', i);
      if (close !== -1) {
        const idx = path.slice(i + 1, close);
        const num = parseInt(idx, 10);
        segments.push(!isNaN(num) ? num : idx);
        i = close;
      }
    } else {
      current += char;
    }
  }
  if (current) segments.push(current);

  let target: any = obj;
  for (let i = 0; i < segments.length - 1; i++) {
    const seg = segments[i];
    const nextSeg = segments[i + 1];
    if (target[seg] === undefined) {
      target[seg] = typeof nextSeg === 'number' ? [] : {};
    }
    target = target[seg];
  }
  target[segments[segments.length - 1]] = value;
}
