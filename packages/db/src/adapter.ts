/**
 * @ereo/db - Database Adapter Interface
 *
 * Core abstraction for ORM-agnostic database operations.
 * Adapters implement this interface to provide consistent access patterns.
 */

import type { AppContext } from '@ereo/core';
import type {
  QueryResult,
  MutationResult,
  DedupResult,
  DedupStats,
  TransactionOptions,
  AdapterConfig,
  HealthCheckResult,
} from './types';

// ============================================================================
// Request-Scoped Client Interface
// ============================================================================

/**
 * Request-scoped database client with query deduplication.
 * Created per-request and provides automatic caching of identical queries.
 */
export interface RequestScopedClient<TSchema> {
  /**
   * The underlying database client (e.g., Drizzle instance).
   * Use this for building and executing queries.
   */
  readonly client: TSchema;

  /**
   * Execute a raw SQL query with automatic deduplication.
   * Identical queries within the same request are cached.
   */
  query<T = unknown>(sql: string, params?: unknown[]): Promise<DedupResult<QueryResult<T>>>;

  /**
   * Get deduplication statistics for this request.
   */
  getDedupStats(): DedupStats;

  /**
   * Clear the deduplication cache.
   * Call this after mutations to ensure fresh data.
   */
  clearDedup(): void;

  /**
   * Mark that a mutation has occurred, clearing relevant cache entries.
   * Optionally specify table names to clear only related queries.
   */
  invalidate(tables?: string[]): void;
}

// ============================================================================
// Database Adapter Interface
// ============================================================================

/**
 * Core database adapter interface.
 * All ORM adapters (Drizzle, Prisma, Kysely) implement this interface.
 *
 * @template TSchema - The schema type (e.g., Drizzle's `typeof schema`)
 */
export interface DatabaseAdapter<TSchema = unknown> {
  /**
   * Human-readable adapter name (e.g., 'drizzle-postgres', 'prisma').
   */
  readonly name: string;

  /**
   * Whether this adapter is compatible with edge runtimes.
   * Edge-compatible adapters can run in Cloudflare Workers, Vercel Edge, etc.
   */
  readonly edgeCompatible: boolean;

  /**
   * Get the underlying database client.
   * For Drizzle, this returns the Drizzle instance.
   * Use this for direct database operations outside of request context.
   */
  getClient(): TSchema;

  /**
   * Get a request-scoped client with query deduplication.
   * Call this in middleware/loaders to get per-request caching.
   *
   * @param context - The request context from EreoJS
   */
  getRequestClient(context: AppContext): RequestScopedClient<TSchema>;

  /**
   * Execute a raw SQL query.
   *
   * @param sql - The SQL query string
   * @param params - Query parameters for parameterized queries
   */
  query<T = unknown>(sql: string, params?: unknown[]): Promise<QueryResult<T>>;

  /**
   * Execute a raw SQL statement that modifies data.
   *
   * @param sql - The SQL statement (INSERT, UPDATE, DELETE)
   * @param params - Statement parameters
   */
  execute(sql: string, params?: unknown[]): Promise<MutationResult>;

  /**
   * Run operations within a transaction.
   * Automatically handles commit on success and rollback on error.
   *
   * @param fn - Function receiving the transaction client
   * @param options - Transaction configuration
   */
  transaction<T>(
    fn: (tx: TSchema) => Promise<T>,
    options?: TransactionOptions
  ): Promise<T>;

  /**
   * Begin a manual transaction.
   * Returns a transaction object that must be committed or rolled back.
   *
   * @param options - Transaction configuration
   */
  beginTransaction(options?: TransactionOptions): Promise<Transaction<TSchema>>;

  /**
   * Check database connectivity and health.
   */
  healthCheck(): Promise<HealthCheckResult>;

  /**
   * Disconnect from the database and cleanup resources.
   * Call this on application shutdown.
   */
  disconnect(): Promise<void>;
}

// ============================================================================
// Transaction Interface
// ============================================================================

/**
 * Manual transaction handle for explicit control.
 */
export interface Transaction<TSchema> {
  /**
   * The transaction-scoped database client.
   */
  readonly client: TSchema;

  /**
   * Commit the transaction.
   */
  commit(): Promise<void>;

  /**
   * Rollback the transaction.
   */
  rollback(): Promise<void>;

  /**
   * Whether the transaction is still active.
   */
  readonly isActive: boolean;
}

// ============================================================================
// Adapter Factory Type
// ============================================================================

/**
 * Factory function type for creating database adapters.
 */
export type AdapterFactory<TConfig extends AdapterConfig, TSchema> = (
  config: TConfig
) => DatabaseAdapter<TSchema>;

// ============================================================================
// Adapter Registration
// ============================================================================

/** Registry of available adapters */
const adapterRegistry = new Map<string, DatabaseAdapter<unknown>>();

/**
 * Register an adapter instance globally.
 * Useful for accessing the adapter from anywhere in the application.
 */
export function registerAdapter<TSchema>(
  name: string,
  adapter: DatabaseAdapter<TSchema>
): void {
  adapterRegistry.set(name, adapter);
}

/**
 * Get a registered adapter by name.
 */
export function getAdapter<TSchema = unknown>(
  name: string
): DatabaseAdapter<TSchema> | undefined {
  return adapterRegistry.get(name) as DatabaseAdapter<TSchema> | undefined;
}

/**
 * Get the default registered adapter.
 * Returns the first registered adapter or undefined if none.
 */
export function getDefaultAdapter<TSchema = unknown>(): DatabaseAdapter<TSchema> | undefined {
  const first = adapterRegistry.values().next();
  return first.done ? undefined : (first.value as DatabaseAdapter<TSchema>);
}

/**
 * Clear all registered adapters.
 * Useful for testing.
 */
export function clearAdapterRegistry(): void {
  adapterRegistry.clear();
}
