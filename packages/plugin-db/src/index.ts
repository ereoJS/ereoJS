/**
 * @ereo/db - Database integration plugin
 *
 * Provides database connectivity with SQLite support via Bun's native bun:sqlite.
 * Features:
 * - Query builder API with type-safe CRUD operations
 * - Transaction support
 * - Connection management
 * - Caching integration
 */

import { Database, Statement, type SQLQueryBindings } from 'bun:sqlite';
import type { Plugin, AppContext } from '@ereo/core';

// ============================================================================
// Configuration Types
// ============================================================================

/** Database provider type */
export type DatabaseProvider = 'sqlite';

/** Database configuration */
export interface DatabaseConfig {
  /** Database provider (currently only 'sqlite' supported) */
  provider: DatabaseProvider;
  /** Connection URL/path for the database */
  url: string;
  /** Enable query caching */
  cache?: boolean;
  /** Cache TTL in seconds */
  cacheTtl?: number;
  /** Enable debug logging */
  debug?: boolean;
}

/** Query cache options */
export interface QueryCacheOptions {
  /** Cache key */
  key?: string;
  /** Cache tags for invalidation */
  tags?: string[];
  /** TTL in seconds */
  ttl?: number;
}

// ============================================================================
// Query Types
// ============================================================================

/** Where clause conditions */
export type WhereCondition<T = Record<string, unknown>> = Partial<T> & {
  /** NOT conditions */
  NOT?: Partial<T>;
  /** OR conditions */
  OR?: Array<Partial<T>>;
  /** AND conditions */
  AND?: Array<Partial<T>>;
  /** Greater than */
  gt?: Record<string, number | Date>;
  /** Greater than or equal */
  gte?: Record<string, number | Date>;
  /** Less than */
  lt?: Record<string, number | Date>;
  /** Less than or equal */
  lte?: Record<string, number | Date>;
  /** LIKE condition */
  like?: Record<string, string>;
  /** IN condition */
  in?: Record<string, unknown[]>;
  /** NOT IN condition */
  notIn?: Record<string, unknown[]>;
  /** IS NULL */
  isNull?: string[];
  /** IS NOT NULL */
  isNotNull?: string[];
};

/** Order by direction */
export type OrderDirection = 'asc' | 'desc';

/** Order by clause */
export type OrderBy<T = Record<string, unknown>> = {
  [K in keyof T]?: OrderDirection;
};

/** Find unique options */
export interface FindUniqueOptions<T = Record<string, unknown>> {
  /** Where conditions */
  where: WhereCondition<T>;
  /** Fields to select */
  select?: (keyof T)[];
  /** Relations to include */
  include?: Record<string, boolean | object>;
}

/** Find many options */
export interface FindManyOptions<T = Record<string, unknown>> {
  /** Where conditions */
  where?: WhereCondition<T>;
  /** Fields to select */
  select?: (keyof T)[];
  /** Order by */
  orderBy?: OrderBy<T>;
  /** Limit results */
  take?: number;
  /** Skip results (offset) */
  skip?: number;
  /** Relations to include */
  include?: Record<string, boolean | object>;
  /** Enable distinct */
  distinct?: boolean;
  /** Cache options */
  cache?: QueryCacheOptions;
}

/** Create options */
export interface CreateOptions<T = Record<string, unknown>> {
  /** Data to create */
  data: Omit<T, 'id' | 'createdAt' | 'updatedAt'>;
  /** Fields to select in result */
  select?: (keyof T)[];
}

/** Create many options */
export interface CreateManyOptions<T = Record<string, unknown>> {
  /** Array of data to create */
  data: Array<Omit<T, 'id' | 'createdAt' | 'updatedAt'>>;
  /** Skip duplicates */
  skipDuplicates?: boolean;
}

/** Update options */
export interface UpdateOptions<T = Record<string, unknown>> {
  /** Where conditions */
  where: WhereCondition<T>;
  /** Data to update */
  data: Partial<Omit<T, 'id' | 'createdAt'>>;
  /** Fields to select in result */
  select?: (keyof T)[];
}

/** Update many options */
export interface UpdateManyOptions<T = Record<string, unknown>> {
  /** Where conditions */
  where: WhereCondition<T>;
  /** Data to update */
  data: Partial<Omit<T, 'id' | 'createdAt'>>;
}

