# Database Integration

This guide covers database integration patterns in EreoJS.

## SQLite with better-sqlite3

SQLite is perfect for small to medium applications.

### Setup

```bash
bun add better-sqlite3
bun add -d @types/better-sqlite3
```

### Basic Usage

```ts
// lib/db.ts
import Database from 'better-sqlite3'

const db = new Database(process.env.DATABASE_URL || 'app.db')

// Enable WAL mode for better performance
db.pragma('journal_mode = WAL')

// Initialize tables
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );
`)

export { db }
```

### Repository Pattern

```ts
// lib/repositories/users.ts
import { db } from '../db'

export interface User {
  id: number
  email: string
  name: string
  created_at: string
}

export const users = {
  findById(id: number): User | undefined {
    return db.prepare('SELECT * FROM users WHERE id = ?').get(id) as User
  },

  findByEmail(email: string): User | undefined {
    return db.prepare('SELECT * FROM users WHERE email = ?').get(email) as User
  },

  findAll(): User[] {
    return db.prepare('SELECT * FROM users ORDER BY created_at DESC').all() as User[]
  },

  create(data: { email: string; name: string }): number {
    const result = db.prepare(
      'INSERT INTO users (email, name) VALUES (?, ?)'
    ).run(data.email, data.name)
    return result.lastInsertRowid as number
  },

  update(id: number, data: Partial<{ email: string; name: string }>): void {
    const fields = Object.keys(data).map(k => `${k} = ?`).join(', ')
    const values = Object.values(data)
    db.prepare(`UPDATE users SET ${fields} WHERE id = ?`).run(...values, id)
  },

  delete(id: number): void {
    db.prepare('DELETE FROM users WHERE id = ?').run(id)
  }
}
```

## PostgreSQL with postgres.js

For larger applications, use PostgreSQL.

### Setup

```bash
bun add postgres
```

### Connection

```ts
// lib/db.ts
import postgres from 'postgres'

const sql = postgres(process.env.DATABASE_URL!, {
  max: 10,
  idle_timeout: 20
})

export { sql }
```

### Queries

```ts
// lib/repositories/posts.ts
import { sql } from '../db'

export interface Post {
  id: number
  title: string
  content: string
  user_id: number
  created_at: Date
}

export const posts = {
  async findAll(): Promise<Post[]> {
    return sql<Post[]>`SELECT * FROM posts ORDER BY created_at DESC`
  },

  async findById(id: number): Promise<Post | undefined> {
    const [post] = await sql<Post[]>`SELECT * FROM posts WHERE id = ${id}`
    return post
  },

  async create(data: { title: string; content: string; userId: number }): Promise<Post> {
    const [post] = await sql<Post[]>`
      INSERT INTO posts (title, content, user_id)
      VALUES (${data.title}, ${data.content}, ${data.userId})
      RETURNING *
    `
    return post
  },

  async update(id: number, data: { title?: string; content?: string }): Promise<Post> {
    const [post] = await sql<Post[]>`
      UPDATE posts
      SET title = COALESCE(${data.title}, title),
          content = COALESCE(${data.content}, content)
      WHERE id = ${id}
      RETURNING *
    `
    return post
  },

  async delete(id: number): Promise<void> {
    await sql`DELETE FROM posts WHERE id = ${id}`
  }
}
```

## Drizzle ORM

Type-safe ORM with great DX.

### Setup

```bash
bun add drizzle-orm
bun add -d drizzle-kit
```

### Schema

```ts
// lib/schema.ts
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core'

export const users = sqliteTable('users', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  email: text('email').notNull().unique(),
  name: text('name').notNull(),
  createdAt: text('created_at').default('CURRENT_TIMESTAMP')
})

export const posts = sqliteTable('posts', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id').notNull().references(() => users.id),
  title: text('title').notNull(),
  content: text('content').notNull(),
  createdAt: text('created_at').default('CURRENT_TIMESTAMP')
})
```

### Usage

```ts
// lib/db.ts
import { drizzle } from 'drizzle-orm/better-sqlite3'
import Database from 'better-sqlite3'
import * as schema from './schema'

