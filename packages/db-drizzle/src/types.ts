/**
 * @ereo/db-drizzle - Type definitions
 *
 * Drizzle-specific types and driver configurations.
 */

import type { AdapterConfig, PoolConfig } from '@ereo/db';

// ============================================================================
// Supported Drivers
// ============================================================================

/**
 * Supported database drivers for the Drizzle adapter.
 */
export type DrizzleDriver =
  | 'postgres-js'      // PostgreSQL via postgres.js
  | 'neon-http'        // Neon serverless HTTP driver
  | 'neon-websocket'   // Neon serverless WebSocket driver
  | 'planetscale'      // PlanetScale serverless driver
  | 'libsql'           // LibSQL/Turso driver
  | 'bun-sqlite'       // Bun's native SQLite
  | 'better-sqlite3'   // better-sqlite3 for Node.js
  | 'd1';              // Cloudflare D1

/**
 * Map of drivers to their edge compatibility.
 */
export const EDGE_COMPATIBLE_DRIVERS: Record<DrizzleDriver, boolean> = {
  'postgres-js': false,     // Requires TCP connections
  'neon-http': true,        // HTTP-based, edge compatible
  'neon-websocket': true,   // WebSocket-based, edge compatible
  'planetscale': true,      // HTTP-based, edge compatible
  'libsql': true,           // HTTP mode is edge compatible
  'bun-sqlite': false,      // Requires file system
  'better-sqlite3': false,  // Requires native bindings
  'd1': true,               // Cloudflare's edge database
};

// ============================================================================
// Configuration Types
// ============================================================================

/**
 * Base configuration for all Drizzle adapters.
 */
export interface DrizzleBaseConfig extends AdapterConfig {
  /**
   * The database driver to use.
   */
  driver: DrizzleDriver;

  /**
   * The Drizzle schema object.
   * Pass your schema for type inference.
   */
  schema?: Record<string, unknown>;

  /**
   * Enable Drizzle logger.
   * @default false
   */
  logger?: boolean;
}

/**
 * PostgreSQL-specific configuration (postgres-js driver).
 */
export interface PostgresConfig extends DrizzleBaseConfig {
  driver: 'postgres-js';

  /**
   * Additional postgres.js connection options.
   */
  connection?: {
    /** SSL mode */
    ssl?: boolean | 'require' | 'prefer' | 'allow';
    /** Maximum connections */
    max?: number;
    /** Idle timeout in seconds */
    idle_timeout?: number;
    /** Connection timeout in seconds */
    connect_timeout?: number;
    /** Prepare statements */
    prepare?: boolean;
  };
}

/**
 * Neon HTTP configuration.
 */
export interface NeonHttpConfig extends DrizzleBaseConfig {
  driver: 'neon-http';

  /**
   * Neon-specific options.
   */
  neon?: {
    /** Fetch function to use (for custom fetch implementations) */
    fetchOptions?: RequestInit;
  };
}

/**
 * Neon WebSocket configuration.
 */
export interface NeonWebSocketConfig extends DrizzleBaseConfig {
  driver: 'neon-websocket';

  /**
   * Neon pool configuration.
   */
  pool?: PoolConfig;
}

/**
 * PlanetScale configuration.
 */
export interface PlanetScaleConfig extends DrizzleBaseConfig {
  driver: 'planetscale';

  /**
   * PlanetScale-specific options.
   */
  planetscale?: {
    /** Fetch function to use */
    fetch?: typeof fetch;
  };
}

/**
 * LibSQL/Turso configuration.
 */
export interface LibSQLConfig extends DrizzleBaseConfig {
  driver: 'libsql';

  /**
   * Authentication token for Turso.
   */
  authToken?: string;

  /**
   * Sync URL for embedded replicas.
   */
  syncUrl?: string;
}

/**
 * Bun SQLite configuration.
 */
export interface BunSQLiteConfig extends DrizzleBaseConfig {
  driver: 'bun-sqlite';

  /**
   * SQLite PRAGMA settings.
   */
  pragma?: {
    journal_mode?: 'DELETE' | 'TRUNCATE' | 'PERSIST' | 'MEMORY' | 'WAL' | 'OFF';
    synchronous?: 'OFF' | 'NORMAL' | 'FULL' | 'EXTRA';
    foreign_keys?: boolean;
    cache_size?: number;
  };
}

/**
 * better-sqlite3 configuration.
 */
export interface BetterSQLite3Config extends DrizzleBaseConfig {
  driver: 'better-sqlite3';

  /**
   * SQLite options.
   */
  options?: {
    readonly?: boolean;
    fileMustExist?: boolean;
    timeout?: number;
    verbose?: (message: string) => void;
  };
}

/**
 * Cloudflare D1 configuration.
 */
export interface D1Config extends DrizzleBaseConfig {
  driver: 'd1';

  /**
   * The D1 database binding.
   * This is provided by Cloudflare Workers runtime.
   */
  d1?: D1Database;
}

/**
 * Union of all Drizzle configuration types.
 */
export type DrizzleConfig =
  | PostgresConfig
  | NeonHttpConfig
  | NeonWebSocketConfig
  | PlanetScaleConfig
  | LibSQLConfig
  | BunSQLiteConfig
  | BetterSQLite3Config
  | D1Config;

// ============================================================================
// Drizzle Client Types
// ============================================================================

/**
 * Generic Drizzle client type.
 * This is a placeholder - actual type comes from drizzle-orm.
 */
export type DrizzleClient = unknown;

/**
 * D1Database interface (from Cloudflare Workers types).
 */
export interface D1Database {
  prepare(query: string): D1PreparedStatement;
  dump(): Promise<ArrayBuffer>;
  batch<T = unknown>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]>;
  exec(query: string): Promise<D1ExecResult>;
}

export interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  first<T = unknown>(colName?: string): Promise<T>;
  run(): Promise<D1Result>;
  all<T = unknown>(): Promise<D1Result<T>>;
  raw<T = unknown>(): Promise<T[]>;
}

export interface D1Result<T = unknown> {
  results?: T[];
  success: boolean;
  error?: string;
  meta: {
    changed_db?: boolean;
    changes?: number;
    last_row_id?: number;
    duration?: number;
    rows_read?: number;
    rows_written?: number;
  };
}

export interface D1ExecResult {
  count: number;
  duration: number;
}
