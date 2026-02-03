/**
 * @ereo/db-surrealdb - Type definitions
 *
 * SurrealDB-specific types and configuration.
 */

import type { AdapterConfig } from '@ereo/db';

// ============================================================================
// Authentication Types
// ============================================================================

/**
 * Root user authentication credentials.
 */
export interface RootAuth {
  username: string;
  password: string;
}

/**
 * Namespace-level authentication credentials.
 */
export interface NamespaceAuth {
  namespace: string;
  username: string;
  password: string;
}

/**
 * Database-level authentication credentials.
 */
export interface DatabaseAuth {
  namespace: string;
  database: string;
  username: string;
  password: string;
}

/**
 * Record access authentication (SurrealDB 2.x+).
 */
export interface RecordAccessAuth {
  namespace: string;
  database: string;
  access: string;
  variables?: Record<string, unknown>;
}

/**
 * Scope-based authentication (SurrealDB 1.x).
 */
export interface ScopeAuth {
  namespace: string;
  database: string;
  scope: string;
  [key: string]: unknown;
}

/**
 * Union of all authentication types.
 */
export type SurrealAuth =
  | RootAuth
  | NamespaceAuth
  | DatabaseAuth
  | RecordAccessAuth
  | ScopeAuth;

// ============================================================================
// Connection Types
// ============================================================================

/**
 * Connection protocol for SurrealDB.
 */
export type ConnectionProtocol = 'http' | 'https' | 'ws' | 'wss';

/**
 * SurrealDB engine type.
 */
export type SurrealEngine =
  | 'remote'     // Connect to remote SurrealDB instance
  | 'memory'     // In-memory database (requires @surrealdb/node)
  | 'surrealkv'; // Persistent storage (requires @surrealdb/node)

// ============================================================================
// Configuration Types
// ============================================================================

/**
 * SurrealDB adapter configuration.
 */
export interface SurrealDBConfig extends AdapterConfig {
  /**
   * SurrealDB connection URL.
   * Examples:
   * - 'http://127.0.0.1:8000' (HTTP)
   * - 'https://cloud.surrealdb.com' (HTTPS)
   * - 'ws://127.0.0.1:8000' (WebSocket)
   * - 'wss://cloud.surrealdb.com' (Secure WebSocket)
   * - 'mem://' (In-memory, requires @surrealdb/node)
   * - 'surrealkv://path/to/db' (Persistent, requires @surrealdb/node)
   */
  url: string;

  /**
   * Target namespace.
   */
  namespace: string;

  /**
   * Target database within the namespace.
   */
  database: string;

  /**
   * Authentication credentials.
   * If not provided, connects in unauthenticated mode.
   */
  auth?: SurrealAuth;

  /**
   * Connection timeout in milliseconds.
   * @default 30000
   */
  timeout?: number;

  /**
   * Enable debug logging.
   * @default false
   */
  debug?: boolean;
}

// ============================================================================
// Query Result Types
// ============================================================================

/**
 * SurrealDB query result structure.
 * Each statement in a query returns a separate result.
 */
export interface SurrealQueryResult<T = unknown> {
  result: T;
  status: 'OK' | 'ERR';
  time: string;
}

/**
 * Raw RPC response from SurrealDB.
 */
export interface SurrealRawResponse<T = unknown> {
  result: T;
  status: string;
  time: string;
}

// ============================================================================
// Record Types
// ============================================================================

/**
 * SurrealDB Record ID.
 * Format: "table:id"
 */
export interface RecordId<T extends string = string> {
  tb: T;
  id: string | number | object;
}

/**
 * Base record with ID.
 */
export interface SurrealRecord {
  id: RecordId | string;
}

// ============================================================================
// Live Query Types
// ============================================================================

/**
 * Live query action types.
 */
export type LiveAction = 'CREATE' | 'UPDATE' | 'DELETE';

/**
 * Live query notification.
 */
export interface LiveNotification<T = unknown> {
  action: LiveAction;
  result: T;
}

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Check if auth is root-level authentication.
 */
export function isRootAuth(auth: SurrealAuth): auth is RootAuth {
  return 'username' in auth && 'password' in auth && !('namespace' in auth);
}

/**
 * Check if auth is namespace-level authentication.
 */
export function isNamespaceAuth(auth: SurrealAuth): auth is NamespaceAuth {
  return 'namespace' in auth && 'username' in auth && !('database' in auth);
}

/**
 * Check if auth is database-level authentication.
 */
export function isDatabaseAuth(auth: SurrealAuth): auth is DatabaseAuth {
  return 'namespace' in auth && 'database' in auth && 'username' in auth && !('access' in auth) && !('scope' in auth);
}

/**
 * Check if auth is record access authentication (2.x).
 */
export function isRecordAccessAuth(auth: SurrealAuth): auth is RecordAccessAuth {
  return 'namespace' in auth && 'database' in auth && 'access' in auth;
}

/**
 * Check if auth is scope-based authentication (1.x).
 */
export function isScopeAuth(auth: SurrealAuth): auth is ScopeAuth {
  return 'namespace' in auth && 'database' in auth && 'scope' in auth;
}
