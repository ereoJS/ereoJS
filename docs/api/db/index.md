# @ereo/db

Core database abstraction package for EreoJS. Provides ORM-agnostic database adapters with request-scoped query deduplication, connection pooling, and type-safe APIs.

## Installation

```bash
bun add @ereo/db
```

## Overview

The `@ereo/db` package provides:

1. **Adapter Interface** - Standardized interface for any ORM or database driver
2. **Query Deduplication** - Automatic caching of identical queries within a request
3. **Connection Pooling** - Abstract pool primitives for connection management
4. **Plugin Integration** - Seamless integration with EreoJS plugin system
5. **Type Safety** - Full TypeScript support with type inference utilities

## Quick Start

### 1. Create an Adapter

Use an adapter package (like `@ereo/db-drizzle`) or create your own:

```ts
import { createDrizzleAdapter } from '@ereo/db-drizzle';
import { createDatabasePlugin } from '@ereo/db';
import * as schema from './schema';

const adapter = createDrizzleAdapter({
  driver: 'postgres-js',
  url: process.env.DATABASE_URL,
  schema,
});

export default defineConfig({
  plugins: [createDatabasePlugin(adapter)],
});
```

### 2. Use in Routes

```ts
import { createLoader } from '@ereo/data';
import { useDb } from '@ereo/db';

export const loader = createLoader({
  load: async ({ context }) => {
    const db = useDb(context);
    return db.client.select().from(users).where(eq(users.active, true));
  },
});
```

## Core APIs

### createDatabasePlugin

Creates an EreoJS plugin that integrates a database adapter with the framework's request lifecycle.

```ts
function createDatabasePlugin<TSchema>(
  adapter: DatabaseAdapter<TSchema>,
  options?: DatabasePluginOptions
): Plugin;
```

#### Options

```ts
interface DatabasePluginOptions {
  /** Register this adapter as the default */
  registerDefault?: boolean; // default: true

  /** Name to register the adapter under */
  registrationName?: string; // default: adapter.name

  /** Enable debug logging */
  debug?: boolean; // default: false
}
```

#### Example

```ts
// Register with custom name
const adapter = createDrizzleAdapter(config);

export default defineConfig({
  plugins: [
    createDatabasePlugin(adapter, {
      registrationName: 'primary',
      debug: process.env.NODE_ENV === 'development',
    }),
  ],
});
```

### useDb

Get the request-scoped database client from context. This is the primary way to access the database in loaders and actions.

```ts
function useDb<TSchema = unknown>(
  context: AppContext
): RequestScopedClient<TSchema>;
```

```ts
import { createLoader } from '@ereo/data';
import { useDb } from '@ereo/db';

export const loader = createLoader({
  load: async ({ context }) => {
    const db = useDb(context);

    // Access the underlying ORM client
    const users = await db.client.select().from(usersTable);

    // Execute raw SQL with deduplication
    const result = await db.query('SELECT * FROM users WHERE active = $1', [true]);

    return { users: result.result.rows };
  },
});
```

#### RequestScopedClient Interface

```ts
interface RequestScopedClient<TSchema> {
  /** The underlying database client (e.g., Drizzle instance) */
  readonly client: TSchema;

  /** Execute raw SQL with automatic deduplication */
  query<T>(sql: string, params?: unknown[]): Promise<DedupResult<QueryResult<T>>>;

  /** Get deduplication statistics for this request */
  getDedupStats(): DedupStats;

  /** Clear the deduplication cache */
  clearDedup(): void;

  /** Invalidate specific tables from the dedup cache */
  invalidate(tables?: string[]): void;
}
```

### useAdapter

Get the raw database adapter from context. Use this when you need direct adapter access (e.g., for transactions).

```ts
function useAdapter<TSchema = unknown>(
  context: AppContext
): DatabaseAdapter<TSchema>;
```

```ts
import { createAction } from '@ereo/data';
import { useAdapter, withTransaction } from '@ereo/db';

export const action = createAction({
  handler: async ({ context, formData }) => {
    const adapter = useAdapter(context);

    // Use adapter directly for transactions
    return adapter.transaction(async (tx) => {
      const user = await tx.insert(users).values({ name: formData.get('name') }).returning();
      await tx.insert(profiles).values({ userId: user[0].id });
      return { success: true };
    });
  },
});
```

### getDb

Get the default registered database adapter outside of request context. Useful for scripts, background jobs, or seed files.

```ts
function getDb<TSchema = unknown>(): DatabaseAdapter<TSchema> | undefined;
```

