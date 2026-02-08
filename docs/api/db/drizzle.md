# @ereo/db-drizzle

Drizzle ORM adapter for EreoJS. Supports multiple database drivers including PostgreSQL, SQLite, MySQL (via PlanetScale), and edge-compatible options.

## Installation

```bash
bun add @ereo/db-drizzle
# Install driver based on your database:
bun add drizzle-orm postgres  # For PostgreSQL
bun add drizzle-orm @libsql/client  # For Turso/LibSQL
```

## Supported Drivers

| Driver | Database | Edge Compatible | Best For |
|--------|----------|-----------------|----------|
| `postgres-js` | PostgreSQL | No | Traditional servers, Bun/Node.js |
| `neon-http` | PostgreSQL (Neon) | Yes | Edge deployments, serverless |
| `neon-websocket` | PostgreSQL (Neon) | Yes | Real-time applications |
| `planetscale` | MySQL (PlanetScale) | Yes | Edge deployments, MySQL compatibility |
| `libsql` | SQLite (Turso) | Yes | Edge deployments, distributed SQLite |
| `bun-sqlite` | SQLite | No | Bun runtime, local development |
| `better-sqlite3` | SQLite | No | Node.js, high-performance SQLite |
| `d1` | SQLite (Cloudflare) | Yes | Cloudflare Workers |

## Quick Start

### PostgreSQL

```bash
bun add drizzle-orm postgres
```

```ts
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
  plugins: [createDatabasePlugin(adapter)],
});
```

### Edge with Neon

```bash
bun add drizzle-orm @neondatabase/serverless
```

```ts
import { createDrizzleAdapter, defineEdgeConfig } from '@ereo/db-drizzle';

const adapter = createDrizzleAdapter(
  defineEdgeConfig({
    driver: 'neon-http',
    url: process.env.DATABASE_URL!,
    schema,
  })
);
```

## Adapter Factory

### createDrizzleAdapter

Creates a Drizzle database adapter implementing the `DatabaseAdapter` interface.

```ts
function createDrizzleAdapter<TSchema = unknown>(
  config: DrizzleConfig
): DatabaseAdapter<TSchema>;
```

```ts
import { createDrizzleAdapter } from '@ereo/db-drizzle';

const adapter = createDrizzleAdapter({
  driver: 'postgres-js',
  url: process.env.DATABASE_URL!,
  schema: {
    users,
    posts,
  },
  logger: process.env.NODE_ENV === 'development',
});
```

## Configuration Helpers

### defineDrizzleConfig

Type-safe generic configuration builder:

```ts
function defineDrizzleConfig<T extends DrizzleConfig>(config: T): T;
```

```ts
import { defineDrizzleConfig } from '@ereo/db-drizzle';

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

### Driver-Specific Config Presets

#### definePostgresConfig

PostgreSQL with sensible defaults:

```ts
function definePostgresConfig(
  config: Omit<PostgresConfig, 'driver'>
): PostgresConfig;
```

```ts
import { definePostgresConfig } from '@ereo/db-drizzle';

const config = definePostgresConfig({
  url: process.env.DATABASE_URL!,
  schema,
  connection: {
    ssl: 'require',
    max: 20,
    idle_timeout: 30,
    connect_timeout: 10,
    prepare: true,
  },
});
```

#### defineNeonHttpConfig

Neon HTTP driver (edge-compatible):

```ts
function defineNeonHttpConfig(
  config: Omit<NeonHttpConfig, 'driver'>
): NeonHttpConfig;
```

```ts
import { defineNeonHttpConfig } from '@ereo/db-drizzle';

const config = defineNeonHttpConfig({
  url: process.env.DATABASE_URL!,
  schema,
  neon: {
    fetchOptions: {
      cache: 'no-store',
    },
  },
});
```

#### defineNeonWebSocketConfig

Neon WebSocket driver (edge-compatible, better for real-time):

```ts
function defineNeonWebSocketConfig(
  config: Omit<NeonWebSocketConfig, 'driver'>
): NeonWebSocketConfig;
```

```ts
import { defineNeonWebSocketConfig } from '@ereo/db-drizzle';

const config = defineNeonWebSocketConfig({
  url: process.env.DATABASE_URL!,
  schema,
  pool: {
    max: 5,
    idleTimeoutMs: 10000,
  },
});
```

#### definePlanetScaleConfig

PlanetScale serverless driver:

```ts
function definePlanetScaleConfig(
  config: Omit<PlanetScaleConfig, 'driver'>
): PlanetScaleConfig;
```

```ts
import { definePlanetScaleConfig } from '@ereo/db-drizzle';

