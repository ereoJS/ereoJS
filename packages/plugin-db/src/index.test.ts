/**
 * @ereo/db - Database plugin tests
 */

import { describe, expect, test, beforeEach, afterEach } from 'bun:test';
import { Database } from 'bun:sqlite';
import {
  createSQLiteClient,
  createDatabasePlugin,
  useDB,
  defineTable,
  db,
  type DatabaseConfig,
  type WhereCondition,
} from './index';

// Test database path - use unique path per test run
function getUniqueDbPath(): string {
  return `/tmp/test-ereo-db-${Date.now()}-${Math.random().toString(36).slice(2)}.sqlite`;
}

describe('createSQLiteClient', () => {
  let dbPath: string;
  let client: ReturnType<typeof createSQLiteClient> | undefined;

  beforeEach(async () => {
    dbPath = getUniqueDbPath();
    try {
      await Bun.file(dbPath).delete();
    } catch {}
  });

  afterEach(async () => {
    if (client) {
      await client.disconnect();
    }
    try {
      await Bun.file(dbPath).delete();
    } catch {}
  });

  test('creates database client', () => {
    client = createSQLiteClient({
      provider: 'sqlite',
      url: dbPath,
    });
    expect(client).toBeDefined();
    expect(client.query).toBeDefined();
    expect(client.execute).toBeDefined();
  });

  test('creates database file', async () => {
    client = createSQLiteClient({
      provider: 'sqlite',
      url: dbPath,
    });
    const file = Bun.file(dbPath);
    expect(await file.exists()).toBe(true);
  });

  test('executes raw SQL query', async () => {
    client = createSQLiteClient({
      provider: 'sqlite',
      url: dbPath,
    });
    const results = await client.query('SELECT 1 as test');
    expect(results).toEqual([{ test: 1 }]);
  });

  test('executes SQL modifications', async () => {
    client = createSQLiteClient({
      provider: 'sqlite',
      url: dbPath,
    });
    const result = await client.execute(
      'CREATE TABLE test (id INTEGER PRIMARY KEY, name TEXT)'
    );
    expect(result.changes).toBe(0);
  });

  test('getRawConnection returns Database instance', () => {
    client = createSQLiteClient({
      provider: 'sqlite',
      url: dbPath,
    });
    const raw = client.getRawConnection();
    expect(raw).toBeInstanceOf(Database);
  });
});

describe('Table Operations', () => {
  let client: ReturnType<typeof createSQLiteClient>;

  beforeEach(async () => {
    try {
      await Bun.file(dbPath).delete();
    } catch {}
    client = createSQLiteClient({
      provider: 'sqlite',
      url: dbPath,
    });
    await client.createTable('users', {
      id: { type: 'INTEGER', primaryKey: true, autoIncrement: true },
      name: { type: 'TEXT', notNull: true },
      email: { type: 'TEXT', unique: true },
      age: { type: 'INTEGER' },
    });
  });

  afterEach(async () => {
    await client.disconnect();
    try {
      await Bun.file(dbPath).delete();
    } catch {}
  });

  test('createTable creates table with schema', async () => {
    const exists = await client.tableExists('users');
    expect(exists).toBe(true);
  });

  test('dropTable removes table', async () => {
    await client.dropTable('users');
    const exists = await client.tableExists('users');
    expect(exists).toBe(false);
  });

  test('tableExists returns false for non-existent table', async () => {
    const exists = await client.tableExists('nonexistent');
    expect(exists).toBe(false);
  });
});

