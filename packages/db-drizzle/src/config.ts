/**
 * @ereo/db-drizzle - Configuration Helpers
 *
 * Type-safe configuration builders for Drizzle adapters.
 */

import type {
  DrizzleConfig,
  DrizzleDriver,
  PostgresConfig,
  NeonHttpConfig,
  NeonWebSocketConfig,
  PlanetScaleConfig,
  LibSQLConfig,
  BunSQLiteConfig,
  BetterSQLite3Config,
  D1Config,
  EDGE_COMPATIBLE_DRIVERS,
} from './types';

// ============================================================================
// Configuration Builder
// ============================================================================

/**
 * Type-safe configuration builder for Drizzle adapters.
 * Provides autocomplete and validation based on the selected driver.
 *
 * @example
 * const config = defineDrizzleConfig({
 *   driver: 'postgres-js',
 *   url: process.env.DATABASE_URL,
 *   schema,
 *   connection: {
 *     ssl: 'require',
 *     max: 10,
 *   },
 * });
 */
export function defineDrizzleConfig<T extends DrizzleConfig>(config: T): T {
  return config;
}

// ============================================================================
// Driver-Specific Presets
// ============================================================================

/**
 * Create a PostgreSQL configuration with sensible defaults.
 */
export function definePostgresConfig(
  config: Omit<PostgresConfig, 'driver'>
): PostgresConfig {
  return {
    driver: 'postgres-js',
    connection: {
      ssl: 'require',
      max: 10,
      idle_timeout: 20,
      connect_timeout: 10,
      prepare: true,
    },
    ...config,
  };
}

/**
 * Create a Neon HTTP configuration (edge-compatible).
 */
export function defineNeonHttpConfig(
  config: Omit<NeonHttpConfig, 'driver'>
): NeonHttpConfig {
  return {
    driver: 'neon-http',
    edgeCompatible: true,
    ...config,
  };
}

/**
 * Create a Neon WebSocket configuration.
 */
export function defineNeonWebSocketConfig(
  config: Omit<NeonWebSocketConfig, 'driver'>
): NeonWebSocketConfig {
  return {
    driver: 'neon-websocket',
    edgeCompatible: true,
    pool: {
      max: 5,
      idleTimeoutMs: 10000,
    },
    ...config,
  };
}

/**
 * Create a PlanetScale configuration (edge-compatible).
 */
export function definePlanetScaleConfig(
  config: Omit<PlanetScaleConfig, 'driver'>
): PlanetScaleConfig {
  return {
    driver: 'planetscale',
    edgeCompatible: true,
    ...config,
  };
}

/**
 * Create a LibSQL/Turso configuration.
 */
export function defineLibSQLConfig(
  config: Omit<LibSQLConfig, 'driver'>
): LibSQLConfig {
  return {
    driver: 'libsql',
    edgeCompatible: true,
    ...config,
  };
}

/**
 * Create a Bun SQLite configuration.
 */
export function defineBunSQLiteConfig(
  config: Omit<BunSQLiteConfig, 'driver'>
): BunSQLiteConfig {
  return {
    driver: 'bun-sqlite',
    edgeCompatible: false,
    ...config,
    pragma: {
      journal_mode: 'WAL',
      synchronous: 'NORMAL',
      foreign_keys: true,
      cache_size: 10000,
      ...config.pragma,
    },
  };
}

/**
 * Create a better-sqlite3 configuration.
 */
export function defineBetterSQLite3Config(
  config: Omit<BetterSQLite3Config, 'driver'>
): BetterSQLite3Config {
  return {
    driver: 'better-sqlite3',
    edgeCompatible: false,
    ...config,
  };
}

/**
 * Create a Cloudflare D1 configuration.
 */
export function defineD1Config(
  config: Omit<D1Config, 'driver'>
): D1Config {
  return {
    driver: 'd1',
    edgeCompatible: true,
    ...config,
  };
}

// ============================================================================
// Edge Configuration Preset
// ============================================================================

/**
 * Configuration options for edge environments.
 */
export interface EdgeConfigOptions {
  /**
   * The edge-compatible driver to use.
   */
  driver: 'neon-http' | 'neon-websocket' | 'planetscale' | 'libsql' | 'd1';

  /**
   * Database connection URL.
   */
  url: string;

  /**
   * The Drizzle schema object.
   */
  schema?: Record<string, unknown>;

  /**
   * Auth token (for LibSQL/Turso).
   */
  authToken?: string;

  /**
   * Enable debug logging.
   */
  debug?: boolean;
}

/**
 * Create an edge-optimized Drizzle configuration.
 * Automatically selects appropriate settings for edge runtimes.
 *
 * @example
 * const config = defineEdgeConfig({
 *   driver: 'neon-http',
 *   url: process.env.DATABASE_URL,
 *   schema,
 * });
 */
export function defineEdgeConfig(options: EdgeConfigOptions): DrizzleConfig {
  const { driver, url, schema, authToken, debug } = options;

  const baseConfig = {
    url,
    schema,
    debug,
    edgeCompatible: true,
  };

  switch (driver) {
    case 'neon-http':
      return defineNeonHttpConfig(baseConfig);

    case 'neon-websocket':
      return defineNeonWebSocketConfig(baseConfig);

    case 'planetscale':
      return definePlanetScaleConfig(baseConfig);

    case 'libsql':
      return defineLibSQLConfig({
        ...baseConfig,
        authToken,
      });

    case 'd1':
      return defineD1Config(baseConfig);

    default:
      throw new Error(`Unknown edge driver: ${driver}`);
  }
}

// ============================================================================
// Environment Detection
// ============================================================================

/**
 * Detect the current runtime environment.
 */
export type RuntimeEnvironment =
  | 'bun'
  | 'node'
  | 'cloudflare-workers'
  | 'vercel-edge'
  | 'deno'
  | 'unknown';

/**
 * Detect the current runtime environment.
 */
export function detectRuntime(): RuntimeEnvironment {
  // Check for Bun
  if (typeof globalThis !== 'undefined' && 'Bun' in globalThis) {
    return 'bun';
  }

  // Check for Deno
  if (typeof globalThis !== 'undefined' && 'Deno' in globalThis) {
    return 'deno';
  }

  // Check for Cloudflare Workers
  if (
    typeof globalThis !== 'undefined' &&
    'caches' in globalThis &&
    typeof (globalThis as any).caches?.default !== 'undefined'
  ) {
    return 'cloudflare-workers';
  }

  // Check for Vercel Edge
  if (typeof process !== 'undefined' && process.env?.VERCEL_EDGE === '1') {
    return 'vercel-edge';
  }

  // Check for Node.js
  if (typeof process !== 'undefined' && process.versions?.node) {
    return 'node';
  }

  return 'unknown';
}

/**
 * Check if the current environment is edge-compatible.
 */
export function isEdgeRuntime(): boolean {
  const runtime = detectRuntime();
  return runtime === 'cloudflare-workers' || runtime === 'vercel-edge';
}

/**
 * Suggest appropriate drivers for the current environment.
 */
export function suggestDrivers(): DrizzleDriver[] {
  const runtime = detectRuntime();

  switch (runtime) {
    case 'bun':
      return ['bun-sqlite', 'postgres-js', 'libsql'];

    case 'node':
      return ['better-sqlite3', 'postgres-js', 'libsql'];

    case 'cloudflare-workers':
      return ['d1', 'neon-http', 'planetscale'];

    case 'vercel-edge':
      return ['neon-http', 'planetscale', 'libsql'];

    case 'deno':
      return ['postgres-js', 'libsql'];

    default:
      return ['neon-http', 'postgres-js'];
  }
}
