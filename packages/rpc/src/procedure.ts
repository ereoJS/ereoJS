/**
 * Procedure builder with chainable middleware
 *
 * Usage:
 *   // Create base procedure
 *   const publicProcedure = procedure;
 *
 *   // Add middleware for auth
 *   const protectedProcedure = procedure.use(async ({ ctx, next }) => {
 *     if (!ctx.ctx.user) {
 *       return { ok: false, error: { code: 'UNAUTHORIZED', message: 'Not logged in' } };
 *     }
 *     return next({ ...ctx, user: ctx.ctx.user });
 *   });
 *
 *   // Use in router
 *   const api = createRouter({
 *     public: {
 *       health: publicProcedure.query(() => ({ status: 'ok' })),
 *     },
 *     protected: {
 *       me: protectedProcedure.query(({ user }) => user),
 *     },
 *   });
 */

import type {
  Schema,
  BaseContext,
  MiddlewareFn,
  MiddlewareDef,
  MiddlewareResult,
  QueryProcedure,
  MutationProcedure,
  SubscriptionProcedure,
  SubscriptionYield,
} from './types';

/**
 * Procedure builder with accumulated middleware and context types
 */
export interface ProcedureBuilder<TContext extends BaseContext> {
  /**
   * Add middleware that can transform context or short-circuit
   */
  use<TNewContext extends BaseContext>(
    middleware: MiddlewareFn<TContext, TNewContext>
  ): ProcedureBuilder<TNewContext>;

  /**
   * Create a query procedure (no input)
   */
  query<TOutput>(
    handler: (ctx: TContext) => TOutput | Promise<TOutput>
  ): QueryProcedure<TContext, void, Awaited<TOutput>>;

  /**
   * Create a query procedure (with validated input)
   */
  query<TInput, TOutput>(
    schema: Schema<TInput>,
    handler: (ctx: TContext & { input: TInput }) => TOutput | Promise<TOutput>
  ): QueryProcedure<TContext, TInput, Awaited<TOutput>>;

  /**
   * Create a mutation procedure (no input)
   */
  mutation<TOutput>(
    handler: (ctx: TContext) => TOutput | Promise<TOutput>
  ): MutationProcedure<TContext, void, Awaited<TOutput>>;

  /**
   * Create a mutation procedure (with validated input)
   */
  mutation<TInput, TOutput>(
    schema: Schema<TInput>,
    handler: (ctx: TContext & { input: TInput }) => TOutput | Promise<TOutput>
  ): MutationProcedure<TContext, TInput, Awaited<TOutput>>;

  /**
   * Create a subscription procedure (no input)
   */
  subscription<TOutput>(
    handler: (ctx: TContext) => SubscriptionYield<TOutput>
  ): SubscriptionProcedure<TContext, void, TOutput>;

  /**
   * Create a subscription procedure (with validated input)
   */
  subscription<TInput, TOutput>(
    schema: Schema<TInput>,
    handler: (ctx: TContext & { input: TInput }) => SubscriptionYield<TOutput>
  ): SubscriptionProcedure<TContext, TInput, TOutput>;
}

/**
 * Create a procedure builder with accumulated middleware
 */
function createProcedureBuilder<TContext extends BaseContext>(
  middlewares: MiddlewareDef<any, any>[] = []
): ProcedureBuilder<TContext> {
  return {
    use<TNewContext extends BaseContext>(
      middleware: MiddlewareFn<TContext, TNewContext>
    ): ProcedureBuilder<TNewContext> {
      return createProcedureBuilder<TNewContext>([
        ...middlewares,
        { fn: middleware },
      ]);
    },

    query<TInput = void, TOutput = unknown>(
      schemaOrHandler: Schema<TInput> | ((ctx: TContext) => TOutput | Promise<TOutput>),
      maybeHandler?: (ctx: TContext & { input: TInput }) => TOutput | Promise<TOutput>
    ): QueryProcedure<TContext, TInput, Awaited<TOutput>> {
      if (typeof schemaOrHandler === 'function') {
        return {
          _type: 'query',
          _ctx: undefined as unknown as TContext,
          _input: undefined as unknown as TInput,
          _output: undefined as unknown as Awaited<TOutput>,
          middlewares: [...middlewares],
          handler: schemaOrHandler as any,
        };
      }

      return {
        _type: 'query',
        _ctx: undefined as unknown as TContext,
        _input: undefined as unknown as TInput,
        _output: undefined as unknown as Awaited<TOutput>,
        middlewares: [...middlewares],
        inputSchema: schemaOrHandler,
        handler: maybeHandler as any,
      };
    },

    mutation<TInput = void, TOutput = unknown>(
      schemaOrHandler: Schema<TInput> | ((ctx: TContext) => TOutput | Promise<TOutput>),
      maybeHandler?: (ctx: TContext & { input: TInput }) => TOutput | Promise<TOutput>
    ): MutationProcedure<TContext, TInput, Awaited<TOutput>> {
      if (typeof schemaOrHandler === 'function') {
        return {
          _type: 'mutation',
          _ctx: undefined as unknown as TContext,
          _input: undefined as unknown as TInput,
          _output: undefined as unknown as Awaited<TOutput>,
          middlewares: [...middlewares],
          handler: schemaOrHandler as any,
        };
      }

      return {
        _type: 'mutation',
        _ctx: undefined as unknown as TContext,
        _input: undefined as unknown as TInput,
        _output: undefined as unknown as Awaited<TOutput>,
        middlewares: [...middlewares],
        inputSchema: schemaOrHandler,
        handler: maybeHandler as any,
      };
    },

    subscription<TInput = void, TOutput = unknown>(
      schemaOrHandler: Schema<TInput> | ((ctx: TContext) => SubscriptionYield<TOutput>),
      maybeHandler?: (ctx: TContext & { input: TInput }) => SubscriptionYield<TOutput>
    ): SubscriptionProcedure<TContext, TInput, TOutput> {
      if (typeof schemaOrHandler === 'function') {
        return {
          _type: 'subscription',
          _ctx: undefined as unknown as TContext,
          _input: undefined as unknown as TInput,
          _output: undefined as unknown as TOutput,
          middlewares: [...middlewares],
          handler: schemaOrHandler as any,
        };
      }

      return {
        _type: 'subscription',
        _ctx: undefined as unknown as TContext,
        _input: undefined as unknown as TInput,
        _output: undefined as unknown as TOutput,
        middlewares: [...middlewares],
        inputSchema: schemaOrHandler,
        handler: maybeHandler as any,
      };
    },
  } as ProcedureBuilder<TContext>;
}

