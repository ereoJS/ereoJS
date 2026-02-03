/**
 * @ereo/db-surrealdb - Configuration Helpers
 *
 * Type-safe configuration builders for SurrealDB adapter.
 */

import type {
  SurrealDBConfig,
  RootAuth,
  NamespaceAuth,
  DatabaseAuth,
  RecordAccessAuth,
} from './types';

// ============================================================================
// Configuration Builder
// ============================================================================

/**
 * Type-safe configuration builder for SurrealDB adapter.
 *
 * @example
 * const config = defineSurrealConfig({
 *   url: 'http://localhost:8000',
 *   namespace: 'test',
 *   database: 'test',
 *   auth: {
 *     username: 'root',
 *     password: 'root',
 *   },
 * });
 */
export function defineSurrealConfig(config: SurrealDBConfig): SurrealDBConfig {
  return {
    timeout: 30000,
    debug: false,
    ...config,
  };
}

// ============================================================================
// Authentication Helpers
// ============================================================================

/**
 * Create root-level authentication credentials.
 *
 * @example
 * const auth = rootAuth('root', 'surrealdb');
 */
export function rootAuth(username: string, password: string): RootAuth {
  return { username, password };
}

/**
 * Create namespace-level authentication credentials.
 *
 * @example
 * const auth = namespaceAuth('myns', 'admin', 'password');
 */
export function namespaceAuth(
  namespace: string,
  username: string,
  password: string
): NamespaceAuth {
  return { namespace, username, password };
}

/**
 * Create database-level authentication credentials.
 *
 * @example
 * const auth = databaseAuth('myns', 'mydb', 'admin', 'password');
 */
export function databaseAuth(
  namespace: string,
  database: string,
  username: string,
  password: string
): DatabaseAuth {
  return { namespace, database, username, password };
}

/**
 * Create record access authentication (SurrealDB 2.x+).
 *
 * @example
 * const auth = recordAccessAuth('myns', 'mydb', 'user', {
 *   email: 'user@example.com',
 *   password: 'secret',
 * });
 */
export function recordAccessAuth(
  namespace: string,
  database: string,
  access: string,
  variables?: Record<string, unknown>
): RecordAccessAuth {
  return { namespace, database, access, variables };
}

// ============================================================================
// URL Helpers
// ============================================================================

/**
 * Build a SurrealDB connection URL.
 *
 * @example
 * const url = buildSurrealUrl('localhost', 8000, 'http');
 * // => 'http://localhost:8000'
 */
export function buildSurrealUrl(
  host: string,
  port: number = 8000,
  protocol: 'http' | 'https' | 'ws' | 'wss' = 'http'
): string {
  return `${protocol}://${host}:${port}`;
}

/**
 * Parse a SurrealDB connection URL into components.
 */
export function parseSurrealUrl(url: string): {
  protocol: string;
  host: string;
  port: number;
  path: string;
} {
  const parsed = new URL(url);
  return {
    protocol: parsed.protocol.replace(':', ''),
    host: parsed.hostname,
    port: parseInt(parsed.port) || (parsed.protocol === 'https:' || parsed.protocol === 'wss:' ? 443 : 8000),
    path: parsed.pathname,
  };
}

// ============================================================================
// Preset Configurations
// ============================================================================

/**
 * Create a local development configuration.
 *
 * @example
 * const config = localConfig('test', 'test');
 */
export function localConfig(
  namespace: string,
  database: string,
  options?: Partial<SurrealDBConfig>
): SurrealDBConfig {
  return defineSurrealConfig({
    url: 'http://127.0.0.1:8000',
    namespace,
    database,
    debug: true,
    ...options,
  });
}

/**
 * Create a cloud/production configuration.
 *
 * @example
 * const config = cloudConfig(
 *   'https://cloud.surrealdb.com',
 *   'production',
 *   'mydb',
 *   rootAuth('user', 'password')
 * );
 */
export function cloudConfig(
  url: string,
  namespace: string,
  database: string,
  auth: SurrealDBConfig['auth'],
  options?: Partial<SurrealDBConfig>
): SurrealDBConfig {
  return defineSurrealConfig({
    url,
    namespace,
    database,
    auth,
    debug: false,
    ...options,
  });
}

/**
 * Create configuration from environment variables.
 *
 * Expected env vars:
 * - SURREAL_URL (required)
 * - SURREAL_NAMESPACE (required)
 * - SURREAL_DATABASE (required)
 * - SURREAL_USERNAME (optional)
 * - SURREAL_PASSWORD (optional)
 *
 * @example
 * const config = envConfig();
 */
export function envConfig(
  env: Record<string, string | undefined> = process.env
): SurrealDBConfig {
  const url = env.SURREAL_URL;
  const namespace = env.SURREAL_NAMESPACE;
  const database = env.SURREAL_DATABASE;

  if (!url) {
    throw new Error('SURREAL_URL environment variable is required');
  }
  if (!namespace) {
    throw new Error('SURREAL_NAMESPACE environment variable is required');
  }
  if (!database) {
    throw new Error('SURREAL_DATABASE environment variable is required');
  }

  const username = env.SURREAL_USERNAME;
  const password = env.SURREAL_PASSWORD;

  return defineSurrealConfig({
    url,
    namespace,
    database,
    auth: username && password ? { username, password } : undefined,
    debug: env.SURREAL_DEBUG === 'true',
  });
}

// ============================================================================
// Validation
// ============================================================================

/**
 * Validate a SurrealDB configuration.
 * Throws an error if the configuration is invalid.
 */
export function validateConfig(config: SurrealDBConfig): void {
  if (!config.url) {
    throw new Error('SurrealDB url is required');
  }

  if (!config.namespace) {
    throw new Error('SurrealDB namespace is required');
  }

  if (!config.database) {
    throw new Error('SurrealDB database is required');
  }

  // Validate URL format
  try {
    // Handle special URL schemes
    if (!config.url.startsWith('mem://') && !config.url.startsWith('surrealkv://')) {
      new URL(config.url);
    }
  } catch {
    throw new Error(`Invalid SurrealDB URL: ${config.url}`);
  }
}