/** Delete options */
export interface DeleteOptions<T = Record<string, unknown>> {
  /** Where conditions */
  where: WhereCondition<T>;
  /** Fields to select in result (before deletion) */
  select?: (keyof T)[];
}

/** Delete many options */
export interface DeleteManyOptions<T = Record<string, unknown>> {
  /** Where conditions */
  where?: WhereCondition<T>;
}

/** Upsert options */
export interface UpsertOptions<T = Record<string, unknown>> {
  /** Where conditions for finding existing record */
  where: WhereCondition<T>;
  /** Data to create if not found */
  create: Omit<T, 'id' | 'createdAt' | 'updatedAt'>;
  /** Data to update if found */
  update: Partial<Omit<T, 'id' | 'createdAt'>>;
  /** Fields to select in result */
  select?: (keyof T)[];
}

/** Count options */
export interface CountOptions<T = Record<string, unknown>> {
  /** Where conditions */
  where?: WhereCondition<T>;
}

/** Aggregate options */
export interface AggregateOptions<T = Record<string, unknown>> {
  /** Where conditions */
  where?: WhereCondition<T>;
  /** Fields to count */
  _count?: boolean | { [K in keyof T]?: boolean };
  /** Fields to sum */
  _sum?: { [K in keyof T]?: boolean };
  /** Fields to average */
  _avg?: { [K in keyof T]?: boolean };
  /** Fields to find min */
  _min?: { [K in keyof T]?: boolean };
  /** Fields to find max */
  _max?: { [K in keyof T]?: boolean };
}

/** Group by options */
export interface GroupByOptions<T = Record<string, unknown>> {
  /** Fields to group by */
  by: (keyof T)[];
  /** Where conditions (before grouping) */
  where?: WhereCondition<T>;
  /** Having conditions (after grouping) */
  having?: WhereCondition<T>;
  /** Order by */
  orderBy?: OrderBy<T>;
  /** Skip results */
  skip?: number;
  /** Take results */
  take?: number;
  /** Aggregations */
  _count?: boolean | { [K in keyof T]?: boolean };
  _sum?: { [K in keyof T]?: boolean };
  _avg?: { [K in keyof T]?: boolean };
  _min?: { [K in keyof T]?: boolean };
  _max?: { [K in keyof T]?: boolean };
}

// ============================================================================
// Table Model Interface
// ============================================================================

/** Table model with CRUD operations */
export interface TableModel<T = Record<string, unknown>> {
  /** Find a unique record */
  findUnique(options: FindUniqueOptions<T>): Promise<T | null>;

  /** Find the first matching record */
  findFirst(options?: FindManyOptions<T>): Promise<T | null>;

  /** Find many records */
  findMany(options?: FindManyOptions<T>): Promise<T[]>;

  /** Create a new record */
  create(options: CreateOptions<T>): Promise<T>;

  /** Create many records */
  createMany(options: CreateManyOptions<T>): Promise<{ count: number }>;

  /** Update a record */
  update(options: UpdateOptions<T>): Promise<T>;

  /** Update many records */
  updateMany(options: UpdateManyOptions<T>): Promise<{ count: number }>;

  /** Delete a record */
  delete(options: DeleteOptions<T>): Promise<T>;

  /** Delete many records */
  deleteMany(options?: DeleteManyOptions<T>): Promise<{ count: number }>;

  /** Upsert (create or update) */
  upsert(options: UpsertOptions<T>): Promise<T>;

  /** Count records */
  count(options?: CountOptions<T>): Promise<number>;

  /** Aggregate records */
  aggregate(options?: AggregateOptions<T>): Promise<Record<string, unknown>>;

  /** Group by */
  groupBy(options: GroupByOptions<T>): Promise<Array<Record<string, unknown>>>;
}

// ============================================================================
// Database Client Interface
// ============================================================================

/** Column definition for schema */
export interface ColumnDefinition {
  type: 'INTEGER' | 'TEXT' | 'REAL' | 'BLOB' | 'BOOLEAN' | 'DATETIME';
  primaryKey?: boolean;
  autoIncrement?: boolean;
  notNull?: boolean;
  unique?: boolean;
  default?: unknown;
  references?: {
    table: string;
    column: string;
    onDelete?: 'CASCADE' | 'SET NULL' | 'RESTRICT' | 'NO ACTION';
    onUpdate?: 'CASCADE' | 'SET NULL' | 'RESTRICT' | 'NO ACTION';
  };
}

