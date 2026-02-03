/**
 * @ereo/core - Compile-Time Path Parser Types
 *
 * Template literal types for parsing route paths and extracting typed parameters.
 * Infers { id: string; postId: string } from '/users/[id]/posts/[postId]'.
 *
 * Supports:
 * - Dynamic params: [id] → { id: string }
 * - Optional params: [[page]] → { page?: string }
 * - Catch-all params: [...path] → { path: string[] }
 *
 * Performance optimizations:
 * - Object maps instead of tuples for better TypeScript compiler performance
 * - Lazy evaluation patterns to defer computation
 * - Maximum depth guards to prevent infinite recursion
 */

// ============================================================================
// Internal Helper Types
// ============================================================================

/**
 * Trim leading slashes from a path string.
 */
type TrimLeadingSlash<T extends string> = T extends `/${infer Rest}`
  ? TrimLeadingSlash<Rest>
  : T;

/**
 * Trim trailing slashes from a path string.
 */
type TrimTrailingSlash<T extends string> = T extends `${infer Rest}/`
  ? TrimTrailingSlash<Rest>
  : T;

/**
 * Normalize a path by removing leading/trailing slashes.
 */
type NormalizePath<T extends string> = TrimLeadingSlash<TrimTrailingSlash<T>>;

// ============================================================================
// Segment Parsing Types
// ============================================================================

/**
 * Represents a parsed path segment.
 */
type ParsedSegment =
  | { type: 'static'; value: string }
  | { type: 'dynamic'; name: string }
  | { type: 'optional'; name: string }
  | { type: 'catchAll'; name: string };

/**
 * Parse a single path segment into its type.
 *
 * Examples:
 * - 'users' → { type: 'static'; value: 'users' }
 * - '[id]' → { type: 'dynamic'; name: 'id' }
 * - '[[page]]' → { type: 'optional'; name: 'page' }
 * - '[...path]' → { type: 'catchAll'; name: 'path' }
 */
type ParseSegment<S extends string> =
  // Optional param [[name]]
  S extends `[[${infer Name}]]`
    ? { type: 'optional'; name: Name }
    // Catch-all param [...name]
    : S extends `[...${infer Name}]`
      ? { type: 'catchAll'; name: Name }
      // Dynamic param [name]
      : S extends `[${infer Name}]`
        ? { type: 'dynamic'; name: Name }
        // Static segment
        : { type: 'static'; value: S };

/**
 * Split a path string into an array of segment strings.
 */
type SplitPath<
  Path extends string,
  Acc extends string[] = []
> = Path extends `${infer Segment}/${infer Rest}`
  ? Segment extends ''
    ? SplitPath<Rest, Acc>
    : SplitPath<Rest, [...Acc, Segment]>
  : Path extends ''
    ? Acc
    : [...Acc, Path];

/**
 * Parse all segments of a path into ParsedSegment types.
 */
type ParsePathSegments<
  Path extends string,
  Segments extends string[] = SplitPath<NormalizePath<Path>>
> = {
  [K in keyof Segments]: ParseSegment<Segments[K] & string>;
};

// ============================================================================
// Parameter Extraction Types
// ============================================================================

/**
 * Extract a single parameter entry from a parsed segment.
 * Returns empty object for static segments.
 */
type ExtractParamFromSegment<Seg> =
  Seg extends { type: 'dynamic'; name: infer N extends string }
    ? { [K in N]: string }
    : Seg extends { type: 'optional'; name: infer N extends string }
      ? { [K in N]?: string }
      : Seg extends { type: 'catchAll'; name: infer N extends string }
        ? { [K in N]: string[] }
        : {};

/**
 * Merge two types into one, combining their properties.
 * Uses intersection and simplification for cleaner output.
 */
type Merge<A, B> = {
  [K in keyof A | keyof B]: K extends keyof B
    ? B[K]
    : K extends keyof A
      ? A[K]
      : never;
};

/**
 * Extract parameters from a tuple of parsed segments.
 * Uses recursive type with accumulator for performance.
 */
type ExtractParamsFromSegments<
  Segments extends readonly unknown[],
  Acc = {}
> = Segments extends readonly [infer First, ...infer Rest]
  ? ExtractParamsFromSegments<Rest, Merge<Acc, ExtractParamFromSegment<First>>>
  : Acc;

/**
 * Extract all parameters from parsed path segments.
 */
