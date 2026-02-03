/**
 * @ereo/db-surrealdb - SurrealDB Adapter Implementation
 *
 * Implements the DatabaseAdapter interface for SurrealDB.
 */

import type { AppContext } from '@ereo/core';
import {
  type DatabaseAdapter,
  type RequestScopedClient,
  type Transaction,
  type QueryResult,
  type MutationResult,
  type TransactionOptions,
  type HealthCheckResult,
  type DedupResult,
  type DedupStats,
  dedupQuery,
  clearDedupCache,
  invalidateTables,
  getRequestDedupStats,
  ConnectionError,
  QueryError,
  TransactionError,
} from '@ereo/db';

import type { SurrealDBConfig } from './types';
import { validateConfig } from './config';

// ============================================================================
// Types for SurrealDB SDK
// ============================================================================

/**
 * SurrealDB client interface.
 * This matches the API from the 'surrealdb' package.
 */
interface SurrealClient {
  connect(url: string): Promise<void>;
  close(): Promise<void>;
  use(params: { namespace: string; database: string }): Promise<void>;
  signin(credentials: Record<string, unknown>): Promise<string>;
  query<T = unknown>(sql: string, vars?: Record<string, unknown>): Promise<T[]>;
  select<T = unknown>(thing: string): Promise<T[]>;
  create<T = unknown>(thing: string, data?: Record<string, unknown>): Promise<T>;
  insert<T = unknown>(thing: string, data?: Record<string, unknown> | Record<string, unknown>[]): Promise<T[]>;
  update<T = unknown>(thing: string, data?: Record<string, unknown>): Promise<T>;
  merge<T = unknown>(thing: string, data?: Record<string, unknown>): Promise<T>;
  patch<T = unknown>(thing: string, data?: unknown[]): Promise<T>;
  delete<T = unknown>(thing: string): Promise<T>;
}

// ============================================================================
// SurrealDB Adapter Implementation
// ============================================================================

/**
 * SurrealDB adapter implementing the DatabaseAdapter interface.
 */
class SurrealDBAdapter implements DatabaseAdapter<SurrealClient> {
  readonly name = 'surrealdb';
  readonly edgeCompatible = true; // SurrealDB supports HTTP/WebSocket

  private client: SurrealClient | null = null;
  private config: SurrealDBConfig;
  private isConnected = false;

  constructor(config: SurrealDBConfig) {
    validateConfig(config);
    this.config = config;
  }

  /**
   * Initialize the database connection.
   */
  private async connect(): Promise<void> {
    if (this.isConnected && this.client) {
      return;
    }

    try {
      // Dynamic import of the surrealdb package
      const SurrealModule = await import('surrealdb' as string) as any;
      const Surreal = SurrealModule.default || SurrealModule.Surreal || SurrealModule;

      this.client = new Surreal() as SurrealClient;

      // Connect to the database
      // The URL should include /rpc for HTTP connections
      let connectionUrl = this.config.url;
      if (
        (connectionUrl.startsWith('http://') || connectionUrl.startsWith('https://')) &&
        !connectionUrl.endsWith('/rpc')
      ) {
        connectionUrl = connectionUrl.replace(/\/$/, '') + '/rpc';
      }

      if (this.config.debug) {
        console.log(`[surrealdb] Connecting to ${connectionUrl}...`);
      }

      await this.client.connect(connectionUrl);

      // Authenticate if credentials provided
      if (this.config.auth) {
        if (this.config.debug) {
          console.log('[surrealdb] Signing in...');
        }
        await this.client.signin(this.config.auth as Record<string, unknown>);
      }

      // Select namespace and database
      await this.client.use({
        namespace: this.config.namespace,
        database: this.config.database,
      });

      this.isConnected = true;

      if (this.config.debug) {
        console.log(`[surrealdb] Connected to ${this.config.namespace}/${this.config.database}`);
      }
    } catch (error) {
      this.client = null;
      this.isConnected = false;
      throw new ConnectionError(
        `Failed to connect to SurrealDB: ${error instanceof Error ? error.message : error}`,
        error instanceof Error ? error : undefined
      );
    }
  }

