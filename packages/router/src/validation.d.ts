/**
 * @areo/router - Parameter Validation
 *
 * Validates route params and search params against schemas.
 */
import type { ParamValidationSchema, SearchParamValidationSchema, RouteParams } from '@areo/core';
/** Validation error for parameters */
export declare class ParamValidationError extends Error {
    field: string;
    value: unknown;
    constructor(message: string, field: string, value: unknown);
}
/** Validation result */
export interface ValidationResult<T> {
    valid: boolean;
    data?: T;
    errors?: ParamValidationError[];
}
/** Built-in validators */
export declare const validators: {
    /** String validator */
    string: (options?: {
        min?: number;
        max?: number;
        regex?: RegExp;
    }) => {
        parse: (value: string | string[] | undefined) => string;
    };
    /** Number validator */
    number: (options?: {
        min?: number;
        max?: number;
        integer?: boolean;
    }) => {
        parse: (value: string | string[] | undefined) => number;
    };
    /** Integer validator (convenience) */
    int: (options?: {
        min?: number;
        max?: number;
    }) => {
        parse: (value: string | string[] | undefined) => number;
    };
    /** Boolean validator */
    boolean: () => {
        parse: (value: string | string[] | undefined) => boolean;
    };
    /** Enum validator */
    enum: <T extends string>(values: T[]) => {
        parse: (value: string | string[] | undefined) => T;
    };
    /** Array validator */
    array: <T>(itemValidator: {
        parse: (value: string) => T;
    }) => {
        parse: (value: string | string[] | undefined) => T[];
    };
    /** Optional wrapper */
    optional: <T>(validator: {
        parse: (value: string | string[] | undefined) => T;
    }) => {
        parse: (value: string | string[] | undefined) => T | undefined;
    };
    /** Default value wrapper */
    default: <T>(validator: {
        parse: (value: string | string[] | undefined) => T;
    }, defaultValue: T) => {
        parse: (value: string | string[] | undefined) => T;
    };
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
export declare function validateParams<T extends ParamValidationSchema>(params: RouteParams, schema: T): {
    [K in keyof T]: ReturnType<T[K]['parse']>;
};
/**
 * Safely validate parameters, returning result instead of throwing.
 */
export declare function safeValidateParams<T extends ParamValidationSchema>(params: RouteParams, schema: T): ValidationResult<{
    [K in keyof T]: ReturnType<T[K]['parse']>;
}>;
/**
 * Validate search parameters against a schema.
 */
export declare function validateSearchParams<T extends SearchParamValidationSchema>(searchParams: URLSearchParams | string | Record<string, string | string[]>, schema: T): Record<string, unknown>;
/**
 * Create a combined validator for params and search params.
 */
export declare function createRouteValidator<P extends ParamValidationSchema, S extends SearchParamValidationSchema>(options: {
    params?: P;
    searchParams?: S;
}): {
    validate: (routeParams: RouteParams, searchParams: URLSearchParams | string) => {
        params: { [K in keyof P]: ReturnType<P[K]["parse"]>; };
        searchParams: Record<string, unknown>;
    };
    safeValidate: (routeParams: RouteParams, searchParams: URLSearchParams | string) => {
        valid: true;
        data: {
            params: { [K in keyof P]: ReturnType<P[K]["parse"]>; };
            searchParams: Record<string, unknown>;
        };
        error?: undefined;
    } | {
        valid: false;
        error: ParamValidationError;
        data?: undefined;
    };
};
/** Match a param pattern against a value */
export declare function matchParamPattern(pattern: string, value: string): boolean;
/** Extract param names from a route path */
export declare function extractParamNames(path: string): string[];
//# sourceMappingURL=validation.d.ts.map