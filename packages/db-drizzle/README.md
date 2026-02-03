# @ereo/db-drizzle

Drizzle ORM adapter for the EreoJS database abstraction layer. This package provides seamless integration between Drizzle ORM and EreoJS applications with support for multiple database drivers, including edge-compatible options.

## Table of Contents

- [Overview](#overview)
- [Installation](#installation)
- [Quick Start](#quick-start)
- [API Reference](#api-reference)
  - [createDrizzleAdapter](#createdrizzleadapter)
  - [Configuration Helpers](#configuration-helpers)
  - [Environment Detection](#environment-detection)
- [Configuration Options](#configuration-options)
  - [PostgreSQL (postgres-js)](#postgresql-postgres-js)
  - [Neon HTTP](#neon-http)
  - [Neon WebSocket](#neon-websocket)
  - [PlanetScale](#planetscale)
  - [LibSQL/Turso](#libsqlturso)
  - [Bun SQLite](#bun-sqlite)
  - [better-sqlite3](#better-sqlite3)
  - [Cloudflare D1](#cloudflare-d1)
- [Drizzle ORM Integration](#drizzle-orm-integration)
- [Use Cases](#use-cases)
  - [Basic Query Execution](#basic-query-execution)
  - [Transactions](#transactions)
  - [Request-Scoped Queries with Deduplication](#request-scoped-queries-with-deduplication)
  - [Edge Deployment](#edge-deployment)
  - [Health Checks](#health-checks)
- [Migrations](#migrations)
- [Error Handling](#error-handling)
- [TypeScript Types Reference](#typescript-types-reference)
- [Troubleshooting / FAQ](#troubleshooting--faq)

---

## Overview

`@ereo/db-drizzle` bridges Drizzle ORM with the EreoJS database abstraction layer (`@ereo/db`). It implements the `DatabaseAdapter` interface, providing:

- **Multi-driver support**: PostgreSQL, MySQL (PlanetScale), SQLite (multiple variants), and Cloudflare D1
- **Edge compatibility**: First-class support for serverless and edge runtimes
- **Request-scoped query deduplication**: Automatic caching of identical queries within a request
- **Type safety**: Full TypeScript support with Drizzle schema inference
- **Connection management**: Automatic connection pooling and lifecycle management

### Supported Drivers

| Driver | Database | Edge Compatible | Use Case |
|--------|----------|-----------------|----------|
| `postgres-js` | PostgreSQL | No | Traditional server deployments |
| `neon-http` | PostgreSQL (Neon) | Yes | Edge/serverless with Neon |
| `neon-websocket` | PostgreSQL (Neon) | Yes | Edge with connection pooling |
| `planetscale` | MySQL | Yes | Edge/serverless with PlanetScale |
| `libsql` | SQLite (Turso) | Yes | Edge/serverless with Turso |
| `bun-sqlite` | SQLite | No | Bun runtime local development |
| `better-sqlite3` | SQLite | No | Node.js local development |
| `d1` | SQLite (Cloudflare) | Yes | Cloudflare Workers |

---

## Installation

```bash
# Install the package
bun add @ereo/db-drizzle

# Install Drizzle ORM (required peer dependency)
bun add drizzle-orm

# Install driver-specific dependencies (pick one based on your database)
# PostgreSQL
bun add postgres

# Neon (serverless PostgreSQL)
bun add @neondatabase/serverless

# PlanetScale (serverless MySQL)
bun add @planetscale/database

# LibSQL/Turso
bun add @libsql/client

# better-sqlite3 (Node.js)
bun add better-sqlite3
```

---

## Quick Start

### 1. Define Your Drizzle Schema

```typescript
// db/schema.ts
import { pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  createdAt: timestamp('created_at').defaultNow(),
});

export const posts = pgTable('posts', {
  id: serial('id').primaryKey(),
  title: text('title').notNull(),
  content: text('content'),
  authorId: serial('author_id').references(() => users.id),
});
```

### 2. Configure the Adapter

```typescript
// ereo.config.ts
import { defineConfig } from '@ereo/core';
import {
  createDrizzleAdapter,
  definePostgresConfig,
  createDatabasePlugin,
} from '@ereo/db-drizzle';
import * as schema from './db/schema';

const config = definePostgresConfig({
  url: process.env.DATABASE_URL!,
  schema,
});

const adapter = createDrizzleAdapter(config);

export default defineConfig({
  plugins: [createDatabasePlugin(adapter)],
});
```

### 3. Use in Routes

```typescript
// routes/users.ts
import { createLoader } from '@ereo/core';
import { useDb } from '@ereo/db-drizzle';
import { users } from '../db/schema';

export const loader = createLoader({
  load: async ({ context }) => {
    const db = useDb(context);
    const allUsers = await db.client.select().from(users);
    return { users: allUsers };
  },
});
```

---

## API Reference

### createDrizzleAdapter

Creates a Drizzle database adapter implementing the `DatabaseAdapter` interface.

```typescript
function createDrizzleAdapter<TSchema = unknown>(
  config: DrizzleConfig
): DatabaseAdapter<TSchema>
```

**Parameters:**
- `config` - A `DrizzleConfig` object specifying the driver and connection options

**Returns:**
- A `DatabaseAdapter<TSchema>` instance

**Example:**
```typescript
import { createDrizzleAdapter } from '@ereo/db-drizzle';

const adapter = createDrizzleAdapter({
  driver: 'postgres-js',
  url: process.env.DATABASE_URL!,
  schema,
  logger: true,
});
```

### Configuration Helpers

#### defineDrizzleConfig

Generic type-safe configuration builder that provides autocomplete based on the selected driver.

```typescript
function defineDrizzleConfig<T extends DrizzleConfig>(config: T): T
```

**Example:**
```typescript
const config = defineDrizzleConfig({
  driver: 'postgres-js',
  url: process.env.DATABASE_URL!,
  schema,
  connection: {
    ssl: 'require',
    max: 10,
  },
});
```

#### definePostgresConfig

Creates a PostgreSQL configuration with sensible defaults.

```typescript
function definePostgresConfig(
  config: Omit<PostgresConfig, 'driver'>
): PostgresConfig
```

**Default values:**
- `ssl`: `'require'`
- `max`: `10` connections
- `idle_timeout`: `20` seconds
- `connect_timeout`: `10` seconds
- `prepare`: `true`

**Example:**
```typescript
const config = definePostgresConfig({
  url: process.env.DATABASE_URL!,
  schema,
  connection: {
    max: 20, // Override default
  },
});
```

#### defineNeonHttpConfig

Creates a Neon HTTP configuration (edge-compatible).

```typescript
function defineNeonHttpConfig(
  config: Omit<NeonHttpConfig, 'driver'>
): NeonHttpConfig
```

**Example:**
```typescript
const config = defineNeonHttpConfig({
  url: process.env.DATABASE_URL!,
  schema,
});
// config.edgeCompatible === true
```

#### defineNeonWebSocketConfig

Creates a Neon WebSocket configuration with connection pooling.

```typescript
function defineNeonWebSocketConfig(
  config: Omit<NeonWebSocketConfig, 'driver'>
): NeonWebSocketConfig
```

**Default values:**
- `pool.max`: `5` connections
- `pool.idleTimeoutMs`: `10000` ms

**Example:**
```typescript
const config = defineNeonWebSocketConfig({
  url: process.env.DATABASE_URL!,
  schema,
  pool: {
    max: 10,
  },
});
```

#### definePlanetScaleConfig

Creates a PlanetScale configuration (edge-compatible).

```typescript
function definePlanetScaleConfig(
  config: Omit<PlanetScaleConfig, 'driver'>
): PlanetScaleConfig
```

**Example:**
```typescript
const config = definePlanetScaleConfig({
  url: process.env.DATABASE_URL!,
  schema,
});
```

#### defineLibSQLConfig

Creates a LibSQL/Turso configuration (edge-compatible).

```typescript
function defineLibSQLConfig(
  config: Omit<LibSQLConfig, 'driver'>
): LibSQLConfig
```

**Example:**
```typescript
const config = defineLibSQLConfig({
  url: 'libsql://your-db.turso.io',
  authToken: process.env.TURSO_AUTH_TOKEN,
  schema,
});
```

#### defineBunSQLiteConfig

Creates a Bun SQLite configuration with optimized PRAGMA settings.

```typescript
function defineBunSQLiteConfig(
  config: Omit<BunSQLiteConfig, 'driver'>
): BunSQLiteConfig
```

**Default PRAGMA values:**
- `journal_mode`: `'WAL'`
- `synchronous`: `'NORMAL'`
- `foreign_keys`: `true`
- `cache_size`: `10000`

**Example:**
```typescript
const config = defineBunSQLiteConfig({
  url: './data/app.db',
  schema,
});
```

#### defineBetterSQLite3Config

Creates a better-sqlite3 configuration for Node.js.

```typescript
function defineBetterSQLite3Config(
  config: Omit<BetterSQLite3Config, 'driver'>
): BetterSQLite3Config
```

**Example:**
```typescript
const config = defineBetterSQLite3Config({
  url: './data/app.db',
  schema,
  options: {
    readonly: false,
    fileMustExist: false,
  },
});
```

#### defineD1Config

Creates a Cloudflare D1 configuration (edge-compatible).

```typescript
function defineD1Config(
  config: Omit<D1Config, 'driver'>
): D1Config
```

**Example:**
```typescript
// In a Cloudflare Worker
export default {
  async fetch(request, env) {
    const config = defineD1Config({
      url: '', // Not used for D1
      d1: env.DB, // D1 binding from wrangler.toml
      schema,
    });
    // ...
  },
};
```

#### defineEdgeConfig

Creates an edge-optimized configuration with a simplified API.

```typescript
function defineEdgeConfig(options: EdgeConfigOptions): DrizzleConfig
```

**Parameters:**
- `driver`: `'neon-http' | 'neon-websocket' | 'planetscale' | 'libsql' | 'd1'`
- `url`: Database connection URL
- `schema`: Optional Drizzle schema object
- `authToken`: Optional auth token (for LibSQL/Turso)
- `debug`: Optional debug logging flag

**Example:**
```typescript
const config = defineEdgeConfig({
  driver: 'neon-http',
  url: process.env.DATABASE_URL!,
  schema,
});
```

### Environment Detection

#### detectRuntime

Detects the current JavaScript runtime environment.

```typescript
function detectRuntime(): RuntimeEnvironment

type RuntimeEnvironment =
  | 'bun'
  | 'node'
  | 'cloudflare-workers'
  | 'vercel-edge'
  | 'deno'
  | 'unknown';
```

**Example:**
```typescript
const runtime = detectRuntime();
if (runtime === 'cloudflare-workers') {
  // Use D1 or edge-compatible driver
}
```

#### isEdgeRuntime

Checks if the current environment is an edge runtime.

```typescript
function isEdgeRuntime(): boolean
```

**Returns:** `true` for Cloudflare Workers and Vercel Edge, `false` otherwise.

**Example:**
```typescript
if (isEdgeRuntime()) {
  console.log('Running on the edge');
}
```

#### suggestDrivers

Suggests appropriate drivers for the current runtime environment.

```typescript
function suggestDrivers(): DrizzleDriver[]
```

**Returns by runtime:**
- **Bun**: `['bun-sqlite', 'postgres-js', 'libsql']`
- **Node.js**: `['better-sqlite3', 'postgres-js', 'libsql']`
- **Cloudflare Workers**: `['d1', 'neon-http', 'planetscale']`
- **Vercel Edge**: `['neon-http', 'planetscale', 'libsql']`
- **Deno**: `['postgres-js', 'libsql']`
- **Unknown**: `['neon-http', 'postgres-js']`

**Example:**
```typescript
const recommended = suggestDrivers();
console.log(`Recommended drivers: ${recommended.join(', ')}`);
```

---

## Configuration Options

### PostgreSQL (postgres-js)

```typescript
interface PostgresConfig {
  driver: 'postgres-js';
  url: string;
  schema?: Record<string, unknown>;
  logger?: boolean;
  debug?: boolean;
  edgeCompatible?: boolean; // Defaults to false
  connection?: {
    ssl?: boolean | 'require' | 'prefer' | 'allow';
    max?: number;           // Maximum connections (default: 10)
    idle_timeout?: number;  // Seconds (default: 20)
    connect_timeout?: number; // Seconds (default: 10)
    prepare?: boolean;      // Use prepared statements (default: true)
  };
}
```

### Neon HTTP

```typescript
interface NeonHttpConfig {
  driver: 'neon-http';
  url: string;
  schema?: Record<string, unknown>;
  logger?: boolean;
  debug?: boolean;
  edgeCompatible?: boolean; // Defaults to true
  neon?: {
    fetchOptions?: RequestInit; // Custom fetch options
  };
}
```

### Neon WebSocket

```typescript
interface NeonWebSocketConfig {
  driver: 'neon-websocket';
  url: string;
  schema?: Record<string, unknown>;
  logger?: boolean;
  debug?: boolean;
  edgeCompatible?: boolean; // Defaults to true
  pool?: {
    min?: number;
    max?: number;           // Default: 5
    idleTimeoutMs?: number; // Default: 10000
    acquireTimeoutMs?: number;
    acquireRetries?: number;
  };
}
```

### PlanetScale

```typescript
interface PlanetScaleConfig {
  driver: 'planetscale';
  url: string;
  schema?: Record<string, unknown>;
  logger?: boolean;
  debug?: boolean;
  edgeCompatible?: boolean; // Defaults to true
  planetscale?: {
    fetch?: typeof fetch; // Custom fetch function
  };
}
```

### LibSQL/Turso

```typescript
interface LibSQLConfig {
  driver: 'libsql';
  url: string;
  schema?: Record<string, unknown>;
  logger?: boolean;
  debug?: boolean;
  edgeCompatible?: boolean; // Defaults to true
  authToken?: string;       // Turso authentication token
  syncUrl?: string;         // Sync URL for embedded replicas
}
```

### Bun SQLite

```typescript
interface BunSQLiteConfig {
  driver: 'bun-sqlite';
  url: string;              // File path to SQLite database
  schema?: Record<string, unknown>;
  logger?: boolean;
  debug?: boolean;
  edgeCompatible?: boolean; // Defaults to false
  pragma?: {
    journal_mode?: 'DELETE' | 'TRUNCATE' | 'PERSIST' | 'MEMORY' | 'WAL' | 'OFF';
    synchronous?: 'OFF' | 'NORMAL' | 'FULL' | 'EXTRA';
    foreign_keys?: boolean;
    cache_size?: number;
  };
}
```

### better-sqlite3

```typescript
interface BetterSQLite3Config {
  driver: 'better-sqlite3';
  url: string;              // File path to SQLite database
  schema?: Record<string, unknown>;
  logger?: boolean;
  debug?: boolean;
  edgeCompatible?: boolean; // Defaults to false
  options?: {
    readonly?: boolean;
    fileMustExist?: boolean;
    timeout?: number;
    verbose?: (message: string) => void;
  };
}
```

### Cloudflare D1

```typescript
interface D1Config {
  driver: 'd1';
  url: string;              // Not used, but required for interface
  schema?: Record<string, unknown>;
  logger?: boolean;
  debug?: boolean;
  edgeCompatible?: boolean; // Defaults to true
  d1?: D1Database;          // D1 binding from Cloudflare Workers
}
```

---

## Drizzle ORM Integration

The adapter provides the full Drizzle client through the `client` property. All Drizzle query methods are available.

### Schema Passing

Pass your Drizzle schema to enable relational queries and type inference:

```typescript
import * as schema from './db/schema';

const config = definePostgresConfig({
  url: process.env.DATABASE_URL!,
  schema, // Enables relational queries
});

const adapter = createDrizzleAdapter(config);
const db = adapter.getClient();

// Relational queries work
const usersWithPosts = await db.query.users.findMany({
  with: {
    posts: true,
  },
});
```

### Logger Integration

Enable Drizzle's built-in query logger:

```typescript
const config = definePostgresConfig({
  url: process.env.DATABASE_URL!,
  schema,
  logger: true, // Logs all queries to console
});
```

### Type Inference

Use Drizzle's type inference utilities:

```typescript
import { InferSelect, InferInsert } from '@ereo/db-drizzle';
import { users } from './db/schema';

type User = InferSelect<typeof users>;
type NewUser = InferInsert<typeof users>;

// Or use Drizzle's built-in types
type User = typeof users.$inferSelect;
type NewUser = typeof users.$inferInsert;
```

---

## Use Cases

### Basic Query Execution

```typescript
import { createDrizzleAdapter, definePostgresConfig } from '@ereo/db-drizzle';
import { eq } from 'drizzle-orm';
import * as schema from './db/schema';

const adapter = createDrizzleAdapter(
  definePostgresConfig({
    url: process.env.DATABASE_URL!,
    schema,
  })
);

const db = adapter.getClient();

// Select queries
const allUsers = await db.select().from(schema.users);

// Filtered queries
const user = await db
  .select()
  .from(schema.users)
  .where(eq(schema.users.id, 1));

// Insert
const [newUser] = await db
  .insert(schema.users)
  .values({ name: 'Alice', email: 'alice@example.com' })
  .returning();

// Update
await db
  .update(schema.users)
  .set({ name: 'Bob' })
  .where(eq(schema.users.id, 1));

// Delete
await db
  .delete(schema.users)
  .where(eq(schema.users.id, 1));
```

### Transactions

#### Callback-Based Transactions (Recommended)

```typescript
import { withTransaction } from '@ereo/db-drizzle';

// Automatic commit on success, rollback on error
const result = await adapter.transaction(async (tx) => {
  const [user] = await tx
    .insert(schema.users)
    .values({ name: 'Alice', email: 'alice@example.com' })
    .returning();

  await tx
    .insert(schema.posts)
    .values({ title: 'First Post', authorId: user.id });

  return user;
});
```

#### Using withTransaction Helper

```typescript
import { createLoader } from '@ereo/core';
import { useDb, withTransaction } from '@ereo/db-drizzle';

export const action = createAction({
  action: async ({ context, request }) => {
    const db = useDb(context);

    const result = await withTransaction(context, async (tx) => {
      // All operations use the same transaction
      const [user] = await tx
        .insert(schema.users)
        .values({ name: 'Alice', email: 'alice@example.com' })
        .returning();

      return user;
    });

    return { user: result };
  },
});
```

#### Manual Transactions

```typescript
const tx = await adapter.beginTransaction();

try {
  const [user] = await tx.client
    .insert(schema.users)
    .values({ name: 'Alice', email: 'alice@example.com' })
    .returning();

  await tx.commit();
  return user;
} catch (error) {
  await tx.rollback();
  throw error;
}
```

### Request-Scoped Queries with Deduplication

The adapter automatically deduplicates identical queries within a single request:

```typescript
import { createLoader } from '@ereo/core';
import { useDb } from '@ereo/db-drizzle';

export const loader = createLoader({
  load: async ({ context }) => {
    const db = useDb(context);

    // First call executes the query
    const { result: users1, fromCache: cached1 } = await db.query(
      'SELECT * FROM users WHERE active = $1',
      [true]
    );
    // cached1 === false

    // Identical query returns cached result
    const { result: users2, fromCache: cached2 } = await db.query(
      'SELECT * FROM users WHERE active = $1',
      [true]
    );
    // cached2 === true

    // Get deduplication statistics
    const stats = db.getDedupStats();
    console.log(`Cache hit rate: ${stats.hitRate * 100}%`);

    // Clear cache after mutations
    await db.client.insert(schema.users).values({ ... });
    db.clearDedup(); // or db.invalidate(['users']);

    return { users: users1.rows };
  },
});
```

### Edge Deployment

#### Vercel Edge Functions

```typescript
// ereo.config.ts
import { defineConfig } from '@ereo/core';
import {
  createDrizzleAdapter,
  defineEdgeConfig,
  createDatabasePlugin,
} from '@ereo/db-drizzle';
import * as schema from './db/schema';

const adapter = createDrizzleAdapter(
  defineEdgeConfig({
    driver: 'neon-http',
    url: process.env.DATABASE_URL!,
    schema,
  })
);

export default defineConfig({
  plugins: [createDatabasePlugin(adapter)],
});
```

#### Cloudflare Workers with D1

```typescript
// src/index.ts
import {
  createDrizzleAdapter,
  defineD1Config,
  createDatabasePlugin,
} from '@ereo/db-drizzle';
import * as schema from './db/schema';

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const adapter = createDrizzleAdapter(
      defineD1Config({
        url: '',
        d1: env.DB,
        schema,
      })
    );

    const db = adapter.getClient();
    const users = await db.select().from(schema.users);

    return Response.json({ users });
  },
};
```

### Health Checks

```typescript
import { createDrizzleAdapter, definePostgresConfig } from '@ereo/db-drizzle';

const adapter = createDrizzleAdapter(
  definePostgresConfig({
    url: process.env.DATABASE_URL!,
  })
);

// Perform health check
const health = await adapter.healthCheck();

if (health.healthy) {
  console.log(`Database healthy, latency: ${health.latencyMs}ms`);
  console.log(`Driver: ${health.metadata?.driver}`);
} else {
  console.error(`Database unhealthy: ${health.error}`);
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  await adapter.disconnect();
  process.exit(0);
});
```

---

## Migrations

This package does not handle migrations directly. Use Drizzle Kit for schema migrations.

### Setup Drizzle Kit

```typescript
// drizzle.config.ts
import type { Config } from 'drizzle-kit';

export default {
  schema: './db/schema.ts',
  out: './drizzle',
  driver: 'pg', // or 'mysql2', 'better-sqlite', 'libsql', 'd1'
  dbCredentials: {
    connectionString: process.env.DATABASE_URL!,
  },
} satisfies Config;
```

### Common Commands

```bash
# Generate migrations
bunx drizzle-kit generate:pg

# Apply migrations
bunx drizzle-kit push:pg

# Open Drizzle Studio
bunx drizzle-kit studio
```

### Migration with Different Drivers

```typescript
// PostgreSQL
export default {
  driver: 'pg',
  dbCredentials: {
    connectionString: process.env.DATABASE_URL!,
  },
} satisfies Config;

// PlanetScale
export default {
  driver: 'mysql2',
  dbCredentials: {
    uri: process.env.DATABASE_URL!,
  },
} satisfies Config;

// LibSQL/Turso
export default {
  driver: 'libsql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
    authToken: process.env.DATABASE_AUTH_TOKEN,
  },
} satisfies Config;

// Cloudflare D1
export default {
  driver: 'd1',
  dbCredentials: {
    wranglerConfigPath: './wrangler.toml',
    dbName: 'my-database',
  },
} satisfies Config;
```

---

## Error Handling

The adapter throws typed errors from `@ereo/db`:

### ConnectionError

Thrown when the database connection fails.

```typescript
import { ConnectionError } from '@ereo/db-drizzle';

try {
  const db = adapter.getClient();
} catch (error) {
  if (error instanceof ConnectionError) {
    console.error('Failed to connect:', error.message);
    // error.code === 'CONNECTION_ERROR'
    // error.cause contains the original error
  }
}
```

### QueryError

Thrown when a query fails to execute.

```typescript
import { QueryError } from '@ereo/db-drizzle';

try {
  await adapter.query('SELECT * FROM nonexistent');
} catch (error) {
  if (error instanceof QueryError) {
    console.error('Query failed:', error.message);
    console.error('SQL:', error.query);
    console.error('Params:', error.params);
  }
}
```

### TransactionError

Thrown when a transaction operation fails.

```typescript
import { TransactionError } from '@ereo/db-drizzle';

try {
  await adapter.transaction(async (tx) => {
    // ...
    throw new Error('Something went wrong');
  });
} catch (error) {
  if (error instanceof TransactionError) {
    console.error('Transaction failed:', error.message);
  }
}
```

### Error Handling Pattern

```typescript
import {
  ConnectionError,
  QueryError,
  TransactionError,
  DatabaseError,
} from '@ereo/db-drizzle';

try {
  await performDatabaseOperation();
} catch (error) {
  if (error instanceof ConnectionError) {
    // Handle connection issues (retry, alert, etc.)
  } else if (error instanceof QueryError) {
    // Handle query issues (log, validate input, etc.)
  } else if (error instanceof TransactionError) {
    // Handle transaction issues (retry, partial rollback, etc.)
  } else if (error instanceof DatabaseError) {
    // Generic database error
  } else {
    // Non-database error
    throw error;
  }
}
```

---

## TypeScript Types Reference

### Driver Types

```typescript
// Supported database drivers
type DrizzleDriver =
  | 'postgres-js'
  | 'neon-http'
  | 'neon-websocket'
  | 'planetscale'
  | 'libsql'
  | 'bun-sqlite'
  | 'better-sqlite3'
  | 'd1';

// Edge compatibility map
const EDGE_COMPATIBLE_DRIVERS: Record<DrizzleDriver, boolean>;
```

### Configuration Types

```typescript
// Union of all configuration types
type DrizzleConfig =
  | PostgresConfig
  | NeonHttpConfig
  | NeonWebSocketConfig
  | PlanetScaleConfig
  | LibSQLConfig
  | BunSQLiteConfig
  | BetterSQLite3Config
  | D1Config;

// Edge configuration options
interface EdgeConfigOptions {
  driver: 'neon-http' | 'neon-websocket' | 'planetscale' | 'libsql' | 'd1';
  url: string;
  schema?: Record<string, unknown>;
  authToken?: string;
  debug?: boolean;
}

// Runtime environment
type RuntimeEnvironment =
  | 'bun'
  | 'node'
  | 'cloudflare-workers'
  | 'vercel-edge'
  | 'deno'
  | 'unknown';
```

### Re-exported Types from @ereo/db

```typescript
// Core adapter interface
interface DatabaseAdapter<TSchema = unknown> {
  readonly name: string;
  readonly edgeCompatible: boolean;
  getClient(): TSchema;
  getRequestClient(context: AppContext): RequestScopedClient<TSchema>;
  query<T = unknown>(sql: string, params?: unknown[]): Promise<QueryResult<T>>;
  execute(sql: string, params?: unknown[]): Promise<MutationResult>;
  transaction<T>(fn: (tx: TSchema) => Promise<T>, options?: TransactionOptions): Promise<T>;
  beginTransaction(options?: TransactionOptions): Promise<Transaction<TSchema>>;
  healthCheck(): Promise<HealthCheckResult>;
  disconnect(): Promise<void>;
}

// Request-scoped client with deduplication
interface RequestScopedClient<TSchema> {
  readonly client: TSchema;
  query<T = unknown>(sql: string, params?: unknown[]): Promise<DedupResult<QueryResult<T>>>;
  getDedupStats(): DedupStats;
  clearDedup(): void;
  invalidate(tables?: string[]): void;
}

// Query results
interface QueryResult<T = unknown> {
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

interface DedupStats {
  total: number;
  deduplicated: number;
  unique: number;
  hitRate: number;
}

// Transaction types
interface TransactionOptions {
  isolationLevel?: 'read uncommitted' | 'read committed' | 'repeatable read' | 'serializable';
  readOnly?: boolean;
  timeout?: number;
}

interface Transaction<TSchema> {
  readonly client: TSchema;
  commit(): Promise<void>;
  rollback(): Promise<void>;
  readonly isActive: boolean;
}

// Health check
interface HealthCheckResult {
  healthy: boolean;
  latencyMs: number;
  error?: string;
  metadata?: Record<string, unknown>;
}
```

### D1 Types (Cloudflare Workers)

```typescript
interface D1Database {
  prepare(query: string): D1PreparedStatement;
  dump(): Promise<ArrayBuffer>;
  batch<T = unknown>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]>;
  exec(query: string): Promise<D1ExecResult>;
}

interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  first<T = unknown>(colName?: string): Promise<T>;
  run(): Promise<D1Result>;
  all<T = unknown>(): Promise<D1Result<T>>;
  raw<T = unknown>(): Promise<T[]>;
}

interface D1Result<T = unknown> {
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

interface D1ExecResult {
  count: number;
  duration: number;
}
```

---

## Troubleshooting / FAQ

### Connection Issues

**Q: I'm getting "Failed to connect to database" errors.**

A: Check the following:
1. Verify your `DATABASE_URL` is correct and accessible
2. For PostgreSQL, ensure SSL settings match your database requirements
3. For serverless databases (Neon, PlanetScale), verify your API keys/tokens
4. Check firewall rules if connecting to a remote database

```typescript
// Enable debug logging to see connection details
const config = definePostgresConfig({
  url: process.env.DATABASE_URL!,
  debug: true,
});
```

### Edge Runtime Errors

**Q: My database queries fail on Vercel Edge or Cloudflare Workers.**

A: Ensure you're using an edge-compatible driver:

```typescript
// Check edge compatibility
import { EDGE_COMPATIBLE_DRIVERS } from '@ereo/db-drizzle';

console.log(EDGE_COMPATIBLE_DRIVERS);
// {
//   'postgres-js': false,    // NOT edge compatible
//   'neon-http': true,       // Edge compatible
//   'neon-websocket': true,  // Edge compatible
//   'planetscale': true,     // Edge compatible
//   'libsql': true,          // Edge compatible
//   'bun-sqlite': false,     // NOT edge compatible
//   'better-sqlite3': false, // NOT edge compatible
//   'd1': true,              // Edge compatible
// }
```

### Transaction Support

**Q: Transactions don't work with SQLite drivers.**

A: For `bun-sqlite` and `better-sqlite3`, use the Drizzle client's transaction method directly:

```typescript
const db = adapter.getClient();

// Use Drizzle's built-in transaction support
await db.transaction(async (tx) => {
  // Your transaction code
});
```

### Query Deduplication

**Q: How do I disable query deduplication?**

A: Query deduplication only applies to request-scoped clients. Use `adapter.getClient()` for non-deduplicated queries:

```typescript
// Deduplicated (via useDb/getRequestClient)
const db = useDb(context);
await db.query('SELECT * FROM users', []);

// Not deduplicated (direct client)
const client = adapter.getClient();
await client.select().from(users);
```

**Q: Why isn't my cache invalidating after mutations?**

A: Call `invalidate()` or `clearDedup()` after mutations:

```typescript
const db = useDb(context);

// Perform mutation
await db.client.insert(users).values({ name: 'Alice' });

// Invalidate cache for specific tables
db.invalidate(['users']);

// Or clear entire cache
db.clearDedup();
```

### Driver Selection

**Q: Which driver should I use?**

A: Use `suggestDrivers()` to get recommendations based on your runtime:

```typescript
import { suggestDrivers, detectRuntime } from '@ereo/db-drizzle';

const runtime = detectRuntime();
const recommended = suggestDrivers();

console.log(`Runtime: ${runtime}`);
console.log(`Recommended drivers: ${recommended.join(', ')}`);
```

General guidelines:
- **Local development**: `bun-sqlite` (Bun) or `better-sqlite3` (Node.js)
- **Traditional servers**: `postgres-js` for PostgreSQL
- **Serverless/Edge**: `neon-http`, `planetscale`, or `libsql`
- **Cloudflare Workers**: `d1` or `neon-http`

### Schema Not Working

**Q: Relational queries return undefined.**

A: Ensure you pass the schema to your configuration:

```typescript
import * as schema from './db/schema';

const config = definePostgresConfig({
  url: process.env.DATABASE_URL!,
  schema, // Required for relational queries
});
```

### Performance

**Q: How can I improve query performance?**

A: Consider these optimizations:

1. **Enable prepared statements** (default for postgres-js):
   ```typescript
   connection: { prepare: true }
   ```

2. **Tune connection pool** for your workload:
   ```typescript
   connection: { max: 20, idle_timeout: 30 }
   ```

3. **Use WAL mode for SQLite**:
   ```typescript
   pragma: { journal_mode: 'WAL' }
   ```

4. **Leverage query deduplication** for read-heavy routes

5. **Use appropriate indexes** in your schema

---

## License

MIT
