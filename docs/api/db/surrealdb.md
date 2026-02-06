# @ereo/db-surrealdb

SurrealDB adapter for the EreoJS database abstraction layer. SurrealDB is a multi-model database that supports SQL-like queries, graph relationships, and real-time subscriptions.

## Installation

```bash
bun add @ereo/db-surrealdb @ereo/db surrealdb
```

## Quick Start

```ts
import { createSurrealAdapter, defineSurrealConfig } from '@ereo/db-surrealdb'
import { createDatabasePlugin } from '@ereo/db'
import { defineConfig } from '@ereo/core'

const adapter = createSurrealAdapter(defineSurrealConfig({
  url: 'http://localhost:8000',
  namespace: 'test',
  database: 'test',
  auth: {
    username: 'root',
    password: 'root',
  },
}))

export default defineConfig({
  plugins: [createDatabasePlugin(adapter)],
})
```

## Import

```ts
import {
  // Adapter
  createSurrealAdapter,

  // Configuration
  defineSurrealConfig,
  validateConfig,

  // Authentication helpers
  rootAuth,
  namespaceAuth,
  databaseAuth,
  recordAccessAuth,

  // URL helpers
  buildSurrealUrl,
  parseSurrealUrl,

  // Configuration presets
  localConfig,
  cloudConfig,
  envConfig,

  // Query helpers
  select,
  create,
  update,
  deleteFrom,

  // Type guards
  isRootAuth,
  isNamespaceAuth,
  isDatabaseAuth,
  isRecordAccessAuth,
  isScopeAuth,

  // Types
  type SurrealClient,
  type SurrealDBConfig,
  type SurrealAuth,
  type RootAuth,
  type NamespaceAuth,
  type DatabaseAuth,
  type RecordAccessAuth,
  type ScopeAuth,
  type ConnectionProtocol,
  type SurrealEngine,
  type SurrealQueryResult,
  type SurrealRawResponse,
  type RecordId,
  type SurrealRecord,
  type LiveAction,
  type LiveNotification,

  // Re-exports from @ereo/db
  createDatabasePlugin,
  useDb,
  useAdapter,
  getDb,
  withTransaction,
} from '@ereo/db-surrealdb'
```

## createSurrealAdapter

Creates a SurrealDB database adapter implementing the `DatabaseAdapter` interface.

### Signature

```ts
function createSurrealAdapter(config: SurrealDBConfig): DatabaseAdapter<SurrealClient>
```

### Example

```ts
const adapter = createSurrealAdapter({
  url: 'http://localhost:8000',
  namespace: 'myapp',
  database: 'production',
  auth: rootAuth('root', 'password'),
  timeout: 30000,
  debug: false,
})
```

### Adapter Properties

| Property | Value | Description |
|----------|-------|-------------|
| `name` | `'surrealdb'` | Adapter identifier |
| `edgeCompatible` | `true` | Works in edge runtimes via HTTP/WebSocket |

## Configuration

### defineSurrealConfig

Type-safe configuration builder with sensible defaults.

```ts
function defineSurrealConfig(config: SurrealDBConfig): SurrealDBConfig
```

### SurrealDBConfig

```ts
interface SurrealDBConfig {
  // Required
  url: string           // Connection URL
  namespace: string     // Target namespace
  database: string      // Target database

  // Optional
  auth?: SurrealAuth    // Authentication credentials
  timeout?: number      // Connection timeout in ms (default: 30000)
  debug?: boolean       // Enable debug logging (default: false)
}
```

### URL Formats

| Format | Description |
|--------|-------------|
| `http://host:8000` | HTTP connection |
| `https://host` | HTTPS connection |
| `ws://host:8000` | WebSocket connection |
| `wss://host` | Secure WebSocket |
| `mem://` | In-memory (requires @surrealdb/node) |
| `surrealkv://path` | Persistent storage (requires @surrealdb/node) |

## Authentication

### Root Authentication

Full access to all namespaces and databases.

```ts
import { rootAuth } from '@ereo/db-surrealdb'

const auth = rootAuth('root', 'password')
// { username: 'root', password: 'password' }
```

### Namespace Authentication

Access to a specific namespace.

```ts
import { namespaceAuth } from '@ereo/db-surrealdb'

const auth = namespaceAuth('myns', 'admin', 'password')
// { namespace: 'myns', username: 'admin', password: 'password' }
```

