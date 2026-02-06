/**
 * @ereo/data - Route Definition Builder
 *
 * A builder pattern API that maintains stable type inference through chaining.
 * Solves TanStack Start's documented limitation where adding `head` breaks loader inference.
 *
 * Key features:
 * - Branded types preserve inference through the entire chain
 * - Each method returns a new builder with accumulated types
 * - No inference breakage when adding head/meta/middleware
 * - Compile-time path parameter inference
 *
 * @example
 * ```typescript
 * export const route = defineRoute('/users/[id]')
 *   .loader(async ({ params }) => {
 *     // params is typed as { id: string }
 *     return db.user.findUnique({ where: { id: params.id } });
 *   })
 *   .action(async ({ body }) => {
 *     // body is typed based on schema
 *     return { success: true };
 *   })
 *   .head(({ data }) => {
 *     // data is loader return type - NEVER breaks inference
 *     return { title: data.name };
 *   })
 *   .build();
 * ```
 */

import type {
  LoaderArgs,
  ActionArgs,
  AppContext,
  RouteParams,
  CacheOptions,
  MetaDescriptor,
  InferParams,
  RouteConfig,
  ShouldRevalidateFunction,
  ClientLoaderArgs,
  ClientLoaderFunction,
  ClientActionArgs,
  ClientActionFunction,
  LinkDescriptor,
  LinksFunction,
  MethodHandlerFunction,
  BeforeLoadFunction,
} from '@ereo/core';

// ============================================================================
// Branded Types for Stable Inference
// ============================================================================

/**
 * Brand symbol for route path type preservation.
 */
declare const RouteBrand: unique symbol;
declare const LoaderBrand: unique symbol;
declare const ActionBrand: unique symbol;

/**
 * Branded path type that preserves the path string through transformations.
 */
type BrandedRoutePath<Path extends string> = {
  readonly [RouteBrand]: Path;
};

/**
 * Branded loader type that preserves return type through transformations.
 */
type BrandedLoader<T> = {
  readonly [LoaderBrand]: T;
};

/**
 * Branded action type that preserves return type through transformations.
 */
type BrandedAction<T> = {
  readonly [ActionBrand]: T;
};

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Extended loader args with typed params.
 */
export interface TypedLoaderArgs<P extends RouteParams = RouteParams> extends LoaderArgs<P> {
  /** Validated search params (if schema provided) */
  searchParams?: Record<string, unknown>;
  /** Validated hash params (if schema provided) */
  hashParams?: Record<string, unknown>;
}

/**
 * Extended action args with typed body.
 */
export interface TypedActionArgs<TBody, P extends RouteParams = RouteParams> extends ActionArgs<P> {
  /** Parsed and validated body */
  body: TBody;
  /** Raw form data (if applicable) */
  formData?: FormData;
}

/**
 * Head function args with loader data.
 */
export interface HeadArgs<TLoaderData, P extends RouteParams = RouteParams> {
  /** Loader data */
  data: TLoaderData;
  /** Route params */
  params: P;
  /** Request object */
  request: Request;
}

/**
 * Meta function args with loader data.
 */
export interface TypedMetaArgs<TLoaderData, P extends RouteParams = RouteParams> {
  /** Loader data */
  data: TLoaderData;
  /** Route params */
  params: P;
  /** Location info */
  location: { pathname: string; search: string; hash: string };
}

/**
 * Head function return type.
 */
export interface HeadData {
  title?: string;
  description?: string;
  canonical?: string;
  robots?: string;
  openGraph?: {
    title?: string;
    description?: string;
    image?: string;
    type?: string;
  };
  twitter?: {
    card?: 'summary' | 'summary_large_image' | 'app' | 'player';
    site?: string;
    creator?: string;
  };
  links?: Array<{ rel: string; href: string; [key: string]: string }>;
  scripts?: Array<{ src?: string; content?: string; type?: string }>;
}

/**
 * Middleware handler for route-level middleware.
 */
export type RouteMiddleware<P extends RouteParams = RouteParams> = (
  request: Request,
  context: AppContext,
  params: P,
  next: () => Promise<Response>
) => Response | Promise<Response>;

/**
 * Schema type for validation (compatible with Zod, Yup, etc.).
 */
export interface ValidationSchema<T> {
  parse: (data: unknown) => T;
  safeParse?: (data: unknown) => { success: true; data: T } | { success: false; error: unknown };
}

// ============================================================================
// Route Builder Types
// ============================================================================

/**
 * Route builder state tracking.
 */
interface RouteBuilderState<
  Path extends string,
  Params extends RouteParams,
  LoaderData,
  ActionData,
  ActionBody