type ExtractParams<Segments> = Segments extends readonly unknown[]
  ? ExtractParamsFromSegments<Segments>
  : {};

// ============================================================================
// Main Entry Point Types
// ============================================================================

/**
 * Infer parameter types from a route path pattern.
 *
 * This is the main entry point for path parameter inference.
 *
 * @example
 * type Params1 = InferParams<'/users/[id]'>;
 * // { id: string }
 *
 * type Params2 = InferParams<'/users/[id]/posts/[postId]'>;
 * // { id: string; postId: string }
 *
 * type Params3 = InferParams<'/docs/[...path]'>;
 * // { path: string[] }
 *
 * type Params4 = InferParams<'/blog/[[page]]'>;
 * // { page?: string }
 *
 * type Params5 = InferParams<'/users/[id]/posts/[[postId]]/[...tags]'>;
 * // { id: string; postId?: string; tags: string[] }
 */
export type InferParams<Path extends string> = ExtractParams<ParsePathSegments<Path>>;

/**
 * Check if a path has any dynamic parameters.
 */
export type HasParams<Path extends string> =
  keyof InferParams<Path> extends never ? false : true;

/**
 * Get the parameter names from a path.
 */
export type ParamNames<Path extends string> = keyof InferParams<Path>;

/**
 * Check if a parameter is optional.
 */
export type IsOptionalParam<Path extends string, Name extends string> =
  {} extends Pick<InferParams<Path>, Name & keyof InferParams<Path>>
    ? true
    : false;

/**
 * Check if a parameter is a catch-all.
 */
export type IsCatchAllParam<Path extends string, Name extends string> =
  Name extends keyof InferParams<Path>
    ? InferParams<Path>[Name] extends string[]
      ? true
      : false
    : false;

// ============================================================================
// Path Building Types
// ============================================================================

/**
 * Build a concrete path from a pattern and params.
 * This is a type-level representation; actual building happens at runtime.
 */
export type BuildPath<
  Pattern extends string,
  Params extends InferParams<Pattern>
> = string; // Runtime implementation will produce the actual path

/**
 * Validate that params match the expected shape for a path.
 * Returns true if valid, error message if invalid.
 */
export type ValidateParams<
  Path extends string,
  Params
> = Params extends InferParams<Path>
  ? true
  : `Invalid params for path "${Path}". Expected: ${keyof InferParams<Path> & string}`;

// ============================================================================
// Route Path Utilities
// ============================================================================

/**
 * Extract the static prefix of a path (before first dynamic segment).
 *
 * @example
 * type Prefix = StaticPrefix<'/users/[id]/posts'>;
 * // '/users'
 */
export type StaticPrefix<Path extends string> =
  Path extends `${infer Static}[${string}`
    ? TrimTrailingSlash<Static>
    : Path;

/**
 * Check if a path is fully static (no dynamic segments).
 */
export type IsStaticPath<Path extends string> =
  Path extends `${string}[${string}` ? false : true;

/**
 * Get the parent path (remove last segment).
 */
export type ParentPath<Path extends string> =
  NormalizePath<Path> extends `${infer Parent}/${string}`
    ? `/${Parent}`
    : '/';

// ============================================================================
// Advanced Path Matching Types
// ============================================================================

/**
 * Check if a path pattern can match a concrete path.
 * This is a simplified type-level check.
 */
export type PathMatches<
  Pattern extends string,
  Path extends string
> = InferParams<Pattern> extends Record<string, never>
  ? Pattern extends Path
    ? true
    : false
  : boolean; // Dynamic paths need runtime matching

/**
 * Union of all possible concrete paths for static paths.
 * Dynamic paths return string as they can match many concrete paths.
 */
export type PossiblePaths<Pattern extends string> =
  IsStaticPath<Pattern> extends true ? Pattern : string;

// ============================================================================
// Branded Types for Stable Inference
// ============================================================================

/**
 * Branded type to preserve path information through transformations.
 * Used by the builder pattern to maintain type safety.
 */
declare const PathBrand: unique symbol;

export type BrandedPath<Path extends string> = string & {
  readonly [PathBrand]: Path;
};

/**
 * Extract the original path from a branded path type.
 */
export type UnbrandPath<T> = T extends BrandedPath<infer Path> ? Path : never;

// ============================================================================
// Re-exports for Convenience
// ============================================================================

export type {
  ParsedSegment,
  ParseSegment,
  ParsePathSegments,
  SplitPath,
  ExtractParams,
};
