import type { ValidatorFunction } from './types';

// ─── Core Validators ─────────────────────────────────────────────────────────

export function required(msg = 'This field is required'): ValidatorFunction {
  const fn: ValidatorFunction = (value) => {
    if (value === null || value === undefined || value === '') return msg;
    if (Array.isArray(value) && value.length === 0) return msg;
    return undefined;
  };
  fn._isRequired = true;
  return fn;
}

export function email(msg = 'Invalid email address'): ValidatorFunction<string> {
  return (value) => {
    if (!value) return undefined;
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(String(value)) ? undefined : msg;
  };
}

export function url(msg = 'Invalid URL'): ValidatorFunction<string> {
  return (value) => {
    if (!value) return undefined;
    try {
      new URL(String(value));
      return undefined;
    } catch {
      return msg;
    }
  };
}

export function date(msg = 'Invalid date'): ValidatorFunction<string> {
  return (value) => {
    if (!value) return undefined;
    const d = new Date(String(value));
    return isNaN(d.getTime()) ? msg : undefined;
  };
}

export function phone(msg = 'Invalid phone number'): ValidatorFunction<string> {
  return (value) => {
    if (!value) return undefined;
    const str = String(value);
    // Must contain at least 7 digits total, allows +, spaces, hyphens, parens
    const re = /^\+?[\d\s\-().]{7,}$/;
    const digitCount = (str.match(/\d/g) || []).length;
    return re.test(str) && digitCount >= 7 ? undefined : msg;
  };
}

// ─── Length / Range Validators ────────────────────────────────────────────────

export function minLength(n: number, msg?: string): ValidatorFunction<string> {
  return (value) => {
    if (!value) return undefined;
    return String(value).length >= n
      ? undefined
      : msg ?? `Must be at least ${n} characters`;
  };
}

export function maxLength(n: number, msg?: string): ValidatorFunction<string> {
  return (value) => {
    if (!value) return undefined;
    return String(value).length <= n
      ? undefined
      : msg ?? `Must be at most ${n} characters`;
  };
}

export function min(n: number, msg?: string): ValidatorFunction<number> {
  return (value) => {
    if (value === null || value === undefined || value === ('' as any)) return undefined;
    return Number(value) >= n
      ? undefined
      : msg ?? `Must be at least ${n}`;
  };
}

export function max(n: number, msg?: string): ValidatorFunction<number> {
  return (value) => {
    if (value === null || value === undefined || value === ('' as any)) return undefined;
    return Number(value) <= n
      ? undefined
      : msg ?? `Must be at most ${n}`;
  };
}

// ─── Pattern / Type Validators ───────────────────────────────────────────────

export function pattern(regex: RegExp, msg = 'Invalid format'): ValidatorFunction<string> {
  return (value) => {
    if (!value) return undefined;
    return regex.test(String(value)) ? undefined : msg;
  };
}

export function number(msg = 'Must be a number'): ValidatorFunction {
  return (value) => {
    if (value === null || value === undefined || value === '') return undefined;
    return isNaN(Number(value)) ? msg : undefined;
  };
}

export function integer(msg = 'Must be an integer'): ValidatorFunction {
  return (value) => {
    if (value === null || value === undefined || value === '') return undefined;
    return Number.isInteger(Number(value)) ? undefined : msg;
  };
}

export function positive(msg = 'Must be a positive number'): ValidatorFunction<number> {
  return (value) => {
    if (value === null || value === undefined || value === ('' as any)) return undefined;
    return Number(value) > 0 ? undefined : msg;
  };
}

// ─── Custom Validators ───────────────────────────────────────────────────────

export function custom<T = unknown>(
  fn: (value: T) => string | undefined,
  msg?: string
): ValidatorFunction<T> {
  return (value) => {
    const result = fn(value);
    if (result !== undefined) return result;
    return undefined;
  };
}

