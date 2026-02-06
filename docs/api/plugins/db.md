# Database Plugin

> **DEPRECATED**: This package is deprecated. Please migrate to:
> - `@ereo/db` for core abstractions
> - `@ereo/db-drizzle` for Drizzle ORM adapter (recommended)
>
> See the [Migration Guide](#migration-to-ereodrizzle) below for details.

Database integration plugin for EreoJS providing SQLite database connectivity with a Prisma-like query API.

## Installation

```bash
bun add @ereo/db
```

## Supported Databases

- **SQLite** (via Bun's native sqlite) - the only supported database

> **Note**: PostgreSQL, MySQL, and Turso are NOT supported in this deprecated package. For multi-database support, migrate to `@ereo/db-drizzle`.

## Configuration

```ts
// ereo.config.ts
import { defineConfig } from '@ereo/core';
import { createDatabasePlugin } from '@ereo/db';

export default defineConfig({
  plugins: [
    createDatabasePlugin({
      provider: 'sqlite',
      url: './data.db',
      debug: false,    // Optional: enable query logging
      cache: false,    // Optional: enable query caching
      cacheTtl: 60,    // Optional: cache TTL in seconds
    }),
  ],
});
```

### Configuration Options

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `provider` | `'sqlite'` | Yes | Database provider (only SQLite supported) |
| `url` | `string` | Yes | Path to SQLite database file |
| `debug` | `boolean` | No | Enable SQL query logging |
| `cache` | `boolean` | No | Enable query caching |
| `cacheTtl` | `number` | No | Cache time-to-live in seconds |

## Using the Database

### Global `db` Proxy

Import and use the global `db` proxy for direct access:

```ts
import { db } from '@ereo/db';

// Access tables dynamically via proxy
const user = await db.users.findUnique({ where: { id: 1 } });
const posts = await db.posts.findMany({ where: { authorId: 1 } });
```

### Using `useDB()` in Request Context

Access the database client from request context in loaders and actions:

```ts
import { createLoader } from '@ereo/data';
import { useDB } from '@ereo/db';

export const loader = createLoader(async ({ context }) => {
  const db = useDB(context);

  const posts = await db.posts.findMany({
    orderBy: { createdAt: 'desc' },
    take: 10,
  });

  return { posts };
});
```

### Using `getTable()` with TypeScript

For type-safe table access:

```ts
import { db } from '@ereo/db';

interface User {
  id: number;
  email: string;
  name: string;
  createdAt: string;
}

const users = db.getTable<User>('users');
const user = await users.findUnique({ where: { email: 'user@example.com' } });
// user is typed as User | null
```

## Table Model API

Each table provides the following methods:

### `findUnique(options)`

Find a single unique record.

```ts
const user = await db.users.findUnique({
  where: { id: 1 },
  select: ['id', 'email', 'name'],  // Optional: select specific fields
});
```

### `findFirst(options?)`

Find the first matching record.

```ts
const user = await db.users.findFirst({
  where: { status: 'active' },
  orderBy: { createdAt: 'desc' },
});
```

### `findMany(options?)`

Find multiple records.

```ts
const users = await db.users.findMany({
  where: { status: 'active' },
  orderBy: { name: 'asc' },
  take: 10,
  skip: 0,
  distinct: true,
});
```

### `create(options)`

Create a new record.

```ts
const user = await db.users.create({
  data: {
    email: 'user@example.com',
    name: 'John Doe',
  },
  select: ['id', 'email'],  // Optional: select fields to return
});
```

### `createMany(options)`

Create multiple records.

```ts
const result = await db.users.createMany({
  data: [
    { email: 'user1@example.com', name: 'User 1' },
    { email: 'user2@example.com', name: 'User 2' },
  ],
  skipDuplicates: true,  // Optional: skip duplicate entries
});
// result: { count: 2 }
```

### `update(options)`

Update a single record.

```ts
const user = await db.users.update({
  where: { id: 1 },
  data: { name: 'Jane Doe' },
});
```

### `updateMany(options)`

Update multiple records.

```ts
const result = await db.users.updateMany({
  where: { status: 'pending' },
  data: { status: 'active' },
});
// result: { count: 5 }
```

### `delete(options)`

Delete a single record (returns the deleted record).

```ts
const deletedUser = await db.users.delete({
  where: { id: 1 },
});
```

### `deleteMany(options?)`

Delete multiple records.

```ts
const result = await db.users.deleteMany({
  where: { status: 'inactive' },
});
// result: { count: 3 }
```

### `upsert(options)`

Create or update a record.

```ts
const user = await db.users.upsert({
  where: { email: 'user@example.com' },
  create: { email: 'user@example.com', name: 'New User' },
  update: { name: 'Existing User' },
});
```

### `count(options?)`

Count records.

```ts
const total = await db.users.count();
const activeCount = await db.users.count({ where: { status: 'active' } });
```

### `aggregate(options?)`

Perform aggregations.

```ts
const stats = await db.orders.aggregate({
  where: { status: 'completed' },
  _count: true,
  _sum: { amount: true },
  _avg: { amount: true },
  _min: { amount: true },
  _max: { amount: true },
});
```

### `groupBy(options)`

Group records with aggregations.

```ts
const salesByCategory = await db.products.groupBy({
  by: ['category'],
  where: { status: 'active' },
  _count: true,
  _sum: { price: true },
  orderBy: { category: 'asc' },
});
```

## Query Operators

### Comparison Operators

```ts
await db.products.findMany({
  where: {
    // Greater than
    gt: { price: 100 },
    // Greater than or equal
    gte: { stock: 10 },
    // Less than
    lt: { price: 1000 },
    // Less than or equal
    lte: { discount: 50 },
  },
});
```

### String Matching

```ts
await db.users.findMany({
  where: {
    like: { name: '%john%' },  // SQL LIKE pattern
  },
});
```

### IN and NOT IN

```ts
await db.users.findMany({
  where: {
    in: { status: ['active', 'pending'] },
    notIn: { role: ['banned', 'suspended'] },
  },
});
```

### NULL Checks

```ts
await db.users.findMany({
  where: {
    isNull: ['deletedAt'],
    isNotNull: ['emailVerifiedAt'],
  },
});
```

### Logical Operators

```ts
// NOT conditions
await db.users.findMany({
  where: {
    NOT: { status: 'banned' },
  },
});

// OR conditions
await db.users.findMany({
  where: {
    OR: [
      { status: 'active' },
      { role: 'admin' },
    ],
  },
});

// AND conditions (implicit for top-level, explicit via AND)
await db.users.findMany({
  where: {
    AND: [
      { status: 'active' },
      { gt: { age: 18 } },
    ],
  },
});
```

## Raw SQL Queries

### `query(sql, params?)`

Execute a SELECT query and return results.

```ts
const users = await db.query<User>(
  'SELECT * FROM users WHERE status = ? ORDER BY name',
  ['active']
);
```

### `execute(sql, params?)`

Execute an INSERT, UPDATE, or DELETE query.

```ts
const result = await db.execute(
  'UPDATE users SET status = ? WHERE last_login < ?',
  ['inactive', '2024-01-01']
);
// result: { changes: 5, lastInsertRowid: 0 }
```

## Transactions

Run multiple operations atomically:

```ts
const result = await db.transaction(async (tx) => {
  const user = await tx.getTable('users').create({
    data: { email: 'user@example.com', name: 'John' },
  });

  await tx.getTable('profiles').create({
    data: { userId: user.id, bio: 'Hello!' },
  });

  return user;
});
```

## Schema Management

### `createTable(tableName, schema)`

Create a table programmatically.

```ts
await db.createTable('users', {
  id: { type: 'INTEGER', primaryKey: true, autoIncrement: true },
  email: { type: 'TEXT', notNull: true, unique: true },
  name: { type: 'TEXT' },
  age: { type: 'INTEGER' },
  balance: { type: 'REAL', default: 0 },
  createdAt: { type: 'DATETIME', default: 'CURRENT_TIMESTAMP' },

  // Foreign key example
  organizationId: {
    type: 'INTEGER',
    references: {
      table: 'organizations',
      column: 'id',
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE',
    },
  },
});
```

#### Column Types

| Type | Description |
|------|-------------|
| `INTEGER` | Integer values |
| `TEXT` | String values |
| `REAL` | Floating point numbers |
| `BLOB` | Binary data |
| `BOOLEAN` | Boolean values (stored as 0/1) |
| `DATETIME` | Date and time values |

#### Column Options

| Option | Type | Description |
|--------|------|-------------|
| `primaryKey` | `boolean` | Mark as primary key |
| `autoIncrement` | `boolean` | Auto-increment (INTEGER only) |
| `notNull` | `boolean` | NOT NULL constraint |
| `unique` | `boolean` | UNIQUE constraint |
| `default` | `any` | Default value |
| `references` | `object` | Foreign key reference |

### `dropTable(tableName)`

Drop a table.

```ts
await db.dropTable('temp_table');
```

### `tableExists(tableName)`

Check if a table exists.

```ts
if (await db.tableExists('users')) {
  console.log('Users table exists');
}
```

### `getRawConnection()`

Get the underlying Bun SQLite database instance.

```ts
const sqlite = db.getRawConnection();
sqlite.exec('PRAGMA table_info(users)');
```

### `disconnect()`

Close the database connection.

```ts
await db.disconnect();
```

## TypeScript Interfaces

### DatabaseConfig

```ts
interface DatabaseConfig {
  provider: 'sqlite';
  url: string;
  cache?: boolean;
  cacheTtl?: number;
  debug?: boolean;
}
```

### WhereCondition

```ts
type WhereCondition<T> = Partial<T> & {
  NOT?: Partial<T>;
  OR?: Array<Partial<T>>;
  AND?: Array<Partial<T>>;
  gt?: Record<string, number | Date>;
  gte?: Record<string, number | Date>;
  lt?: Record<string, number | Date>;
  lte?: Record<string, number | Date>;
  like?: Record<string, string>;
  in?: Record<string, unknown[]>;
  notIn?: Record<string, unknown[]>;
  isNull?: string[];
  isNotNull?: string[];
};
```

### FindManyOptions

```ts
interface FindManyOptions<T> {
  where?: WhereCondition<T>;
  select?: (keyof T)[];
  orderBy?: { [K in keyof T]?: 'asc' | 'desc' };
  take?: number;
  skip?: number;
  include?: Record<string, boolean | object>;
  distinct?: boolean;
  cache?: QueryCacheOptions;
}
```

### TableModel

```ts
interface TableModel<T> {
  findUnique(options: FindUniqueOptions<T>): Promise<T | null>;
  findFirst(options?: FindManyOptions<T>): Promise<T | null>;
  findMany(options?: FindManyOptions<T>): Promise<T[]>;
  create(options: CreateOptions<T>): Promise<T>;
  createMany(options: CreateManyOptions<T>): Promise<{ count: number }>;
  update(options: UpdateOptions<T>): Promise<T>;
  updateMany(options: UpdateManyOptions<T>): Promise<{ count: number }>;
  delete(options: DeleteOptions<T>): Promise<T>;
  deleteMany(options?: DeleteManyOptions<T>): Promise<{ count: number }>;
  upsert(options: UpsertOptions<T>): Promise<T>;
  count(options?: CountOptions<T>): Promise<number>;
  aggregate(options?: AggregateOptions<T>): Promise<Record<string, unknown>>;
  groupBy(options: GroupByOptions<T>): Promise<Array<Record<string, unknown>>>;
}
```

### DBClient

```ts
interface DBClient {
  query<T = unknown>(sql: string, params?: SQLQueryBindings[]): Promise<T[]>;
  execute(sql: string, params?: SQLQueryBindings[]): Promise<{ changes: number; lastInsertRowid: number }>;
  transaction<T>(fn: (tx: TransactionClient) => Promise<T>): Promise<T>;
  disconnect(): Promise<void>;
  getRawConnection(): Database;
  createTable(tableName: string, schema: TableSchema): Promise<void>;
  dropTable(tableName: string): Promise<void>;
  tableExists(tableName: string): Promise<boolean>;
  getTable<T>(tableName: string): TableModel<T>;
}
```

## Migration to @ereo/db-drizzle

This package is deprecated. Migrate to `@ereo/db-drizzle` for:

- Multiple database driver support (PostgreSQL, MySQL, SQLite, etc.)
- Edge runtime compatibility (Neon, PlanetScale, Turso)
- Query deduplication
- Better TypeScript integration via Drizzle ORM

### Migration Steps

1. Install the new packages:

```bash
bun add @ereo/db @ereo/db-drizzle drizzle-orm
```

2. Update your configuration:

```ts
// Before (deprecated)
import { createDatabasePlugin, useDB } from '@ereo/db';

export default defineConfig({
  plugins: [
    createDatabasePlugin({
      provider: 'sqlite',
      url: './data.db',
    }),
  ],
});

// After (recommended)
import { createDrizzleAdapter } from '@ereo/db-drizzle';
import { createDatabasePlugin, useDb } from '@ereo/db';
import * as schema from './db/schema';

const adapter = createDrizzleAdapter({
  driver: 'bun-sqlite',
  url: './data.db',
  schema,
});

export default defineConfig({
  plugins: [createDatabasePlugin(adapter)],
});
```

3. Define your schema with Drizzle:

```ts
// db/schema.ts
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const users = sqliteTable('users', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  email: text('email').notNull().unique(),
  name: text('name'),
});
```

For complete migration documentation, see: https://ereo.dev/docs/database/migration

## Related

- [@ereo/db](/api/db) — New core database abstractions (recommended)
- [@ereo/db-drizzle](/api/db/drizzle) — New Drizzle ORM adapter (recommended)
- [Database Guide](/guides/database)
- [Caching](/core-concepts/caching)
- [Actions](/api/data/actions)