describe('TableModel CRUD', () => {
  let client: ReturnType<typeof createSQLiteClient>;

  beforeEach(async () => {
    try {
      await Bun.file(dbPath).delete();
    } catch {}
    client = createSQLiteClient({
      provider: 'sqlite',
      url: dbPath,
    });
    await client.createTable('users', {
      id: { type: 'INTEGER', primaryKey: true, autoIncrement: true },
      name: { type: 'TEXT', notNull: true },
      email: { type: 'TEXT' },
      age: { type: 'INTEGER' },
    });
  });

  afterEach(async () => {
    await client.disconnect();
    try {
      await Bun.file(dbPath).delete();
    } catch {}
  });

  test('create inserts record', async () => {
    const users = client.getTable('users');
    const result = await users.create({
      data: { name: 'John', email: 'john@example.com', age: 30 },
    });
    expect(result.id).toBeDefined();
    expect(result.name).toBe('John');
  });

  test('findUnique finds record by criteria', async () => {
    const users = client.getTable('users');
    await users.create({
      data: { name: 'John', email: 'john@example.com' },
    });
    const found = await users.findUnique({
      where: { email: 'john@example.com' },
    });
    expect(found).toBeDefined();
    expect(found?.name).toBe('John');
  });

  test('findUnique returns null for missing record', async () => {
    const users = client.getTable('users');
    const found = await users.findUnique({
      where: { email: 'missing@example.com' },
    });
    expect(found).toBeNull();
  });

  test('findMany returns all records', async () => {
    const users = client.getTable('users');
    await users.create({ data: { name: 'John' } });
    await users.create({ data: { name: 'Jane' } });
    const all = await users.findMany();
    expect(all).toHaveLength(2);
  });

  test('findMany with where filter', async () => {
    const users = client.getTable('users');
    await users.create({ data: { name: 'John', age: 30 } });
    await users.create({ data: { name: 'Jane', age: 25 } });
    const results = await users.findMany({
      where: { age: 30 },
    });
    expect(results).toHaveLength(1);
    expect(results[0].name).toBe('John');
  });

  test('update modifies record', async () => {
    const users = client.getTable('users');
    await users.create({ data: { name: 'John', email: 'john@example.com' } });
    const updated = await users.update({
      where: { email: 'john@example.com' },
      data: { name: 'Johnny' },
    });
    expect(updated.name).toBe('Johnny');
  });

  test('delete removes record', async () => {
    const users = client.getTable('users');
    await users.create({ data: { name: 'John', email: 'john@example.com' } });
    const deleted = await users.delete({
      where: { email: 'john@example.com' },
    });
    expect(deleted.name).toBe('John');
    const remaining = await users.findMany();
    expect(remaining).toHaveLength(0);
  });

  test('count returns total records', async () => {
    const users = client.getTable('users');
    await users.create({ data: { name: 'John' } });
    await users.create({ data: { name: 'Jane' } });
    const count = await users.count();
    expect(count).toBe(2);
  });

  test('count with where filter', async () => {
    const users = client.getTable('users');
    await users.create({ data: { name: 'John', age: 30 } });
    await users.create({ data: { name: 'Jane', age: 25 } });
    const count = await users.count({ where: { age: 30 } });
    expect(count).toBe(1);
  });
});

describe('TableModel Advanced Queries', () => {
  let client: ReturnType<typeof createSQLiteClient>;

  beforeEach(async () => {
    try {
      await Bun.file(dbPath).delete();
    } catch {}
    client = createSQLiteClient({
      provider: 'sqlite',
      url: dbPath,
    });
    await client.createTable('products', {
      id: { type: 'INTEGER', primaryKey: true, autoIncrement: true },
      name: { type: 'TEXT' },
      price: { type: 'REAL' },
      category: { type: 'TEXT' },
    });
  });

  afterEach(async () => {
    await client.disconnect();
    try {
      await Bun.file(dbPath).delete();
    } catch {}
  });

  test('findMany with orderBy', async () => {
    const products = client.getTable('products');
    await products.create({ data: { name: 'C', price: 30 } });
    await products.create({ data: { name: 'A', price: 10 } });
    await products.create({ data: { name: 'B', price: 20 } });
    const results = await products.findMany({
      orderBy: { price: 'asc' },
    });
    expect(results[0].name).toBe('A');
    expect(results[2].name).toBe('C');
  });

  test('findMany with take limit', async () => {
    const products = client.getTable('products');
    await products.create({ data: { name: 'A' } });
    await products.create({ data: { name: 'B' } });
    await products.create({ data: { name: 'C' } });
    const results = await products.findMany({ take: 2 });
    expect(results).toHaveLength(2);
  });

  test('findMany with skip offset', async () => {
    const products = client.getTable('products');
    await products.create({ data: { name: 'A' } });
    await products.create({ data: { name: 'B' } });
    await products.create({ data: { name: 'C' } });
    const results = await products.findMany({ skip: 1 });
    expect(results).toHaveLength(2);
  });

  test('aggregate with _count', async () => {
    const products = client.getTable('products');
    await products.create({ data: { name: 'A', price: 10 } });
    await products.create({ data: { name: 'B', price: 20 } });
    const result = await products.aggregate({ _count: true });
    expect(result._count).toBe(2);
  });

  test('aggregate with _sum', async () => {
    const products = client.getTable('products');
    await products.create({ data: { name: 'A', price: 10 } });
    await products.create({ data: { name: 'B', price: 20 } });
    const result = await products.aggregate({ _sum: { price: true } });
    expect(result._sum_price).toBe(30);
  });
});

