/**
 * @ereo/db - Database Plugin Factory
 *
 * Creates an EreoJS plugin that integrates a database adapter
 * with the framework's request lifecycle.
 */

import type { Plugin, AppContext } from '@ereo/core';
import type { DatabaseAdapter, RequestScopedClient } from './adapter';
import { registerAdapter, getDefaultAdapter } from './adapter';

// ============================================================================
// Context Key Constants
// ============================================================================

/** Key used to store the request-scoped client in context */
const DB_CLIENT_KEY = '__ereo_db_client';

/** Key used to store the adapter reference in context */
const DB_ADAPTER_KEY = '__ereo_db_adapter';

// ============================================================================
// Plugin Options
// ============================================================================

/**
 * Options for the database plugin.
 */
export interface DatabasePluginOptions {
  /**
   * Register this adapter as the default.
   * @default true
   */
  registerDefault?: boolean;

  /**
   * Name to register the adapter under.
   * @default adapter.name
   */
  registrationName?: string;

  /**
   * Enable debug logging.
   * @default false
   */
  debug?: boolean;
}

// ============================================================================
// Plugin Factory
// ============================================================================

/**
 * Create an EreoJS plugin for a database adapter.
 * This handles the lifecycle integration:
 * - Registers the adapter globally on setup
 * - Attaches request-scoped clients to context via middleware
 * - Handles cleanup on shutdown
 *
 * @param adapter - The database adapter instance
 * @param options - Plugin configuration options
 * @returns An EreoJS plugin
 *
 * @example
 * import { createDatabasePlugin } from '@ereo/db';
 * import { createDrizzleAdapter } from '@ereo/db-drizzle';
 *
 * const adapter = createDrizzleAdapter({
 *   driver: 'postgres-js',
 *   url: process.env.DATABASE_URL,
 *   schema,
 * });
 *
 * export default defineConfig({
 *   plugins: [
 *     createDatabasePlugin(adapter),
 *   ],
 * });
 */
export function createDatabasePlugin<TSchema>(
  adapter: DatabaseAdapter<TSchema>,
  options: DatabasePluginOptions = {}
): Plugin {
  const {
    registerDefault = true,
    registrationName = adapter.name,
    debug = false,
  } = options;

  const log = debug
    ? (...args: unknown[]) => console.log(`[db:${adapter.name}]`, ...args)
    : () => {};

  return {
    name: `@ereo/db:${adapter.name}`,

    async setup() {
      log('Initializing database adapter...');

      // Register the adapter globally
      if (registerDefault) {
        registerAdapter(registrationName, adapter);
        log(`Registered as "${registrationName}"`);
      }

      // Perform health check
      const health = await adapter.healthCheck();
      if (health.healthy) {
        log(`Connected successfully (${health.latencyMs}ms)`);
      } else {
        console.warn(
          `[db:${adapter.name}] Health check failed:`,
          health.error
        );
      }
    },

    configureServer(server) {
      // Add middleware that attaches request-scoped client to context
      server.middlewares.push(async (_request, context, next) => {
        // Create request-scoped client with deduplication
        const client = adapter.getRequestClient(context);

        // Store in context
        context.set(DB_CLIENT_KEY, client);
        context.set(DB_ADAPTER_KEY, adapter);

        log('Attached request-scoped client to context');

        return next();
      });
    },

    // Note: buildEnd could be used for cleanup, but adapters
    // typically stay connected during the build process
  };
}

// ============================================================================
// Context Helpers
// ============================================================================

/**
 * Get the database client from request context.
 * Use this in loaders, actions, and middleware.
 *
 * @param context - The request context from EreoJS
 * @returns The request-scoped database client with deduplication
 * @throws Error if database plugin is not configured
 *
 * @example
 * export const loader = createLoader({
 *   load: async ({ context }) => {
 *     const db = useDb(context);
 *     return db.client.select().from(users).where(eq(users.id, 1));
 *   },
 * });
 */
export function useDb<TSchema = unknown>(
  context: AppContext
): RequestScopedClient<TSchema> {
  const client = context.get<RequestScopedClient<TSchema>>(DB_CLIENT_KEY);

  if (!client) {
    throw new Error(
      'Database not available in context. ' +
      'Ensure createDatabasePlugin is registered in your config.'
    );
  }

  return client;
}

/**
 * Get the raw database adapter from context.
 * Use this when you need direct adapter access (e.g., for transactions).
 *
 * @param context - The request context from EreoJS
 * @returns The database adapter
 * @throws Error if database plugin is not configured
 */
export function useAdapter<TSchema = unknown>(
  context: AppContext
): DatabaseAdapter<TSchema> {
  const adapter = context.get<DatabaseAdapter<TSchema>>(DB_ADAPTER_KEY);

  if (!adapter) {
    throw new Error(
      'Database adapter not available in context. ' +
      'Ensure createDatabasePlugin is registered in your config.'
    );
  }

  return adapter;
}

/**
 * Get the default registered database adapter.
 * Use this outside of request context when you need database access.
 *
 * @returns The default database adapter or undefined
 *
 * @example
 * // In a script or background job
 * const adapter = getDb();
 * if (adapter) {
 *   const users = await adapter.getClient().select().from(users);
 * }
 */
export function getDb<TSchema = unknown>(): DatabaseAdapter<TSchema> | undefined {
  return getDefaultAdapter<TSchema>();
}

// ============================================================================
// Transaction Helpers
// ============================================================================

/**
 * Run a function within a database transaction using request context.
 * Convenience wrapper around adapter.transaction().
 *
 * @param context - The request context
 * @param fn - Function to run within the transaction
 * @returns The result of the function
 *
 * @example
 * export const action = createAction({
 *   async run({ context }) {
 *     return withTransaction(context, async (tx) => {
 *       await tx.insert(users).values({ name: 'Alice' });
 *       await tx.insert(profiles).values({ userId: 1 });
 *       return { success: true };
 *     });
 *   },
 * });
 */
export async function withTransaction<TSchema, TResult>(
  context: AppContext,
  fn: (tx: TSchema) => Promise<TResult>
): Promise<TResult> {
  const adapter = useAdapter<TSchema>(context);
  const result = await adapter.transaction(fn);

  // Clear dedup cache after transaction (mutations occurred)
  const client = context.get<RequestScopedClient<TSchema>>(DB_CLIENT_KEY);
  if (client) {
    client.clearDedup();
  }

  return result;
}