  getClient(): SurrealClient {
    if (!this.client || !this.isConnected) {
      throw new ConnectionError(
        'SurrealDB not connected. Call connect() first or use the plugin which handles this automatically.'
      );
    }
    return this.client;
  }

  getRequestClient(context: AppContext): RequestScopedClient<SurrealClient> {
    const adapter = this;

    return {
      get client() {
        return adapter.getClient();
      },

      async query<T>(sql: string, params?: unknown[]): Promise<DedupResult<QueryResult<T>>> {
        // Convert array params to object for SurrealDB
        const vars = params ? arrayToVars(params) : undefined;
        return dedupQuery(
          context,
          sql,
          params,
          async () => adapter.query<T>(sql, params)
        );
      },

      getDedupStats(): DedupStats {
        return getRequestDedupStats(context);
      },

      clearDedup(): void {
        clearDedupCache(context);
      },

      invalidate(tables?: string[]): void {
        if (tables) {
          invalidateTables(context, tables);
        } else {
          clearDedupCache(context);
        }
      },
    };
  }

  async query<T = unknown>(sql: string, params?: unknown[]): Promise<QueryResult<T>> {
    await this.connect();

    try {
      // Convert array params to object vars for SurrealDB
      const vars = params ? arrayToVars(params) : undefined;

      if (this.config.debug) {
        console.log('[surrealdb] Query:', sql, vars);
      }

      const results = await this.client!.query<T>(sql, vars);

      // SurrealDB returns an array of results for each statement
      // Flatten the results for simple queries
      const flatResults = Array.isArray(results) ? results.flat() : [results];

      return {
        rows: flatResults as T[],
        rowCount: flatResults.length,
      };
    } catch (error) {
      throw new QueryError(
        `SurrealDB query failed: ${error instanceof Error ? error.message : error}`,
        sql,
        params,
        error instanceof Error ? error : undefined
      );
    }
  }

  async execute(sql: string, params?: unknown[]): Promise<MutationResult> {
    await this.connect();

    try {
      const vars = params ? arrayToVars(params) : undefined;

      if (this.config.debug) {
        console.log('[surrealdb] Execute:', sql, vars);
      }

      const results = await this.client!.query(sql, vars);

      // Try to determine rows affected from result
      const flatResults = Array.isArray(results) ? results.flat() : [results];

      return {
        rowsAffected: flatResults.length,
      };
    } catch (error) {
      throw new QueryError(
        `SurrealDB execute failed: ${error instanceof Error ? error.message : error}`,
        sql,
        params,
        error instanceof Error ? error : undefined
      );
    }
  }

  async transaction<T>(
    fn: (tx: SurrealClient) => Promise<T>,
    _options?: TransactionOptions
  ): Promise<T> {
    await this.connect();

    try {
      // SurrealDB supports transactions via BEGIN/COMMIT/CANCEL statements
      // We wrap the function calls in a transaction block
      await this.client!.query('BEGIN TRANSACTION');

      try {
        const result = await fn(this.client!);
        await this.client!.query('COMMIT TRANSACTION');
        return result;
      } catch (error) {
        await this.client!.query('CANCEL TRANSACTION');
        throw error;
      }
    } catch (error) {
      throw new TransactionError(
        `SurrealDB transaction failed: ${error instanceof Error ? error.message : error}`,
        error instanceof Error ? error : undefined
      );
    }
  }