/** Table schema definition */
export interface TableSchema {
  [columnName: string]: ColumnDefinition | string;
}

/** Transaction client interface - provides table access only */
export interface TransactionClient {
  /** Get table model by name */
  getTable<T extends Record<string, unknown> = Record<string, unknown>>(tableName: string): TableModel<T>;
}

/** Database client interface */
export interface DBClient {
  /** Execute raw SQL query */
  query<T = unknown>(sql: string, params?: SQLQueryBindings[]): Promise<T[]>;

  /** Execute raw SQL that modifies data */
  execute(sql: string, params?: SQLQueryBindings[]): Promise<{ changes: number; lastInsertRowid: number }>;

  /** Run operations in a transaction */
  transaction<T>(fn: (tx: TransactionClient) => Promise<T>): Promise<T>;

  /** Disconnect from database */
  disconnect(): Promise<void>;

  /** Get raw database connection */
  getRawConnection(): Database;

  /** Create table if not exists */
  createTable(tableName: string, schema: TableSchema): Promise<void>;

  /** Drop table */
  dropTable(tableName: string): Promise<void>;

  /** Check if table exists */
  tableExists(tableName: string): Promise<boolean>;

  /** Get table model by name */
  getTable<T extends Record<string, unknown> = Record<string, unknown>>(tableName: string): TableModel<T>;
}

/** Extended DB client with dynamic table access via proxy */
export type DBClientWithTables = DBClient & {
  [tableName: string]: TableModel<any>;
};

// ============================================================================
// SQLite Implementation
// ============================================================================

/** SQLite query builder and executor */
class SQLiteTableModel<T extends Record<string, unknown>> implements TableModel<T> {
  private db: Database;
  private tableName: string;
  private debug: boolean;
  private statementCache: Map<string, Statement> = new Map();

  constructor(db: Database, tableName: string, debug = false) {
    this.db = db;
    this.tableName = tableName;
    this.debug = debug;
  }

  private log(message: string, ...args: unknown[]): void {
    if (this.debug) {
      console.log(`[db:${this.tableName}] ${message}`, ...args);
    }
  }

  private getStatement(sql: string): Statement {
    let stmt = this.statementCache.get(sql);
    if (!stmt) {
      stmt = this.db.prepare(sql);
      this.statementCache.set(sql, stmt);
    }
    return stmt;
  }