describe('createDatabasePlugin', () => {
  test('creates plugin with correct name', () => {
    const plugin = createDatabasePlugin({
      provider: 'sqlite',
      url: dbPath,
    });
    expect(plugin.name).toBe('@ereo/db');
    expect(plugin.setup).toBeDefined();
  });
});

describe('defineTable', () => {
  test('returns type helper (empty cast object)', () => {
    const table = defineTable<{ id: number; name: string }>();
    // Type helper returns empty object cast to TableModel
    expect(typeof table).toBe('object');
  });
});

describe('Where Conditions', () => {
  let client: ReturnType<typeof createSQLiteClient>;

  beforeEach(async () => {
    try {
      await Bun.file(dbPath).delete();
    } catch {}
    client = createSQLiteClient({
      provider: 'sqlite',
      url: dbPath,
    });
    await client.createTable('items', {
      id: { type: 'INTEGER', primaryKey: true, autoIncrement: true },
      name: { type: 'TEXT' },
      price: { type: 'REAL' },
      quantity: { type: 'INTEGER' },
    });
  });

  afterEach(async () => {
    await client.disconnect();
    try {
      await Bun.file(dbPath).delete();
    } catch {}
  });

  test('gt (greater than) condition', async () => {
    const items = client.getTable('items');
    await items.create({ data: { name: 'A', price: 10 } });
    await items.create({ data: { name: 'B', price: 20 } });
    const results = await items.findMany({
      where: { gt: { price: 15 } },
    });
    expect(results).toHaveLength(1);
    expect(results[0].name).toBe('B');
  });

  test('lt (less than) condition', async () => {
    const items = client.getTable('items');
    await items.create({ data: { name: 'A', price: 10 } });
    await items.create({ data: { name: 'B', price: 20 } });
    const results = await items.findMany({
      where: { lt: { price: 15 } },
    });
    expect(results).toHaveLength(1);
    expect(results[0].name).toBe('A');
  });

  test('like condition', async () => {
    const items = client.getTable('items');
    await items.create({ data: { name: 'Apple' } });
    await items.create({ data: { name: 'Banana' } });
    const results = await items.findMany({
      where: { like: { name: 'A%' } },
    });
    expect(results).toHaveLength(1);
    expect(results[0].name).toBe('Apple');
  });

  test('in condition', async () => {
    const items = client.getTable('items');
    await items.create({ data: { name: 'A', quantity: 1 } });
    await items.create({ data: { name: 'B', quantity: 2 } });
    await items.create({ data: { name: 'C', quantity: 3 } });
    const results = await items.findMany({
      where: { in: { quantity: [1, 3] } },
    });
    expect(results).toHaveLength(2);
  });

  test('NOT condition', async () => {
    const items = client.getTable('items');
    await items.create({ data: { name: 'A', quantity: 1 } });
    await items.create({ data: { name: 'B', quantity: 2 } });
    const results = await items.findMany({
      where: { NOT: { quantity: 1 } },
    });
    expect(results).toHaveLength(1);
    expect(results[0].name).toBe('B');
  });
});
