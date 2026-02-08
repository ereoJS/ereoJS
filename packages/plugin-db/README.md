# @ereo/db

> **DEPRECATED**: This package is deprecated and will not receive new features.
>
> Please migrate to:
> - [`@ereo/db`](https://www.npmjs.com/package/@ereo/db) for core database abstractions
> - [`@ereo/db-drizzle`](https://www.npmjs.com/package/@ereo/db-drizzle) for Drizzle ORM adapter (recommended)
>
> See the [Migration Guide](#migration) below.

Database integration plugin for the EreoJS framework. Provides SQLite database connectivity with a Prisma-like type-safe query API.

## Installation

```bash
bun add @ereo/db
```

## Quick Start

```typescript
// ereo.config.ts
import { defineConfig } from '@ereo/core';
import { createDatabasePlugin, db } from '@ereo/db';

export default defineConfig({
  plugins: [
    createDatabasePlugin({
      provider: 'sqlite',
      url: './data.db',
    }),
  ],
});
```

```typescript
// Using the database
import { db } from '@ereo/db';

interface User {
  id: number;
  email: string;
  name: string;
}

// Create a table
await db.createTable('users', {
  id: { type: 'INTEGER', primaryKey: true, autoIncrement: true },
  email: { type: 'TEXT', notNull: true, unique: true },
  name: { type: 'TEXT' },
});

// Type-safe CRUD operations
const users = db.getTable<User>('users');

// Create
await users.create({ data: { email: 'user@example.com', name: 'John' } });

// Read
const user = await users.findUnique({ where: { email: 'user@example.com' } });
const allUsers = await users.findMany({ orderBy: { name: 'asc' } });

// Update
await users.update({ where: { id: 1 }, data: { name: 'Jane' } });

// Delete
await users.delete({ where: { id: 1 } });
```

## Features

- **SQLite Only**: Native Bun SQLite integration with WAL mode for better concurrency
- **Prisma-like API**: Familiar options-based query syntax with full TypeScript support
- **CRUD Operations**: `findUnique`, `findFirst`, `findMany`, `create`, `createMany`, `update`, `updateMany`, `delete`, `deleteMany`, `upsert`
- **Aggregations**: `count`, `aggregate`, `groupBy`
- **Query Operators**: `gt`, `gte`, `lt`, `lte`, `like`, `in`, `notIn`, `isNull`, `isNotNull`, `NOT`, `OR`, `AND`
- **Raw SQL**: `query()` and `execute()` for custom SQL
- **Transactions**: `transaction()` for atomic operations
- **Schema Management**: `createTable()`, `dropTable()`, `tableExists()`
- **Request Context**: `useDB()` helper for accessing database in loaders/actions

## API Reference

### Configuration

```typescript
createDatabasePlugin({
  provider: 'sqlite',     // Required: only 'sqlite' is supported
  url: './data.db',       // Required: path to SQLite file
  debug: false,           // Optional: log SQL queries
  cache: false,           // Optional: enable query caching
  cacheTtl: 60,           // Optional: cache TTL in seconds
});
```

### Table Model Methods

| Method | Description |
|--------|-------------|
| `findUnique({ where })` | Find one record by unique field |
| `findFirst({ where?, orderBy?, ... })` | Find first matching record |
| `findMany({ where?, orderBy?, take?, skip?, ... })` | Find multiple records |
| `create({ data })` | Create a record |
| `createMany({ data[], skipDuplicates? })` | Create multiple records |
| `update({ where, data })` | Update a record |
| `updateMany({ where, data })` | Update multiple records |
| `delete({ where })` | Delete a record |
| `deleteMany({ where? })` | Delete multiple records |
| `upsert({ where, create, update })` | Create or update |
| `count({ where? })` | Count records |
| `aggregate({ _count?, _sum?, _avg?, _min?, _max? })` | Aggregations |
| `groupBy({ by, _count?, ... })` | Group with aggregations |

### Database Client Methods

| Method | Description |
|--------|-------------|
| `query(sql, params?)` | Execute SELECT query |
| `execute(sql, params?)` | Execute INSERT/UPDATE/DELETE |
| `transaction(fn)` | Run operations in transaction |
| `createTable(name, schema)` | Create table |
| `dropTable(name)` | Drop table |
| `tableExists(name)` | Check if table exists |
| `getTable<T>(name)` | Get typed table model |
| `getRawConnection()` | Get Bun SQLite instance |
| `disconnect()` | Close connection |

## Migration

Migrate to `@ereo/db-drizzle` for multi-database support:

```typescript
// Before (this package)
import { createDatabasePlugin } from '@ereo/db';

createDatabasePlugin({
  provider: 'sqlite',
  url: './data.db',
});

// After (@ereo/db-drizzle)
import { createDrizzleAdapter } from '@ereo/db-drizzle';
import { createDatabasePlugin } from '@ereo/db';

const adapter = createDrizzleAdapter({
  driver: 'bun-sqlite',  // or 'postgres', 'mysql', 'turso', etc.
  url: './data.db',
  schema,
});

createDatabasePlugin(adapter);
```

Full migration guide: https://ereo.dev/docs/database/migration

## Documentation

For complete documentation, see [EreoJS Database Plugin Docs](https://ereo.dev/docs/api/plugins/db).

## Part of EreoJS

This package is part of the [EreoJS](https://github.com/ereoJS/ereoJS) monorepo - a modern full-stack JavaScript framework.

## License

MIT