export function async<T = unknown>(
  fn: (value: T) => Promise<string | undefined>,
  opts?: { debounce?: number; message?: string }
): ValidatorFunction<T> {
  const validator: ValidatorFunction<T> = (value) => fn(value);
  validator._isAsync = true;
  if (opts?.debounce) validator._debounce = opts.debounce;
  return validator;
}

// ─── Cross-field Validators ──────────────────────────────────────────────────

export function matches(
  otherField: string,
  msg?: string
): ValidatorFunction {
  const validator: ValidatorFunction = (value, context) => {
    if (!context) return undefined;
    const other = context.getValue(otherField);
    return value === other ? undefined : msg ?? `Must match ${otherField}`;
  };
  validator._crossField = true;
  validator._dependsOnField = otherField;
  return validator;
}

// ─── Collection Validators ───────────────────────────────────────────────────

export function oneOf<T>(values: T[], msg?: string): ValidatorFunction<T> {
  return (value) => {
    if (value === null || value === undefined || value === ('' as any)) return undefined;
    return values.includes(value)
      ? undefined
      : msg ?? `Must be one of: ${values.join(', ')}`;
  };
}

export function notOneOf<T>(values: T[], msg?: string): ValidatorFunction<T> {
  return (value) => {
    if (value === null || value === undefined || value === ('' as any)) return undefined;
    return !values.includes(value)
      ? undefined
      : msg ?? `Must not be one of: ${values.join(', ')}`;
  };
}

// ─── File Validators ─────────────────────────────────────────────────────────

export function fileSize(maxBytes: number, msg?: string): ValidatorFunction {
  return (value) => {
    if (!value) return undefined;
    const file = value as File;
    if (!file.size) return undefined;
    return file.size <= maxBytes
      ? undefined
      : msg ?? `File must be less than ${Math.round(maxBytes / 1024)}KB`;
  };
}

export function fileType(types: string[], msg?: string): ValidatorFunction {
  return (value) => {
    if (!value) return undefined;
    const file = value as File;
    if (!file.type) return undefined;
    return types.some((t) => file.type.includes(t))
      ? undefined
      : msg ?? `File type must be: ${types.join(', ')}`;
  };
}

// ─── Composition ─────────────────────────────────────────────────────────────

export function compose<T = unknown>(
  ...rules: ValidatorFunction<T>[]
): ValidatorFunction<T> {
  const hasAsync = rules.some((r) => r._isAsync);

  const fn: ValidatorFunction<T> = hasAsync
    ? async (value, context) => {
        for (const rule of rules) {
          const result = await rule(value, context);
          if (result) return result;
        }
        return undefined;
      }
    : (value, context) => {
        for (const rule of rules) {
          const result = rule(value, context);
          if (result) return result;
        }
        return undefined;
      };
  fn._isAsync = hasAsync;
  fn._isRequired = rules.some((r) => r._isRequired);
  fn._crossField = rules.some((r) => r._crossField);
  const maxDebounce = rules.reduce((max, r) => Math.max(max, r._debounce ?? 0), 0);
  if (maxDebounce > 0) fn._debounce = maxDebounce;
  return fn;
}

export function when<T = unknown>(
  condition: (value: T, context?: any) => boolean,
  rule: ValidatorFunction<T>
): ValidatorFunction<T> {
  const fn: ValidatorFunction<T> = rule._isAsync
    ? async (value, context) => {
        if (!condition(value, context)) return undefined;
        return rule(value, context);
      }
    : (value, context) => {
        if (!condition(value, context)) return undefined;
        return rule(value, context);
      };
  fn._isAsync = rule._isAsync;
  fn._crossField = rule._crossField;
  return fn;
}

// ─── Short Alias ─────────────────────────────────────────────────────────────

export const v = {
  required,
  email,
  url,
  date,
  phone,
  minLength,
  maxLength,
  min,
  max,
  pattern,
  number,
  integer,
  positive,
  custom,
  async,
  matches,
  oneOf,
  notOneOf,
  fileSize,
  fileType,
  compose,
  when,
};
