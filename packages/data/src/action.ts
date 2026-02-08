/**
 * @ereo/data - Mutations (Actions)
 *
 * Handle form submissions and mutations with a simple, type-safe API.
 * Supports both FormData and JSON payloads with complex data types.
 */

import type { ActionArgs, ActionFunction, RouteParams } from '@ereo/core';
import { serializeLoaderData } from './loader';

/**
 * Parsed action body - can be any type when using JSON.
 */
export type ActionBody<T = unknown> = T;

/**
 * Extended action args with parsed body.
 */
export interface TypedActionArgs<TBody, P extends RouteParams = RouteParams> extends ActionArgs<P> {
  /** Parsed body data (from JSON or FormData) */
  body: TBody;
  /** Raw FormData (if content-type was form data) */
  formData?: FormData;
  /** Content type of the request */
  contentType: 'json' | 'form' | 'text' | 'unknown';
}

/**
 * Options for creating an action.
 */
export interface ActionOptions<T, P extends RouteParams = RouteParams> {
  /** Handle the form submission */
  handler: (args: ActionArgs<P> & { formData: FormData }) => T | Promise<T>;
  /** Validate form data before processing */
  validate?: (formData: FormData) => ValidationResult | Promise<ValidationResult>;
  /** Handle errors */
  onError?: (error: Error, args: ActionArgs<P>) => T | Response | Promise<T | Response>;
}

/**
 * Options for creating a typed action with complex data support.
 */
export interface TypedActionOptions<TBody, TResult, P extends RouteParams = RouteParams> {
  /** Handle the action with typed body */
  handler: (args: TypedActionArgs<TBody, P>) => TResult | Promise<TResult>;
  /** Validate the parsed body */
  validate?: (body: TBody) => ValidationResult | Promise<ValidationResult>;
  /** Transform/coerce the raw body before validation */
  transform?: (raw: unknown) => TBody;
  /** Handle errors */
  onError?: (error: Error, args: ActionArgs<P>) => TResult | Response | Promise<TResult | Response>;
  /** Schema for automatic validation (compatible with zod, yup, etc.) */
  schema?: {
    parse: (data: unknown) => TBody;
    safeParse?: (data: unknown) => { success: true; data: TBody } | { success: false; error: { errors: Array<{ path: (string | number)[]; message: string }> } };
  };
}

/**
 * Validation result.
 */
export interface ValidationResult {
  success: boolean;
  errors?: Record<string, string[]>;
}

/**
 * Action result with potential errors.
 */
export interface ActionResult<T = unknown> {
  success: boolean;
  data?: T;
  errors?: Record<string, string[]>;
}

/**
 * Create a type-safe action function.
 *
 * Accepts either a plain async function (shorthand) or an options object
 * with validation, error handling, and automatic FormData parsing.
 *
 * @example
 * // Shorthand — just pass a function directly
 * export const action = createAction(async ({ request }) => {
 *   const formData = await request.formData();
 *   const title = formData.get('title');
 *   await db.post.create({ data: { title } });
 *   return redirect('/posts');
 * });
 *
 * @example
 * // Full options — with validation and auto-parsed FormData
 * export const action = createAction({
 *   handler: async ({ formData }) => {
 *     const title = formData.get('title');
 *     return db.post.create({ data: { title } });
 *   },
 *   validate: (formData) => {
 *     const errors: Record<string, string[]> = {};
 *     if (!formData.get('title')) {
 *       errors.title = ['Title is required'];
 *     }
 *     return { success: Object.keys(errors).length === 0, errors };
 *   },
 * });
 */
export function createAction<T, P extends RouteParams = RouteParams>(
  fn: (args: ActionArgs<P>) => T | Promise<T>
): ActionFunction<T, P>;
export function createAction<T, P extends RouteParams = RouteParams>(
  options: ActionOptions<T, P>
): ActionFunction<ActionResult<T>, P>;
export function createAction<T, P extends RouteParams = RouteParams>(
  optionsOrFn: ActionOptions<T, P> | ((args: ActionArgs<P>) => T | Promise<T>)
): ActionFunction<T, P> | ActionFunction<ActionResult<T>, P> {
  // Shorthand: createAction(async (args) => { ... })
  if (typeof optionsOrFn === 'function') {
    return optionsOrFn;
  }

  const options = optionsOrFn;

  return async (args: ActionArgs<P>): Promise<ActionResult<T>> => {
    const { request } = args;

    // Parse form data
    const formData = await request.formData();

    // Validate if validator provided
    if (options.validate) {
      const validation = await options.validate(formData);
      if (!validation.success) {
        return {
          success: false,
          errors: validation.errors,
        };
      }
    }

    try {
      // Execute handler
      const data = await options.handler({ ...args, formData });
      return { success: true, data };
    } catch (error) {
      if (options.onError && error instanceof Error) {
        const result = await options.onError(error, args);
        if (result instanceof Response) {
          throw result;
        }
        return { success: true, data: result };
      }

      // Re-throw for error boundary handling
      throw error;
    }
  };
}