const config = definePlanetScaleConfig({
  url: process.env.DATABASE_URL!,
  schema,
  planetscale: {
    fetch: customFetch, // Optional custom fetch
  },
});
```

#### defineLibSQLConfig

LibSQL/Turso configuration:

```ts
function defineLibSQLConfig(
  config: Omit<LibSQLConfig, 'driver'>
): LibSQLConfig;
```

```ts
import { defineLibSQLConfig } from '@ereo/db-drizzle';

const config = defineLibSQLConfig({
  url: 'libsql://mydb.turso.io',
  authToken: process.env.TURSO_AUTH_TOKEN!,
  schema,
  syncUrl: 'https://sync.turso.io', // Optional for embedded replicas
});
```

#### defineBunSQLiteConfig

Bun's native SQLite (Bun runtime only):

```ts
function defineBunSQLiteConfig(
  config: Omit<BunSQLiteConfig, 'driver'>
): BunSQLiteConfig;
```

```ts
import { defineBunSQLiteConfig } from '@ereo/db-drizzle';

const config = defineBunSQLiteConfig({
  url: './data/app.db',
  schema,
  pragma: {
    journal_mode: 'WAL',
    synchronous: 'NORMAL',
    foreign_keys: true,
    cache_size: 10000,
  },
});
```

#### defineBetterSQLite3Config

better-sqlite3 for Node.js:

```ts
function defineBetterSQLite3Config(
  config: Omit<BetterSQLite3Config, 'driver'>
): BetterSQLite3Config;
```

```ts
import { defineBetterSQLite3Config } from '@ereo/db-drizzle';

const config = defineBetterSQLite3Config({
  url: './data/app.db',
  schema,
  options: {
    readonly: false,
    fileMustExist: false,
    timeout: 5000,
    verbose: console.log,
  },
});
```

#### defineD1Config

Cloudflare D1:

```ts
function defineD1Config(
  config: Omit<D1Config, 'driver'>
): D1Config;
```

```ts
import { defineD1Config } from '@ereo/db-drizzle';

const config = defineD1Config({
  url: 'd1://', // Not used, d1 binding provided separately
  schema,
  d1: env.DB, // D1Database binding from Cloudflare
});
```

### defineEdgeConfig

Automatically configures edge-compatible settings based on driver:

```ts
function defineEdgeConfig(options: EdgeConfigOptions): DrizzleConfig;
```

```ts
import { defineEdgeConfig } from '@ereo/db-drizzle';

const config = defineEdgeConfig({
  driver: 'neon-http', // or 'planetscale', 'libsql', 'd1'
  url: process.env.DATABASE_URL!,
  schema,
  authToken: process.env.TURSO_TOKEN, // For libsql
});
```

## Runtime Detection

### detectRuntime

Detect the current JavaScript runtime:

```ts
function detectRuntime(): RuntimeEnvironment;
```

```ts
import { detectRuntime } from '@ereo/db-drizzle';

const runtime = detectRuntime();
// 'bun' | 'node' | 'cloudflare-workers' | 'vercel-edge' | 'deno' | 'unknown'

if (runtime === 'cloudflare-workers') {
  // Use D1 or other edge-compatible driver
}
```

### isEdgeRuntime

Check if running in an edge environment:

```ts
function isEdgeRuntime(): boolean;
```

```ts
import { isEdgeRuntime, defineEdgeConfig, definePostgresConfig } from '@ereo/db-drizzle';

const config = isEdgeRuntime()
  ? defineEdgeConfig({ driver: 'neon-http', url: env.DATABASE_URL, schema })
  : definePostgresConfig({ url: env.DATABASE_URL, schema });
```

### suggestDrivers

Get driver recommendations for the current environment:

```ts
function suggestDrivers(): DrizzleDriver[];
```

```ts
import { suggestDrivers } from '@ereo/db-drizzle';

const suggested = suggestDrivers();
console.log(suggested); // ['neon-http', 'planetscale', 'libsql'] on edge
```

## Configuration Types

### DrizzleDriver

```ts
type DrizzleDriver =
  | 'postgres-js'      // PostgreSQL via postgres.js
  | 'neon-http'        // Neon serverless HTTP
  | 'neon-websocket'   // Neon serverless WebSocket
  | 'planetscale'      // PlanetScale serverless
  | 'libsql'           // LibSQL/Turso
  | 'bun-sqlite'       // Bun's native SQLite
  | 'better-sqlite3'   // better-sqlite3 for Node
  | 'd1';              // Cloudflare D1
```

### Edge Compatibility

```ts
import { EDGE_COMPATIBLE_DRIVERS } from '@ereo/db-drizzle';