/**
 * Base procedure builder - starting point for all procedures
 */
export const procedure: ProcedureBuilder<BaseContext> = createProcedureBuilder();

/**
 * Execute middleware chain and return final context
 */
export async function executeMiddleware<TContext extends BaseContext>(
  middlewares: MiddlewareDef<any, any>[],
  initialCtx: BaseContext
): Promise<MiddlewareResult<TContext>> {
  let currentCtx: any = initialCtx;

  for (const middleware of middlewares) {
    const result = await middleware.fn({
      ctx: currentCtx,
      next: <T>(ctx: T): MiddlewareResult<T> => ({ ok: true, ctx }),
    });

    if (!result.ok) {
      return result;
    }

    currentCtx = result.ctx;
  }

  return { ok: true, ctx: currentCtx };
}

// =============================================================================
// Legacy API (standalone functions for backwards compatibility)
// =============================================================================

/**
 * Create a query procedure without middleware
 * @deprecated Use `procedure.query()` instead for middleware support
 */
export function query<TOutput>(
  handler: (ctx: BaseContext) => TOutput | Promise<TOutput>
): QueryProcedure<BaseContext, void, Awaited<TOutput>>;
export function query<TInput, TOutput>(
  schema: Schema<TInput>,
  handler: (ctx: BaseContext & { input: TInput }) => TOutput | Promise<TOutput>
): QueryProcedure<BaseContext, TInput, Awaited<TOutput>>;
export function query<TInput, TOutput>(
  schemaOrHandler: Schema<TInput> | ((ctx: BaseContext) => TOutput | Promise<TOutput>),
  maybeHandler?: (ctx: BaseContext & { input: TInput }) => TOutput | Promise<TOutput>
): QueryProcedure<BaseContext, any, any> {
  if (typeof schemaOrHandler === 'function') {
    return procedure.query(schemaOrHandler as any) as any;
  }
  return procedure.query(schemaOrHandler, maybeHandler as any) as any;
}

/**
 * Create a mutation procedure without middleware
 * @deprecated Use `procedure.mutation()` instead for middleware support
 */
export function mutation<TOutput>(
  handler: (ctx: BaseContext) => TOutput | Promise<TOutput>
): MutationProcedure<BaseContext, void, Awaited<TOutput>>;
export function mutation<TInput, TOutput>(
  schema: Schema<TInput>,
  handler: (ctx: BaseContext & { input: TInput }) => TOutput | Promise<TOutput>
): MutationProcedure<BaseContext, TInput, Awaited<TOutput>>;
export function mutation<TInput, TOutput>(
  schemaOrHandler: Schema<TInput> | ((ctx: BaseContext) => TOutput | Promise<TOutput>),
  maybeHandler?: (ctx: BaseContext & { input: TInput }) => TOutput | Promise<TOutput>
): MutationProcedure<BaseContext, any, any> {
  if (typeof schemaOrHandler === 'function') {
    return procedure.mutation(schemaOrHandler as any) as any;
  }
  return procedure.mutation(schemaOrHandler, maybeHandler as any) as any;
}

/**
 * Create a subscription procedure without middleware
 * @deprecated Use `procedure.subscription()` instead for middleware support
 */
export function subscription<TOutput>(
  handler: (ctx: BaseContext) => SubscriptionYield<TOutput>
): SubscriptionProcedure<BaseContext, void, TOutput>;
export function subscription<TInput, TOutput>(
  schema: Schema<TInput>,
  handler: (ctx: BaseContext & { input: TInput }) => SubscriptionYield<TOutput>
): SubscriptionProcedure<BaseContext, TInput, TOutput>;
export function subscription<TInput, TOutput>(
  schemaOrHandler: Schema<TInput> | ((ctx: BaseContext) => SubscriptionYield<TOutput>),
  maybeHandler?: (ctx: BaseContext & { input: TInput }) => SubscriptionYield<TOutput>
): SubscriptionProcedure<BaseContext, any, any> {
  if (typeof schemaOrHandler === 'function') {
    return procedure.subscription(schemaOrHandler as any) as any;
  }
  return procedure.subscription(schemaOrHandler, maybeHandler as any) as any;
}