/**
 * Create a simple action from a handler function.
 */
export function action<T, P extends RouteParams = RouteParams>(
  handler: (args: ActionArgs<P> & { formData: FormData }) => T | Promise<T>
): ActionFunction<ActionResult<T>, P> {
  return createAction({ handler });
}

/**
 * Create a typed action that accepts complex data types.
 * Automatically handles JSON and FormData content types.
 *
 * @example
 * // With inline type
 * export const action = typedAction<{ title: string; count: number; tags: string[] }>({
 *   handler: async ({ body }) => {
 *     // body is typed as { title: string; count: number; tags: string[] }
 *     return db.post.create({ data: body });
 *   },
 * });
 *
 * @example
 * // With zod schema
 * const PostSchema = z.object({
 *   title: z.string().min(1),
 *   count: z.number(),
 *   tags: z.array(z.string()),
 * });
 *
 * export const action = typedAction({
 *   schema: PostSchema,
 *   handler: async ({ body }) => {
 *     // body is inferred from schema
 *     return db.post.create({ data: body });
 *   },
 * });
 */
export function typedAction<TBody, TResult = TBody, P extends RouteParams = RouteParams>(
  options: TypedActionOptions<TBody, TResult, P>
): ActionFunction<ActionResult<TResult>, P> {
  return async (args: ActionArgs<P>): Promise<ActionResult<TResult>> => {
    const { request } = args;

    try {
      // Parse body based on content type
      const { body: rawBody, formData, contentType } = await parseRequestBody(request);

      // Transform if provided
      let body: TBody;
      if (options.transform) {
        body = options.transform(rawBody);
      } else if (options.schema) {
        // Use schema for parsing/validation
        if (options.schema.safeParse) {
          const result = options.schema.safeParse(rawBody);
          if (!result.success) {
            const errors: Record<string, string[]> = {};
            for (const err of result.error.errors) {
              const path = err.path.join('.') || '_root';
              if (!errors[path]) errors[path] = [];
              errors[path].push(err.message);
            }
            return { success: false, errors };
          }
          body = result.data;
        } else {
          body = options.schema.parse(rawBody);
        }
      } else {
        body = rawBody as TBody;
      }

      // Validate if validator provided
      if (options.validate) {
        const validation = await options.validate(body);
        if (!validation.success) {
          return { success: false, errors: validation.errors };
        }
      }

      // Execute handler
      const typedArgs: TypedActionArgs<TBody, P> = {
        ...args,
        body,
        formData,
        contentType,
      };

      const data = await options.handler(typedArgs);
      return { success: true, data };
    } catch (error) {
      if (options.onError && error instanceof Error) {
        const result = await options.onError(error, args);
        if (result instanceof Response) {
          throw result;
        }
        return { success: true, data: result };
      }
      throw error;
    }
  };
}

/**
 * Parse request body based on content type.
 * Supports JSON, FormData, and text.
 */
export async function parseRequestBody(
  request: Request
): Promise<{ body: unknown; formData?: FormData; contentType: 'json' | 'form' | 'text' | 'unknown' }> {
  const contentType = request.headers.get('Content-Type') || '';

  if (contentType.includes('application/json')) {
    const body = await request.json();
    return { body, contentType: 'json' };
  }

  if (contentType.includes('multipart/form-data') || contentType.includes('application/x-www-form-urlencoded')) {
    const formData = await request.formData();
    const body = formDataToObject(formData);
    return { body, formData, contentType: 'form' };
  }

  if (contentType.includes('text/')) {
    const body = await request.text();
    return { body, contentType: 'text' };
  }

  // Try to parse as JSON, fallback to text
  try {
    const text = await request.text();
    const body = JSON.parse(text);
    return { body, contentType: 'json' };
  } catch {
    return { body: null, contentType: 'unknown' };
  }
}

/**
 * Convert FormData to a typed object with automatic type coercion.
 * Handles nested objects, arrays, numbers, booleans, and dates.
 *
 * Conventions:
 * - `field[]` or multiple same-name fields → array
 * - `field.nested` → nested object
 * - `field[0]`, `field[1]` → indexed array
 * - Values "true"/"false" → boolean (when coercing)
 * - Numeric strings → number (when coercing)
 * - ISO date strings → Date (when coercing)
 */
