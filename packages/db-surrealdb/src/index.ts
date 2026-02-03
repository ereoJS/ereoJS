/**
 * @ereo/db-surrealdb - SurrealDB Adapter
 *
 * Provides SurrealDB integration for the EreoJS database abstraction layer.
 * SurrealDB is a multi-model database that supports SQL-like queries, graph
 * relationships, and real-time subscriptions.
 *
 * @example
 * // Basic setup
 * import { createSurrealAdapter, defineSurrealConfig } from '@ereo/db-surrealdb';
 * import { createDatabasePlugin } from '@ereo/db';
 *
 * const adapter = createSurrealAdapter(defineSurrealConfig({
 *   url: 'http://localhost:8000',
 *   namespace: 'test',
 *   database: 'test',
 *   auth: {
 *     username: 'root',
 *     password: 'root',
 *   },
 * }));
 *
 * export default defineConfig({
 *   plugins: [createDatabasePlugin(adapter)],
 * });
 *
 * @example
 * // Using in routes
 * import { useDb } from '@ereo/db';
 *
 * export const loader = createLoader({
 *   load: async ({ context }) => {
 *     const db = useDb(context);
 *
 *     // Use SurrealQL
 *     const result = await db.client.query('SELECT * FROM users WHERE active = true');
 *
 *     // Or use the convenience methods
 *     const users = await db.client.select('users');
 *
 *     return users;
 *   },
 * });
 *
 * @example
 * // Environment-based configuration
 * import { createSurrealAdapter, envConfig } from '@ereo/db-surrealdb';
 *
 * const adapter = createSurrealAdapter(envConfig());
 * // Uses: SURREAL_URL, SURREAL_NAMESPACE, SURREAL_DATABASE, SURREAL_USERNAME, SURREAL_PASSWORD
 *
 * @packageDocumentation
 */

// ============================================================================
// Adapter Factory
// ============================================================================

export {
  createSurrealAdapter,
  // Query helpers
  select,
  create,
  update,
  deleteFrom,
  // Types
  type SurrealClient,
} from './adapter';

// ============================================================================
// Configuration Helpers
// ============================================================================

export {
  // Config builders
  defineSurrealConfig,
  // Auth helpers
  rootAuth,
  namespaceAuth,
  databaseAuth,
  recordAccessAuth,
  // URL helpers
  buildSurrealUrl,
  parseSurrealUrl,
  // Presets
  localConfig,
  cloudConfig,
  envConfig,
  // Validation
  validateConfig,
} from './config';

// ============================================================================
// Types
// ============================================================================

export {
  // Configuration types
  type SurrealDBConfig,
  // Authentication types
  type SurrealAuth,
  type RootAuth,
  type NamespaceAuth,
  type DatabaseAuth,
  type RecordAccessAuth,
  type ScopeAuth,
  // Connection types
  type ConnectionProtocol,
  type SurrealEngine,
  // Query result types
  type SurrealQueryResult,
  type SurrealRawResponse,
  // Record types
  type RecordId,
  type SurrealRecord,
  // Live query types
  type LiveAction,
  type LiveNotification,
  // Type guards
  isRootAuth,
  isNamespaceAuth,
  isDatabaseAuth,
  isRecordAccessAuth,
  isScopeAuth,
} from './types';

// ============================================================================
// Re-exports from @ereo/db for convenience
// ============================================================================

export {
  // Core exports users commonly need
  createDatabasePlugin,
  useDb,
  useAdapter,
  getDb,
  withTransaction,
  // Types
  type DatabaseAdapter,
  type RequestScopedClient,
  type QueryResult,
  type MutationResult,
  type DedupResult,
  type DedupStats,
  type TransactionOptions,
} from '@ereo/db';