  private buildWhereClause(where: WhereCondition<T>): { sql: string; params: SQLQueryBindings[] } {
    const conditions: string[] = [];
    const params: SQLQueryBindings[] = [];

    // Handle simple equality conditions
    for (const [key, value] of Object.entries(where)) {
      if (key === 'NOT' || key === 'OR' || key === 'AND' ||
          key === 'gt' || key === 'gte' || key === 'lt' || key === 'lte' ||
          key === 'like' || key === 'in' || key === 'notIn' ||
          key === 'isNull' || key === 'isNotNull') {
        continue;
      }

      if (value !== undefined) {
        conditions.push(`"${key}" = ?`);
        params.push(value as SQLQueryBindings);
      }
    }

    // Handle NOT conditions
    if (where.NOT) {
      for (const [key, value] of Object.entries(where.NOT)) {
        if (value !== undefined) {
          conditions.push(`"${key}" != ?`);
          params.push(value as SQLQueryBindings);
        }
      }
    }

    // Handle comparison operators
    if (where.gt) {
      for (const [key, value] of Object.entries(where.gt)) {
        conditions.push(`"${key}" > ?`);
        params.push(value instanceof Date ? value.toISOString() : value);
      }
    }
    if (where.gte) {
      for (const [key, value] of Object.entries(where.gte)) {
        conditions.push(`"${key}" >= ?`);
        params.push(value instanceof Date ? value.toISOString() : value);
      }
    }
    if (where.lt) {
      for (const [key, value] of Object.entries(where.lt)) {
        conditions.push(`"${key}" < ?`);
        params.push(value instanceof Date ? value.toISOString() : value);
      }
    }
    if (where.lte) {
      for (const [key, value] of Object.entries(where.lte)) {
        conditions.push(`"${key}" <= ?`);
        params.push(value instanceof Date ? value.toISOString() : value);
      }
    }

    // Handle LIKE
    if (where.like) {
      for (const [key, value] of Object.entries(where.like)) {
        conditions.push(`"${key}" LIKE ?`);
        params.push(value);
      }
    }

    // Handle IN
    if (where.in) {
      for (const [key, values] of Object.entries(where.in)) {
        const placeholders = values.map(() => '?').join(', ');
        conditions.push(`"${key}" IN (${placeholders})`);
        params.push(...(values as SQLQueryBindings[]));
      }
    }

    // Handle NOT IN
    if (where.notIn) {
      for (const [key, values] of Object.entries(where.notIn)) {
        const placeholders = values.map(() => '?').join(', ');
        conditions.push(`"${key}" NOT IN (${placeholders})`);
        params.push(...(values as SQLQueryBindings[]));
      }
    }

    // Handle IS NULL
    if (where.isNull) {
      for (const key of where.isNull) {
        conditions.push(`"${key}" IS NULL`);
      }
    }

    // Handle IS NOT NULL
    if (where.isNotNull) {
      for (const key of where.isNotNull) {
        conditions.push(`"${key}" IS NOT NULL`);
      }
    }

    // Handle OR conditions
    if (where.OR && where.OR.length > 0) {
      const orConditions: string[] = [];
      for (const orWhere of where.OR) {
        const { sql: orSql, params: orParams } = this.buildWhereClause(orWhere as WhereCondition<T>);
        if (orSql) {
          orConditions.push(`(${orSql})`);
          params.push(...orParams);
        }
      }
      if (orConditions.length > 0) {
        conditions.push(`(${orConditions.join(' OR ')})`);
      }
    }

    // Handle AND conditions
    if (where.AND && where.AND.length > 0) {
      for (const andWhere of where.AND) {
        const { sql: andSql, params: andParams } = this.buildWhereClause(andWhere as WhereCondition<T>);
        if (andSql) {
          conditions.push(`(${andSql})`);
          params.push(...andParams);
        }
      }
    }

    return {
      sql: conditions.length > 0 ? conditions.join(' AND ') : '',
      params,
    };
  }

  private buildSelectClause(select?: (keyof T)[]): string {
    if (!select || select.length === 0) {
      return '*';
    }
    return select.map(col => `"${String(col)}"`).join(', ');
  }

  private buildOrderByClause(orderBy?: OrderBy<T>): string {
    if (!orderBy) return '';

    const clauses: string[] = [];
    for (const [key, direction] of Object.entries(orderBy)) {
      clauses.push(`"${key}" ${direction === 'desc' ? 'DESC' : 'ASC'}`);
    }
    return clauses.length > 0 ? ` ORDER BY ${clauses.join(', ')}` : '';
  }

  async findUnique(options: FindUniqueOptions<T>): Promise<T | null> {
    const selectClause = this.buildSelectClause(options.select);
    const { sql: whereClause, params } = this.buildWhereClause(options.where);

    const sql = `SELECT ${selectClause} FROM "${this.tableName}" WHERE ${whereClause} LIMIT 1`;
    this.log('findUnique:', sql, params);

    const stmt = this.getStatement(sql);
    const result = stmt.get(...params) as T | null;
    return result;
  }

  async findFirst(options?: FindManyOptions<T>): Promise<T | null> {
    const results = await this.findMany({ ...options, take: 1 });
    return results[0] || null;
  }

  async findMany(options?: FindManyOptions<T>): Promise<T[]> {
    const selectClause = options?.distinct
      ? `DISTINCT ${this.buildSelectClause(options?.select)}`
      : this.buildSelectClause(options?.select);

    let sql = `SELECT ${selectClause} FROM "${this.tableName}"`;
    const params: SQLQueryBindings[] = [];

    if (options?.where) {
      const { sql: whereClause, params: whereParams } = this.buildWhereClause(options.where);
      if (whereClause) {
        sql += ` WHERE ${whereClause}`;
        params.push(...whereParams);
      }
    }

    sql += this.buildOrderByClause(options?.orderBy);

    if (options?.take !== undefined) {
      sql += ` LIMIT ?`;
      params.push(options.take);
    }

    if (options?.skip !== undefined) {
      sql += options?.take === undefined ? ' LIMIT -1' : '';
      sql += ` OFFSET ?`;
      params.push(options.skip);
    }

    this.log('findMany:', sql, params);

    const stmt = this.getStatement(sql);
    const results = stmt.all(...params) as T[];
    return results;
  }