> {
  path: Path;
  loader?: (args: TypedLoaderArgs<Params>) => LoaderData | Promise<LoaderData>;
  action?: (args: TypedActionArgs<ActionBody, Params>) => ActionData | Promise<ActionData>;
  head?: (args: HeadArgs<LoaderData, Params>) => HeadData;
  meta?: (args: TypedMetaArgs<LoaderData, Params>) => MetaDescriptor[];
  middleware?: RouteMiddleware<Params>[];
  searchParamsSchema?: ValidationSchema<unknown>;
  hashParamsSchema?: ValidationSchema<unknown>;
  actionBodySchema?: ValidationSchema<ActionBody>;
  shouldRevalidate?: ShouldRevalidateFunction;
  clientLoader?: ClientLoaderFunction;
  clientAction?: ClientActionFunction;
  links?: LinksFunction;
  config?: RouteConfig;
  cache?: CacheOptions;
  beforeLoad?: BeforeLoadFunction<Params>;
  methodHandlers?: Partial<Record<string, MethodHandlerFunction>>;
}

/**
 * Route builder with no loader defined yet.
 */
export interface RouteBuilder<
  Path extends string,
  Params extends RouteParams = InferParams<Path> extends RouteParams ? InferParams<Path> : RouteParams
> extends BrandedRoutePath<Path> {
  /**
   * Define the route's data loader.
   *
   * @example
   * .loader(async ({ params }) => {
   *   return db.user.findUnique({ where: { id: params.id } });
   * })
   */
  loader<TData>(
    fn: (args: TypedLoaderArgs<Params>) => TData | Promise<TData>
  ): RouteBuilderWithLoader<Path, Params, Awaited<TData>>;

  /**
   * Define search params validation schema.
   * Used for type-safe search param parsing.
   */
  searchParams<T>(
    schema: ValidationSchema<T>
  ): RouteBuilder<Path, Params>;

  /**
   * Define hash params validation schema.
   * This is UNIQUE to Ereo - TanStack has no hash param support.
   */
  hashParams<T>(
    schema: ValidationSchema<T>
  ): RouteBuilder<Path, Params>;

  /**
   * Add route-level middleware.
   */
  middleware(
    ...handlers: RouteMiddleware<Params>[]
  ): RouteBuilder<Path, Params>;

  /**
   * Set route configuration.
   */
  configure(config: RouteConfig): RouteBuilder<Path, Params>;

  /**
   * Control when this route's loader re-runs after navigations/mutations.
   */
  shouldRevalidate(fn: ShouldRevalidateFunction): RouteBuilder<Path, Params>;

  /**
   * Define a client-side loader (runs in browser).
   */
  clientLoader(fn: ClientLoaderFunction): RouteBuilder<Path, Params>;

  /**
   * Define a client-side action (runs in browser).
   */
  clientAction(fn: ClientActionFunction): RouteBuilder<Path, Params>;

  /**
   * Define per-route link descriptors (stylesheets, preloads, etc.).
   */
  links(fn: LinksFunction): RouteBuilder<Path, Params>;

  /**
   * Define a beforeLoad guard that runs before the loader.
   */
  beforeLoad(fn: BeforeLoadFunction<Params>): RouteBuilder<Path, Params>;

  /**
   * Define a GET method handler (API route).
   */
  get(fn: MethodHandlerFunction<unknown, Params>): RouteBuilder<Path, Params>;

  /**
   * Define a POST method handler (API route).
   */
  post(fn: MethodHandlerFunction<unknown, Params>): RouteBuilder<Path, Params>;

  /**
   * Define a PUT method handler (API route).
   */
  put(fn: MethodHandlerFunction<unknown, Params>): RouteBuilder<Path, Params>;

  /**
   * Define a DELETE method handler (API route).
   */
  delete(fn: MethodHandlerFunction<unknown, Params>): RouteBuilder<Path, Params>;

  /**
   * Define a PATCH method handler (API route).
   */
  patch(fn: MethodHandlerFunction<unknown, Params>): RouteBuilder<Path, Params>;

  /**
   * Build the route definition (no loader case).
   */
  build(): RouteDefinition<Path, Params, never, never, never>;
}

/**
 * Route builder after loader is defined.
 */
export interface RouteBuilderWithLoader<
  Path extends string,
  Params extends RouteParams,
  LoaderData
