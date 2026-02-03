# @ereo/db

Database integration plugin for the EreoJS framework. Provides SQLite database connectivity with a type-safe query builder API.

## Installation

```bash
bun add @ereo/db
```

## Quick Start

```typescript
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

// Using the database
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

// CRUD operations
const users = db.getTable<User>('users');
await users.create({ data: { email: 'user@example.com', name: 'John' } });
const user = await users.findUnique({ where: { email: 'user@example.com' } });
```

## Key Features

- **Type-safe Query Builder**: Prisma-like API with full TypeScript support
- **SQLite Support**: Native Bun SQLite integration with WAL mode
- **CRUD Operations**: `findUnique`, `findMany`, `create`, `update`, `delete`, `upsert`
- **Advanced Queries**: Support for `count`, `aggregate`, and `groupBy`
- **Where Conditions**: Flexible filtering with `AND`, `OR`, `NOT`, comparisons, `LIKE`, `IN`
- **Transaction Support**: Atomic operations with `db.transaction()`
- **Schema Management**: `createTable`, `dropTable`, `tableExists`
- **Connection Pooling**: Efficient prepared statement caching

## Documentation

For full documentation, visit the [EreoJS Documentation](https://ereojs.dev/docs/plugins/db).

## Part of EreoJS

This package is part of the [EreoJS](https://github.com/ereojs/ereo) monorepo - a modern full-stack JavaScript framework.

## License

MIT