  async create(options: CreateOptions<T>): Promise<T> {
    const data = options.data as Record<string, unknown>;
    const keys = Object.keys(data);
    const values = Object.values(data) as SQLQueryBindings[];
    const placeholders = keys.map(() => '?').join(', ');
    const columns = keys.map(k => `"${k}"`).join(', ');

    const sql = `INSERT INTO "${this.tableName}" (${columns}) VALUES (${placeholders}) RETURNING *`;
    this.log('create:', sql, values);

    const stmt = this.getStatement(sql);
    const result = stmt.get(...values) as T;
    return result;
  }

  async createMany(options: CreateManyOptions<T>): Promise<{ count: number }> {
    if (options.data.length === 0) {
      return { count: 0 };
    }

    const firstRecord = options.data[0] as Record<string, unknown>;
    const keys = Object.keys(firstRecord);
    const columns = keys.map(k => `"${k}"`).join(', ');
    const placeholders = keys.map(() => '?').join(', ');

    const insertOrIgnore = options.skipDuplicates ? 'INSERT OR IGNORE' : 'INSERT';
    const sql = `${insertOrIgnore} INTO "${this.tableName}" (${columns}) VALUES (${placeholders})`;
    this.log('createMany:', sql);

    const stmt = this.db.prepare(sql);
    let count = 0;

    const transaction = this.db.transaction((records: Array<Record<string, unknown>>) => {
      for (const record of records) {
        const values = keys.map(k => record[k] as SQLQueryBindings);
        const result = stmt.run(...values);
        if (result.changes > 0) count++;
      }
    });

    transaction(options.data as Array<Record<string, unknown>>);
    return { count };
  }

  async update(options: UpdateOptions<T>): Promise<T> {
    const data = options.data as Record<string, unknown>;
    const setClauses: string[] = [];
    const setParams: SQLQueryBindings[] = [];

    for (const [key, value] of Object.entries(data)) {
      setClauses.push(`"${key}" = ?`);
      setParams.push(value as SQLQueryBindings);
    }

    const { sql: whereClause, params: whereParams } = this.buildWhereClause(options.where);

    const sql = `UPDATE "${this.tableName}" SET ${setClauses.join(', ')} WHERE ${whereClause} RETURNING *`;
    const params = [...setParams, ...whereParams];
    this.log('update:', sql, params);

    const stmt = this.getStatement(sql);
    const result = stmt.get(...params) as T;
    return result;
  }

  async updateMany(options: UpdateManyOptions<T>): Promise<{ count: number }> {
    const data = options.data as Record<string, unknown>;
    const setClauses: string[] = [];
    const setParams: SQLQueryBindings[] = [];

    for (const [key, value] of Object.entries(data)) {
      setClauses.push(`"${key}" = ?`);
      setParams.push(value as SQLQueryBindings);
    }

    const { sql: whereClause, params: whereParams } = this.buildWhereClause(options.where);

    const sql = `UPDATE "${this.tableName}" SET ${setClauses.join(', ')} WHERE ${whereClause}`;
    const params = [...setParams, ...whereParams];
    this.log('updateMany:', sql, params);

    const stmt = this.getStatement(sql);
    const result = stmt.run(...params);
    return { count: result.changes };
  }

  async delete(options: DeleteOptions<T>): Promise<T> {
    // First fetch the record to return it
    const record = await this.findUnique({ where: options.where, select: options.select });

    if (!record) {
      throw new Error(`Record not found in ${this.tableName}`);
    }

    const { sql: whereClause, params } = this.buildWhereClause(options.where);
    const sql = `DELETE FROM "${this.tableName}" WHERE ${whereClause}`;
    this.log('delete:', sql, params);

    const stmt = this.getStatement(sql);
    stmt.run(...params);
    return record;
  }

  async deleteMany(options?: DeleteManyOptions<T>): Promise<{ count: number }> {
    let sql = `DELETE FROM "${this.tableName}"`;
    const params: SQLQueryBindings[] = [];

    if (options?.where) {
      const { sql: whereClause, params: whereParams } = this.buildWhereClause(options.where);
      if (whereClause) {
        sql += ` WHERE ${whereClause}`;
        params.push(...whereParams);
      }
    }

    this.log('deleteMany:', sql, params);

    const stmt = this.getStatement(sql);
    const result = stmt.run(...params);
    return { count: result.changes };
  }