const isEdge = EDGE_COMPATIBLE_DRIVERS['neon-http']; // true
const isNotEdge = EDGE_COMPATIBLE_DRIVERS['postgres-js']; // false
```

### PostgresConfig

```ts
interface PostgresConfig extends DrizzleBaseConfig {
  driver: 'postgres-js';
  connection?: {
    ssl?: boolean | 'require' | 'prefer' | 'allow';
    max?: number;
    idle_timeout?: number;
    connect_timeout?: number;
    prepare?: boolean;
  };
}
```

### NeonHttpConfig

```ts
interface NeonHttpConfig extends DrizzleBaseConfig {
  driver: 'neon-http';
  neon?: {
    fetchOptions?: RequestInit;
  };
}
```

### NeonWebSocketConfig

```ts
interface NeonWebSocketConfig extends DrizzleBaseConfig {
  driver: 'neon-websocket';
  pool?: PoolConfig;
}
```

### PlanetScaleConfig

```ts
interface PlanetScaleConfig extends DrizzleBaseConfig {
  driver: 'planetscale';
  planetscale?: {
    fetch?: typeof fetch;
  };
}
```

### LibSQLConfig

```ts
interface LibSQLConfig extends DrizzleBaseConfig {
  driver: 'libsql';
  authToken?: string;
  syncUrl?: string;
}
```

### BunSQLiteConfig

```ts
interface BunSQLiteConfig extends DrizzleBaseConfig {
  driver: 'bun-sqlite';
  pragma?: {
    journal_mode?: 'DELETE' | 'TRUNCATE' | 'PERSIST' | 'MEMORY' | 'WAL' | 'OFF';
    synchronous?: 'OFF' | 'NORMAL' | 'FULL' | 'EXTRA';
    foreign_keys?: boolean;
    cache_size?: number;
  };
}
```

### BetterSQLite3Config

```ts
interface BetterSQLite3Config extends DrizzleBaseConfig {
  driver: 'better-sqlite3';
  options?: {
    readonly?: boolean;
    fileMustExist?: boolean;
    timeout?: number;
    verbose?: (message: string) => void;
  };
}
```

### D1Config

```ts
interface D1Config extends DrizzleBaseConfig {
  driver: 'd1';
  d1?: D1Database; // Cloudflare D1 binding
}
```

### D1 Types

```ts
import type {
  D1Database,
  D1PreparedStatement,
  D1Result,
  D1ExecResult,
} from '@ereo/db-drizzle';
```

## Using with EreoJS

### Basic Setup

```ts
// ereo.config.ts
import { defineConfig } from '@ereo/core';
import { createDatabasePlugin } from '@ereo/db';
import { createDrizzleAdapter, definePostgresConfig } from '@ereo/db-drizzle';
import * as schema from './schema';

export default defineConfig({
  plugins: [
    createDatabasePlugin(
      createDrizzleAdapter(
        definePostgresConfig({
          url: process.env.DATABASE_URL!,
          schema,
        })
      )
    ),
  ],
});
```

### In Loaders

```ts
// routes/posts/page.tsx
import { createLoader } from '@ereo/data';
import { useDb } from '@ereo/db';
import { posts } from '~/schema';
import { eq, desc } from 'drizzle-orm';

export const loader = createLoader({
  load: async ({ context }) => {
    const db = useDb(context);

    const allPosts = await db.client
      .select()
      .from(posts)
      .where(eq(posts.published, true))
      .orderBy(desc(posts.createdAt));

    return { posts: allPosts };
  },
});
```

### In Actions

```ts
import { createAction } from '@ereo/data';
import { useDb, withTransaction } from '@ereo/db';

export const action = createAction({
  handler: async ({ context, formData }) => {
    return withTransaction(context, async (tx) => {
      const post = await tx
        .insert(posts)
        .values({
          title: formData.get('title') as string,
          content: formData.get('content') as string,
        })
        .returning();

      return { post: post[0] };
    });
  },
});
```

### Raw SQL Queries

```ts
import { useDb } from '@ereo/db';

export const loader = createLoader({
  load: async ({ context }) => {
    const db = useDb(context);

    // Raw query with deduplication
    const result = await db.query(
      'SELECT * FROM posts WHERE created_at > $1',
      [new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)]
    );

    return { recentPosts: result.result.rows };
  },
});
```

## Environment-Based Configuration

### Multi-Environment Setup

```ts
// db-config.ts
import {
  definePostgresConfig,
  defineBunSQLiteConfig,
  defineEdgeConfig,
  detectRuntime,
  isEdgeRuntime,
} from '@ereo/db-drizzle';
import * as schema from './schema';

