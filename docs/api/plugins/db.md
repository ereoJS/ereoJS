# Database Plugin

Database integration plugin for EreoJS.

## Installation

```bash
bun add @ereo/db
```

## Supported Databases

- SQLite (via Bun's native sqlite)
- PostgreSQL
- MySQL
- Turso (LibSQL)

## SQLite Setup

```ts
// ereo.config.ts
import { defineConfig } from '@ereo/core'
import db from '@ereo/db'

export default defineConfig({
  plugins: [
    db({
      type: 'sqlite',
      database: './data/app.db'
    })
  ]
})
```

## PostgreSQL Setup

```bash
bun add pg
```

```ts
import db from '@ereo/db'

export default defineConfig({
  plugins: [
    db({
      type: 'postgres',
      url: process.env.DATABASE_URL
    })
  ]
})
```

## MySQL Setup

```bash
bun add mysql2
```

```ts
import db from '@ereo/db'

export default defineConfig({
  plugins: [
    db({
      type: 'mysql',
      url: process.env.DATABASE_URL
    })
  ]
})
```

## Turso Setup

```bash
bun add @libsql/client
```

```ts
import db from '@ereo/db'

export default defineConfig({
  plugins: [
    db({
      type: 'turso',
      url: process.env.TURSO_DATABASE_URL,
      authToken: process.env.TURSO_AUTH_TOKEN
    })
  ]
})
```

## Using the Database

### In Loaders

```ts
import { createLoader } from '@ereo/data'

export const loader = createLoader(async ({ context }) => {
  const db = context.get('db')

  const posts = await db.query('SELECT * FROM posts ORDER BY created_at DESC')

  return { posts }
})
```

### In Actions

```ts
import { createAction } from '@ereo/data'

export const action = createAction(async ({ request, context }) => {
  const db = context.get('db')
  const formData = await request.formData()

  await db.run(
    'INSERT INTO posts (title, content) VALUES (?, ?)',
    [formData.get('title'), formData.get('content')]
  )

  return Response.redirect('/posts')
})
```

## Query Builder

The plugin includes a simple query builder:

```ts
const db = context.get('db')

// Select
const users = await db.table('users')
  .select('id', 'name', 'email')
  .where('active', true)
  .orderBy('created_at', 'desc')
  .limit(10)
  .all()

// Insert
const id = await db.table('users')
  .insert({ name: 'John', email: 'john@example.com' })

// Update
await db.table('users')
  .where('id', id)
  .update({ name: 'Jane' })

// Delete
await db.table('users')
  .where('id', id)
  .delete()
```

## Transactions

```ts
const db = context.get('db')

await db.transaction(async (tx) => {
  const userId = await tx.table('users')
    .insert({ name: 'John', email: 'john@example.com' })

  await tx.table('profiles')
    .insert({ user_id: userId, bio: 'Hello!' })
})
```

## Migrations

### Create Migration

```bash
bun ereo db:migration create add_posts_table
```

Creates `migrations/001_add_posts_table.sql`:

```sql
-- Up
CREATE TABLE posts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  content TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Down
DROP TABLE posts;
```

### Run Migrations

```bash
# Run pending migrations
bun ereo db:migrate

# Rollback last migration
bun ereo db:rollback

# Reset database
bun ereo db:reset
```

## Schema Generation

Generate TypeScript types from your database:

```bash
bun ereo db:generate
```

Creates `src/lib/db.types.ts`:

```ts
export interface User {
  id: number
  name: string
  email: string
  created_at: Date
}

export interface Post {
  id: number
  title: string
  content: string | null
  author_id: number
  created_at: Date
}
```

## Connection Pooling

Configure connection pools for production:

```ts
db({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  pool: {
    min: 2,
    max: 10,
    idleTimeoutMs: 30000
  }
})
```

## Plugin Options

```ts
db({
  // Database type
  type: 'sqlite' | 'postgres' | 'mysql' | 'turso',

  // Connection URL or path
  url?: string,
  database?: string,

  // Turso-specific
  authToken?: string,

  // Connection pool
  pool?: {
    min: number,
    max: number,
    idleTimeoutMs: number
  },

  // Migrations
  migrations: {
    directory: './migrations',
    table: '_migrations'
  },

  // Logging
  logging: boolean | ((query: string, params: any[]) => void)
})
```

## ORM Integration

### With Drizzle

```bash
bun add drizzle-orm
```

```ts
// lib/db.ts
import { drizzle } from 'drizzle-orm/bun-sqlite'
import { Database } from 'bun:sqlite'
import * as schema from './schema'

const sqlite = new Database('./data/app.db')
export const db = drizzle(sqlite, { schema })
```

### With Prisma

```bash
bun add prisma @prisma/client
bunx prisma init
```

```ts
// lib/db.ts
import { PrismaClient } from '@prisma/client'

export const db = new PrismaClient()
```

## Related

- [Database Guide](/guides/database)
- [Caching](/core-concepts/caching)
- [Actions](/api/data/actions)