  async upsert(options: UpsertOptions<T>): Promise<T> {
    const existing = await this.findUnique({ where: options.where });

    if (existing) {
      return this.update({ where: options.where, data: options.update, select: options.select });
    } else {
      return this.create({ data: options.create, select: options.select });
    }
  }

  async count(options?: CountOptions<T>): Promise<number> {
    let sql = `SELECT COUNT(*) as count FROM "${this.tableName}"`;
    const params: SQLQueryBindings[] = [];

    if (options?.where) {
      const { sql: whereClause, params: whereParams } = this.buildWhereClause(options.where);
      if (whereClause) {
        sql += ` WHERE ${whereClause}`;
        params.push(...whereParams);
      }
    }

    this.log('count:', sql, params);

    const stmt = this.getStatement(sql);
    const result = stmt.get(...params) as { count: number };
    return result.count;
  }

  async aggregate(options?: AggregateOptions<T>): Promise<Record<string, unknown>> {
    const selectParts: string[] = [];

    if (options?._count) {
      if (options._count === true) {
        selectParts.push('COUNT(*) as "_count"');
      } else {
        for (const [field, enabled] of Object.entries(options._count)) {
          if (enabled) {
            selectParts.push(`COUNT("${field}") as "_count_${field}"`);
          }
        }
      }
    }

    if (options?._sum) {
      for (const [field, enabled] of Object.entries(options._sum)) {
        if (enabled) {
          selectParts.push(`SUM("${field}") as "_sum_${field}"`);
        }
      }
    }

    if (options?._avg) {
      for (const [field, enabled] of Object.entries(options._avg)) {
        if (enabled) {
          selectParts.push(`AVG("${field}") as "_avg_${field}"`);
        }
      }
    }

    if (options?._min) {
      for (const [field, enabled] of Object.entries(options._min)) {
        if (enabled) {
          selectParts.push(`MIN("${field}") as "_min_${field}"`);
        }
      }
    }

    if (options?._max) {
      for (const [field, enabled] of Object.entries(options._max)) {
        if (enabled) {
          selectParts.push(`MAX("${field}") as "_max_${field}"`);
        }
      }
    }

    if (selectParts.length === 0) {
      selectParts.push('COUNT(*) as "_count"');
    }

    let sql = `SELECT ${selectParts.join(', ')} FROM "${this.tableName}"`;
    const params: SQLQueryBindings[] = [];

    if (options?.where) {
      const { sql: whereClause, params: whereParams } = this.buildWhereClause(options.where);
      if (whereClause) {
        sql += ` WHERE ${whereClause}`;
        params.push(...whereParams);
      }
    }

    this.log('aggregate:', sql, params);

    const stmt = this.getStatement(sql);
    const result = stmt.get(...params) as Record<string, unknown>;
    return result;
  }

  async groupBy(options: GroupByOptions<T>): Promise<Array<Record<string, unknown>>> {
    const groupByFields = options.by.map(field => `"${String(field)}"`);
    const selectParts = [...groupByFields];

    // Add aggregations
    if (options._count) {
      if (options._count === true) {
        selectParts.push('COUNT(*) as "_count"');
      } else {
        for (const [field, enabled] of Object.entries(options._count)) {
          if (enabled) {
            selectParts.push(`COUNT("${field}") as "_count_${field}"`);
          }
        }
      }
    }

    if (options._sum) {
      for (const [field, enabled] of Object.entries(options._sum)) {
        if (enabled) {
          selectParts.push(`SUM("${field}") as "_sum_${field}"`);
        }
      }
    }

    if (options._avg) {
      for (const [field, enabled] of Object.entries(options._avg)) {
        if (enabled) {
          selectParts.push(`AVG("${field}") as "_avg_${field}"`);
        }
      }
    }

    if (options._min) {
      for (const [field, enabled] of Object.entries(options._min)) {
        if (enabled) {
          selectParts.push(`MIN("${field}") as "_min_${field}"`);
        }
      }
    }

    if (options._max) {
      for (const [field, enabled] of Object.entries(options._max)) {
        if (enabled) {
          selectParts.push(`MAX("${field}") as "_max_${field}"`);
        }
      }
    }

    let sql = `SELECT ${selectParts.join(', ')} FROM "${this.tableName}"`;
    const params: SQLQueryBindings[] = [];

    if (options.where) {
      const { sql: whereClause, params: whereParams } = this.buildWhereClause(options.where);
      if (whereClause) {
        sql += ` WHERE ${whereClause}`;
        params.push(...whereParams);
      }
    }

    sql += ` GROUP BY ${groupByFields.join(', ')}`;

    if (options.having) {
      const { sql: havingClause, params: havingParams } = this.buildWhereClause(options.having);
      if (havingClause) {
        sql += ` HAVING ${havingClause}`;
        params.push(...havingParams);
      }
    }

    if (options.orderBy) {
      sql += this.buildOrderByClause(options.orderBy);
    }

    if (options.take !== undefined) {
      sql += ` LIMIT ?`;
      params.push(options.take);
    }

    if (options.skip !== undefined) {
      sql += options.take === undefined ? ' LIMIT -1' : '';
      sql += ` OFFSET ?`;
      params.push(options.skip);
    }

    this.log('groupBy:', sql, params);

    const stmt = this.getStatement(sql);
    const results = stmt.all(...params) as Array<Record<string, unknown>>;
    return results;
  }
}