export function formDataToObject<T = Record<string, unknown>>(
  formData: FormData,
  options: { coerce?: boolean } = {}
): T {
  const { coerce = true } = options;
  const result: Record<string, unknown> = {};

  for (const [key, value] of formData.entries()) {
    // Skip File objects for now (handle separately if needed)
    if (typeof value === 'object' && value !== null && 'name' in value && 'size' in value) {
      setNestedValue(result, key, value);
      continue;
    }

    const coercedValue = coerce ? coerceValue(value) : value;
    setNestedValue(result, key, coercedValue);
  }

  return result as T;
}

/**
 * Set a nested value in an object using dot notation or bracket notation.
 * Supports: "a.b.c", "a[0]", "a[0].b", "tags[]"
 */
function setNestedValue(obj: Record<string, unknown>, path: string, value: unknown): void {
  // Handle array notation like "tags[]"
  if (path.endsWith('[]')) {
    const arrayPath = path.slice(0, -2);
    const existing = getNestedValue(obj, arrayPath);
    if (Array.isArray(existing)) {
      existing.push(value);
    } else {
      setNestedValueDirect(obj, arrayPath, [value]);
    }
    return;
  }

  // Parse path into segments
  const segments = parsePath(path);

  // Guard against prototype pollution
  for (const seg of segments) {
    if (typeof seg === 'string' && (seg === '__proto__' || seg === 'constructor' || seg === 'prototype')) {
      return;
    }
  }

  let current: Record<string, unknown> = obj;
  for (let i = 0; i < segments.length - 1; i++) {
    const segment = segments[i];
    const nextSegment = segments[i + 1];
    const isNextArray = typeof nextSegment === 'number';

    if (current[segment] === undefined) {
      current[segment] = isNextArray ? [] : {};
    }

    current = current[segment] as Record<string, unknown>;
  }

  const lastSegment = segments[segments.length - 1];

  // Handle multiple values with same key (convert to array)
  if (current[lastSegment] !== undefined && !Array.isArray(current[lastSegment])) {
    current[lastSegment] = [current[lastSegment], value];
  } else if (Array.isArray(current[lastSegment]) && typeof lastSegment === 'string') {
    (current[lastSegment] as unknown[]).push(value);
  } else {
    current[lastSegment] = value;
  }
}

/**
 * Parse a path string into segments.
 * "a.b[0].c" → ["a", "b", 0, "c"]
 */
function parsePath(path: string): (string | number)[] {
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
      // Find closing bracket
      const closeBracket = path.indexOf(']', i);
      if (closeBracket !== -1) {
        const indexStr = path.slice(i + 1, closeBracket);
        const index = parseInt(indexStr, 10);
        if (!isNaN(index)) {
          segments.push(index);
        } else if (indexStr) {
          segments.push(indexStr);
        }
        i = closeBracket;
      }
    } else {
      current += char;
    }
  }

  if (current) {
    segments.push(current);
  }

  return segments;
}

/**
 * Get a nested value from an object.
 */
function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  const segments = parsePath(path);
  let current: unknown = obj;

  for (const segment of segments) {
    if (current == null || typeof current !== 'object') {
      return undefined;
    }
    current = (current as Record<string | number, unknown>)[segment];
  }

  return current;
}

/**
 * Set a nested value directly without array handling.
 */
function setNestedValueDirect(obj: Record<string, unknown>, path: string, value: unknown): void {
  const segments = parsePath(path);
  let current: Record<string, unknown> = obj;

  for (let i = 0; i < segments.length - 1; i++) {
    const segment = segments[i];
    const nextSegment = segments[i + 1];
    const isNextArray = typeof nextSegment === 'number';

    if (current[segment] === undefined) {
      current[segment] = isNextArray ? [] : {};
    }

    current = current[segment] as Record<string, unknown>;
  }

  current[segments[segments.length - 1]] = value;
}

/**
 * Coerce a string value to appropriate type.
 */
export function coerceValue(value: string): unknown {
  // Boolean
  if (value === 'true') return true;
  if (value === 'false') return false;

  // Null/undefined
  if (value === 'null') return null;
  if (value === 'undefined') return undefined;

  // Number (including floats)
  if (value !== '' && !isNaN(Number(value)) && isFinite(Number(value))) {
    return Number(value);
  }

  // ISO Date (basic check)
  if (/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2})?/.test(value)) {
    const date = new Date(value);
    if (!isNaN(date.getTime())) {
      return date;
    }
  }

  // JSON objects/arrays
  if ((value.startsWith('{') && value.endsWith('}')) || (value.startsWith('[') && value.endsWith(']'))) {
    try {
      return JSON.parse(value);
    } catch {
      // Not valid JSON, return as string
    }
  }

  return value;
}

