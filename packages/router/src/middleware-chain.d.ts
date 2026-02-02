/**
 * @areo/router - Middleware Chain Executor
 *
 * Executes route-level middleware chains with support for named middleware,
 * inline middleware functions, and type-safe context passing.
 */
import type { MiddlewareReference, MiddlewareHandler, AppContext, NextFunction, RouteConfig } from '@areo/core';
/**
 * Typed middleware context values.
 * Middleware can declare what values it adds to the context.
 */
export interface TypedMiddlewareContext {
    [key: string]: unknown;
}
/**
 * Typed middleware handler that declares its context additions.
 */
export type TypedMiddlewareHandler<TProvides extends TypedMiddlewareContext = {}, TRequires extends TypedMiddlewareContext = {}> = (request: Request, context: AppContext & TRequires, next: NextFunction) => Response | Promise<Response>;
/**
 * Typed middleware definition with metadata.
 */
export interface TypedMiddleware<TProvides extends TypedMiddlewareContext = {}, TRequires extends TypedMiddlewareContext = {}> {
    name: string;
    handler: TypedMiddlewareHandler<TProvides, TRequires>;
    /** Keys this middleware provides to the context */
    provides?: (keyof TProvides)[];
    /** Keys this middleware requires from the context */
    requires?: (keyof TRequires)[];
}
/**
 * Create a typed middleware with context type safety.
 *
 * @example
 * const authMiddleware = createMiddleware<{ user: User }>({
 *   name: 'auth',
 *   provides: ['user'],
 *   handler: async (req, ctx, next) => {
 *     const session = await getSession(req);
 *     if (!session) {
 *       return new Response('Unauthorized', { status: 401 });
 *     }
 *     ctx.set('user', session.user); // TypeScript knows 'user' is valid
 *     return next();
 *   },
 * });
 *
 * // In your loader:
 * export const loader = async ({ context }) => {
 *   const user = context.get<User>('user'); // Set by auth middleware
 * };
 */
export declare function createMiddleware<TProvides extends TypedMiddlewareContext = {}, TRequires extends TypedMiddlewareContext = {}>(config: TypedMiddleware<TProvides, TRequires>): TypedMiddleware<TProvides, TRequires> & {
    register: () => void;
};
/**
 * Chain multiple typed middleware together with type inference.
 *
 * @example
 * const protectedRoute = chainMiddleware(
 *   authMiddleware,    // provides: { user: User }
 *   adminMiddleware,   // requires: { user: User }, provides: { isAdmin: boolean }
 *   rateLimitMiddleware
 * );
 */
export declare function chainMiddleware<M1 extends TypedMiddleware<any, any>, M2 extends TypedMiddleware<any, any>>(m1: M1, m2: M2): TypedMiddleware<M1 extends TypedMiddleware<infer P1, any> ? (M2 extends TypedMiddleware<infer P2, any> ? P1 & P2 : P1) : {}, M1 extends TypedMiddleware<any, infer R1> ? R1 : {}>;
export declare function chainMiddleware<M1 extends TypedMiddleware<any, any>, M2 extends TypedMiddleware<any, any>, M3 extends TypedMiddleware<any, any>>(m1: M1, m2: M2, m3: M3): TypedMiddleware<any, any>;
/**
 * Register a named middleware in the global registry.
 *
 * @example
 * registerMiddleware('auth', async (req, ctx, next) => {
 *   if (!ctx.get('user')) {
 *     return new Response('Unauthorized', { status: 401 });
 *   }
 *   return next();
 * });
 */
export declare function registerMiddleware(name: string, handler: MiddlewareHandler): void;
/**
 * Register a typed middleware with metadata.
 */
export declare function registerTypedMiddleware<TProvides extends TypedMiddlewareContext, TRequires extends TypedMiddlewareContext>(middleware: TypedMiddleware<TProvides, TRequires>): void;
/**
 * Get typed middleware metadata.
 */
export declare function getTypedMiddleware(name: string): TypedMiddleware<any, any> | undefined;
/**
 * Validate middleware chain for type safety.
 * Ensures that all required context values are provided by preceding middleware.
 */