// ============================================================================
// SQLite Database Client
// ============================================================================

/** Create SQLite database client */
export function createSQLiteClient(config: DatabaseConfig): DBClientWithTables {
  const database = new Database(config.url, { create: true });
  const tableModels = new Map<string, SQLiteTableModel<any>>();

  // Enable WAL mode for better concurrency
  database.exec('PRAGMA journal_mode = WAL');
  database.exec('PRAGMA foreign_keys = ON');

  function getTableModel<T extends Record<string, unknown>>(tableName: string): SQLiteTableModel<T> {
    let model = tableModels.get(tableName);
    if (!model) {
      model = new SQLiteTableModel<T>(database, tableName, config.debug);
      tableModels.set(tableName, model);
    }
    return model as SQLiteTableModel<T>;
  }

  const client: DBClient = {
    async query<T = unknown>(sql: string, params?: SQLQueryBindings[]): Promise<T[]> {
      if (config.debug) {
        console.log('[db] query:', sql, params);
      }
      const stmt = database.prepare(sql);
      return stmt.all(...(params || [])) as T[];
    },

    async execute(sql: string, params?: SQLQueryBindings[]): Promise<{ changes: number; lastInsertRowid: number }> {
      if (config.debug) {
        console.log('[db] execute:', sql, params);
      }
      const stmt = database.prepare(sql);
      const result = stmt.run(...(params || []));
      return { changes: result.changes, lastInsertRowid: Number(result.lastInsertRowid) };
    },

    async transaction<T>(fn: (tx: TransactionClient) => Promise<T>): Promise<T> {
      // Create a transaction-scoped client
      const txClient: TransactionClient = {
        getTable<U extends Record<string, unknown> = Record<string, unknown>>(tableName: string): TableModel<U> {
          return getTableModel<U>(tableName);
        },
      };

      // Use Bun's native transaction support
      const bunTransaction = database.transaction(async () => {
        return await fn(txClient);
      });

      return bunTransaction() as T;
    },

    async disconnect(): Promise<void> {
      database.close();
    },

    getRawConnection(): Database {
      return database;
    },

    async createTable(tableName: string, schema: TableSchema): Promise<void> {
      const columnDefs: string[] = [];

      for (const [columnName, definition] of Object.entries(schema)) {
        if (typeof definition === 'string') {
          columnDefs.push(`"${columnName}" ${definition}`);
        } else {
          let colDef = `"${columnName}" ${definition.type}`;

          if (definition.primaryKey) {
            colDef += ' PRIMARY KEY';
          }
          if (definition.autoIncrement) {
            colDef += ' AUTOINCREMENT';
          }
          if (definition.notNull) {
            colDef += ' NOT NULL';
          }
          if (definition.unique) {
            colDef += ' UNIQUE';
          }
          if (definition.default !== undefined) {
            const defaultValue = typeof definition.default === 'string'
              ? `'${definition.default}'`
              : definition.default;
            colDef += ` DEFAULT ${defaultValue}`;
          }
          if (definition.references) {
            colDef += ` REFERENCES "${definition.references.table}"("${definition.references.column}")`;
            if (definition.references.onDelete) {
              colDef += ` ON DELETE ${definition.references.onDelete}`;
            }
            if (definition.references.onUpdate) {
              colDef += ` ON UPDATE ${definition.references.onUpdate}`;
            }
          }

          columnDefs.push(colDef);
        }
      }

      const sql = `CREATE TABLE IF NOT EXISTS "${tableName}" (${columnDefs.join(', ')})`;
      if (config.debug) {
        console.log('[db] createTable:', sql);
      }
      database.exec(sql);
    },

    async dropTable(tableName: string): Promise<void> {
      const sql = `DROP TABLE IF EXISTS "${tableName}"`;
      if (config.debug) {
        console.log('[db] dropTable:', sql);
      }
      database.exec(sql);
    },

    async tableExists(tableName: string): Promise<boolean> {
      const result = database.prepare(
        `SELECT name FROM sqlite_master WHERE type='table' AND name=?`
      ).get(tableName);
      return result !== null;
    },

    getTable<T extends Record<string, unknown> = Record<string, unknown>>(tableName: string): TableModel<T> {
      return getTableModel<T>(tableName);
    },
  };

  // Create a proxy to allow dynamic table access (e.g., db.users, db.posts)
  return new Proxy(client as DBClientWithTables, {
    get(target, prop: string | symbol) {
      if (typeof prop === 'symbol') {
        return undefined;
      }

      // Return known methods from client
      if (prop in target) {
        return (target as any)[prop];
      }

      // Return table model for unknown properties (table names)
      return getTableModel(prop);
    },
  });
}

