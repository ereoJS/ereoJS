/**
 * @areo/data - Mutations (Actions)
 *
 * Handle form submissions and mutations with a simple, type-safe API.
 * Supports both FormData and JSON payloads with complex data types.
 */
import type { ActionArgs, ActionFunction, RouteParams } from '@areo/core';
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
    handler: (args: ActionArgs<P> & {
        formData: FormData;
    }) => T | Promise<T>;
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
        safeParse?: (data: unknown) => {
            success: true;
            data: TBody;
        } | {
            success: false;
            error: {
                errors: Array<{
                    path: (string | number)[];
                    message: string;
                }>;
            };
        };
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
export declare function createAction<T, P extends RouteParams = RouteParams>(options: ActionOptions<T, P>): ActionFunction<ActionResult<T>, P>;
/**
 * Create a simple action from a handler function.
 */
export declare function action<T, P extends RouteParams = RouteParams>(handler: (args: ActionArgs<P> & {
    formData: FormData;
}) => T | Promise<T>): ActionFunction<ActionResult<T>, P>;
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
export declare function typedAction<TBody, TResult = TBody, P extends RouteParams = RouteParams>(options: TypedActionOptions<TBody, TResult, P>): ActionFunction<ActionResult<TResult>, P>;
/**
 * Parse request body based on content type.
 * Supports JSON, FormData, and text.
 */
export declare function parseRequestBody(request: Request): Promise<{
    body: unknown;
    formData?: FormData;
    contentType: 'json' | 'form' | 'text' | 'unknown';
}>;
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
export declare function formDataToObject<T = Record<string, unknown>>(formData: FormData, options?: {
    coerce?: boolean;
}): T;
/**
 * Coerce a string value to appropriate type.
 */
export declare function coerceValue(value: string): unknown;
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
export declare function jsonAction<TBody, TResult = TBody, P extends RouteParams = RouteParams>(options: Omit<TypedActionOptions<TBody, TResult, P>, 'transform'> & {
    /** Require JSON content type (returns 415 if not JSON) */
    strict?: boolean;
}): ActionFunction<ActionResult<TResult>, P>;
/**
 * Redirect response helper.
 */
export declare function redirect(url: string, status?: 301 | 302 | 303 | 307 | 308): Response;
/**
 * JSON response helper.
 */
export declare function json<T>(data: T, init?: ResponseInit): Response;
/**
 * Error response helper.
 */
export declare function error(message: string, status?: number): Response;
/**
 * Form data helper - convert FormData to typed object.
 */
export declare function parseFormData<T extends Record<string, unknown>>(formData: FormData): Partial<T>;
/**
 * Validate that required fields are present.
 */
export declare function validateRequired(formData: FormData, fields: string[]): ValidationResult;
/**
 * Combine multiple validators.
 */
export declare function combineValidators(...validators: Array<(formData: FormData) => ValidationResult | Promise<ValidationResult>>): (formData: FormData) => Promise<ValidationResult>;
//# sourceMappingURL=action.d.ts.map