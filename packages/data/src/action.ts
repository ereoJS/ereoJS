/**
 * @oreo/data - Mutations (Actions)
 *
 * Handle form submissions and mutations with a simple, type-safe API.
 */

import type { ActionArgs, ActionFunction, RouteParams } from '@oreo/core';

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
 * @example
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
  options: ActionOptions<T, P>
): ActionFunction<ActionResult<T>, P> {
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
 * Redirect response helper.
 */
export function redirect(url: string, status: 301 | 302 | 303 | 307 | 308 = 302): Response {
  return new Response(null, {
    status,
    headers: { Location: url },
  });
}

/**
 * JSON response helper.
 */
export function json<T>(data: T, init?: ResponseInit): Response {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...init?.headers,
    },
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