export declare function validateMiddlewareChain(names: string[]): {
    valid: boolean;
    errors: string[];
};
/**
 * Get a named middleware from the registry.
 */
export declare function getMiddleware(name: string): MiddlewareHandler | undefined;
/**
 * Check if a named middleware exists in the registry.
 */
export declare function hasMiddleware(name: string): boolean;
/**
 * Remove a named middleware from the registry.
 */
export declare function unregisterMiddleware(name: string): boolean;
/**
 * Clear all named middleware from the registry.
 */
export declare function clearMiddlewareRegistry(): void;
/**
 * Resolve a middleware reference to a handler function.
 * String references are looked up in the named middleware registry.
 */
export declare function resolveMiddleware(reference: MiddlewareReference): MiddlewareHandler | undefined;
/**
 * Options for executing a middleware chain.
 */
export interface MiddlewareChainOptions {
    /** Request object */
    request: Request;
    /** Application context */
    context: AppContext;
    /** Final handler to call when chain completes */
    finalHandler: NextFunction;
    /** Error handler for middleware errors */
    onError?: (error: Error) => Response | Promise<Response>;
}
/**
 * Execute a middleware chain.
 *
 * @param middleware Array of middleware references
 * @param options Chain execution options
 * @returns Response from the chain
 *
 * @example
 * const response = await executeMiddlewareChain(
 *   ['csrf', 'auth', customMiddleware],
 *   {
 *     request,
 *     context,
 *     finalHandler: async () => renderRoute(),
 *   }
 * );
 */
export declare function executeMiddlewareChain(middleware: MiddlewareReference[], options: MiddlewareChainOptions): Promise<Response>;
/**
 * Create a middleware chain executor bound to a route config.
 *
 * @param config Route configuration containing middleware array
 * @returns Function to execute the middleware chain
 *
 * @example
 * const executor = createMiddlewareExecutor(routeConfig);
 * const response = await executor({ request, context, finalHandler });
 */
export declare function createMiddlewareExecutor(config: RouteConfig): (options: Omit<MiddlewareChainOptions, "finalHandler"> & {
    finalHandler: NextFunction;
}) => Promise<Response>;
/**
 * Compose multiple middleware handlers into a single handler.
 */
export declare function composeMiddleware(...handlers: MiddlewareHandler[]): MiddlewareHandler;
/**
 * Create a conditional middleware that only runs when the predicate matches.
 */
export declare function when(predicate: (request: Request, context: AppContext) => boolean | Promise<boolean>, middleware: MiddlewareHandler): MiddlewareHandler;
/**
 * Create a middleware that only runs for specific HTTP methods.
 */
export declare function method(methods: string | string[], middleware: MiddlewareHandler): MiddlewareHandler;
/**
 * Convert a glob pattern to a RegExp.
 * Supports * (match anything except /) and ** (match anything including /).
 */
export declare function globToRegex(glob: string): RegExp;
/**
 * Create a middleware that only runs for specific path patterns.
 */
export declare function path(patterns: string | string[] | RegExp | RegExp[], middleware: MiddlewareHandler): MiddlewareHandler;
/**
 * Create a logging middleware.
 */
export declare function createLoggerMiddleware(options?: {
    includeBody?: boolean;
    includeHeaders?: string[];
}): MiddlewareHandler;
/**
 * Create a CORS middleware.
 */
export declare function createCorsMiddleware(options?: {
    origin?: string | string[] | ((origin: string) => boolean);
    methods?: string[];
    headers?: string[];
    credentials?: boolean;
    maxAge?: number;
}): MiddlewareHandler;
/**
 * Create a rate limiting middleware.
 */
export declare function createRateLimitMiddleware(options?: {
    windowMs?: number;
    maxRequests?: number;
    keyGenerator?: (request: Request) => string;
    skipSuccessfulRequests?: boolean;
}): MiddlewareHandler;
//# sourceMappingURL=middleware-chain.d.ts.map