/**
 * @ereo/db - Database Adapter Abstractions
 *
 * This package provides ORM-agnostic database abstractions for EreoJS:
 * - Adapter interface for pluggable database backends
 * - Query deduplication for request-scoped caching
 * - Connection pooling primitives
 * - Type utilities for end-to-end type safety
 *
 * @example
 * // Using with Drizzle adapter
 * import { createDatabasePlugin, useDb } from '@ereo/db';
 * import { createDrizzleAdapter } from '@ereo/db-drizzle';
 *
 * // In ereo.config.ts
 * const adapter = createDrizzleAdapter({
 *   driver: 'postgres-js',
 *   url: process.env.DATABASE_URL,
 *   schema,
 * });
 *
 * export default defineConfig({
 *   plugins: [createDatabasePlugin(adapter)],
 * });
 *
 * // In a route loader
 * export const loader = createLoader({
 *   load: async ({ context }) => {
 *     const db = useDb(context);
 *     return db.client.select().from(users);
 *   },
 * });
 *
 * @packageDocumentation
 */

// ============================================================================
// Adapter Interface & Registry
// ============================================================================

export {
  // Interfaces
  type DatabaseAdapter,
  type RequestScopedClient,
  type Transaction,
  type AdapterFactory,
  // Registry functions
  registerAdapter,
  getAdapter,
  getDefaultAdapter,
  clearAdapterRegistry,
} from './adapter';

// ============================================================================
// Query Deduplication
// ============================================================================

export {
  // Core dedup functions
  generateFingerprint,
  dedupQuery,
  clearDedupCache,
  invalidateTables,
  getRequestDedupStats,
  // Debug utilities
  debugGetCacheContents,
} from './dedup';

// ============================================================================
// Connection Pool
// ============================================================================

export {
  // Pool class
  ConnectionPool,
  // Pool configuration presets
  DEFAULT_POOL_CONFIG,
  createEdgePoolConfig,
  createServerlessPoolConfig,
  // Retry utilities
  withRetry,
  isCommonRetryableError,
  DEFAULT_RETRY_CONFIG,
  // Types
  type PoolStats,
  type RetryConfig,
} from './pool';

// ============================================================================
// Plugin Factory & Context Helpers
// ============================================================================

export {
  // Plugin factory
  createDatabasePlugin,
  // Context helpers
  useDb,
  useAdapter,
  getDb,
  // Transaction helper
  withTransaction,
  // Types
  type DatabasePluginOptions,
} from './plugin';

// ============================================================================
// Types
// ============================================================================

export {
  // Query result types
  type QueryResult,
  type MutationResult,
  type DedupResult,
  type DedupStats,
  // Configuration types
  type PoolConfig,
  type AdapterConfig,
  type TransactionOptions,
  type IsolationLevel,
  // Type inference utilities
  type InferSelect,
  type InferInsert,
  type DatabaseTables,
  type TableNames,
  type TableType,
  // Query builder types
  type TypedWhere,
  type WhereOperator,
  type TypedOrderBy,
  type TypedSelect,
  // Health check
  type HealthCheckResult,
  // Error classes
  DatabaseError,
  ConnectionError,
  QueryError,
  TransactionError,
  TimeoutError,
} from './types';
