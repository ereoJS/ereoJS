/**
 * @ereo/db-drizzle - Drizzle Adapter Implementation
 *
 * Implements the DatabaseAdapter interface for Drizzle ORM
 * with support for multiple database drivers.
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
} from './types';
import { EDGE_COMPATIBLE_DRIVERS } from './types';

// ============================================================================
// Drizzle Adapter Implementation
// ============================================================================

/**
 * Drizzle ORM adapter implementing the DatabaseAdapter interface.
 */
class DrizzleAdapter<TSchema> implements DatabaseAdapter<TSchema> {
  readonly name: string;
  readonly edgeCompatible: boolean;

  private client: TSchema | null = null;
  private rawConnection: unknown = null;
  private config: DrizzleConfig;
  private isConnected = false;

  constructor(config: DrizzleConfig) {
    this.config = config;
    this.name = `drizzle-${config.driver}`;
    this.edgeCompatible = config.edgeCompatible ?? EDGE_COMPATIBLE_DRIVERS[config.driver];
  }

  /**
   * Initialize the database connection.
   */
  private async connect(): Promise<void> {
    if (this.isConnected && this.client) {
      return;
    }

    try {
      const result = await createDrizzleClient(this.config);
      this.client = result.client as TSchema;
      this.rawConnection = result.connection;
      this.isConnected = true;

      if (this.config.debug) {
        console.log(`[${this.name}] Connected to database`);
      }
    } catch (error) {
      throw new ConnectionError(
        `Failed to connect to database: ${error instanceof Error ? error.message : error}`,
        error instanceof Error ? error : undefined
      );
    }
  }

  getClient(): TSchema {
    if (!this.client) {
      throw new ConnectionError(
        'Database not connected. Call connect() first or use the plugin which handles this automatically.'
      );
    }
    return this.client;
  }