> extends BrandedRoutePath<Path>, BrandedLoader<LoaderData> {
  /**
   * Define the route's action handler.
   *
   * @example
   * .action(async ({ body, params }) => {
   *   await db.user.update({ where: { id: params.id }, data: body });
   *   return { success: true };
   * })
   */
  action<TBody = unknown, TResult = unknown>(
    fn: (args: TypedActionArgs<TBody, Params>) => TResult | Promise<TResult>,
    options?: { schema?: ValidationSchema<TBody> }
  ): RouteBuilderWithLoaderAndAction<Path, Params, LoaderData, Awaited<TResult>, TBody>;

  /**
   * Define the head/meta data generator.
   * CRITICAL: This NEVER breaks loader inference (TanStack limitation solved).
   *
   * @example
   * .head(({ data }) => ({
   *   title: data.user.name,
   *   description: data.user.bio,
   * }))
   */
  head(
    fn: (args: HeadArgs<LoaderData, Params>) => HeadData
  ): RouteBuilderWithLoader<Path, Params, LoaderData>;

  /**
   * Define the meta tags generator.
   * CRITICAL: This NEVER breaks loader inference (TanStack limitation solved).
   *
   * @example
   * .meta(({ data }) => [
   *   { title: data.user.name },
   *   { name: 'description', content: data.user.bio },
   * ])
   */
  meta(
    fn: (args: TypedMetaArgs<LoaderData, Params>) => MetaDescriptor[]
  ): RouteBuilderWithLoader<Path, Params, LoaderData>;

  /**
   * Set cache options for the loader.
   */
  cache(options: CacheOptions): RouteBuilderWithLoader<Path, Params, LoaderData>;

  /**
   * Add route-level middleware.
   */
  middleware(
    ...handlers: RouteMiddleware<Params>[]
  ): RouteBuilderWithLoader<Path, Params, LoaderData>;

  /**
   * Set route configuration.
   */
  configure(config: RouteConfig): RouteBuilderWithLoader<Path, Params, LoaderData>;

  /**
   * Control when this route's loader re-runs after navigations/mutations.
   */
  shouldRevalidate(fn: ShouldRevalidateFunction): RouteBuilderWithLoader<Path, Params, LoaderData>;

  /**
   * Define a client-side loader (runs in browser).
   */
  clientLoader(fn: ClientLoaderFunction): RouteBuilderWithLoader<Path, Params, LoaderData>;

  /**
   * Define a client-side action (runs in browser).
   */
  clientAction(fn: ClientActionFunction): RouteBuilderWithLoader<Path, Params, LoaderData>;

  /**
   * Define per-route link descriptors (stylesheets, preloads, etc.).
   */
  links(fn: LinksFunction): RouteBuilderWithLoader<Path, Params, LoaderData>;

  /**
   * Define a beforeLoad guard that runs before the loader.
   */
  beforeLoad(fn: BeforeLoadFunction<Params>): RouteBuilderWithLoader<Path, Params, LoaderData>;

  /**
   * Define a GET method handler (API route).
   */
  get(fn: MethodHandlerFunction<unknown, Params>): RouteBuilderWithLoader<Path, Params, LoaderData>;

  /**
   * Define a POST method handler (API route).
   */
  post(fn: MethodHandlerFunction<unknown, Params>): RouteBuilderWithLoader<Path, Params, LoaderData>;

  /**
   * Define a PUT method handler (API route).
   */
  put(fn: MethodHandlerFunction<unknown, Params>): RouteBuilderWithLoader<Path, Params, LoaderData>;

  /**
   * Define a DELETE method handler (API route).
   */
  delete(fn: MethodHandlerFunction<unknown, Params>): RouteBuilderWithLoader<Path, Params, LoaderData>;

  /**
   * Define a PATCH method handler (API route).
   */
  patch(fn: MethodHandlerFunction<unknown, Params>): RouteBuilderWithLoader<Path, Params, LoaderData>;

  /**
   * Build the route definition.
   */
  build(): RouteDefinition<Path, Params, LoaderData, never, never>;
}

/**
 * Route builder after both loader and action are defined.
 */
export interface RouteBuilderWithLoaderAndAction<
  Path extends string,
  Params extends RouteParams,
  LoaderData,
  ActionData,
  ActionBody