/**
 * Create a JSON action that only accepts JSON payloads.
 * Provides better type safety for API endpoints.
 *
 * @example
 * export const action = jsonAction<CreatePostInput, Post>({
 *   handler: async ({ body }) => {
 *     return db.post.create({ data: body });
 *   },
 * });
 */
export function jsonAction<TBody, TResult = TBody, P extends RouteParams = RouteParams>(
  options: Omit<TypedActionOptions<TBody, TResult, P>, 'transform'> & {
    /** Require JSON content type (returns 415 if not JSON) */
    strict?: boolean;
  }
): ActionFunction<ActionResult<TResult>, P> {
  return async (args: ActionArgs<P>): Promise<ActionResult<TResult>> => {
    const { request } = args;
    const contentType = request.headers.get('Content-Type') || '';

    if (options.strict && !contentType.includes('application/json')) {
      return {
        success: false,
        errors: { _request: ['Content-Type must be application/json'] },
      };
    }

    return typedAction<TBody, TResult, P>(options)(args);
  };
}

/**
 * Redirect response helper.
 * Accepts a status code or full ResponseInit for custom headers.
 */
export function redirect(url: string, init?: number | ResponseInit): Response {
  const status = typeof init === 'number' ? init : (init?.status ?? 302);
  const headers = new Headers(typeof init === 'object' ? init?.headers : undefined);
  headers.set('Location', url);
  return new Response(null, {
    ...(typeof init === 'object' ? init : undefined),
    status,
    headers,
  });
}

/**
 * Throw a redirect response.
 * The server catches thrown Responses and returns them directly.
 */
export function throwRedirect(url: string, init?: number | ResponseInit): never {
  throw redirect(url, init);
}

/**
 * XSS-safe data response helper.
 * Uses serializeLoaderData to escape dangerous characters.
 */
export function data<T>(value: T, init?: ResponseInit): Response {
  const headers = new Headers(init?.headers);
  if (!headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  return new Response(serializeLoaderData(value), {
    ...init,
    headers,
  });
}

/**
 * JSON response helper.
 */
export function json<T>(data: T, init?: ResponseInit): Response {
  const headers = new Headers(init?.headers);
  if (!headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  return new Response(JSON.stringify(data), {
    ...init,
    headers,
  });
}

/**
 * Error response helper.
 */
export function error(message: string, status = 500): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/**
 * Form data helper - convert FormData to typed object.
 */
export function parseFormData<T extends Record<string, unknown>>(
  formData: FormData
): Partial<T> {
  const result: Record<string, unknown> = {};

  for (const [key, value] of formData.entries()) {
    // Handle array fields (e.g., tags[])
    if (key.endsWith('[]')) {
      const arrayKey = key.slice(0, -2);
      if (!result[arrayKey]) {
        result[arrayKey] = [];
      }
      (result[arrayKey] as unknown[]).push(value);
    } else if (result[key] !== undefined) {
      // Convert to array if multiple values
      if (!Array.isArray(result[key])) {
        result[key] = [result[key]];
      }
      (result[key] as unknown[]).push(value);
    } else {
      result[key] = value;
    }
  }

  return result as Partial<T>;
}

/**
 * Validate that required fields are present.
 */
export function validateRequired(
  formData: FormData,
  fields: string[]
): ValidationResult {
  const errors: Record<string, string[]> = {};

  for (const field of fields) {
    const value = formData.get(field);
    if (!value || (typeof value === 'string' && value.trim() === '')) {
      errors[field] = [`${field} is required`];
    }
  }

  return {
    success: Object.keys(errors).length === 0,
    errors: Object.keys(errors).length > 0 ? errors : undefined,
  };
}

/**
 * Combine multiple validators.
 */
export function combineValidators(
  ...validators: Array<(formData: FormData) => ValidationResult | Promise<ValidationResult>>
): (formData: FormData) => Promise<ValidationResult> {
  return async (formData: FormData) => {
    const allErrors: Record<string, string[]> = {};

    for (const validator of validators) {
      const result = await validator(formData);
      if (!result.success && result.errors) {
        for (const [field, fieldErrors] of Object.entries(result.errors)) {
          if (!allErrors[field]) {
            allErrors[field] = [];
          }
          allErrors[field].push(...fieldErrors);
        }
      }
    }

    return {
      success: Object.keys(allErrors).length === 0,
      errors: Object.keys(allErrors).length > 0 ? allErrors : undefined,
    };
  };
}