  getRequestClient(context: AppContext): RequestScopedClient<TSchema> {
    const client = this.getClient();
    const adapter = this;

    return {
      get client() {
        return client;
      },

      async query<T>(sql: string, params?: unknown[]): Promise<DedupResult<QueryResult<T>>> {
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
      const result = await executeRawQuery(this.rawConnection, this.config.driver, sql, params);
      return {
        rows: result as T[],
        rowCount: Array.isArray(result) ? result.length : 0,
      };
    } catch (error) {
      throw new QueryError(
        `Query failed: ${error instanceof Error ? error.message : error}`,
        sql,
        params,
        error instanceof Error ? error : undefined
      );
    }
  }

  async execute(sql: string, params?: unknown[]): Promise<MutationResult> {
    await this.connect();

    try {
      const result = await executeRawMutation(this.rawConnection, this.config.driver, sql, params);
      return result;
    } catch (error) {
      throw new QueryError(
        `Execute failed: ${error instanceof Error ? error.message : error}`,
        sql,
        params,
        error instanceof Error ? error : undefined
      );
    }
  }

  async transaction<T>(
    fn: (tx: TSchema) => Promise<T>,
    _options?: TransactionOptions
  ): Promise<T> {
    await this.connect();

    try {
      // Drizzle handles transactions through its own API
      // We delegate to the driver-specific transaction handling
      const result = await executeTransaction(
        this.client as unknown,
        this.config.driver,
        fn as (tx: unknown) => Promise<T>
      );
      return result;
    } catch (error) {
      throw new TransactionError(
        `Transaction failed: ${error instanceof Error ? error.message : error}`,
        error instanceof Error ? error : undefined
      );
    }
  }

  async beginTransaction(_options?: TransactionOptions): Promise<Transaction<TSchema>> {
    // Manual transactions are complex with Drizzle's callback-based API
    // We implement a simple wrapper that tracks state
    await this.connect();

    let isActive = true;
    let resolveTransaction: ((value: unknown) => void) | null = null;
    let rejectTransaction: ((error: Error) => void) | null = null;

    // Start a transaction and hold it open
    const transactionPromise = new Promise((resolve, reject) => {
      resolveTransaction = resolve;
      rejectTransaction = reject;
    });

    let transactionClient: TSchema | null = null;

    // This is a simplified implementation
    // In practice, you'd use the callback-based transaction and manage state
    executeTransaction(
      this.client as unknown,
      this.config.driver,
      async (tx: unknown) => {
        transactionClient = tx as TSchema;
        return transactionPromise;
      }
    ).catch(rejectTransaction!);

    return {
      get client(): TSchema {
        if (!transactionClient) {
          throw new TransactionError('Transaction not yet started');
        }
        return transactionClient;
      },

      async commit(): Promise<void> {
        if (!isActive) {
          throw new TransactionError('Transaction is not active');
        }
        isActive = false;
        resolveTransaction?.(undefined);
      },

      async rollback(): Promise<void> {
        if (!isActive) {
          throw new TransactionError('Transaction is not active');
        }
        isActive = false;
        rejectTransaction?.(new Error('Transaction rolled back'));
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

      // Execute a simple query to verify connection
      const testQuery = getHealthCheckQuery(this.config.driver);
      await this.query(testQuery);

      return {
        healthy: true,
        latencyMs: Date.now() - start,
        metadata: {
          driver: this.config.driver,
          edgeCompatible: this.edgeCompatible,
        },
      };
    } catch (error) {
      return {
        healthy: false,
        latencyMs: Date.now() - start,
        error: error instanceof Error ? error.message : String(error),
        metadata: {
          driver: this.config.driver,
        },
      };
    }
  }

  async disconnect(): Promise<void> {
    if (!this.isConnected) {
      return;
    }

    try {
      await closeConnection(this.rawConnection, this.config.driver);
      this.client = null;
      this.rawConnection = null;
      this.isConnected = false;

      if (this.config.debug) {
        console.log(`[${this.name}] Disconnected from database`);
      }
    } catch (error) {
      console.error(`[${this.name}] Error during disconnect:`, error);
    }
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a Drizzle database adapter.
 *
 * @param config - Drizzle configuration
 * @returns A configured DatabaseAdapter instance
 *
 * @example
 * const adapter = createDrizzleAdapter({
 *   driver: 'postgres-js',
 *   url: process.env.DATABASE_URL,
 *   schema,
 * });
 */
export function createDrizzleAdapter<TSchema = unknown>(
  config: DrizzleConfig
): DatabaseAdapter<TSchema> {
  return new DrizzleAdapter<TSchema>(config);
}

// ============================================================================
// Driver-Specific Implementations
// ============================================================================

interface DrizzleClientResult {
  client: unknown;
  connection: unknown;
}

/**
 * Create a Drizzle client for the specified driver.
 */
async function createDrizzleClient(config: DrizzleConfig): Promise<DrizzleClientResult> {
  switch (config.driver) {
    case 'postgres-js':
      return createPostgresClient(config as PostgresConfig);

    case 'neon-http':
      return createNeonHttpClient(config as NeonHttpConfig);

    case 'neon-websocket':
      return createNeonWebSocketClient(config as NeonWebSocketConfig);

    case 'planetscale':
      return createPlanetScaleClient(config as PlanetScaleConfig);

    case 'libsql':
      return createLibSQLClient(config as LibSQLConfig);

    case 'bun-sqlite':
      return createBunSQLiteClient(config as BunSQLiteConfig);

    case 'better-sqlite3':
      return createBetterSQLite3Client(config as BetterSQLite3Config);

    case 'd1':
      return createD1Client(config as D1Config);

    default:
      throw new Error(`Unsupported driver: ${(config as DrizzleConfig).driver}`);
  }
}

async function createPostgresClient(config: PostgresConfig): Promise<DrizzleClientResult> {
  // Dynamic imports for optional peer dependencies
  const postgres = await import('postgres' as string) as any;
  const drizzleModule = await import('drizzle-orm/postgres-js' as string) as any;

  const connection = postgres.default(config.url, {
    ssl: config.connection?.ssl,
    max: config.connection?.max ?? 10,
    idle_timeout: config.connection?.idle_timeout ?? 20,
    connect_timeout: config.connection?.connect_timeout ?? 10,
    prepare: config.connection?.prepare ?? true,
  });

  const client = drizzleModule.drizzle(connection, {
    schema: config.schema,
    logger: config.logger,
  });

  return { client, connection };
}

async function createNeonHttpClient(config: NeonHttpConfig): Promise<DrizzleClientResult> {
  const neonModule = await import('@neondatabase/serverless' as string) as any;
  const drizzleModule = await import('drizzle-orm/neon-http' as string) as any;

  const connection = neonModule.neon(config.url, config.neon);
  const client = drizzleModule.drizzle(connection, {
    schema: config.schema,
    logger: config.logger,
  });

  return { client, connection };
}

async function createNeonWebSocketClient(config: NeonWebSocketConfig): Promise<DrizzleClientResult> {
  const neonModule = await import('@neondatabase/serverless' as string) as any;
  const drizzleModule = await import('drizzle-orm/neon-serverless' as string) as any;

  const connection = new neonModule.Pool({ connectionString: config.url });
  const client = drizzleModule.drizzle(connection, {
    schema: config.schema,
    logger: config.logger,
  });

  return { client, connection };
}

async function createPlanetScaleClient(config: PlanetScaleConfig): Promise<DrizzleClientResult> {
  const psModule = await import('@planetscale/database' as string) as any;
  const drizzleModule = await import('drizzle-orm/planetscale-serverless' as string) as any;

  const connection = new psModule.Client({
    url: config.url,
    fetch: config.planetscale?.fetch,
  });
  const client = drizzleModule.drizzle(connection, {
    schema: config.schema,
    logger: config.logger,
  });

  return { client, connection };
}

async function createLibSQLClient(config: LibSQLConfig): Promise<DrizzleClientResult> {
  const libsqlModule = await import('@libsql/client' as string) as any;
  const drizzleModule = await import('drizzle-orm/libsql' as string) as any;

  const connection = libsqlModule.createClient({
    url: config.url,
    authToken: config.authToken,
    syncUrl: config.syncUrl,
  });
  const client = drizzleModule.drizzle(connection, {
    schema: config.schema,
    logger: config.logger,
  });

  return { client, connection };
}

async function createBunSQLiteClient(config: BunSQLiteConfig): Promise<DrizzleClientResult> {
  const sqliteModule = await import('bun:sqlite');
  const drizzleModule = await import('drizzle-orm/bun-sqlite' as string) as any;

  const connection = new sqliteModule.Database(config.url);

  // Apply PRAGMA settings
  if (config.pragma) {
    const { journal_mode, synchronous, foreign_keys, cache_size } = config.pragma;
    if (journal_mode) connection.exec(`PRAGMA journal_mode = ${journal_mode}`);
    if (synchronous) connection.exec(`PRAGMA synchronous = ${synchronous}`);
    if (foreign_keys !== undefined) connection.exec(`PRAGMA foreign_keys = ${foreign_keys ? 'ON' : 'OFF'}`);
    if (cache_size) connection.exec(`PRAGMA cache_size = ${cache_size}`);
  }

  const client = drizzleModule.drizzle(connection, {
    schema: config.schema,
    logger: config.logger,
  });

  return { client, connection };
}

async function createBetterSQLite3Client(config: BetterSQLite3Config): Promise<DrizzleClientResult> {
  const Database = await import('better-sqlite3' as string) as any;
  const drizzleModule = await import('drizzle-orm/better-sqlite3' as string) as any;

  const connection = new Database.default(config.url, config.options);
  const client = drizzleModule.drizzle(connection, {
    schema: config.schema,
    logger: config.logger,
  });

  return { client, connection };
}

async function createD1Client(config: D1Config): Promise<DrizzleClientResult> {
  const drizzleModule = await import('drizzle-orm/d1' as string) as any;

  if (!config.d1) {
    throw new Error('D1 database binding is required for d1 driver');
  }

  const client = drizzleModule.drizzle(config.d1, {
    schema: config.schema,
    logger: config.logger,
  });

  return { client, connection: config.d1 };
}

// ============================================================================
// Raw Query Execution
// ============================================================================

async function executeRawQuery(
  connection: unknown,
  driver: DrizzleDriver,
  sql: string,
  params?: unknown[]
): Promise<unknown[]> {
  // Use any type for connection since these are dynamically loaded modules
  const conn = connection as any;

  switch (driver) {
    case 'postgres-js': {
      return conn.unsafe(sql, params ?? []);
    }

    case 'neon-http': {
      return conn(sql, params ?? []);
    }

    case 'neon-websocket': {
      const result = await conn.query(sql, params ?? []);
      return result.rows;
    }

    case 'planetscale': {
      const result = await conn.execute(sql, params ?? []);
      return result.rows as unknown[];
    }

    case 'libsql': {
      const result = await conn.execute({ sql, args: params ?? [] });
      return result.rows;
    }

    case 'bun-sqlite': {
      const stmt = conn.prepare(sql);
      return stmt.all(...(params ?? [])) as unknown[];
    }

    case 'better-sqlite3': {
      const stmt = conn.prepare(sql);
      return stmt.all(...(params ?? []));
    }

    case 'd1': {
      const stmt = conn.prepare(sql);
      const bound = params ? stmt.bind(...params) : stmt;
      const result = await bound.all();
      return result.results ?? [];
    }

    default:
      throw new Error(`Raw query not supported for driver: ${driver}`);
  }
}

async function executeRawMutation(
  connection: unknown,
  driver: DrizzleDriver,
  sql: string,
  params?: unknown[]
): Promise<MutationResult> {
  // Use any type for connection since these are dynamically loaded modules
  const conn = connection as any;

  switch (driver) {
    case 'postgres-js': {
      const result = await conn.unsafe(sql, params ?? []);
      return { rowsAffected: result.count ?? 0 };
    }

    case 'neon-http': {
      await conn(sql, params ?? []);
      return { rowsAffected: 0 }; // HTTP mode doesn't return affected rows easily
    }

    case 'neon-websocket': {
      const result = await conn.query(sql, params ?? []);
      return { rowsAffected: result.rowCount ?? 0 };
    }

    case 'planetscale': {
      const result = await conn.execute(sql, params ?? []);
      return {
        rowsAffected: result.rowsAffected ?? 0,
        lastInsertId: result.insertId ? BigInt(result.insertId) : undefined,
      };
    }

    case 'libsql': {
      const result = await conn.execute({ sql, args: params ?? [] });
      return {
        rowsAffected: result.rowsAffected,
        lastInsertId: result.lastInsertRowid,
      };
    }

    case 'bun-sqlite': {
      const stmt = conn.prepare(sql);
      const result = stmt.run(...(params ?? []));
      return {
        rowsAffected: result.changes,
        lastInsertId: result.lastInsertRowid,
      };
    }

    case 'better-sqlite3': {
      const stmt = conn.prepare(sql);
      const result = stmt.run(...(params ?? []));
      return {
        rowsAffected: result.changes,
        lastInsertId: BigInt(result.lastInsertRowid),
      };
    }

    case 'd1': {
      const stmt = conn.prepare(sql);
      const bound = params ? stmt.bind(...params) : stmt;
      const result = await bound.run();
      return {
        rowsAffected: result.meta.changes ?? 0,
        lastInsertId: result.meta.last_row_id,
      };
    }

    default:
      throw new Error(`Raw mutation not supported for driver: ${driver}`);
  }
}

// ============================================================================
// Transaction Handling
// ============================================================================

async function executeTransaction<T>(
  client: unknown,
  driver: DrizzleDriver,
  fn: (tx: unknown) => Promise<T>
): Promise<T> {
  // Most Drizzle clients have a .transaction() method
  const db = client as { transaction?: (fn: (tx: unknown) => Promise<T>) => Promise<T> };

  if (typeof db.transaction === 'function') {
    return db.transaction(fn);
  }

  // For SQLite drivers that don't have built-in transaction support,
  // we manually manage BEGIN/COMMIT/ROLLBACK
  if (driver === 'bun-sqlite' || driver === 'better-sqlite3') {
    // These are synchronous drivers, so we need to handle differently
    throw new TransactionError(
      `Transaction support for ${driver} requires using the Drizzle client directly`
    );
  }

  throw new TransactionError(`Transaction not supported for driver: ${driver}`);
}

// ============================================================================
// Connection Management
// ============================================================================

async function closeConnection(connection: unknown, driver: DrizzleDriver): Promise<void> {
  // Use any type for connection since these are dynamically loaded modules
  const conn = connection as any;

  switch (driver) {
    case 'postgres-js': {
      await conn.end();
      break;
    }

    case 'neon-websocket': {
      await conn.end();
      break;
    }

    case 'libsql': {
      conn.close();
      break;
    }

    case 'bun-sqlite': {
      conn.close();
      break;
    }

    case 'better-sqlite3': {
      conn.close();
      break;
    }

    // HTTP-based drivers don't need explicit cleanup
    case 'neon-http':
    case 'planetscale':
    case 'd1':
      break;
  }
}

function getHealthCheckQuery(driver: DrizzleDriver): string {
  switch (driver) {
    case 'postgres-js':
    case 'neon-http':
    case 'neon-websocket':
      return 'SELECT 1';

    case 'planetscale':
      return 'SELECT 1';

    case 'libsql':
    case 'bun-sqlite':
    case 'better-sqlite3':
    case 'd1':
      return 'SELECT 1';

    default:
      return 'SELECT 1';
  }
}

// Type import for D1
import type { D1Database } from './types';