> extends BrandedRoutePath<Path>, BrandedLoader<LoaderData>, BrandedAction<ActionData> {
  /**
   * Define the head/meta data generator.
   */
  head(
    fn: (args: HeadArgs<LoaderData, Params>) => HeadData
  ): RouteBuilderWithLoaderAndAction<Path, Params, LoaderData, ActionData, ActionBody>;

  /**
   * Define the meta tags generator.
   */
  meta(
    fn: (args: TypedMetaArgs<LoaderData, Params>) => MetaDescriptor[]
  ): RouteBuilderWithLoaderAndAction<Path, Params, LoaderData, ActionData, ActionBody>;

  /**
   * Set cache options for the loader.
   */
  cache(options: CacheOptions): RouteBuilderWithLoaderAndAction<Path, Params, LoaderData, ActionData, ActionBody>;

  /**
   * Add route-level middleware.
   */
  middleware(
    ...handlers: RouteMiddleware<Params>[]
  ): RouteBuilderWithLoaderAndAction<Path, Params, LoaderData, ActionData, ActionBody>;

  /**
   * Set route configuration.
   */
  configure(config: RouteConfig): RouteBuilderWithLoaderAndAction<Path, Params, LoaderData, ActionData, ActionBody>;

  /**
   * Control when this route's loader re-runs after navigations/mutations.
   */
  shouldRevalidate(fn: ShouldRevalidateFunction): RouteBuilderWithLoaderAndAction<Path, Params, LoaderData, ActionData, ActionBody>;

  /**
   * Define a client-side loader (runs in browser).
   */
  clientLoader(fn: ClientLoaderFunction): RouteBuilderWithLoaderAndAction<Path, Params, LoaderData, ActionData, ActionBody>;

  /**
   * Define a client-side action (runs in browser).
   */
  clientAction(fn: ClientActionFunction): RouteBuilderWithLoaderAndAction<Path, Params, LoaderData, ActionData, ActionBody>;

  /**
   * Define per-route link descriptors (stylesheets, preloads, etc.).
   */
  links(fn: LinksFunction): RouteBuilderWithLoaderAndAction<Path, Params, LoaderData, ActionData, ActionBody>;

  /**
   * Define a beforeLoad guard that runs before the loader.
   */
  beforeLoad(fn: BeforeLoadFunction<Params>): RouteBuilderWithLoaderAndAction<Path, Params, LoaderData, ActionData, ActionBody>;

  /**
   * Define a GET method handler (API route).
   */
  get(fn: MethodHandlerFunction<unknown, Params>): RouteBuilderWithLoaderAndAction<Path, Params, LoaderData, ActionData, ActionBody>;

  /**
   * Define a POST method handler (API route).
   */
  post(fn: MethodHandlerFunction<unknown, Params>): RouteBuilderWithLoaderAndAction<Path, Params, LoaderData, ActionData, ActionBody>;

  /**
   * Define a PUT method handler (API route).
   */
  put(fn: MethodHandlerFunction<unknown, Params>): RouteBuilderWithLoaderAndAction<Path, Params, LoaderData, ActionData, ActionBody>;

  /**
   * Define a DELETE method handler (API route).
   */
  delete(fn: MethodHandlerFunction<unknown, Params>): RouteBuilderWithLoaderAndAction<Path, Params, LoaderData, ActionData, ActionBody>;

  /**
   * Define a PATCH method handler (API route).
   */
  patch(fn: MethodHandlerFunction<unknown, Params>): RouteBuilderWithLoaderAndAction<Path, Params, LoaderData, ActionData, ActionBody>;

  /**
   * Build the route definition.
   */
  build(): RouteDefinition<Path, Params, LoaderData, ActionData, ActionBody>;
}

// ============================================================================
// Route Definition Output
// ============================================================================

/**
 * Final route definition output.
 * Contains all the configured handlers and metadata.
 */
export interface RouteDefinition<
  Path extends string,
  Params extends RouteParams,
  LoaderData,
  ActionData,
  ActionBody
> {
  /** The route path pattern */
  path: Path;

  /** Loader function (if defined) */
  loader?: (args: LoaderArgs<Params>) => Promise<LoaderData>;

  /** Action function (if defined) */
  action?: (args: ActionArgs<Params>) => Promise<ActionData>;

  /** Head data generator */
  head?: (args: HeadArgs<LoaderData, Params>) => HeadData;

  /** Meta tags generator */
  meta?: (args: TypedMetaArgs<LoaderData, Params>) => MetaDescriptor[];

  /** Route-level middleware */
  middleware?: RouteMiddleware<Params>[];

  /** Route configuration */
  config?: RouteConfig;

  /** Cache options */
  cache?: CacheOptions;

  /** Controls when this route's loader re-runs */
  shouldRevalidate?: ShouldRevalidateFunction;

  /** Client-side loader (runs in browser) */
  clientLoader?: ClientLoaderFunction;

  /** Client-side action (runs in browser) */
  clientAction?: ClientActionFunction;

  /** Per-route link descriptors */
  links?: LinksFunction;

  /** Search params schema */
  searchParamsSchema?: ValidationSchema<unknown>;

  /** Hash params schema */
  hashParamsSchema?: ValidationSchema<unknown>;

  /** Action body schema */
  actionBodySchema?: ValidationSchema<ActionBody>;

  /** beforeLoad guard */
  beforeLoad?: BeforeLoadFunction<Params>;

  /** HTTP method handlers (API routes) */
  GET?: MethodHandlerFunction;
  POST?: MethodHandlerFunction;
  PUT?: MethodHandlerFunction;
  DELETE?: MethodHandlerFunction;
  PATCH?: MethodHandlerFunction;

  /** Type brands for external type inference */
  readonly _types: {
    path: Path;
    params: Params;
    loaderData: LoaderData;
    actionData: ActionData;
    actionBody: ActionBody;
  };
}

// ============================================================================
// Builder Implementation
// ============================================================================