```ts
// In a seed script
import { getDb } from '@ereo/db';

async function seed() {
  const adapter = getDb();
  if (!adapter) {
    throw new Error('Database not initialized');
  }

  const db = adapter.getClient();
  await db.insert(users).values([
    { name: 'Admin', email: 'admin@example.com' },
    { name: 'User', email: 'user@example.com' },
  ]);
}

seed();
```

### withTransaction

Run a function within a database transaction using request context. Automatically clears the dedup cache after the transaction.

```ts
function withTransaction<TSchema, TResult>(
  context: AppContext,
  fn: (tx: TSchema) => Promise<TResult>
): Promise<TResult>;
```

```ts
import { createAction } from '@ereo/data';
import { withTransaction } from '@ereo/db';

export const action = createAction({
  handler: async ({ context }) => {
    return withTransaction(context, async (tx) => {
      const order = await tx.insert(orders).values({ total: 100 }).returning();
      await tx.insert(orderItems).values([
        { orderId: order[0].id, productId: 1, quantity: 2 },
        { orderId: order[0].id, productId: 2, quantity: 1 },
      ]);
      return { orderId: order[0].id };
    });
  },
});
```

## Query Deduplication

The `@ereo/db` package automatically deduplicates identical queries within a single request. This prevents N+1 query problems in nested loaders.

### How It Works

```ts
// In a parent loader
export const loader = createLoader({
  load: async ({ context }) => {
    const db = useDb(context);

    // First query - hits the database
    const users = await db.query('SELECT * FROM users WHERE id = $1', [1]);

    // Same query - served from cache, no database hit
    const usersAgain = await db.query('SELECT * FROM users WHERE id = $1', [1]);

    return { users: users.result.rows };
  },
});
```

### Deduplication API

#### generateFingerprint

Generate a cache key for a query:

```ts
function generateFingerprint(query: string, params?: unknown[]): string;
```

```ts
import { generateFingerprint } from '@ereo/db';

const key1 = generateFingerprint('SELECT * FROM users WHERE id = $1', [1]);
const key2 = generateFingerprint('SELECT   *   FROM users WHERE id = $1', [1]); // Same key (whitespace normalized)
```

#### dedupQuery

Execute a query with deduplication:

```ts
async function dedupQuery<T>(
  context: AppContext,
  query: string,
  params: unknown[] | undefined,
  executor: () => Promise<T>,
  options?: { tables?: string[]; noCache?: boolean }
): Promise<DedupResult<T>>;
```

```ts
import { dedupQuery } from '@ereo/db';

const result = await dedupQuery(
  context,
  'SELECT * FROM posts WHERE author_id = $1',
  [userId],
  async () => db.select().from(posts).where(eq(posts.authorId, userId)),
  { tables: ['posts'] } // For selective invalidation
);

console.log(result.fromCache); // true if served from cache
console.log(result.cacheKey); // The cache key used
```

#### invalidateTables

Invalidate cache entries for specific tables:

```ts
function invalidateTables(context: AppContext, tables: string[]): void;
```

```ts
import { invalidateTables } from '@ereo/db';

export const action = createAction({
  handler: async ({ context }) => {
    const db = useDb(context);

    // After mutation, invalidate posts cache
    await db.client.insert(posts).values({ title: 'New Post' });
    db.invalidate(['posts']);

    return { success: true };
  },
});
```

#### clearDedupCache

Clear all deduplication cache for the request:

```ts
function clearDedupCache(context: AppContext): void;
```

#### getRequestDedupStats

Get statistics about query deduplication:

```ts
function getRequestDedupStats(context: AppContext): DedupStats;
```

```ts
import { getRequestDedupStats } from '@ereo/db';

const stats = getRequestDedupStats(context);
console.log(`Hit rate: ${(stats.hitRate * 100).toFixed(1)}%`);
console.log(`${stats.deduplicated} cached, ${stats.unique} unique queries`);
```

#### debugGetCacheContents

Get current cache contents for debugging (development only):

```ts
function debugGetCacheContents(context: AppContext): Array<{
  key: string;
  tables?: string[];
  age: number; // milliseconds
}>;
```

## Connection Pooling

Abstract connection pool that adapters can extend.

### ConnectionPool

```ts
abstract class ConnectionPool<T> {
  constructor(config?: PoolConfig);

  async acquire(): Promise<T>;
  async release(connection: T): Promise<void>;
  async close(): Promise<void>;
  getStats(): PoolStats;
  async healthCheck(): Promise<HealthCheckResult>;
}
```

### Pool Configuration

#### DEFAULT_POOL_CONFIG

