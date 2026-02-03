/**
 * @ereo/db-drizzle - Drizzle ORM Adapter
 *
 * Provides Drizzle ORM integration for the EreoJS database abstraction layer.
 * Supports multiple database drivers including edge-compatible options.
 *
 * @example
 * // PostgreSQL setup
 * import { createDrizzleAdapter, definePostgresConfig } from '@ereo/db-drizzle';
 * import { createDatabasePlugin } from '@ereo/db';
 * import * as schema from './db/schema';
 *
 * const config = definePostgresConfig({
 *   url: process.env.DATABASE_URL,
 *   schema,
 * });
 *
 * const adapter = createDrizzleAdapter(config);
 *
 * export default defineConfig({
 *   plugins: [createDatabasePlugin(adapter)],
 * });
 *
 * @example
 * // Edge-compatible setup with Neon
 * import { createDrizzleAdapter, defineEdgeConfig } from '@ereo/db-drizzle';
 * import { createDatabasePlugin } from '@ereo/db';
 *
 * const adapter = createDrizzleAdapter(defineEdgeConfig({
 *   driver: 'neon-http',
 *   url: process.env.DATABASE_URL,
 *   schema,
 * }));
 *
 * @packageDocumentation
 */

// ============================================================================
// Adapter Factory
// ============================================================================

export { createDrizzleAdapter } from './adapter';

// ============================================================================
// Configuration Helpers
// ============================================================================

export {
  // Generic config builder
  defineDrizzleConfig,
  // Driver-specific presets
  definePostgresConfig,
  defineNeonHttpConfig,
  defineNeonWebSocketConfig,
  definePlanetScaleConfig,
  defineLibSQLConfig,
  defineBunSQLiteConfig,
  defineBetterSQLite3Config,
  defineD1Config,
  // Edge preset
  defineEdgeConfig,
  // Environment detection
  detectRuntime,
  isEdgeRuntime,
  suggestDrivers,
  // Types
  type EdgeConfigOptions,
  type RuntimeEnvironment,
} from './config';

// ============================================================================
// Types
// ============================================================================

export {
  // Driver types
  type DrizzleDriver,
  type DrizzleConfig,
  type DrizzleClient,
  // Driver-specific configs
  type PostgresConfig,
  type NeonHttpConfig,
  type NeonWebSocketConfig,
  type PlanetScaleConfig,
  type LibSQLConfig,
  type BunSQLiteConfig,
  type BetterSQLite3Config,
  type D1Config,
  // Edge compatibility
  EDGE_COMPATIBLE_DRIVERS,
  // D1 types (for Cloudflare Workers)
  type D1Database,
  type D1PreparedStatement,
  type D1Result,
  type D1ExecResult,
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