/**
 * Create a route builder for a given path.
 *
 * This is the main entry point for defining type-safe routes.
 *
 * @example
 * ```typescript
 * // Basic usage
 * export const route = defineRoute('/users/[id]')
 *   .loader(async ({ params }) => {
 *     return db.user.findUnique({ where: { id: params.id } });
 *   })
 *   .build();
 *
 * // With action and head (NEVER breaks inference)
 * export const route = defineRoute('/posts/[slug]')
 *   .loader(async ({ params }) => {
 *     return db.post.findUnique({ where: { slug: params.slug } });
 *   })
 *   .action(async ({ body }) => {
 *     // Handle form submission
 *     return { success: true };
 *   })
 *   .head(({ data }) => ({
 *     title: data.title,  // Full type inference preserved!
 *     description: data.excerpt,
 *   }))
 *   .build();
 *
 * // Export parts for route module
 * export const { loader, action, meta } = route;
 * ```
 */
export function defineRoute<Path extends string>(
  path: Path
): RouteBuilder<Path, InferParams<Path> extends RouteParams ? InferParams<Path> : RouteParams> {
  type Params = InferParams<Path> extends RouteParams ? InferParams<Path> : RouteParams;

  const state: RouteBuilderState<Path, Params, unknown, unknown, unknown> = {
    path,
    middleware: [],
  };

  const createBuilder = (): RouteBuilder<Path, Params> => ({
    // Brand markers (runtime no-op, compile-time type info)
    [Symbol() as typeof RouteBrand]: path,

    loader<TData>(
      fn: (args: TypedLoaderArgs<Params>) => TData | Promise<TData>
    ): RouteBuilderWithLoader<Path, Params, Awaited<TData>> {
      state.loader = fn as typeof state.loader;
      return createBuilderWithLoader<Awaited<TData>>();
    },

    searchParams<T>(schema: ValidationSchema<T>) {
      state.searchParamsSchema = schema as ValidationSchema<unknown>;
      return createBuilder();
    },

    hashParams<T>(schema: ValidationSchema<T>) {
      state.hashParamsSchema = schema as ValidationSchema<unknown>;
      return createBuilder();
    },

    middleware(...handlers: RouteMiddleware<Params>[]) {
      state.middleware = [...(state.middleware || []), ...handlers];
      return createBuilder();
    },

    configure(config: RouteConfig) {
      state.config = config;
      return createBuilder();
    },

    shouldRevalidate(fn: ShouldRevalidateFunction) {
      state.shouldRevalidate = fn;
      return createBuilder();
    },

    clientLoader(fn: ClientLoaderFunction) {
      state.clientLoader = fn;
      return createBuilder();
    },

    clientAction(fn: ClientActionFunction) {
      state.clientAction = fn;
      return createBuilder();
    },

    links(fn: LinksFunction) {
      state.links = fn;
      return createBuilder();
    },

    beforeLoad(fn: BeforeLoadFunction<Params>) {
      state.beforeLoad = fn;
      return createBuilder();
    },

    get(fn: MethodHandlerFunction<unknown, Params>) {
      if (!state.methodHandlers) state.methodHandlers = {};
      state.methodHandlers.GET = fn as MethodHandlerFunction;
      return createBuilder();
    },

    post(fn: MethodHandlerFunction<unknown, Params>) {
      if (!state.methodHandlers) state.methodHandlers = {};
      state.methodHandlers.POST = fn as MethodHandlerFunction;
      return createBuilder();
    },

    put(fn: MethodHandlerFunction<unknown, Params>) {
      if (!state.methodHandlers) state.methodHandlers = {};
      state.methodHandlers.PUT = fn as MethodHandlerFunction;
      return createBuilder();
    },

    delete(fn: MethodHandlerFunction<unknown, Params>) {
      if (!state.methodHandlers) state.methodHandlers = {};
      state.methodHandlers.DELETE = fn as MethodHandlerFunction;
      return createBuilder();
    },

    patch(fn: MethodHandlerFunction<unknown, Params>) {
      if (!state.methodHandlers) state.methodHandlers = {};
      state.methodHandlers.PATCH = fn as MethodHandlerFunction;
      return createBuilder();
    },

    build(): RouteDefinition<Path, Params, never, never, never> {
      return {
        path,
        middleware: state.middleware,
        config: state.config,
        shouldRevalidate: state.shouldRevalidate,
        clientLoader: state.clientLoader,
        clientAction: state.clientAction,
        links: state.links,
        searchParamsSchema: state.searchParamsSchema,
        hashParamsSchema: state.hashParamsSchema,
        beforeLoad: state.beforeLoad,
        ...(state.methodHandlers || {}),
        _types: {} as RouteDefinition<Path, Params, never, never, never>['_types'],
      };
    },
  } as RouteBuilder<Path, Params>);

  const createBuilderWithLoader = <LoaderData>(): RouteBuilderWithLoader<Path, Params, LoaderData> => ({
    // Brand markers
    [Symbol() as typeof RouteBrand]: path,
    [Symbol() as typeof LoaderBrand]: {} as LoaderData,

    action<TBody = unknown, TResult = unknown>(
      fn: (args: TypedActionArgs<TBody, Params>) => TResult | Promise<TResult>,
      options?: { schema?: ValidationSchema<TBody> }
    ): RouteBuilderWithLoaderAndAction<Path, Params, LoaderData, Awaited<TResult>, TBody> {
      state.action = fn as typeof state.action;
      if (options?.schema) {
        state.actionBodySchema = options.schema as ValidationSchema<unknown>;
      }
      return createBuilderWithLoaderAndAction<LoaderData, Awaited<TResult>, TBody>();
    },

    head(fn: (args: HeadArgs<LoaderData, Params>) => HeadData) {
      state.head = fn as typeof state.head;
      return createBuilderWithLoader<LoaderData>();
    },

    meta(fn: (args: TypedMetaArgs<LoaderData, Params>) => MetaDescriptor[]) {
      state.meta = fn as typeof state.meta;
      return createBuilderWithLoader<LoaderData>();
    },

    cache(options: CacheOptions) {
      state.cache = options;
      return createBuilderWithLoader<LoaderData>();
    },

    middleware(...handlers: RouteMiddleware<Params>[]) {
      state.middleware = [...(state.middleware || []), ...handlers];
      return createBuilderWithLoader<LoaderData>();
    },

    configure(config: RouteConfig) {
      state.config = config;
      return createBuilderWithLoader<LoaderData>();
    },

    shouldRevalidate(fn: ShouldRevalidateFunction) {
      state.shouldRevalidate = fn;
      return createBuilderWithLoader<LoaderData>();
    },

    clientLoader(fn: ClientLoaderFunction) {
      state.clientLoader = fn;
      return createBuilderWithLoader<LoaderData>();
    },

    clientAction(fn: ClientActionFunction) {
      state.clientAction = fn;
      return createBuilderWithLoader<LoaderData>();
    },

    links(fn: LinksFunction) {
      state.links = fn;
      return createBuilderWithLoader<LoaderData>();
    },

    beforeLoad(fn: BeforeLoadFunction<Params>) {
      state.beforeLoad = fn;
      return createBuilderWithLoader<LoaderData>();
    },

    get(fn: MethodHandlerFunction<unknown, Params>) {
      if (!state.methodHandlers) state.methodHandlers = {};
      state.methodHandlers.GET = fn as MethodHandlerFunction;
      return createBuilderWithLoader<LoaderData>();
    },

    post(fn: MethodHandlerFunction<unknown, Params>) {
      if (!state.methodHandlers) state.methodHandlers = {};
      state.methodHandlers.POST = fn as MethodHandlerFunction;
      return createBuilderWithLoader<LoaderData>();
    },

    put(fn: MethodHandlerFunction<unknown, Params>) {
      if (!state.methodHandlers) state.methodHandlers = {};
      state.methodHandlers.PUT = fn as MethodHandlerFunction;
      return createBuilderWithLoader<LoaderData>();
    },

    delete(fn: MethodHandlerFunction<unknown, Params>) {
      if (!state.methodHandlers) state.methodHandlers = {};
      state.methodHandlers.DELETE = fn as MethodHandlerFunction;
      return createBuilderWithLoader<LoaderData>();
    },

    patch(fn: MethodHandlerFunction<unknown, Params>) {
      if (!state.methodHandlers) state.methodHandlers = {};
      state.methodHandlers.PATCH = fn as MethodHandlerFunction;
      return createBuilderWithLoader<LoaderData>();
    },

    build(): RouteDefinition<Path, Params, LoaderData, never, never> {
      return {
        path,
        loader: createWrappedLoader<LoaderData>(),
        head: state.head as RouteDefinition<Path, Params, LoaderData, never, never>['head'],
        meta: state.meta as RouteDefinition<Path, Params, LoaderData, never, never>['meta'],
        middleware: state.middleware,
        config: state.config,
        cache: state.cache,
        shouldRevalidate: state.shouldRevalidate,
        clientLoader: state.clientLoader,
        clientAction: state.clientAction,
        links: state.links,
        searchParamsSchema: state.searchParamsSchema,
        hashParamsSchema: state.hashParamsSchema,
        beforeLoad: state.beforeLoad,
        ...(state.methodHandlers || {}),
        _types: {} as RouteDefinition<Path, Params, LoaderData, never, never>['_types'],
      };
    },
  } as RouteBuilderWithLoader<Path, Params, LoaderData>);

  const createBuilderWithLoaderAndAction = <LoaderData, ActionData, ActionBody>(): RouteBuilderWithLoaderAndAction<
    Path,
    Params,
    LoaderData,
    ActionData,
    ActionBody
  > => ({
    // Brand markers
    [Symbol() as typeof RouteBrand]: path,
    [Symbol() as typeof LoaderBrand]: {} as LoaderData,
    [Symbol() as typeof ActionBrand]: {} as ActionData,

    head(fn: (args: HeadArgs<LoaderData, Params>) => HeadData) {
      state.head = fn as typeof state.head;
      return createBuilderWithLoaderAndAction<LoaderData, ActionData, ActionBody>();
    },

    meta(fn: (args: TypedMetaArgs<LoaderData, Params>) => MetaDescriptor[]) {
      state.meta = fn as typeof state.meta;
      return createBuilderWithLoaderAndAction<LoaderData, ActionData, ActionBody>();
    },

    cache(options: CacheOptions) {
      state.cache = options;
      return createBuilderWithLoaderAndAction<LoaderData, ActionData, ActionBody>();
    },

    middleware(...handlers: RouteMiddleware<Params>[]) {
      state.middleware = [...(state.middleware || []), ...handlers];
      return createBuilderWithLoaderAndAction<LoaderData, ActionData, ActionBody>();
    },

    configure(config: RouteConfig) {
      state.config = config;
      return createBuilderWithLoaderAndAction<LoaderData, ActionData, ActionBody>();
    },

    shouldRevalidate(fn: ShouldRevalidateFunction) {
      state.shouldRevalidate = fn;
      return createBuilderWithLoaderAndAction<LoaderData, ActionData, ActionBody>();
    },

    clientLoader(fn: ClientLoaderFunction) {
      state.clientLoader = fn;
      return createBuilderWithLoaderAndAction<LoaderData, ActionData, ActionBody>();
    },

    clientAction(fn: ClientActionFunction) {
      state.clientAction = fn;
      return createBuilderWithLoaderAndAction<LoaderData, ActionData, ActionBody>();
    },

    links(fn: LinksFunction) {
      state.links = fn;
      return createBuilderWithLoaderAndAction<LoaderData, ActionData, ActionBody>();
    },

    beforeLoad(fn: BeforeLoadFunction<Params>) {
      state.beforeLoad = fn;
      return createBuilderWithLoaderAndAction<LoaderData, ActionData, ActionBody>();
    },

    get(fn: MethodHandlerFunction<unknown, Params>) {
      if (!state.methodHandlers) state.methodHandlers = {};
      state.methodHandlers.GET = fn as MethodHandlerFunction;
      return createBuilderWithLoaderAndAction<LoaderData, ActionData, ActionBody>();
    },

    post(fn: MethodHandlerFunction<unknown, Params>) {
      if (!state.methodHandlers) state.methodHandlers = {};
      state.methodHandlers.POST = fn as MethodHandlerFunction;
      return createBuilderWithLoaderAndAction<LoaderData, ActionData, ActionBody>();
    },

    put(fn: MethodHandlerFunction<unknown, Params>) {
      if (!state.methodHandlers) state.methodHandlers = {};
      state.methodHandlers.PUT = fn as MethodHandlerFunction;
      return createBuilderWithLoaderAndAction<LoaderData, ActionData, ActionBody>();
    },

    delete(fn: MethodHandlerFunction<unknown, Params>) {
      if (!state.methodHandlers) state.methodHandlers = {};
      state.methodHandlers.DELETE = fn as MethodHandlerFunction;
      return createBuilderWithLoaderAndAction<LoaderData, ActionData, ActionBody>();
    },

    patch(fn: MethodHandlerFunction<unknown, Params>) {
      if (!state.methodHandlers) state.methodHandlers = {};
      state.methodHandlers.PATCH = fn as MethodHandlerFunction;
      return createBuilderWithLoaderAndAction<LoaderData, ActionData, ActionBody>();
    },

    build(): RouteDefinition<Path, Params, LoaderData, ActionData, ActionBody> {
      return {
        path,
        loader: createWrappedLoader<LoaderData>(),
        action: createWrappedAction<ActionData, ActionBody>(),
        head: state.head as RouteDefinition<Path, Params, LoaderData, ActionData, ActionBody>['head'],
        meta: state.meta as RouteDefinition<Path, Params, LoaderData, ActionData, ActionBody>['meta'],
        middleware: state.middleware,
        config: state.config,
        cache: state.cache,
        shouldRevalidate: state.shouldRevalidate,
        clientLoader: state.clientLoader,
        clientAction: state.clientAction,
        links: state.links,
        searchParamsSchema: state.searchParamsSchema,
        hashParamsSchema: state.hashParamsSchema,
        actionBodySchema: state.actionBodySchema as ValidationSchema<ActionBody>,
        beforeLoad: state.beforeLoad,
        ...(state.methodHandlers || {}),
        _types: {} as RouteDefinition<Path, Params, LoaderData, ActionData, ActionBody>['_types'],
      };
    },
  } as RouteBuilderWithLoaderAndAction<Path, Params, LoaderData, ActionData, ActionBody>);

  // Helper to create wrapped loader with cache and schema support
  const createWrappedLoader = <LoaderData>(): ((args: LoaderArgs<Params>) => Promise<LoaderData>) => {
    return async (args: LoaderArgs<Params>): Promise<LoaderData> => {
      // Apply cache options
      if (state.cache) {
        args.context.cache.set(state.cache);
      }

      // Parse search params if schema provided
      let searchParams: Record<string, unknown> | undefined;
      if (state.searchParamsSchema) {
        const url = new URL(args.request.url);
        const rawParams: Record<string, string | string[]> = {};
        url.searchParams.forEach((value, key) => {
          if (rawParams[key]) {
            const existing = rawParams[key];
            rawParams[key] = Array.isArray(existing) ? [...existing, value] : [existing, value];
          } else {
            rawParams[key] = value;
          }
        });
        searchParams = state.searchParamsSchema.parse(rawParams) as Record<string, unknown>;
      }

      // Parse hash params if schema provided
      let hashParams: Record<string, unknown> | undefined;
      if (state.hashParamsSchema) {
        const url = new URL(args.request.url);
        if (url.hash) {
          const hashSearchParams = new URLSearchParams(url.hash.slice(1));
          const rawParams: Record<string, string> = {};
          hashSearchParams.forEach((value, key) => {
            rawParams[key] = value;
          });
          hashParams = state.hashParamsSchema.parse(rawParams) as Record<string, unknown>;
        }
      }

      const typedArgs: TypedLoaderArgs<Params> = {
        ...args,
        searchParams,
        hashParams,
      };

      return state.loader!(typedArgs) as Promise<LoaderData>;
    };
  };

  // Helper to create wrapped action with schema support
  const createWrappedAction = <ActionData, ActionBody>(): ((args: ActionArgs<Params>) => Promise<ActionData>) => {
    return async (args: ActionArgs<Params>): Promise<ActionData> => {
      const { request } = args;
      const contentType = request.headers.get('Content-Type') || '';

      let body: ActionBody;
      let formData: FormData | undefined;

      // Parse body based on content type
      if (contentType.includes('application/json')) {
        const rawBody = await request.json();
        body = state.actionBodySchema ? state.actionBodySchema.parse(rawBody) : rawBody;
      } else if (contentType.includes('multipart/form-data') || contentType.includes('application/x-www-form-urlencoded')) {
        formData = await request.formData();
        const rawBody = formDataToObject(formData);
        body = state.actionBodySchema ? (state.actionBodySchema.parse(rawBody) as ActionBody) : (rawBody as ActionBody);
      } else {
        // Try JSON fallback
        try {
          const text = await request.text();
          const rawBody = JSON.parse(text);
          body = state.actionBodySchema ? state.actionBodySchema.parse(rawBody) : rawBody;
        } catch {
          body = {} as ActionBody;
        }
      }

      const typedArgs: TypedActionArgs<ActionBody, Params> = {
        ...args,
        body,
        formData,
      };

      return state.action!(typedArgs) as Promise<ActionData>;
    };
  };

  return createBuilder();
}

