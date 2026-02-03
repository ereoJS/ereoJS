# @ereo/db-surrealdb

SurrealDB adapter for the EreoJS database abstraction layer. This package provides seamless integration between EreoJS applications and SurrealDB, a multi-model database that supports SQL-like queries, graph relationships, and real-time subscriptions.

## Table of Contents

- [Overview](#overview)
- [Installation](#installation)
- [Quick Start](#quick-start)
- [API Reference](#api-reference)
  - [Adapter Factory](#adapter-factory)
  - [Configuration Helpers](#configuration-helpers)
  - [Authentication Helpers](#authentication-helpers)
  - [URL Helpers](#url-helpers)
  - [Preset Configurations](#preset-configurations)
  - [Query Helpers](#query-helpers)
  - [Validation](#validation)
- [Configuration Options](#configuration-options)
- [SurrealDB-Specific Features](#surrealdb-specific-features)
  - [SurrealQL Queries](#surrealql-queries)
  - [Record IDs](#record-ids)
  - [Transactions](#transactions)
  - [Connection Protocols](#connection-protocols)
- [Use Cases with Examples](#use-cases-with-examples)
- [Integration with Core db Package](#integration-with-core-db-package)
- [TypeScript Types Reference](#typescript-types-reference)
- [Troubleshooting / FAQ](#troubleshooting--faq)

## Overview

`@ereo/db-surrealdb` implements the `DatabaseAdapter` interface from `@ereo/db`, providing:

- Full SurrealDB client integration via the official `surrealdb` package
- Support for multiple authentication methods (root, namespace, database, record access, scope)
- HTTP, HTTPS, WebSocket, and secure WebSocket connection protocols
- Request-scoped query deduplication for optimal performance
- Transaction support with automatic commit/rollback
- Health check capabilities
- Edge runtime compatibility

## Installation

```bash
# Using bun
bun add @ereo/db-surrealdb surrealdb

# Using npm
npm install @ereo/db-surrealdb surrealdb

# Using pnpm
pnpm add @ereo/db-surrealdb surrealdb
```

**Peer Dependencies:**
- `surrealdb` (^1.0.0) - Required

## Quick Start

### Basic Setup

```typescript
// ereo.config.ts
import { defineConfig } from '@ereo/core';
import { createSurrealAdapter, defineSurrealConfig, createDatabasePlugin } from '@ereo/db-surrealdb';

const adapter = createSurrealAdapter(defineSurrealConfig({
  url: 'http://localhost:8000',
  namespace: 'test',
  database: 'test',
  auth: {
    username: 'root',
    password: 'root',
  },
}));

export default defineConfig({
  plugins: [createDatabasePlugin(adapter)],
});
```

### Using in Routes

```typescript
// routes/users.ts
import { createLoader } from '@ereo/core';
import { useDb } from '@ereo/db-surrealdb';

export const loader = createLoader({
  load: async ({ context }) => {
    const db = useDb(context);

    // Use SurrealQL
    const result = await db.client.query('SELECT * FROM users WHERE active = true');

    // Or use convenience methods
    const users = await db.client.select('users');

    return users;
  },
});
```

### Environment-Based Configuration

```typescript
import { createSurrealAdapter, envConfig } from '@ereo/db-surrealdb';

// Reads from environment variables:
// - SURREAL_URL (required)
// - SURREAL_NAMESPACE (required)
// - SURREAL_DATABASE (required)
// - SURREAL_USERNAME (optional)
// - SURREAL_PASSWORD (optional)
// - SURREAL_DEBUG (optional, 'true' to enable)
const adapter = createSurrealAdapter(envConfig());
```

## API Reference

### Adapter Factory

#### `createSurrealAdapter(config: SurrealDBConfig): DatabaseAdapter<SurrealClient>`

Creates a SurrealDB database adapter instance.

```typescript
import { createSurrealAdapter } from '@ereo/db-surrealdb';

const adapter = createSurrealAdapter({
  url: 'http://localhost:8000',
  namespace: 'test',
  database: 'test',
  auth: {
    username: 'root',
    password: 'root',
  },
});
```

**Returns:** A `DatabaseAdapter<SurrealClient>` instance implementing:
- `name`: `'surrealdb'`
- `edgeCompatible`: `true`
- `getClient()`: Returns the SurrealDB client
- `getRequestClient(context)`: Returns a request-scoped client with deduplication
- `query(sql, params?)`: Execute a SELECT query
- `execute(sql, params?)`: Execute a mutation (INSERT/UPDATE/DELETE)
- `transaction(fn, options?)`: Run operations in a transaction
- `beginTransaction(options?)`: Start a manual transaction
- `healthCheck()`: Check database connectivity
- `disconnect()`: Close the connection

### Configuration Helpers

#### `defineSurrealConfig(config: SurrealDBConfig): SurrealDBConfig`

Type-safe configuration builder with sensible defaults.

```typescript
import { defineSurrealConfig } from '@ereo/db-surrealdb';

const config = defineSurrealConfig({
  url: 'http://localhost:8000',
  namespace: 'test',
  database: 'test',
  auth: {
    username: 'root',
    password: 'root',
  },
});

// Defaults applied:
// - timeout: 30000
// - debug: false
```

### Authentication Helpers

#### `rootAuth(username: string, password: string): RootAuth`

Create root-level authentication credentials.

```typescript
import { rootAuth } from '@ereo/db-surrealdb';

const auth = rootAuth('root', 'surrealdb');
// => { username: 'root', password: 'surrealdb' }
```

#### `namespaceAuth(namespace: string, username: string, password: string): NamespaceAuth`

Create namespace-level authentication credentials.

```typescript
import { namespaceAuth } from '@ereo/db-surrealdb';

const auth = namespaceAuth('myns', 'admin', 'password');
// => { namespace: 'myns', username: 'admin', password: 'password' }
```

#### `databaseAuth(namespace: string, database: string, username: string, password: string): DatabaseAuth`

Create database-level authentication credentials.

```typescript
import { databaseAuth } from '@ereo/db-surrealdb';

const auth = databaseAuth('myns', 'mydb', 'admin', 'password');
// => { namespace: 'myns', database: 'mydb', username: 'admin', password: 'password' }
```

#### `recordAccessAuth(namespace: string, database: string, access: string, variables?: Record<string, unknown>): RecordAccessAuth`

Create record access authentication (SurrealDB 2.x+).

```typescript
import { recordAccessAuth } from '@ereo/db-surrealdb';

const auth = recordAccessAuth('myns', 'mydb', 'user', {
  email: 'user@example.com',
  password: 'secret',
});
// => { namespace: 'myns', database: 'mydb', access: 'user', variables: { email: '...', password: '...' } }
```

### URL Helpers

#### `buildSurrealUrl(host: string, port?: number, protocol?: ConnectionProtocol): string`

Build a SurrealDB connection URL.

```typescript
import { buildSurrealUrl } from '@ereo/db-surrealdb';

buildSurrealUrl('localhost', 8000, 'http');
// => 'http://localhost:8000'

buildSurrealUrl('cloud.surrealdb.com', 443, 'https');
// => 'https://cloud.surrealdb.com:443'

buildSurrealUrl('localhost', 8000, 'ws');
// => 'ws://localhost:8000'

// With defaults (port: 8000, protocol: 'http')
buildSurrealUrl('localhost');
// => 'http://localhost:8000'
```

#### `parseSurrealUrl(url: string): { protocol: string; host: string; port: number; path: string }`

Parse a SurrealDB connection URL into components.

```typescript
import { parseSurrealUrl } from '@ereo/db-surrealdb';

parseSurrealUrl('http://localhost:8000');
// => { protocol: 'http', host: 'localhost', port: 8000, path: '/' }

parseSurrealUrl('https://cloud.surrealdb.com');
// => { protocol: 'https', host: 'cloud.surrealdb.com', port: 443, path: '/' }

parseSurrealUrl('wss://cloud.surrealdb.com:8080/custom');
// => { protocol: 'wss', host: 'cloud.surrealdb.com', port: 8080, path: '/custom' }
```

### Preset Configurations

#### `localConfig(namespace: string, database: string, options?: Partial<SurrealDBConfig>): SurrealDBConfig`

Create a local development configuration.

```typescript
import { localConfig, rootAuth } from '@ereo/db-surrealdb';

const config = localConfig('test', 'test');
// => { url: 'http://127.0.0.1:8000', namespace: 'test', database: 'test', debug: true }

// With authentication
const configWithAuth = localConfig('test', 'test', {
  auth: rootAuth('root', 'root'),
  debug: false,
});
```

#### `cloudConfig(url: string, namespace: string, database: string, auth: SurrealAuth, options?: Partial<SurrealDBConfig>): SurrealDBConfig`

Create a cloud/production configuration.

```typescript
import { cloudConfig, rootAuth } from '@ereo/db-surrealdb';

const config = cloudConfig(
  'https://cloud.surrealdb.com',
  'production',
  'mydb',
  rootAuth('user', 'password')
);
// => { url: 'https://...', namespace: 'production', database: 'mydb', auth: {...}, debug: false }
```

#### `envConfig(env?: Record<string, string | undefined>): SurrealDBConfig`

Create configuration from environment variables.

```typescript
import { envConfig } from '@ereo/db-surrealdb';

// Uses process.env by default
const config = envConfig();

// Or provide custom env object (useful for testing)
const config = envConfig({
  SURREAL_URL: 'http://localhost:8000',
  SURREAL_NAMESPACE: 'test',
  SURREAL_DATABASE: 'test',
  SURREAL_USERNAME: 'root',
  SURREAL_PASSWORD: 'root',
  SURREAL_DEBUG: 'true',
});
```

**Expected Environment Variables:**
| Variable | Required | Description |
|----------|----------|-------------|
| `SURREAL_URL` | Yes | SurrealDB connection URL |
| `SURREAL_NAMESPACE` | Yes | Target namespace |
| `SURREAL_DATABASE` | Yes | Target database |
| `SURREAL_USERNAME` | No | Authentication username |
| `SURREAL_PASSWORD` | No | Authentication password |
| `SURREAL_DEBUG` | No | Enable debug logging (`'true'`) |

### Query Helpers

#### `select(table: string, options?: SelectOptions): string`

Create a SurrealQL SELECT query string.

```typescript
import { select } from '@ereo/db-surrealdb';

select('users');
// => 'SELECT * FROM users'

select('users', { where: 'active = true' });
// => 'SELECT * FROM users WHERE active = true'

select('users', { orderBy: 'name ASC' });
// => 'SELECT * FROM users ORDER BY name ASC'

select('users', { limit: 10 });
// => 'SELECT * FROM users LIMIT 10'

select('users', { start: 20 });
// => 'SELECT * FROM users START 20'

// Combine all options
select('users', {
  where: 'active = true',
  orderBy: 'created_at DESC',
  limit: 10,
  start: 0,
});
// => 'SELECT * FROM users WHERE active = true ORDER BY created_at DESC LIMIT 10 START 0'
```

#### `create(table: string, id?: string): string`

Create a SurrealQL CREATE query string.

```typescript
import { create } from '@ereo/db-surrealdb';

create('users');
// => 'CREATE users'

create('users', 'john');
// => 'CREATE users:john'
```

#### `update(table: string, id?: string): string`

Create a SurrealQL UPDATE query string.

```typescript
import { update } from '@ereo/db-surrealdb';

update('users');
// => 'UPDATE users'

update('users', 'john');
// => 'UPDATE users:john'
```

#### `deleteFrom(table: string, id?: string): string`

Create a SurrealQL DELETE query string.

```typescript
import { deleteFrom } from '@ereo/db-surrealdb';

deleteFrom('users');
// => 'DELETE users'

deleteFrom('users', 'john');
// => 'DELETE users:john'
```

### Validation

#### `validateConfig(config: SurrealDBConfig): void`

Validate a SurrealDB configuration. Throws an error if invalid.

```typescript
import { validateConfig } from '@ereo/db-surrealdb';

// Valid configurations
validateConfig({
  url: 'http://localhost:8000',
  namespace: 'test',
  database: 'test',
}); // OK

validateConfig({
  url: 'mem://',
  namespace: 'test',
  database: 'test',
}); // OK (in-memory)

validateConfig({
  url: 'surrealkv://./data',
  namespace: 'test',
  database: 'test',
}); // OK (persistent)

// Invalid configurations throw errors
validateConfig({ url: '', namespace: 'test', database: 'test' });
// Throws: 'SurrealDB url is required'

validateConfig({ url: 'http://localhost:8000', namespace: '', database: 'test' });
// Throws: 'SurrealDB namespace is required'

validateConfig({ url: 'not-a-valid-url', namespace: 'test', database: 'test' });
// Throws: 'Invalid SurrealDB URL: not-a-valid-url'
```

## Configuration Options

The `SurrealDBConfig` interface extends `AdapterConfig` and includes:

| Option | Type | Required | Default | Description |
|--------|------|----------|---------|-------------|
| `url` | `string` | Yes | - | SurrealDB connection URL |
| `namespace` | `string` | Yes | - | Target namespace |
| `database` | `string` | Yes | - | Target database within the namespace |
| `auth` | `SurrealAuth` | No | - | Authentication credentials |
| `timeout` | `number` | No | `30000` | Connection timeout in milliseconds |
| `debug` | `boolean` | No | `false` | Enable debug logging |

**Supported URL Formats:**
- `http://127.0.0.1:8000` - HTTP connection
- `https://cloud.surrealdb.com` - HTTPS connection
- `ws://127.0.0.1:8000` - WebSocket connection
- `wss://cloud.surrealdb.com` - Secure WebSocket connection
- `mem://` - In-memory database (requires `@surrealdb/node`)
- `surrealkv://path/to/db` - Persistent storage (requires `@surrealdb/node`)

## SurrealDB-Specific Features

### SurrealQL Queries

Access the full power of SurrealQL through the client:

```typescript
import { useDb } from '@ereo/db-surrealdb';

export const loader = createLoader({
  load: async ({ context }) => {
    const db = useDb(context);

    // Raw SurrealQL queries
    const users = await db.client.query(`
      SELECT *, ->follows->user AS following
      FROM users
      WHERE active = true
      ORDER BY created_at DESC
      LIMIT 10
    `);

    // Parameterized queries (parameters use $0, $1, etc.)
    const result = await db.client.query(
      'SELECT * FROM users WHERE email = $0',
      ['user@example.com']
    );

    return users;
  },
});
```

### Record IDs

SurrealDB uses compound record IDs in the format `table:id`:

```typescript
import { useDb } from '@ereo/db-surrealdb';

export const loader = createLoader({
  load: async ({ context }) => {
    const db = useDb(context);

    // Select a specific record
    const user = await db.client.select('users:john');

    // Create with specific ID
    const newUser = await db.client.create('users:jane', {
      name: 'Jane Doe',
      email: 'jane@example.com',
    });

    // Update specific record
    await db.client.update('users:john', {
      name: 'John Smith',
    });

    // Delete specific record
    await db.client.delete('users:john');

    return user;
  },
});
```

### Transactions

The adapter supports both automatic and manual transaction handling:

```typescript
import { useDb, withTransaction } from '@ereo/db-surrealdb';

// Automatic transaction (recommended)
export const action = createAction({
  action: async ({ context }) => {
    const db = useDb(context);

    const result = await withTransaction(context, async (tx) => {
      // All operations here are in a transaction
      const user = await tx.create('users', { name: 'Alice' });
      await tx.create('profiles', { user: user.id, bio: 'Hello!' });
      return user;
    });

    return result;
  },
});

// Manual transaction control
export const action = createAction({
  action: async ({ context }) => {
    const adapter = useAdapter(context);
    const tx = await adapter.beginTransaction();

    try {
      await tx.client.query('CREATE users SET name = "Bob"');
      await tx.client.query('CREATE profiles SET user = users:bob');
      await tx.commit();
    } catch (error) {
      await tx.rollback();
      throw error;
    }
  },
});
```

### Connection Protocols

The adapter automatically appends `/rpc` to HTTP/HTTPS URLs for compatibility with the SurrealDB RPC endpoint:

```typescript
// Input: 'http://localhost:8000'
// Connection URL: 'http://localhost:8000/rpc'

// Input: 'http://localhost:8000/'
// Connection URL: 'http://localhost:8000/rpc'

// Input: 'ws://localhost:8000'
// Connection URL: 'ws://localhost:8000' (unchanged for WebSocket)
```

## Use Cases with Examples

### Basic CRUD Operations

```typescript
import { createLoader, createAction } from '@ereo/core';
import { useDb } from '@ereo/db-surrealdb';

// Read all users
export const usersLoader = createLoader({
  load: async ({ context }) => {
    const db = useDb(context);
    return db.client.select('users');
  },
});

// Read single user
export const userLoader = createLoader({
  load: async ({ context, params }) => {
    const db = useDb(context);
    return db.client.select(`users:${params.id}`);
  },
});

// Create user
export const createUserAction = createAction({
  action: async ({ context, request }) => {
    const db = useDb(context);
    const data = await request.json();
    return db.client.create('users', data);
  },
});

// Update user
export const updateUserAction = createAction({
  action: async ({ context, params, request }) => {
    const db = useDb(context);
    const data = await request.json();
    return db.client.merge(`users:${params.id}`, data);
  },
});

// Delete user
export const deleteUserAction = createAction({
  action: async ({ context, params }) => {
    const db = useDb(context);
    return db.client.delete(`users:${params.id}`);
  },
});
```

### Graph Relationships

```typescript
import { useDb } from '@ereo/db-surrealdb';

export const loader = createLoader({
  load: async ({ context, params }) => {
    const db = useDb(context);

    // Create a relationship
    await db.client.query(`
      RELATE users:${params.userId}->follows->users:${params.targetId}
      SET created_at = time::now()
    `);

    // Query relationships
    const following = await db.client.query(`
      SELECT ->follows->user.* AS following
      FROM users:${params.userId}
    `);

    const followers = await db.client.query(`
      SELECT <-follows<-user.* AS followers
      FROM users:${params.userId}
    `);

    // Mutual friends
    const mutuals = await db.client.query(`
      SELECT ->follows->user<-follows<-user AS mutuals
      FROM users:${params.userId}
      WHERE mutuals != users:${params.userId}
    `);

    return { following, followers, mutuals };
  },
});
```

### Query Deduplication

The adapter automatically deduplicates identical queries within a request:

```typescript
import { useDb } from '@ereo/db-surrealdb';

export const loader = createLoader({
  load: async ({ context }) => {
    const db = useDb(context);

    // These identical queries will only execute once
    const [users1, users2, users3] = await Promise.all([
      db.query('SELECT * FROM users'),
      db.query('SELECT * FROM users'),
      db.query('SELECT * FROM users'),
    ]);

    // Check deduplication stats
    const stats = db.getDedupStats();
    console.log(stats);
    // => { total: 3, deduplicated: 2, unique: 1, hitRate: 0.67 }

    // Clear cache after mutations
    await db.client.create('users', { name: 'New User' });
    db.invalidate(['users']); // or db.clearDedup() to clear all

    return users1;
  },
});
```

### Health Checks

```typescript
import { createSurrealAdapter } from '@ereo/db-surrealdb';

const adapter = createSurrealAdapter(config);

// Check database health
const health = await adapter.healthCheck();

if (health.healthy) {
  console.log(`Database is healthy (latency: ${health.latencyMs}ms)`);
  console.log(`Connected to: ${health.metadata?.namespace}/${health.metadata?.database}`);
} else {
  console.error(`Database unhealthy: ${health.error}`);
}
```

### Multi-Tenant Configuration

```typescript
import { createSurrealAdapter, defineSurrealConfig, databaseAuth } from '@ereo/db-surrealdb';

// Create tenant-specific adapter
function createTenantAdapter(tenantId: string) {
  return createSurrealAdapter(defineSurrealConfig({
    url: process.env.SURREAL_URL!,
    namespace: 'production',
    database: `tenant_${tenantId}`,
    auth: databaseAuth(
      'production',
      `tenant_${tenantId}`,
      process.env.TENANT_USER!,
      process.env.TENANT_PASSWORD!
    ),
  }));
}
```

## Integration with Core db Package

This package re-exports commonly used items from `@ereo/db` for convenience:

```typescript
import {
  // Plugin factory
  createDatabasePlugin,

  // Context helpers
  useDb,
  useAdapter,
  getDb,

  // Transaction helper
  withTransaction,

  // Types
  type DatabaseAdapter,
  type RequestScopedClient,
  type QueryResult,
  type MutationResult,
  type DedupResult,
  type DedupStats,
  type TransactionOptions,
} from '@ereo/db-surrealdb';
```

## TypeScript Types Reference

### Authentication Types

```typescript
// Root user authentication
interface RootAuth {
  username: string;
  password: string;
}

// Namespace-level authentication
interface NamespaceAuth {
  namespace: string;
  username: string;
  password: string;
}

// Database-level authentication
interface DatabaseAuth {
  namespace: string;
  database: string;
  username: string;
  password: string;
}

// Record access authentication (SurrealDB 2.x+)
interface RecordAccessAuth {
  namespace: string;
  database: string;
  access: string;
  variables?: Record<string, unknown>;
}

// Scope-based authentication (SurrealDB 1.x)
interface ScopeAuth {
  namespace: string;
  database: string;
  scope: string;
  [key: string]: unknown;
}

// Union of all authentication types
type SurrealAuth = RootAuth | NamespaceAuth | DatabaseAuth | RecordAccessAuth | ScopeAuth;
```

### Configuration Types

```typescript
// Connection protocol
type ConnectionProtocol = 'http' | 'https' | 'ws' | 'wss';

// Engine type
type SurrealEngine = 'remote' | 'memory' | 'surrealkv';

// Main configuration
interface SurrealDBConfig extends AdapterConfig {
  url: string;
  namespace: string;
  database: string;
  auth?: SurrealAuth;
  timeout?: number;
  debug?: boolean;
}
```

### Query Result Types

```typescript
// SurrealDB query result
interface SurrealQueryResult<T = unknown> {
  result: T;
  status: 'OK' | 'ERR';
  time: string;
}

// Raw RPC response
interface SurrealRawResponse<T = unknown> {
  result: T;
  status: string;
  time: string;
}
```

### Record Types

```typescript
// SurrealDB Record ID (format: "table:id")
interface RecordId<T extends string = string> {
  tb: T;
  id: string | number | object;
}

// Base record with ID
interface SurrealRecord {
  id: RecordId | string;
}
```

### Live Query Types

```typescript
// Live query action types
type LiveAction = 'CREATE' | 'UPDATE' | 'DELETE';

// Live query notification
interface LiveNotification<T = unknown> {
  action: LiveAction;
  result: T;
}
```

### Type Guards

```typescript
import {
  isRootAuth,
  isNamespaceAuth,
  isDatabaseAuth,
  isRecordAccessAuth,
  isScopeAuth,
} from '@ereo/db-surrealdb';

// Example usage
function handleAuth(auth: SurrealAuth) {
  if (isRootAuth(auth)) {
    console.log('Root auth:', auth.username);
  } else if (isNamespaceAuth(auth)) {
    console.log('Namespace auth:', auth.namespace, auth.username);
  } else if (isDatabaseAuth(auth)) {
    console.log('Database auth:', auth.namespace, auth.database, auth.username);
  } else if (isRecordAccessAuth(auth)) {
    console.log('Record access auth:', auth.access);
  } else if (isScopeAuth(auth)) {
    console.log('Scope auth:', auth.scope);
  }
}
```

### SurrealClient Interface

```typescript
interface SurrealClient {
  connect(url: string): Promise<void>;
  close(): Promise<void>;
  use(params: { namespace: string; database: string }): Promise<void>;
  signin(credentials: Record<string, unknown>): Promise<string>;
  query<T = unknown>(sql: string, vars?: Record<string, unknown>): Promise<T[]>;
  select<T = unknown>(thing: string): Promise<T[]>;
  create<T = unknown>(thing: string, data?: Record<string, unknown>): Promise<T>;
  insert<T = unknown>(thing: string, data?: Record<string, unknown> | Record<string, unknown>[]): Promise<T[]>;
  update<T = unknown>(thing: string, data?: Record<string, unknown>): Promise<T>;
  merge<T = unknown>(thing: string, data?: Record<string, unknown>): Promise<T>;
  patch<T = unknown>(thing: string, data?: unknown[]): Promise<T>;
  delete<T = unknown>(thing: string): Promise<T>;
}
```

## Troubleshooting / FAQ

### Connection Issues

**Q: I get "Failed to connect to SurrealDB" error**

A: Check the following:
1. Ensure SurrealDB is running and accessible at the configured URL
2. Verify the URL format is correct (include protocol: `http://`, `https://`, `ws://`, or `wss://`)
3. Check that namespace and database exist in SurrealDB
4. Verify authentication credentials are correct

```bash
# Test SurrealDB connectivity
curl -X POST http://localhost:8000/health
```

**Q: WebSocket connection keeps disconnecting**

A: This may be due to timeout settings. Increase the timeout:

```typescript
const config = defineSurrealConfig({
  url: 'ws://localhost:8000',
  namespace: 'test',
  database: 'test',
  timeout: 60000, // 60 seconds
});
```

### Authentication Issues

**Q: What authentication method should I use?**

A: It depends on your security requirements:
- **Root auth**: Full access, use for admin tasks or development
- **Namespace auth**: Access to all databases in a namespace
- **Database auth**: Access to a specific database
- **Record access auth** (2.x): Fine-grained access control per record
- **Scope auth** (1.x): User-level authentication with custom scopes

**Q: How do I authenticate users in my application?**

A: Use record access authentication (SurrealDB 2.x) or scope authentication (SurrealDB 1.x):

```typescript
// SurrealDB 2.x
const auth = recordAccessAuth('myns', 'mydb', 'user', {
  email: userEmail,
  password: userPassword,
});

// SurrealDB 1.x
const auth: ScopeAuth = {
  namespace: 'myns',
  database: 'mydb',
  scope: 'user',
  email: userEmail,
  password: userPassword,
};
```

### Query Issues

**Q: How do I pass parameters to queries?**

A: Use numbered parameters ($0, $1, etc.):

```typescript
const db = useDb(context);

// Parameters are converted to $0, $1, etc.
const result = await db.client.query(
  'SELECT * FROM users WHERE email = $0 AND active = $1',
  ['user@example.com', true]
);
```

**Q: Query deduplication is not working**

A: Ensure you're using the request-scoped client:

```typescript
// Correct - uses deduplication
const db = useDb(context);
const result = await db.query('SELECT * FROM users');

// Direct client access - no deduplication
const adapter = useAdapter(context);
const client = adapter.getClient();
const result = await client.query('SELECT * FROM users');
```

### Transaction Issues

**Q: My transaction is not rolling back on error**

A: Ensure you're using the transaction helper or properly handling errors:

```typescript
// Recommended approach - automatic rollback
const result = await withTransaction(context, async (tx) => {
  // If any operation throws, the transaction is rolled back
  await tx.create('users', { name: 'Alice' });
  throw new Error('Something went wrong'); // Transaction will rollback
});

// Manual approach - must handle rollback explicitly
const tx = await adapter.beginTransaction();
try {
  await tx.client.query('...');
  await tx.commit();
} catch (error) {
  await tx.rollback(); // Don't forget this!
  throw error;
}
```

### Debug Mode

Enable debug logging to troubleshoot issues:

```typescript
const config = defineSurrealConfig({
  url: 'http://localhost:8000',
  namespace: 'test',
  database: 'test',
  debug: true, // Logs connection events and queries
});
```

Debug output includes:
- Connection attempts: `[surrealdb] Connecting to http://localhost:8000/rpc...`
- Authentication: `[surrealdb] Signing in...`
- Successful connection: `[surrealdb] Connected to test/test`
- Query execution: `[surrealdb] Query: SELECT * FROM users {...}`
- Disconnection: `[surrealdb] Disconnected`

### Error Classes

The adapter uses typed errors from `@ereo/db`:

```typescript
import { ConnectionError, QueryError, TransactionError } from '@ereo/db-surrealdb';

try {
  const db = useDb(context);
  await db.client.query('INVALID SQL');
} catch (error) {
  if (error instanceof ConnectionError) {
    console.error('Connection failed:', error.message);
  } else if (error instanceof QueryError) {
    console.error('Query failed:', error.message);
    console.error('SQL:', error.query);
    console.error('Params:', error.params);
  } else if (error instanceof TransactionError) {
    console.error('Transaction failed:', error.message);
  }
}
```
