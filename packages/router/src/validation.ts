/**
 * @areo/router - Parameter Validation
 *
 * Validates route params and search params against schemas.
 */

import type { ParamValidationSchema, SearchParamValidationSchema, RouteParams } from '@areo/core';

/** Validation error for parameters */
export class ParamValidationError extends Error {
  constructor(
    message: string,
    public field: string,
    public value: unknown
  ) {
    super(message);
    this.name = 'ParamValidationError';
  }
}

/** Validation result */
export interface ValidationResult<T> {
  valid: boolean;
  data?: T;
  errors?: ParamValidationError[];
}

/** Built-in validators */
export const validators = {
  /** String validator */
  string: (options: { min?: number; max?: number; regex?: RegExp } = {}) => ({
    parse: (value: string | string[] | undefined): string => {
      if (value === undefined) {
        throw new ParamValidationError('Value is required', 'value', value);
      }
      const str = Array.isArray(value) ? value[0] : value;
      if (typeof str !== 'string') {
        throw new ParamValidationError('Value must be a string', 'value', value);
      }
      if (options.min !== undefined && str.length < options.min) {
        throw new ParamValidationError(`String too short (min ${options.min})`, 'value', str);
      }
      if (options.max !== undefined && str.length > options.max) {
        throw new ParamValidationError(`String too long (max ${options.max})`, 'value', str);
      }
      if (options.regex && !options.regex.test(str)) {
        throw new ParamValidationError('String does not match pattern', 'value', str);
      }
      return str;
    },
  }),

  /** Number validator */
  number: (options: { min?: number; max?: number; integer?: boolean } = {}) => ({
    parse: (value: string | string[] | undefined): number => {
      if (value === undefined) {
        throw new ParamValidationError('Value is required', 'value', value);
      }
      const str = Array.isArray(value) ? value[0] : value;
      const num = Number(str);
      if (isNaN(num)) {
        throw new ParamValidationError('Value must be a number', 'value', value);
      }
      if (options.integer && !Number.isInteger(num)) {
        throw new ParamValidationError('Value must be an integer', 'value', num);
      }
      if (options.min !== undefined && num < options.min) {
        throw new ParamValidationError(`Number too small (min ${options.min})`, 'value', num);
      }
      if (options.max !== undefined && num > options.max) {
        throw new ParamValidationError(`Number too large (max ${options.max})`, 'value', num);
      }
      return num;
    },
  }),

  /** Integer validator (convenience) */
  int: (options: { min?: number; max?: number } = {}) =>
    validators.number({ ...options, integer: true }),

  /** Boolean validator */
  boolean: () => ({
    parse: (value: string | string[] | undefined): boolean => {
      if (value === undefined) {
        throw new ParamValidationError('Value is required', 'value', value);
      }
      const str = Array.isArray(value) ? value[0] : value;
      const lower = str.toLowerCase();
      if (lower === 'true' || lower === '1' || lower === 'yes') return true;
      if (lower === 'false' || lower === '0' || lower === 'no') return false;
      throw new ParamValidationError('Value must be a boolean', 'value', value);
    },
  }),

  /** Enum validator */
  enum: <T extends string>(values: T[]) => ({
    parse: (value: string | string[] | undefined): T => {
      if (value === undefined) {
        throw new ParamValidationError('Value is required', 'value', value);
      }
      const str = Array.isArray(value) ? value[0] : value;
      if (!values.includes(str as T)) {
        throw new ParamValidationError(
          `Value must be one of: ${values.join(', ')}`,
          'value',
          str
        );
      }
      return str as T;
    },
  }),

  /** Array validator */
  array: <T>(itemValidator: { parse: (value: string) => T }) => ({
    parse: (value: string | string[] | undefined): T[] => {
      if (value === undefined) {
        return [];
      }
      const arr = Array.isArray(value) ? value : [value];
      return arr.map((item) => itemValidator.parse(item));
    },
  }),

  /** Optional wrapper */
  optional: <T>(validator: { parse: (value: string | string[] | undefined) => T }) => ({
    parse: (value: string | string[] | undefined): T | undefined => {
      if (value === undefined) return undefined;
      return validator.parse(value);
    },
  }),

  /** Default value wrapper */
  default: <T>(validator: { parse: (value: string | string[] | undefined) => T }, defaultValue: T) => ({
    parse: (value: string | string[] | undefined): T => {
      if (value === undefined) return defaultValue;
      return validator.parse(value);
    },
  }),
};

/**
 * Validate route parameters against a schema.
 *
 * @param params Raw parameters from URL
 * @param schema Validation schema
 * @returns Validated parameters
 * @throws ParamValidationError if validation fails
 *
 * @example
 * const schema = {
 *   slug: validators.string({ regex: /^[a-z0-9-]+$/ }),
 *   id: validators.int({ min: 1 }),
 * };
 * const validated = validateParams(params, schema);
 */