  async beginTransaction(_options?: TransactionOptions): Promise<Transaction<SurrealClient>> {
    await this.connect();

    let isActive = true;

    // Begin the transaction
    await this.client!.query('BEGIN TRANSACTION');

    return {
      client: this.client!,

      async commit(): Promise<void> {
        if (!isActive) {
          throw new TransactionError('Transaction is not active');
        }
        isActive = false;
        await this.client.query('COMMIT TRANSACTION');
      },

      async rollback(): Promise<void> {
        if (!isActive) {
          throw new TransactionError('Transaction is not active');
        }
        isActive = false;
        await this.client.query('CANCEL TRANSACTION');
      },

      get isActive(): boolean {
        return isActive;
      },
    };
  }

  async healthCheck(): Promise<HealthCheckResult> {
    const start = Date.now();

    try {
      await this.connect();

      // Simple query to verify connection
      await this.client!.query('INFO FOR DB');

      return {
        healthy: true,
        latencyMs: Date.now() - start,
        metadata: {
          namespace: this.config.namespace,
          database: this.config.database,
          url: this.config.url,
        },
      };
    } catch (error) {
      return {
        healthy: false,
        latencyMs: Date.now() - start,
        error: error instanceof Error ? error.message : String(error),
        metadata: {
          namespace: this.config.namespace,
          database: this.config.database,
        },
      };
    }
  }

  async disconnect(): Promise<void> {
    if (!this.client || !this.isConnected) {
      return;
    }

    try {
      await this.client.close();

      if (this.config.debug) {
        console.log('[surrealdb] Disconnected');
      }
    } catch (error) {
      if (this.config.debug) {
        console.error('[surrealdb] Error during disconnect:', error);
      }
    } finally {
      this.client = null;
      this.isConnected = false;
    }
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Convert array parameters to SurrealDB variable object.
 * SurrealDB uses named parameters like $0, $1, etc.
 */
function arrayToVars(params: unknown[]): Record<string, unknown> {
  const vars: Record<string, unknown> = {};
  for (let i = 0; i < params.length; i++) {
    vars[i.toString()] = params[i];
  }
  return vars;
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a SurrealDB database adapter.
 *
 * @param config - SurrealDB configuration
 * @returns A configured DatabaseAdapter instance
 *
 * @example
 * import { createSurrealAdapter } from '@ereo/db-surrealdb';
 * import { createDatabasePlugin } from '@ereo/db';
 *
 * const adapter = createSurrealAdapter({
 *   url: 'http://localhost:8000',
 *   namespace: 'test',
 *   database: 'test',
 *   auth: {
 *     username: 'root',
 *     password: 'root',
 *   },
 * });
 *
 * export default defineConfig({
 *   plugins: [createDatabasePlugin(adapter)],
 * });
 */
export function createSurrealAdapter(config: SurrealDBConfig): DatabaseAdapter<SurrealClient> {
  return new SurrealDBAdapter(config);
}

// ============================================================================
// Convenience Query Helpers
// ============================================================================

/**
 * Create a SurrealQL SELECT query.
 */
export function select(table: string, options?: {
  where?: string;
  orderBy?: string;
  limit?: number;
  start?: number;
}): string {
  let query = `SELECT * FROM ${table}`;

  if (options?.where) {
    query += ` WHERE ${options.where}`;
  }
  if (options?.orderBy) {
    query += ` ORDER BY ${options.orderBy}`;
  }
  if (options?.limit !== undefined) {
    query += ` LIMIT ${options.limit}`;
  }
  if (options?.start !== undefined) {
    query += ` START ${options.start}`;
  }

  return query;
}

/**
 * Create a SurrealQL CREATE query.
 */
export function create(table: string, id?: string): string {
  return id ? `CREATE ${table}:${id}` : `CREATE ${table}`;
}

/**
 * Create a SurrealQL UPDATE query.
 */
export function update(table: string, id?: string): string {
  return id ? `UPDATE ${table}:${id}` : `UPDATE ${table}`;
}

/**
 * Create a SurrealQL DELETE query.
 */
export function deleteFrom(table: string, id?: string): string {
  return id ? `DELETE ${table}:${id}` : `DELETE ${table}`;
}

// Re-export the SurrealClient type for consumers
export type { SurrealClient };
