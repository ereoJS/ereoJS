/**
 * @ereo/db - Type definitions
 *
 * Core type utilities for database adapters with end-to-end type safety.
 */

// ============================================================================
// Query Result Types
// ============================================================================

/** Result of a SELECT query */
export interface QueryResult<T = unknown> {
  rows: T[];
  rowCount: number;
}

/** Result of an INSERT/UPDATE/DELETE mutation */
export interface MutationResult {
  rowsAffected: number;
  lastInsertId?: number | bigint;
}

/** Result wrapper that includes deduplication metadata */
export interface DedupResult<T> {
  result: T;
  /** Whether this result was served from the request-scoped cache */
  fromCache: boolean;
  /** Cache key used for deduplication */
  cacheKey: string;
}

// ============================================================================
// Configuration Types
// ============================================================================

/** Connection pool configuration */
export interface PoolConfig {
  /** Minimum number of connections to maintain */
  min?: number;
  /** Maximum number of connections allowed */
  max?: number;
  /** How long a connection can be idle before being closed (ms) */
  idleTimeoutMs?: number;
  /** How long to wait for a connection from the pool (ms) */
  acquireTimeoutMs?: number;
  /** Maximum number of times to retry acquiring a connection */
  acquireRetries?: number;
}

/** Transaction isolation levels */
export type IsolationLevel =
  | 'read uncommitted'
  | 'read committed'
  | 'repeatable read'
  | 'serializable';

/** Transaction configuration options */
export interface TransactionOptions {
  /** Isolation level for the transaction */
  isolationLevel?: IsolationLevel;
  /** Whether the transaction is read-only */
  readOnly?: boolean;
  /** Timeout for the transaction in milliseconds */
  timeout?: number;
}

/** Base adapter configuration */
export interface AdapterConfig {
  /** Database connection URL */
  url: string;
  /** Enable debug logging */
  debug?: boolean;
  /** Connection pool configuration */
  pool?: PoolConfig;
  /** Whether this adapter is edge-compatible */
  edgeCompatible?: boolean;
}

// ============================================================================
// Type Inference Utilities (Drizzle-compatible)
// ============================================================================

/**
 * Infer the select type from a Drizzle table.
 * This maps to `typeof table.$inferSelect` in Drizzle.
 */
export type InferSelect<T extends { $inferSelect: unknown }> = T['$inferSelect'];

/**
 * Infer the insert type from a Drizzle table.
 * This maps to `typeof table.$inferInsert` in Drizzle.
 */
export type InferInsert<T extends { $inferInsert: unknown }> = T['$inferInsert'];

/**
 * Module augmentation target for typed database tables.
 * Users can augment this interface to get type-safe table access.
 *
 * @example
 * declare module '@ereo/db' {
 *   interface DatabaseTables {
 *     users: typeof import('./schema').users;
 *     posts: typeof import('./schema').posts;
 *   }
 * }
 */
export interface DatabaseTables {}

/** Get typed table names from the registry */
export type TableNames = keyof DatabaseTables extends never
  ? string
  : keyof DatabaseTables;

/** Get table type by name from the registry */
export type TableType<T extends TableNames> = T extends keyof DatabaseTables
  ? DatabaseTables[T]
  : unknown;

// ============================================================================
// Query Builder Types (for type-safe queries)
// ============================================================================

/** Typed WHERE clause conditions */
export type TypedWhere<T> = {
  [K in keyof T]?: T[K] | WhereOperator<T[K]>;
} & {
  AND?: TypedWhere<T>[];
  OR?: TypedWhere<T>[];
  NOT?: TypedWhere<T>;
};

/** WHERE clause operators */
export interface WhereOperator<T> {
  eq?: T;
  ne?: T;
  gt?: T;
  gte?: T;
  lt?: T;
  lte?: T;
  in?: T[];
  notIn?: T[];
  like?: string;
  ilike?: string;
  isNull?: boolean;
  isNotNull?: boolean;
  between?: [T, T];
}

/** Typed ORDER BY clause */
export type TypedOrderBy<T> = {
  [K in keyof T]?: 'asc' | 'desc';
};

/** Typed SELECT fields */
export type TypedSelect<T> = (keyof T)[] | '*';

// ============================================================================
// Deduplication Stats
// ============================================================================

/** Statistics about query deduplication for a request */
export interface DedupStats {
  /** Total number of queries attempted */
  total: number;
  /** Number of queries served from cache */
  deduplicated: number;
  /** Number of unique queries executed */
  unique: number;
  /** Cache hit rate (0-1) */
  hitRate: number;
}

// ============================================================================
// Health Check Types
// ============================================================================

/** Result of a database health check */
export interface HealthCheckResult {
  /** Whether the database is healthy */
  healthy: boolean;
  /** Time taken for the health check in milliseconds */
  latencyMs: number;
  /** Error message if unhealthy */
  error?: string;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

// ============================================================================
// Error Types
// ============================================================================

/** Base database error */
export class DatabaseError extends Error {
  constructor(
    message: string,
    public readonly code?: string,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = 'DatabaseError';
  }
}

/** Connection-related errors */
export class ConnectionError extends DatabaseError {
  constructor(message: string, cause?: Error) {
    super(message, 'CONNECTION_ERROR', cause);
    this.name = 'ConnectionError';
  }
}

/** Query execution errors */
export class QueryError extends DatabaseError {
  constructor(
    message: string,
    public readonly query?: string,
    public readonly params?: unknown[],
    cause?: Error
  ) {
    super(message, 'QUERY_ERROR', cause);
    this.name = 'QueryError';
  }
}

/** Transaction errors */
export class TransactionError extends DatabaseError {
  constructor(message: string, cause?: Error) {
    super(message, 'TRANSACTION_ERROR', cause);
    this.name = 'TransactionError';
  }
}

/** Timeout errors */
export class TimeoutError extends DatabaseError {
  constructor(message: string, public readonly timeoutMs: number) {
    super(message, 'TIMEOUT_ERROR');
    this.name = 'TimeoutError';
  }
}