### Database Authentication

Access to a specific database within a namespace.

```ts
import { databaseAuth } from '@ereo/db-surrealdb'

const auth = databaseAuth('myns', 'mydb', 'admin', 'password')
// { namespace: 'myns', database: 'mydb', username: 'admin', password: 'password' }
```

### Record Access Authentication (SurrealDB 2.x+)

User-defined access control.

```ts
import { recordAccessAuth } from '@ereo/db-surrealdb'

const auth = recordAccessAuth('myns', 'mydb', 'user', {
  email: 'user@example.com',
  password: 'secret',
})
// { namespace: 'myns', database: 'mydb', access: 'user', variables: {...} }
```

### Type Guards

```ts
import {
  isRootAuth,
  isNamespaceAuth,
  isDatabaseAuth,
  isRecordAccessAuth,
  isScopeAuth,
} from '@ereo/db-surrealdb'

if (isRootAuth(auth)) {
  console.log('Root auth:', auth.username)
} else if (isDatabaseAuth(auth)) {
  console.log('Database auth for:', auth.database)
}
```

## Configuration Presets

### localConfig

Quick setup for local development.

```ts
import { localConfig, rootAuth } from '@ereo/db-surrealdb'

const config = localConfig('test', 'test', {
  auth: rootAuth('root', 'root'),
})
// url: 'http://127.0.0.1:8000', debug: true
```

### cloudConfig

Production configuration for SurrealDB Cloud or remote instances.

```ts
import { cloudConfig, rootAuth } from '@ereo/db-surrealdb'

const config = cloudConfig(
  'https://cloud.surrealdb.com',
  'production',
  'mydb',
  rootAuth('user', 'password')
)
// debug: false
```

### envConfig

Load configuration from environment variables.

```ts
import { envConfig } from '@ereo/db-surrealdb'

const config = envConfig()
```

**Required environment variables:**
- `SURREAL_URL` - Connection URL
- `SURREAL_NAMESPACE` - Target namespace
- `SURREAL_DATABASE` - Target database

**Optional environment variables:**
- `SURREAL_USERNAME` - Auth username
- `SURREAL_PASSWORD` - Auth password
- `SURREAL_DEBUG` - Enable debug ('true')

## URL Helpers

### buildSurrealUrl

Build a connection URL from components.

```ts
import { buildSurrealUrl } from '@ereo/db-surrealdb'

const url = buildSurrealUrl('localhost', 8000, 'http')
// 'http://localhost:8000'

const secureUrl = buildSurrealUrl('cloud.surrealdb.com', 443, 'wss')
// 'wss://cloud.surrealdb.com:443'
```

### parseSurrealUrl

Parse a connection URL into components.

```ts
import { parseSurrealUrl } from '@ereo/db-surrealdb'

const parts = parseSurrealUrl('https://cloud.surrealdb.com:443/rpc')
// { protocol: 'https', host: 'cloud.surrealdb.com', port: 443, path: '/rpc' }
```

## Query Helpers

Helper functions to build SurrealQL query strings.

### select

```ts
import { select } from '@ereo/db-surrealdb'

select('users')
// 'SELECT * FROM users'

select('users', { where: 'active = true', orderBy: 'created DESC', limit: 10 })
// 'SELECT * FROM users WHERE active = true ORDER BY created DESC LIMIT 10'

select('posts', { start: 20, limit: 10 })
// 'SELECT * FROM posts LIMIT 10 START 20'
```

### create

```ts
import { create } from '@ereo/db-surrealdb'

create('users')
// 'CREATE users'

create('users', 'john')
// 'CREATE users:john'
```

### update

```ts
import { update } from '@ereo/db-surrealdb'

update('users')
// 'UPDATE users'

update('users', 'john')
// 'UPDATE users:john'
```

### deleteFrom

```ts
import { deleteFrom } from '@ereo/db-surrealdb'

deleteFrom('users')
// 'DELETE users'

deleteFrom('users', 'john')
// 'DELETE users:john'
```

## Using in Routes

### In Loaders

```ts
import { createLoader } from '@ereo/data'
import { useDb } from '@ereo/db-surrealdb'

export const loader = createLoader({
  load: async ({ context }) => {
    const db = useDb(context)

    // Raw SurrealQL query
    const result = await db.client.query<User[]>(
      'SELECT * FROM users WHERE active = true'
    )

    // Or use the client's select method
    const users = await db.client.select('users')

    return { users }
  },
})
```