export function getDatabaseConfig() {
  const runtime = detectRuntime();

  // Edge runtime (Vercel Edge, Cloudflare Workers)
  if (isEdgeRuntime()) {
    return defineEdgeConfig({
      driver: 'neon-http',
      url: process.env.DATABASE_URL!,
      schema,
    });
  }

  // Bun runtime - use SQLite for dev, Postgres for prod
  if (runtime === 'bun') {
    if (process.env.NODE_ENV === 'development') {
      return defineBunSQLiteConfig({
        url: './data/dev.db',
        schema,
      });
    }
  }

  // Default: PostgreSQL
  return definePostgresConfig({
    url: process.env.DATABASE_URL!,
    schema,
  });
}
```

### Cloudflare Workers with D1

```ts
// ereo.config.ts
import { defineConfig } from '@ereo/core';
import { createDatabasePlugin } from '@ereo/db';
import { createDrizzleAdapter, defineD1Config } from '@ereo/db-drizzle';
import * as schema from './schema';

interface Env {
  DB: D1Database;
}

export default defineConfig({
  plugins: [
    {
      name: 'db',
      async setup(env: Env) {
        return createDatabasePlugin(
          createDrizzleAdapter(
            defineD1Config({
              url: 'd1://',
              schema,
              d1: env.DB,
            })
          )
        );
      },
    },
  ],
});
```

## Complete Examples

### PostgreSQL Full Setup

```ts
// schema.ts
import { pgTable, serial, varchar, text, timestamp, integer } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  name: varchar('name', { length: 255 }),
  createdAt: timestamp('created_at').defaultNow(),
});

export const posts = pgTable('posts', {
  id: serial('id').primaryKey(),
  title: varchar('title', { length: 255 }).notNull(),
  content: text('content'),
  authorId: integer('author_id').references(() => users.id),
  createdAt: timestamp('created_at').defaultNow(),
});

// types.d.ts
declare module '@ereo/db' {
  interface DatabaseTables {
    users: typeof import('./schema').users;
    posts: typeof import('./schema').posts;
  }
}

// ereo.config.ts
import { defineConfig } from '@ereo/core';
import { createDatabasePlugin } from '@ereo/db';
import { createDrizzleAdapter, definePostgresConfig } from '@ereo/db-drizzle';
import * as schema from './schema';

export default defineConfig({
  plugins: [
    createDatabasePlugin(
      createDrizzleAdapter(
        definePostgresConfig({
          url: process.env.DATABASE_URL!,
          schema,
          connection: {
            ssl: 'require',
            max: 10,
          },
        })
      ),
      {
        debug: process.env.NODE_ENV === 'development',
      }
    ),
  ],
});

// routes/users/[id]/page.tsx
import { createLoader, createAction } from '@ereo/data';
import { useDb, withTransaction } from '@ereo/db';
import { users, posts } from '~/schema';
import { eq } from 'drizzle-orm';

export const loader = createLoader({
  load: async ({ params, context }) => {
    const db = useDb(context);

    const user = await db.client
      .select()
      .from(users)
      .where(eq(users.id, parseInt(params.id)))
      .limit(1);

    if (!user[0]) {
      throw new Response('Not Found', { status: 404 });
    }

    const userPosts = await db.client
      .select()
      .from(posts)
      .where(eq(posts.authorId, user[0].id));

    return { user: user[0], posts: userPosts };
  },
});

export const action = createAction({
  handler: async ({ params, context, formData }) => {
    return withTransaction(context, async (tx) => {
      await tx
        .update(users)
        .set({ name: formData.get('name') as string })
        .where(eq(users.id, parseInt(params.id)));

      return { success: true };
    });
  },
});
```

### Turso Edge Setup

```ts
// ereo.config.ts
import { createDrizzleAdapter, defineLibSQLConfig } from '@ereo/db-drizzle';

export default defineConfig({
  plugins: [
    createDatabasePlugin(
      createDrizzleAdapter(
        defineLibSQLConfig({
          url: process.env.TURSO_DATABASE_URL!,
          authToken: process.env.TURSO_AUTH_TOKEN!,
          schema,
          // Optional: sync for offline capabilities
          syncUrl: process.env.TURSO_SYNC_URL,
        })
      )
    ),
  ],
});
```

## Re-exports from @ereo/db

For convenience, `@ereo/db-drizzle` re-exports commonly used functions:

```ts
import {
  // Core functions
  createDatabasePlugin,
  useDb,
  useAdapter,
  getDb,
  withTransaction,

  // Types
  DatabaseAdapter,
  RequestScopedClient,
  QueryResult,
  MutationResult,
  DedupResult,
  DedupStats,
  TransactionOptions,
} from '@ereo/db-drizzle';
```

## Related

- [@ereo/db](/api/db/) - Core database abstractions
- [@ereo/db-surrealdb](/api/db/surrealdb) - SurrealDB adapter
- [Drizzle ORM Documentation](https://orm.drizzle.team)