export function validateParams<T extends ParamValidationSchema>(
  params: RouteParams,
  schema: T
): { [K in keyof T]: ReturnType<T[K]['parse']> } {
  const result: Record<string, unknown> = {};
  const errors: ParamValidationError[] = [];

  for (const [key, validator] of Object.entries(schema)) {
    try {
      result[key] = validator.parse(params[key]);
    } catch (error) {
      if (error instanceof ParamValidationError) {
        errors.push(new ParamValidationError(error.message, key, params[key]));
      } else {
        errors.push(new ParamValidationError(String(error), key, params[key]));
      }
    }
  }

  if (errors.length > 0) {
    const firstError = errors[0];
    throw new ParamValidationError(
      `Parameter validation failed: ${firstError.message}`,
      firstError.field,
      firstError.value
    );
  }

  return result as { [K in keyof T]: ReturnType<T[K]['parse']> };
}

/**
 * Safely validate parameters, returning result instead of throwing.
 */
export function safeValidateParams<T extends ParamValidationSchema>(
  params: RouteParams,
  schema: T
): ValidationResult<{ [K in keyof T]: ReturnType<T[K]['parse']> }> {
  try {
    const data = validateParams(params, schema);
    return { valid: true, data };
  } catch (error) {
    if (error instanceof ParamValidationError) {
      return { valid: false, errors: [error] };
    }
    return {
      valid: false,
      errors: [new ParamValidationError(String(error), 'unknown', params)],
    };
  }
}

/**
 * Validate search parameters against a schema.
 */
export function validateSearchParams<T extends SearchParamValidationSchema>(
  searchParams: URLSearchParams | string | Record<string, string | string[]>,
  schema: T
): Record<string, unknown> {
  // Convert input to Record
  let params: Record<string, string | string[]>;
  if (typeof searchParams === 'string') {
    const url = new URL(`http://localhost:3000?${searchParams}`);
    params = Object.fromEntries(url.searchParams.entries());
  } else if (searchParams instanceof URLSearchParams) {
    params = Object.fromEntries(searchParams.entries());
  } else {
    params = searchParams;
  }

  const result: Record<string, unknown> = {};

  for (const [key, validatorDef] of Object.entries(schema)) {
    const value = params[key];

    if (typeof validatorDef === 'function' || 'parse' in (validatorDef as object)) {
      // Simple validator
      const validator = validatorDef as { parse: (value: string | string[] | undefined) => unknown };
      result[key] = validator.parse(value);
    } else if ('default' in (validatorDef as object)) {
      // Validator with default
      const def = validatorDef as { default: unknown; validator?: { parse: (value: string | string[] | undefined) => unknown } };
      if (value === undefined) {
        result[key] = def.default;
      } else if (def.validator) {
        result[key] = def.validator.parse(value);
      } else {
        result[key] = value;
      }
    }
  }

  return result;
}

/**
 * Create a combined validator for params and search params.
 */
export function createRouteValidator<
  P extends ParamValidationSchema,
  S extends SearchParamValidationSchema
>(options: {
  params?: P;
  searchParams?: S;
}) {
  const validate = (routeParams: RouteParams, searchParams: URLSearchParams | string) => {
    const validatedParams = options.params
      ? validateParams(routeParams, options.params)
      : ({} as { [K in keyof P]: ReturnType<P[K]['parse']> });

    const validatedSearch = options.searchParams
      ? validateSearchParams(searchParams, options.searchParams)
      : ({} as Record<string, unknown>);

    return {
      params: validatedParams,
      searchParams: validatedSearch,
    };
  };

  return {
    validate,
    safeValidate: (routeParams: RouteParams, searchParams: URLSearchParams | string) => {
      try {
        return {
          valid: true as const,
          data: validate(routeParams, searchParams),
        };
      } catch (error) {
        return {
          valid: false as const,
          error: error instanceof ParamValidationError ? error : new ParamValidationError(String(error), 'unknown', null),
        };
      }
    },
  };
}

/** Match a param pattern against a value */
export function matchParamPattern(pattern: string, value: string): boolean {
  // Convert route param pattern to regex
  // [slug] -> matches any non-slash string
  // [...slug] -> matches any string including slashes
  // [[optional]] -> optional param

  if (pattern.startsWith('[...')) {
    // Catch-all: matches everything
    return true;
  }

  if (pattern.startsWith('[[') && pattern.endsWith(']]')) {
    // Optional param
    return value === '' || /^[^/]+$/.test(value);
  }

  if (pattern.startsWith('[') && pattern.endsWith(']')) {
    // Required param
    return /^[^/]+$/.test(value);
  }

  // Static segment - exact match
  return pattern === value;
}

/** Extract param names from a route path */
export function extractParamNames(path: string): string[] {
  const names: string[] = [];
  const segments = path.split('/');

  for (const segment of segments) {
    if (segment.startsWith('[...') && segment.endsWith(']')) {
      // Catch-all
      names.push(segment.slice(4, -1));
    } else if (segment.startsWith('[[[') && segment.endsWith(']]')) {
      // Optional catch-all
      names.push(segment.slice(3, -2));
    } else if (segment.startsWith('[[') && segment.endsWith(']]')) {
      // Optional param
      names.push(segment.slice(2, -2));
    } else if (segment.startsWith('[') && segment.endsWith(']')) {
      // Required param
      names.push(segment.slice(1, -1));
    }
  }

  return names;
}