const sqlite = new Database('app.db')
export const db = drizzle(sqlite, { schema })

// Queries
import { eq } from 'drizzle-orm'
import { users, posts } from './schema'

// Select
const allUsers = await db.select().from(users)
const user = await db.select().from(users).where(eq(users.id, 1))

// Insert
await db.insert(users).values({ email: 'test@example.com', name: 'Test' })

// Update
await db.update(users).set({ name: 'New Name' }).where(eq(users.id, 1))

// Delete
await db.delete(users).where(eq(users.id, 1))

// Joins
const postsWithUsers = await db
  .select()
  .from(posts)
  .innerJoin(users, eq(posts.userId, users.id))
```

## Prisma

Full-featured ORM with migrations.

### Setup

```bash
bun add @prisma/client
bun add -d prisma
bunx prisma init
```

### Schema

```prisma
// prisma/schema.prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}

model User {
  id        Int      @id @default(autoincrement())
  email     String   @unique
  name      String
  posts     Post[]
  createdAt DateTime @default(now())
}

model Post {
  id        Int      @id @default(autoincrement())
  title     String
  content   String
  author    User     @relation(fields: [authorId], references: [id])
  authorId  Int
  createdAt DateTime @default(now())
}
```

### Usage

```ts
// lib/db.ts
import { PrismaClient } from '@prisma/client'

export const prisma = new PrismaClient()

// In routes
import { prisma } from '../lib/db'

export const loader = createLoader(async () => {
  const posts = await prisma.post.findMany({
    include: { author: true },
    orderBy: { createdAt: 'desc' }
  })
  return { posts }
})

export const action = createAction(async ({ request, context }) => {
  const formData = await request.formData()
  const user = context.get('user')

  const post = await prisma.post.create({
    data: {
      title: formData.get('title') as string,
      content: formData.get('content') as string,
      authorId: user.id
    }
  })

  return redirect(`/posts/${post.id}`)
})
```

## Database Patterns

### Transactions

```ts
// SQLite
const createPostWithTags = db.transaction((data) => {
  const post = db.prepare('INSERT INTO posts ...').run(data)
  for (const tag of data.tags) {
    db.prepare('INSERT INTO post_tags ...').run(post.lastInsertRowid, tag)
  }
  return post
})

// Prisma
await prisma.$transaction(async (tx) => {
  const post = await tx.post.create({ data: postData })
  await tx.tag.createMany({ data: tags })
  return post
})
```

### Pagination

```ts
export const loader = createLoader(async ({ request }) => {
  const url = new URL(request.url)
  const page = parseInt(url.searchParams.get('page') || '1')
  const limit = 10
  const offset = (page - 1) * limit

  const [posts, total] = await Promise.all([
    db.prepare('SELECT * FROM posts LIMIT ? OFFSET ?').all(limit, offset),
    db.prepare('SELECT COUNT(*) as count FROM posts').get()
  ])

  return {
    posts,
    pagination: {
      page,
      limit,
      total: total.count,
      pages: Math.ceil(total.count / limit)
    }
  }
})
```

### Caching Database Queries

```ts
import { cached } from '@ereo/data'

export const loader = createLoader(async ({ params }) => {
  const post = await cached(
    `post:${params.id}`,
    () => db.prepare('SELECT * FROM posts WHERE id = ?').get(params.id),
    { ttl: 300, tags: ['posts', `post-${params.id}`] }
  )

  return { post }
})
```

## Best Practices

1. **Use connection pooling** - Don't create connections per request
2. **Use prepared statements** - Prevent SQL injection
3. **Index frequently queried columns** - Improve performance
4. **Use transactions for multi-step operations** - Ensure consistency
5. **Cache expensive queries** - With appropriate invalidation
6. **Use migrations** - Track schema changes