### In Actions

When using the options-object form of `createAction`, `formData` is already parsed and available in the handler arguments — no need to call `request.formData()` yourself:

```ts
import { createAction } from '@ereo/data'
import { useDb } from '@ereo/db-surrealdb'

export const action = createAction({
  handler: async ({ context, formData }) => {
    const db = useDb(context)

    await db.client.create('posts', {
      title: formData.get('title'),
      content: formData.get('content'),
      created: new Date(),
    })

    return redirect('/posts')
  },
})
```

### Transactions

Use `withTransaction` from `@ereo/db` to run multiple operations atomically. It takes the request `context` as the first argument and automatically clears the dedup cache after the transaction completes:

```ts
import { withTransaction } from '@ereo/db-surrealdb'

export const action = createAction({
  handler: async ({ context }) => {
    return withTransaction(context, async (tx) => {
      await tx.query('UPDATE users:john SET balance -= 100')
      await tx.query('UPDATE users:jane SET balance += 100')
      return { success: true }
    })
  },
})
```

## Type Definitions

### SurrealAuth

```ts
type SurrealAuth =
  | RootAuth
  | NamespaceAuth
  | DatabaseAuth
  | RecordAccessAuth
  | ScopeAuth
```

### RecordId

```ts
interface RecordId<T extends string = string> {
  tb: T        // Table name
  id: string | number | object  // Record ID
}
```

### SurrealRecord

```ts
interface SurrealRecord {
  id: RecordId | string
}
```

### SurrealQueryResult

```ts
interface SurrealQueryResult<T = unknown> {
  result: T
  status: 'OK' | 'ERR'
  time: string
}
```

### LiveNotification

```ts
type LiveAction = 'CREATE' | 'UPDATE' | 'DELETE'

interface LiveNotification<T = unknown> {
  action: LiveAction
  result: T
}
```

### ConnectionProtocol

```ts
type ConnectionProtocol = 'http' | 'https' | 'ws' | 'wss'
```

### SurrealEngine

```ts
type SurrealEngine =
  | 'remote'     // Remote SurrealDB instance
  | 'memory'     // In-memory (requires @surrealdb/node)
  | 'surrealkv'  // Persistent (requires @surrealdb/node)
```

## SurrealQL Examples

### CRUD Operations

```ts
// Create
await db.client.create('user:john', {
  name: 'John Doe',
  email: 'john@example.com',
})

// Read
const users = await db.client.query('SELECT * FROM users WHERE age > $0', [18])

// Update
await db.client.query('UPDATE user:john SET name = $0', ['John Smith'])

// Delete
await db.client.query('DELETE user:john')
```

### Graph Relationships

```ts
// Create relationship
await db.client.query(`
  RELATE user:john->follows->user:jane
  SET created = time::now()
`)

// Query relationships
const followers = await db.client.query(`
  SELECT <-follows<-user.* AS followers
  FROM user:jane
`)

// Traverse graph
const recommendations = await db.client.query(`
  SELECT ->follows->user->follows->user AS suggested
  FROM user:john
  WHERE suggested != user:john
`)
```

### Computed Fields

```ts
await db.client.query(`
  SELECT
    *,
    string::concat(first_name, ' ', last_name) AS full_name,
    math::sum(->orders->product.price) AS total_spent
  FROM users
`)
```

## Re-exports from @ereo/db

For convenience, the following are re-exported:

```ts
export {
  createDatabasePlugin,
  useDb,
  useAdapter,
  getDb,
  withTransaction,
  type DatabaseAdapter,
  type RequestScopedClient,
  type QueryResult,
  type MutationResult,
  type DedupResult,
  type DedupStats,
  type TransactionOptions,
} from '@ereo/db'
```

## Validation

### validateConfig

Validates configuration and throws on errors.

```ts
import { validateConfig } from '@ereo/db-surrealdb'

validateConfig(config) // Throws if invalid
```

**Validates:**
- `url` is required and valid URL format
- `namespace` is required
- `database` is required

## Related

- [Database Overview](/api/db/index)
- [Drizzle Adapter](/api/db/drizzle)
- [Database Guide](/guides/database)
- [CLI: db commands](/api/cli/db)