// ============================================================================
// Global Database Instance
// ============================================================================

let globalClient: DBClientWithTables | null = null;

/** Configuration function type */
type ConfigureFn = (config: DatabaseConfig) => void;

/** Database proxy type */
type DBProxy = DBClientWithTables & { configure: ConfigureFn };

/** Database proxy for global access */
export const db: DBProxy = new Proxy({} as DBProxy, {
  get(_, prop: string | symbol) {
    if (typeof prop === 'symbol') {
      return undefined;
    }

    if (prop === 'configure') {
      return (config: DatabaseConfig) => {
        globalClient = createSQLiteClient(config);
      };
    }

    if (!globalClient) {
      throw new Error(
        'Database not configured. Call db.configure({ provider: "sqlite", url: "./data.db" }) first.'
      );
    }

    return (globalClient as any)[prop];
  },
});

// ============================================================================
// Plugin Factory
// ============================================================================

/** Create database plugin */
export function createDatabasePlugin(config: DatabaseConfig): Plugin {
  return {
    name: '@ereo/db',

    async setup() {
      console.log(`[db] Initializing ${config.provider} connection to ${config.url}...`);

      // Configure global db instance
      db.configure(config);

      console.log('[db] Database initialized successfully');
    },

    configureServer(server) {
      server.middlewares.push(async (_request, ctx, next) => {
        // Attach db client to context for each request
        ctx.set('db', globalClient);
        return next();
      });
    },
  };
}

// ============================================================================
// Context Helper
// ============================================================================

/** Use database from context */
export function useDB(context: AppContext): DBClientWithTables {
  const client = context.get('db') as DBClientWithTables | undefined;
  if (!client) {
    throw new Error('Database not available in context. Ensure createDatabasePlugin is registered.');
  }
  return client;
}

// ============================================================================
// Type Utilities
// ============================================================================

/** Define a typed table model - use with db.getTable<YourType>('tablename') */
export function defineTable<T extends Record<string, unknown>>(): TableModel<T> {
  // This is a type helper - the actual implementation comes from the proxy
  return {} as TableModel<T>;
}

// ============================================================================
// Re-exports for backwards compatibility
// ============================================================================

/** Legacy DBClient interface for backwards compatibility */
export interface LegacyDBClient {
  query: (sql: string, params?: unknown[]) => Promise<unknown>;
  findMany: <T>(table: string, options?: { cache?: QueryCacheOptions }) => Promise<T[]>;
  findUnique: <T>(table: string, id: string | number) => Promise<T | null>;
  create: <T>(table: string, data: Record<string, unknown>) => Promise<T>;
  update: <T>(table: string, id: string | number, data: Record<string, unknown>) => Promise<T>;
  delete: <T>(table: string, id: string | number) => Promise<T>;
}