```ts
const DEFAULT_POOL_CONFIG: Required<PoolConfig> = {
  min: 2,
  max: 10,
  idleTimeoutMs: 30000,
  acquireTimeoutMs: 10000,
  acquireRetries: 3,
};
```

#### createEdgePoolConfig

Optimized for edge runtimes (Cloudflare Workers, Vercel Edge):

```ts
function createEdgePoolConfig(overrides?: Partial<PoolConfig>): PoolConfig;
```

```ts
import { createEdgePoolConfig } from '@ereo/db';

const config = createEdgePoolConfig({
  max: 1, // Edge environments typically use single connections
});
```

#### createServerlessPoolConfig

Optimized for serverless environments (AWS Lambda, Vercel Functions):

```ts
function createServerlessPoolConfig(overrides?: Partial<PoolConfig>): PoolConfig;
```

```ts
import { createServerlessPoolConfig } from '@ereo/db';

const config = createServerlessPoolConfig({
  max: 5,
  idleTimeoutMs: 10000,
});
```

## Retry Utilities

### withRetry

Execute an operation with automatic retry logic:

```ts
async function withRetry<T>(
  operation: () => Promise<T>,
  config?: Partial<RetryConfig>
): Promise<T>;
```

```ts
import { withRetry } from '@ereo/db';

const result = await withRetry(
  async () => {
    return fetchCriticalData();
  },
  {
    maxAttempts: 5,
    baseDelayMs: 100,
    exponential: true,
  }
);
```

### RetryConfig

```ts
interface RetryConfig {
  maxAttempts: number;      // default: 3
  baseDelayMs: number;      // default: 100
  maxDelayMs: number;       // default: 5000
  exponential: boolean;     // default: true
  isRetryable?: (error: Error) => boolean;
}
```

### isCommonRetryableError

Check if an error is commonly retryable for databases:

```ts
function isCommonRetryableError(error: Error): boolean;
```

```ts
import { withRetry, isCommonRetryableError } from '@ereo/db';

await withRetry(
  async () => db.query('SELECT * FROM users'),
  {
    isRetryable: isCommonRetryableError,
  }
);
```

## Adapter Registry

Register and retrieve adapters globally:

### registerAdapter

```ts
function registerAdapter<TSchema>(
  name: string,
  adapter: DatabaseAdapter<TSchema>
): void;
```

### getAdapter

```ts
function getAdapter<TSchema = unknown>(
  name: string
): DatabaseAdapter<TSchema> | undefined;
```

### getDefaultAdapter

```ts
function getDefaultAdapter<TSchema = unknown>(): DatabaseAdapter<TSchema> | undefined;
```

### clearAdapterRegistry

```ts
function clearAdapterRegistry(): void;
```

```ts
import {
  registerAdapter,
  getAdapter,
  getDefaultAdapter,
  clearAdapterRegistry,
} from '@ereo/db';

// Register multiple adapters
const primaryAdapter = createDrizzleAdapter(primaryConfig);
const analyticsAdapter = createDrizzleAdapter(analyticsConfig);

registerAdapter('primary', primaryAdapter);
registerAdapter('analytics', analyticsAdapter);

// Retrieve by name
const analytics = getAdapter('analytics');

// Get first registered (primary)
const defaultDb = getDefaultAdapter();

// Clear all (useful in tests)
clearAdapterRegistry();
```

## DatabaseAdapter Interface

Implement this interface to create custom adapters:

```ts
interface DatabaseAdapter<TSchema = unknown> {
  readonly name: string;
  readonly edgeCompatible: boolean;

  getClient(): TSchema;
  getRequestClient(context: AppContext): RequestScopedClient<TSchema>;

  query<T>(sql: string, params?: unknown[]): Promise<QueryResult<T>>;
  execute(sql: string, params?: unknown[]): Promise<MutationResult>;

  transaction<T>(fn: (tx: TSchema) => Promise<T>, options?: TransactionOptions): Promise<T>;
  beginTransaction(options?: TransactionOptions): Promise<Transaction<TSchema>>;

  healthCheck(): Promise<HealthCheckResult>;
  disconnect(): Promise<void>;
}
```

## Error Classes

### DatabaseError

Base database error:

```ts
class DatabaseError extends Error {
  constructor(message: string, code?: string, cause?: Error);
}
```

### ConnectionError

Connection-related errors:

```ts
class ConnectionError extends DatabaseError {
  constructor(message: string, cause?: Error);
}
```

### QueryError

Query execution errors:

```ts
class QueryError extends DatabaseError {
  constructor(
    message: string,
    query?: string,
    params?: unknown[],
    cause?: Error
  );
}
```

### TransactionError

Transaction errors:

```ts
class TransactionError extends DatabaseError {
  constructor(message: string, cause?: Error);
}
```

### TimeoutError

Timeout errors:

```ts
class TimeoutError extends DatabaseError {
  constructor(message: string, timeoutMs: number);
}
```

## Type Utilities

### Query Result Types

```ts
interface QueryResult<T> {
  rows: T[];
  rowCount: number;
}

interface MutationResult {
  rowsAffected: number;
  lastInsertId?: number | bigint;
}

interface DedupResult<T> {
  result: T;
  fromCache: boolean;
  cacheKey: string;
}
```

### Configuration Types

```ts
interface PoolConfig {
  min?: number;
  max?: number;
  idleTimeoutMs?: number;
  acquireTimeoutMs?: number;
  acquireRetries?: number;
}

type IsolationLevel =
  | 'read uncommitted'
  | 'read committed'
  | 'repeatable read'
  | 'serializable';

interface TransactionOptions {
  isolationLevel?: IsolationLevel;
  readOnly?: boolean;
  timeout?: number;
}

interface AdapterConfig {
  url: string;
  debug?: boolean;
  pool?: PoolConfig;
  edgeCompatible?: boolean;
}
```

### Type Inference Utilities

```ts
// Infer select type from Drizzle table
type InferSelect<T extends { $inferSelect: unknown }> = T['$inferSelect'];

// Infer insert type from Drizzle table
type InferInsert<T extends { $inferInsert: unknown }> = T['$inferInsert'];

// Get table names from registry
type TableNames = keyof DatabaseTables extends never ? string : keyof DatabaseTables;

// Get table type by name
type TableType<T extends TableNames> = T extends keyof DatabaseTables
  ? DatabaseTables[T]
  : unknown;
```

### Extending DatabaseTables

```ts
// schema.ts
import { pgTable, serial, varchar } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 255 }),
});

// types.d.ts
declare module '@ereo/db' {
  interface DatabaseTables {
    users: typeof import('./schema').users;
  }
}

// Now get typed access
import { TableType } from '@ereo/db';
type UserTable = TableType<'users'>; // typeof users
```

## Complete Example

```ts
// schema.ts
import { pgTable, serial, varchar, timestamp } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  email: varchar('email', { length: 255 }).notNull(),
  name: varchar('name', { length: 255 }),
  createdAt: timestamp('created_at').defaultNow(),
});

// types.d.ts
declare module '@ereo/db' {
  interface DatabaseTables {
    users: typeof import('./schema').users;
  }
}

// ereo.config.ts
import { defineConfig } from '@ereo/core';
import { createDatabasePlugin } from '@ereo/db';
import { createDrizzleAdapter, definePostgresConfig } from '@ereo/db-drizzle';
import * as schema from './schema';

const adapter = createDrizzleAdapter(
  definePostgresConfig({
    url: process.env.DATABASE_URL!,
    schema,
  })
);

export default defineConfig({
  plugins: [
    createDatabasePlugin(adapter, {
      debug: process.env.NODE_ENV === 'development',
    }),
  ],
});

// routes/users/page.tsx
import { createLoader } from '@ereo/data';
import { useDb, withTransaction } from '@ereo/db';
import { users } from '~/schema';
import { eq } from 'drizzle-orm';

export const loader = createLoader({
  load: async ({ context }) => {
    const db = useDb(context);

    const allUsers = await db.client.select().from(users);

    // Check dedup stats
    const stats = db.getDedupStats();
    console.log(`Query dedup hit rate: ${stats.hitRate}`);

    return { users: allUsers };
  },
});

export const action = createAction({
  handler: async ({ context, formData }) => {
    return withTransaction(context, async (tx) => {
      const user = await tx
        .insert(users)
        .values({
          email: formData.get('email') as string,
          name: formData.get('name') as string,
        })
        .returning();

      return { user: user[0] };
    });
  },
});

export default function UsersPage({ loaderData }) {
  return (
    <ul>
      {loaderData.users.map((user) => (
        <li key={user.id}>{user.name} ({user.email})</li>
      ))}
    </ul>
  );
}
```

## Related

- [@ereo/db-drizzle](/api/db/drizzle) - Drizzle ORM adapter
- [@ereo/db-surrealdb](/api/db/surrealdb) - SurrealDB adapter
- [@ereo/data](/api/data) - Data loading and caching
- [Database Guide](/guides/database)