/**
 * Convert FormData to object (simple version).
 */
function formDataToObject(formData: FormData): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const [key, value] of formData.entries()) {
    if (key.endsWith('[]')) {
      const arrayKey = key.slice(0, -2);
      if (!result[arrayKey]) {
        result[arrayKey] = [];
      }
      (result[arrayKey] as unknown[]).push(value);
    } else if (result[key] !== undefined) {
      if (!Array.isArray(result[key])) {
        result[key] = [result[key]];
      }
      (result[key] as unknown[]).push(value);
    } else {
      result[key] = value;
    }
  }

  return result;
}

// ============================================================================
// Type Helpers for Extracting Types from Route Definitions
// ============================================================================

/**
 * Extract loader data type from a route definition.
 */
export type InferLoaderData<T> = T extends RouteDefinition<
  infer _Path,
  infer _Params,
  infer LoaderData,
  infer _ActionData,
  infer _ActionBody
>
  ? LoaderData
  : never;

/**
 * Extract action data type from a route definition.
 */
export type InferActionData<T> = T extends RouteDefinition<
  infer _Path,
  infer _Params,
  infer _LoaderData,
  infer ActionData,
  infer _ActionBody
>
  ? ActionData
  : never;

/**
 * Extract params type from a route definition.
 */
export type InferRouteParams<T> = T extends RouteDefinition<
  infer _Path,
  infer Params,
  infer _LoaderData,
  infer _ActionData,
  infer _ActionBody
>
  ? Params
  : never;

/**
 * Extract path type from a route definition.
 */
export type InferRoutePath<T> = T extends RouteDefinition<
  infer Path,
  infer _Params,
  infer _LoaderData,
  infer _ActionData,
  infer _ActionBody
>
  ? Path
  : never;
