# @ereo/db

Database adapter abstractions for the EreoJS framework. This package provides ORM-agnostic database abstractions including adapter interfaces, query deduplication, connection pooling primitives, and comprehensive type utilities for end-to-end type safety.

## Table of Contents

- [Overview](#overview)
- [Installation](#installation)
- [Quick Start](#quick-start)
- [API Reference](#api-reference)
  - [Plugin Factory](#plugin-factory)
  - [Context Helpers](#context-helpers)
  - [Adapter Interface](#adapter-interface)
  - [Query Deduplication](#query-deduplication)
  - [Connection Pool](#connection-pool)
  - [Retry Utilities](#retry-utilities)
  - [Error Classes](#error-classes)
  - [Types](#types)
- [Configuration Options](#configuration-options)
- [Use Cases](#use-cases)
- [Integration with Other Packages](#integration-with-other-packages)
- [Troubleshooting](#troubleshooting)
- [TypeScript Types Reference](#typescript-types-reference)

## Overview

`@ereo/db` is the core database abstraction layer for EreoJS applications. It provides:

- **Adapter Interface**: A standardized interface that ORM-specific adapters (Drizzle, Prisma, Kysely) implement for consistent database access patterns.
- **Query Deduplication**: Request-scoped caching that automatically deduplicates identical queries within a single request, eliminating N+1 query problems.
- **Connection Pooling**: Abstract connection pool primitives with presets for server, edge, and serverless environments.
- **Type Utilities**: End-to-end type safety with inference utilities compatible with Drizzle ORM.
- **Plugin Integration**: Seamless integration with EreoJS's plugin system for automatic lifecycle management.

## Installation

```bash
# Using bun
bun add @ereo/db

# Using npm
npm install @ereo/db

# Using pnpm
pnpm add @ereo/db
```

You will also need an ORM-specific adapter package:

```bash
# For Drizzle ORM
bun add @ereo/db-drizzle drizzle-orm

# With a database driver (e.g., postgres)
bun add postgres
```

## Quick Start

### 1. Configure the Database Plugin

```typescript
// ereo.config.ts
import { defineConfig } from '@ereo/core';
import { createDatabasePlugin } from '@ereo/db';
import { createDrizzleAdapter } from '@ereo/db-drizzle';
import * as schema from './db/schema';

const adapter = createDrizzleAdapter({
  driver: 'postgres-js',
  url: process.env.DATABASE_URL,
  schema,
});

export default defineConfig({
  plugins: [
    createDatabasePlugin(adapter),
  ],
});
```

### 2. Use in Route Loaders

```typescript
// routes/users.tsx
import { createLoader } from '@ereo/core';
import { useDb } from '@ereo/db';
import { users } from '../db/schema';
import { eq } from 'drizzle-orm';

export const loader = createLoader({
  load: async ({ context, params }) => {
    const db = useDb(context);

    // Queries are automatically deduplicated within the same request
    const user = await db.client
      .select()
      .from(users)
      .where(eq(users.id, params.id));

    return { user };
  },
});
```

### 3. Use Transactions in Actions

```typescript
// routes/users.tsx
import { createAction } from '@ereo/core';
import { withTransaction } from '@ereo/db';
import { users, profiles } from '../db/schema';

export const action = createAction({
  async run({ context, formData }) {
    return withTransaction(context, async (tx) => {
      const [user] = await tx.insert(users).values({
        name: formData.get('name'),
        email: formData.get('email'),
      }).returning();

      await tx.insert(profiles).values({
        userId: user.id,
        bio: formData.get('bio'),
      });

      return { success: true, userId: user.id };
    });
  },
});
```

## API Reference

### Plugin Factory

#### `createDatabasePlugin(adapter, options?)`

Creates an EreoJS plugin that integrates a database adapter with the framework's request lifecycle.

```typescript
import { createDatabasePlugin } from '@ereo/db';

const plugin = createDatabasePlugin(adapter, {
  registerDefault: true,    // Register as the default adapter (default: true)
  registrationName: 'main', // Name for adapter registration (default: adapter.name)
  debug: false,             // Enable debug logging (default: false)
});
```

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `adapter` | `DatabaseAdapter<TSchema>` | The database adapter instance |
| `options` | `DatabasePluginOptions` | Optional plugin configuration |

**Options:**

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `registerDefault` | `boolean` | `true` | Register this adapter as the default |
| `registrationName` | `string` | `adapter.name` | Name to register the adapter under |
| `debug` | `boolean` | `false` | Enable debug logging |

**Lifecycle:**

1. **Setup**: Registers the adapter globally and performs a health check
2. **Middleware**: Attaches request-scoped clients to context for each request
3. **Shutdown**: Handles cleanup when the application stops

---

### Context Helpers

#### `useDb(context)`

Get the database client from request context. Use this in loaders, actions, and middleware.

```typescript
import { useDb } from '@ereo/db';

export const loader = createLoader({
  load: async ({ context }) => {
    const db = useDb(context);

    // Access the underlying ORM client
    const users = await db.client.select().from(usersTable);

    // Execute raw SQL with deduplication
    const result = await db.query('SELECT * FROM users WHERE id = ?', [1]);

    // Get deduplication statistics
    const stats = db.getDedupStats();
    console.log(`Cache hit rate: ${stats.hitRate * 100}%`);

    return { users };
  },
});
```

**Returns:** `RequestScopedClient<TSchema>`

**Throws:** `Error` if the database plugin is not configured

---

#### `useAdapter(context)`

Get the raw database adapter from context. Use this when you need direct adapter access.

```typescript
import { useAdapter } from '@ereo/db';

export const action = createAction({
  async run({ context }) {
    const adapter = useAdapter(context);

    // Manual transaction control
    const tx = await adapter.beginTransaction();
    try {
      // ... perform operations
      await tx.commit();
    } catch (error) {
      await tx.rollback();
      throw error;
    }
  },
});
```

**Returns:** `DatabaseAdapter<TSchema>`

**Throws:** `Error` if the database plugin is not configured

---

#### `getDb()`

Get the default registered database adapter. Use this outside of request context (e.g., in scripts or background jobs).

```typescript
import { getDb } from '@ereo/db';

// In a background job or script
async function cleanupOldRecords() {
  const adapter = getDb();
  if (!adapter) {
    throw new Error('Database not configured');
  }

  await adapter.execute(
    'DELETE FROM sessions WHERE expires_at < NOW()'
  );
}
```

**Returns:** `DatabaseAdapter<TSchema> | undefined`

---

#### `withTransaction(context, fn)`

Run a function within a database transaction using request context. Automatically clears the deduplication cache after the transaction completes.

```typescript
import { withTransaction } from '@ereo/db';

export const action = createAction({
  async run({ context }) {
    const result = await withTransaction(context, async (tx) => {
      // All operations use the same transaction
      const [order] = await tx.insert(orders).values({
        userId: 1,
        total: 99.99,
      }).returning();

      await tx.insert(orderItems).values([
        { orderId: order.id, productId: 1, quantity: 2 },
        { orderId: order.id, productId: 3, quantity: 1 },
      ]);

      return order;
    });

    return { orderId: result.id };
  },
});
```

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `context` | `AppContext` | The request context |
| `fn` | `(tx: TSchema) => Promise<TResult>` | Function to run within the transaction |

**Returns:** `Promise<TResult>`

---

### Adapter Interface

#### `DatabaseAdapter<TSchema>`

The core interface that all ORM adapters must implement.

```typescript
interface DatabaseAdapter<TSchema = unknown> {
  /** Human-readable adapter name */
  readonly name: string;

  /** Whether this adapter is compatible with edge runtimes */
  readonly edgeCompatible: boolean;

  /** Get the underlying database client */
  getClient(): TSchema;

  /** Get a request-scoped client with query deduplication */
  getRequestClient(context: AppContext): RequestScopedClient<TSchema>;

  /** Execute a raw SQL query */
  query<T = unknown>(sql: string, params?: unknown[]): Promise<QueryResult<T>>;

  /** Execute a raw SQL statement that modifies data */
  execute(sql: string, params?: unknown[]): Promise<MutationResult>;

  /** Run operations within a transaction */
  transaction<T>(
    fn: (tx: TSchema) => Promise<T>,
    options?: TransactionOptions
  ): Promise<T>;

  /** Begin a manual transaction */
  beginTransaction(options?: TransactionOptions): Promise<Transaction<TSchema>>;

  /** Check database connectivity and health */
  healthCheck(): Promise<HealthCheckResult>;

  /** Disconnect from the database */
  disconnect(): Promise<void>;
}
```

---

#### `RequestScopedClient<TSchema>`

Request-scoped database client with automatic query deduplication.

```typescript
interface RequestScopedClient<TSchema> {
  /** The underlying database client (e.g., Drizzle instance) */
  readonly client: TSchema;

  /** Execute a raw SQL query with automatic deduplication */
  query<T = unknown>(sql: string, params?: unknown[]): Promise<DedupResult<QueryResult<T>>>;

  /** Get deduplication statistics for this request */
  getDedupStats(): DedupStats;

  /** Clear the deduplication cache */
  clearDedup(): void;

  /** Mark that a mutation has occurred, clearing relevant cache entries */
  invalidate(tables?: string[]): void;
}
```

---

#### `Transaction<TSchema>`

Manual transaction handle for explicit control.

```typescript
interface Transaction<TSchema> {
  /** The transaction-scoped database client */
  readonly client: TSchema;

  /** Commit the transaction */
  commit(): Promise<void>;

  /** Rollback the transaction */
  rollback(): Promise<void>;

  /** Whether the transaction is still active */
  readonly isActive: boolean;
}
```

---

#### Adapter Registry Functions

##### `registerAdapter(name, adapter)`

Register an adapter instance globally for access from anywhere in the application.

```typescript
import { registerAdapter } from '@ereo/db';

registerAdapter('primary', primaryAdapter);
registerAdapter('readonly', readonlyAdapter);
```

##### `getAdapter(name)`

Get a registered adapter by name.

```typescript
import { getAdapter } from '@ereo/db';

const primary = getAdapter('primary');
const readonly = getAdapter('readonly');
```

##### `getDefaultAdapter()`

Get the first registered adapter (useful when only one adapter is configured).

```typescript
import { getDefaultAdapter } from '@ereo/db';

const adapter = getDefaultAdapter();
```

##### `clearAdapterRegistry()`

Clear all registered adapters. Useful for testing.

```typescript
import { clearAdapterRegistry } from '@ereo/db';

afterEach(() => {
  clearAdapterRegistry();
});
```

---

### Query Deduplication

Query deduplication automatically caches identical queries within a single request, eliminating redundant database calls.

#### `generateFingerprint(query, params?)`

Generate a deterministic cache key for a query and its parameters.

```typescript
import { generateFingerprint } from '@ereo/db';

const key1 = generateFingerprint('SELECT * FROM users WHERE id = ?', [1]);
const key2 = generateFingerprint('SELECT * FROM users WHERE id = ?', [1]);
// key1 === key2

const key3 = generateFingerprint('SELECT * FROM users WHERE id = ?', [2]);
// key1 !== key3
```

**Features:**
- Normalizes whitespace in SQL queries
- Handles special types: `Date`, `bigint`, `undefined`
- Uses djb2 hashing algorithm for fast, consistent fingerprints

---

#### `dedupQuery(context, query, params, executor, options?)`

Execute a query with automatic deduplication. Returns cached results for identical queries within the same request.

```typescript
import { dedupQuery } from '@ereo/db';

const result = await dedupQuery(
  context,
  'SELECT * FROM users WHERE id = ?',
  [userId],
  async () => {
    // This only executes on cache miss
    return db.query('SELECT * FROM users WHERE id = ?', [userId]);
  },
  {
    tables: ['users'],  // Tables affected (for selective invalidation)
    noCache: false,     // Skip caching for this query
  }
);

console.log(result.fromCache);  // true if served from cache
console.log(result.cacheKey);   // The fingerprint used
console.log(result.result);     // The query result
```

**Options:**

| Option | Type | Description |
|--------|------|-------------|
| `tables` | `string[]` | Tables affected by this query (for selective invalidation) |
| `noCache` | `boolean` | Skip caching for this query |

---

#### `clearDedupCache(context)`

Clear the entire deduplication cache for a request. Call this after mutations to ensure subsequent reads get fresh data.

```typescript
import { clearDedupCache } from '@ereo/db';

// After a mutation
await db.execute('UPDATE users SET name = ? WHERE id = ?', ['Alice', 1]);
clearDedupCache(context);
```

---

#### `invalidateTables(context, tables)`

Selectively invalidate cache entries related to specific tables.

```typescript
import { invalidateTables } from '@ereo/db';

// Only invalidate user-related cached queries
await db.execute('UPDATE users SET name = ? WHERE id = ?', ['Alice', 1]);
invalidateTables(context, ['users']);

// Queries for 'posts' table are still cached
```

**Note:** Table name matching is case-insensitive.

---

#### `getRequestDedupStats(context)`

Get deduplication statistics for the current request.

```typescript
import { getRequestDedupStats } from '@ereo/db';

const stats = getRequestDedupStats(context);
console.log({
  total: stats.total,           // Total queries attempted
  deduplicated: stats.deduplicated, // Queries served from cache
  unique: stats.unique,         // Unique queries executed
  hitRate: stats.hitRate,       // Cache hit rate (0-1)
});
```

---

#### `debugGetCacheContents(context)`

Get the current cache contents for debugging. Only use in development.

```typescript
import { debugGetCacheContents } from '@ereo/db';

if (process.env.NODE_ENV === 'development') {
  const contents = debugGetCacheContents(context);
  contents.forEach(entry => {
    console.log({
      key: entry.key,
      tables: entry.tables,
      age: entry.age,  // milliseconds since cached
    });
  });
}
```

---

### Connection Pool

Abstract connection pooling utilities that adapters can extend.

#### `ConnectionPool<T>`

Abstract base class for connection pools. Extend this to create ORM-specific pools.

```typescript
import { ConnectionPool } from '@ereo/db';

class PostgresPool extends ConnectionPool<pg.Client> {
  protected async createConnection(): Promise<pg.Client> {
    const client = new pg.Client(this.connectionString);
    await client.connect();
    return client;
  }

  protected async closeConnection(connection: pg.Client): Promise<void> {
    await connection.end();
  }

  protected async validateConnection(connection: pg.Client): Promise<boolean> {
    try {
      await connection.query('SELECT 1');
      return true;
    } catch {
      return false;
    }
  }
}
```

**Methods:**

| Method | Description |
|--------|-------------|
| `acquire()` | Acquire a connection from the pool |
| `release(connection)` | Release a connection back to the pool |
| `close()` | Close the pool and all connections |
| `getStats()` | Get pool statistics |
| `healthCheck()` | Check if the pool is healthy |

---

#### `DEFAULT_POOL_CONFIG`

Default pool configuration for server environments.

```typescript
import { DEFAULT_POOL_CONFIG } from '@ereo/db';

// {
//   min: 2,
//   max: 10,
//   idleTimeoutMs: 30000,
//   acquireTimeoutMs: 10000,
//   acquireRetries: 3,
// }
```

---

#### `createEdgePoolConfig(overrides?)`

Create pool configuration optimized for edge environments (Cloudflare Workers, Vercel Edge).

```typescript
import { createEdgePoolConfig } from '@ereo/db';

const config = createEdgePoolConfig({
  max: 2,  // Override specific settings
});

// {
//   min: 0,
//   max: 2,
//   idleTimeoutMs: 0,
//   acquireTimeoutMs: 5000,
//   acquireRetries: 2,
// }
```

---

#### `createServerlessPoolConfig(overrides?)`

Create pool configuration for serverless environments (AWS Lambda, Vercel Functions).

```typescript
import { createServerlessPoolConfig } from '@ereo/db';

const config = createServerlessPoolConfig();

// {
//   min: 0,
//   max: 5,
//   idleTimeoutMs: 10000,
//   acquireTimeoutMs: 8000,
//   acquireRetries: 2,
// }
```

---

#### `PoolStats`

Statistics about connection pool state.

```typescript
interface PoolStats {
  active: number;       // Connections currently in use
  idle: number;         // Idle connections available
  total: number;        // Total connections (active + idle)
  waiting: number;      // Requests waiting for a connection
  totalCreated: number; // Total connections created over lifetime
  totalClosed: number;  // Total connections closed over lifetime
}
```

---

### Retry Utilities

#### `withRetry(operation, config?)`

Execute an operation with automatic retry logic and exponential backoff.

```typescript
import { withRetry, isCommonRetryableError } from '@ereo/db';

const result = await withRetry(
  async () => {
    return db.query('SELECT * FROM users');
  },
  {
    maxAttempts: 3,
    baseDelayMs: 100,
    maxDelayMs: 5000,
    exponential: true,
    isRetryable: isCommonRetryableError,
  }
);
```

**Configuration:**

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `maxAttempts` | `number` | `3` | Maximum retry attempts |
| `baseDelayMs` | `number` | `100` | Base delay between retries |
| `maxDelayMs` | `number` | `5000` | Maximum delay between retries |
| `exponential` | `boolean` | `true` | Use exponential backoff |
| `isRetryable` | `(error: Error) => boolean` | - | Custom retry condition |

---

#### `isCommonRetryableError(error)`

Check if an error is commonly retryable (connection issues, deadlocks, etc.).

```typescript
import { isCommonRetryableError } from '@ereo/db';

// Returns true for:
// - Connection refused/reset/closed/timeout
// - Deadlock detected
// - Serialization failure
// - Too many connections

isCommonRetryableError(new Error('Connection refused'));  // true
isCommonRetryableError(new Error('Deadlock detected'));   // true
isCommonRetryableError(new Error('Syntax error'));        // false
```

---

#### `DEFAULT_RETRY_CONFIG`

Default retry configuration.

```typescript
import { DEFAULT_RETRY_CONFIG } from '@ereo/db';

// {
//   maxAttempts: 3,
//   baseDelayMs: 100,
//   maxDelayMs: 5000,
//   exponential: true,
// }
```

---

### Error Classes

All error classes extend `DatabaseError` and include error codes for programmatic handling.

#### `DatabaseError`

Base database error class.

```typescript
import { DatabaseError } from '@ereo/db';

const error = new DatabaseError('Something went wrong', 'CUSTOM_CODE', cause);
console.log(error.name);    // 'DatabaseError'
console.log(error.code);    // 'CUSTOM_CODE'
console.log(error.cause);   // Original error
```

---

#### `ConnectionError`

Connection-related errors (code: `CONNECTION_ERROR`).

```typescript
import { ConnectionError } from '@ereo/db';

try {
  await adapter.connect();
} catch (error) {
  if (error instanceof ConnectionError) {
    console.log('Failed to connect:', error.message);
  }
}
```

---

#### `QueryError`

Query execution errors (code: `QUERY_ERROR`).

```typescript
import { QueryError } from '@ereo/db';

const error = new QueryError(
  'Syntax error near "FORM"',
  'SELECT * FORM users',  // The problematic query
  [1, 2, 3],               // Parameters
  originalError
);

console.log(error.query);   // 'SELECT * FORM users'
console.log(error.params);  // [1, 2, 3]
```

---

#### `TransactionError`

Transaction errors (code: `TRANSACTION_ERROR`).

```typescript
import { TransactionError } from '@ereo/db';

try {
  await adapter.transaction(async (tx) => {
    // ...
  });
} catch (error) {
  if (error instanceof TransactionError) {
    console.log('Transaction failed:', error.message);
  }
}
```

---

#### `TimeoutError`

Timeout errors (code: `TIMEOUT_ERROR`).

```typescript
import { TimeoutError } from '@ereo/db';

const error = new TimeoutError('Query timed out', 5000);
console.log(error.timeoutMs);  // 5000
```

---

### Types

#### Query Result Types

```typescript
/** Result of a SELECT query */
interface QueryResult<T = unknown> {
  rows: T[];
  rowCount: number;
}

/** Result of an INSERT/UPDATE/DELETE mutation */
interface MutationResult {
  rowsAffected: number;
  lastInsertId?: number | bigint;
}

/** Result wrapper with deduplication metadata */
interface DedupResult<T> {
  result: T;
  fromCache: boolean;
  cacheKey: string;
}

/** Deduplication statistics */
interface DedupStats {
  total: number;        // Total queries attempted
  deduplicated: number; // Queries served from cache
  unique: number;       // Unique queries executed
  hitRate: number;      // Cache hit rate (0-1)
}
```

---

#### Configuration Types

```typescript
/** Connection pool configuration */
interface PoolConfig {
  min?: number;              // Minimum connections (default: 2)
  max?: number;              // Maximum connections (default: 10)
  idleTimeoutMs?: number;    // Idle timeout in ms (default: 30000)
  acquireTimeoutMs?: number; // Acquire timeout in ms (default: 10000)
  acquireRetries?: number;   // Max acquire retries (default: 3)
}

/** Transaction isolation levels */
type IsolationLevel =
  | 'read uncommitted'
  | 'read committed'
  | 'repeatable read'
  | 'serializable';

/** Transaction configuration */
interface TransactionOptions {
  isolationLevel?: IsolationLevel;
  readOnly?: boolean;
  timeout?: number;  // Timeout in milliseconds
}

/** Base adapter configuration */
interface AdapterConfig {
  url: string;
  debug?: boolean;
  pool?: PoolConfig;
  edgeCompatible?: boolean;
}
```

---

#### Type Inference Utilities

```typescript
/** Infer the select type from a Drizzle table */
type InferSelect<T extends { $inferSelect: unknown }> = T['$inferSelect'];

/** Infer the insert type from a Drizzle table */
type InferInsert<T extends { $inferInsert: unknown }> = T['$inferInsert'];

// Usage:
type User = InferSelect<typeof users>;
type NewUser = InferInsert<typeof users>;
```

---

#### Module Augmentation for Typed Tables

```typescript
// In your project's types file
declare module '@ereo/db' {
  interface DatabaseTables {
    users: typeof import('./schema').users;
    posts: typeof import('./schema').posts;
  }
}

// Now you get typed table access
type UserTable = TableType<'users'>;
type AllTableNames = TableNames;  // 'users' | 'posts'
```

---

#### Query Builder Types

```typescript
/** Typed WHERE clause conditions */
type TypedWhere<T> = {
  [K in keyof T]?: T[K] | WhereOperator<T[K]>;
} & {
  AND?: TypedWhere<T>[];
  OR?: TypedWhere<T>[];
  NOT?: TypedWhere<T>;
};

/** WHERE clause operators */
interface WhereOperator<T> {
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
type TypedOrderBy<T> = {
  [K in keyof T]?: 'asc' | 'desc';
};

/** Typed SELECT fields */
type TypedSelect<T> = (keyof T)[] | '*';
```

---

#### Health Check Result

```typescript
interface HealthCheckResult {
  healthy: boolean;
  latencyMs: number;
  error?: string;
  metadata?: Record<string, unknown>;
}
```

---

## Configuration Options

### Pool Configuration Presets

| Environment | `min` | `max` | `idleTimeoutMs` | `acquireTimeoutMs` | `acquireRetries` |
|-------------|-------|-------|-----------------|--------------------|--------------------|
| Server (default) | 2 | 10 | 30000 | 10000 | 3 |
| Edge | 0 | 1 | 0 | 5000 | 2 |
| Serverless | 0 | 5 | 10000 | 8000 | 2 |

---

## Use Cases

### Avoiding N+1 Queries

Query deduplication automatically prevents N+1 queries in nested loaders:

```typescript
// Parent loader
export const loader = createLoader({
  load: async ({ context }) => {
    const db = useDb(context);
    const posts = await db.client.select().from(postsTable);
    return { posts };
  },
});

// Child component that runs for each post
function PostAuthor({ postId }) {
  // Even if this runs 100 times, the query only executes once
  const author = useLoaderData(async (context) => {
    const db = useDb(context);
    return db.client
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, postId));
  });
}
```

### Optimistic Updates with Cache Invalidation

```typescript
export const action = createAction({
  async run({ context, formData }) {
    const db = useDb(context);

    // Perform the update
    await db.client
      .update(usersTable)
      .set({ name: formData.get('name') })
      .where(eq(usersTable.id, formData.get('id')));

    // Invalidate only user-related cached queries
    db.invalidate(['users']);

    return { success: true };
  },
});
```

### Background Jobs with Direct Adapter Access

```typescript
import { getDb } from '@ereo/db';

async function processExpiredSessions() {
  const adapter = getDb();
  if (!adapter) {
    throw new Error('Database not configured');
  }

  const result = await adapter.execute(
    'DELETE FROM sessions WHERE expires_at < NOW()'
  );

  console.log(`Cleaned up ${result.rowsAffected} expired sessions`);
}
```

### Custom Connection Pool

```typescript
import { ConnectionPool, createServerlessPoolConfig } from '@ereo/db';

class CustomPool extends ConnectionPool<MyConnection> {
  constructor() {
    super(createServerlessPoolConfig({
      max: 3,  // Limit for serverless
    }));
  }

  protected async createConnection() {
    return new MyConnection(process.env.DATABASE_URL);
  }

  protected async closeConnection(conn: MyConnection) {
    await conn.close();
  }

  protected async validateConnection(conn: MyConnection) {
    return conn.isAlive();
  }
}
```

---

## Integration with Other Packages

### @ereo/db-drizzle

The official Drizzle ORM adapter for `@ereo/db`.

```typescript
import { createDrizzleAdapter, definePostgresConfig } from '@ereo/db-drizzle';
import { createDatabasePlugin } from '@ereo/db';

const adapter = createDrizzleAdapter(definePostgresConfig({
  url: process.env.DATABASE_URL,
  schema,
}));

export default defineConfig({
  plugins: [createDatabasePlugin(adapter)],
});
```

### @ereo/core

The database plugin integrates with EreoJS's plugin system:

```typescript
import { defineConfig } from '@ereo/core';
import { createDatabasePlugin } from '@ereo/db';

export default defineConfig({
  plugins: [
    createDatabasePlugin(adapter),
    // Other plugins...
  ],
});
```

The plugin automatically:
- Registers the adapter during setup
- Attaches request-scoped clients via middleware
- Performs health checks on startup

---

## Troubleshooting

### "Database not available in context"

**Cause:** `useDb()` was called before the database plugin middleware ran.

**Solution:** Ensure `createDatabasePlugin` is registered in your config:

```typescript
export default defineConfig({
  plugins: [createDatabasePlugin(adapter)],
});
```

### "Database not connected"

**Cause:** Attempting to use `getClient()` before the adapter connected.

**Solution:** Use `useDb()` in request context, or call `healthCheck()` first:

```typescript
const adapter = getDb();
const health = await adapter.healthCheck();
if (health.healthy) {
  const client = adapter.getClient();
}
```

### High Memory Usage from Deduplication

**Cause:** Very large result sets being cached.

**Solution:** Skip caching for large queries:

```typescript
await dedupQuery(context, sql, params, executor, { noCache: true });
```

### Connection Pool Exhaustion

**Symptoms:** `TimeoutError: Timed out waiting for connection`

**Solutions:**
1. Increase `max` connections
2. Ensure connections are properly released
3. Check for connection leaks in your code
4. Use appropriate pool presets for your environment

```typescript
const config = createServerlessPoolConfig({
  max: 10,
  acquireTimeoutMs: 15000,
});
```

---

## TypeScript Types Reference

All types are exported from the main package entry point:

```typescript
import {
  // Adapter types
  type DatabaseAdapter,
  type RequestScopedClient,
  type Transaction,
  type AdapterFactory,

  // Result types
  type QueryResult,
  type MutationResult,
  type DedupResult,
  type DedupStats,

  // Configuration types
  type PoolConfig,
  type AdapterConfig,
  type TransactionOptions,
  type IsolationLevel,
  type PoolStats,
  type RetryConfig,
  type HealthCheckResult,

  // Type inference utilities
  type InferSelect,
  type InferInsert,
  type DatabaseTables,
  type TableNames,
  type TableType,

  // Query builder types
  type TypedWhere,
  type WhereOperator,
  type TypedOrderBy,
  type TypedSelect,

  // Plugin types
  type DatabasePluginOptions,

  // Error classes
  DatabaseError,
  ConnectionError,
  QueryError,
  TransactionError,
  TimeoutError,
} from '@ereo/db';
```

---

## License

MIT
