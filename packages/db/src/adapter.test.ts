/**
 * Tests for adapter registry.
 */

import { describe, it, expect, beforeEach } from 'bun:test';
import type { AppContext } from '@ereo/core';
import {
  registerAdapter,
  getAdapter,
  getDefaultAdapter,
  clearAdapterRegistry,
  type DatabaseAdapter,
  type RequestScopedClient,
  type Transaction,
} from './adapter';
import type {
  QueryResult,
  MutationResult,
  TransactionOptions,
  HealthCheckResult,
  DedupResult,
  DedupStats,
} from './types';

// Mock adapter for testing
class MockAdapter implements DatabaseAdapter<{ mockClient: true }> {
  readonly name: string;
  readonly edgeCompatible: boolean;

  constructor(name: string, edgeCompatible = false) {
    this.name = name;
    this.edgeCompatible = edgeCompatible;
  }

  getClient(): { mockClient: true } {
    return { mockClient: true };
  }

  getRequestClient(_context: AppContext): RequestScopedClient<{ mockClient: true }> {
    return {
      client: { mockClient: true },
      async query<T>(_sql: string, _params?: unknown[]): Promise<DedupResult<QueryResult<T>>> {
        return {
          result: { rows: [], rowCount: 0 },
          fromCache: false,
          cacheKey: 'test',
        };
      },
      getDedupStats(): DedupStats {
        return { total: 0, deduplicated: 0, unique: 0, hitRate: 0 };
      },
      clearDedup(): void {},
      invalidate(): void {},
    };
  }

  async query<T>(_sql: string, _params?: unknown[]): Promise<QueryResult<T>> {
    return { rows: [], rowCount: 0 };
  }

  async execute(_sql: string, _params?: unknown[]): Promise<MutationResult> {
    return { rowsAffected: 0 };
  }

  async transaction<T>(fn: (tx: { mockClient: true }) => Promise<T>): Promise<T> {
    return fn({ mockClient: true });
  }

  async beginTransaction(): Promise<Transaction<{ mockClient: true }>> {
    return {
      client: { mockClient: true },
      async commit(): Promise<void> {},
      async rollback(): Promise<void> {},
      isActive: true,
    };
  }

  async healthCheck(): Promise<HealthCheckResult> {
    return { healthy: true, latencyMs: 1 };
  }

  async disconnect(): Promise<void> {}
}

describe('Adapter Registry', () => {
  beforeEach(() => {
    clearAdapterRegistry();
  });

  describe('registerAdapter', () => {
    it('should register an adapter', () => {
      const adapter = new MockAdapter('test-adapter');
      registerAdapter('test', adapter);

      const retrieved = getAdapter('test');
      expect(retrieved).toBe(adapter);
    });

    it('should allow registering multiple adapters', () => {
      const adapter1 = new MockAdapter('adapter-1');
      const adapter2 = new MockAdapter('adapter-2');

      registerAdapter('first', adapter1);
      registerAdapter('second', adapter2);

      expect(getAdapter('first')).toBe(adapter1);
      expect(getAdapter('second')).toBe(adapter2);
    });

    it('should overwrite existing adapter with same name', () => {
      const adapter1 = new MockAdapter('original');
      const adapter2 = new MockAdapter('replacement');

      registerAdapter('test', adapter1);
      registerAdapter('test', adapter2);

      expect(getAdapter('test')).toBe(adapter2);
    });
  });

  describe('getAdapter', () => {
    it('should return undefined for non-existent adapter', () => {
      const adapter = getAdapter('non-existent');
      expect(adapter).toBeUndefined();
    });

    it('should return registered adapter', () => {
      const adapter = new MockAdapter('test');
      registerAdapter('test', adapter);

      expect(getAdapter('test')).toBe(adapter);
    });
  });

  describe('getDefaultAdapter', () => {
    it('should return undefined when no adapters registered', () => {
      const adapter = getDefaultAdapter();
      expect(adapter).toBeUndefined();
    });

    it('should return first registered adapter', () => {
      const adapter = new MockAdapter('first');
      registerAdapter('default', adapter);

      expect(getDefaultAdapter()).toBe(adapter);
    });
  });

  describe('clearAdapterRegistry', () => {
    it('should remove all adapters', () => {
      registerAdapter('one', new MockAdapter('one'));
      registerAdapter('two', new MockAdapter('two'));

      clearAdapterRegistry();

      expect(getAdapter('one')).toBeUndefined();
      expect(getAdapter('two')).toBeUndefined();
      expect(getDefaultAdapter()).toBeUndefined();
    });
  });
});

describe('MockAdapter', () => {
  let adapter: MockAdapter;

  beforeEach(() => {
    adapter = new MockAdapter('mock', true);
  });

  it('should have correct name', () => {
    expect(adapter.name).toBe('mock');
  });

  it('should have correct edge compatibility', () => {
    expect(adapter.edgeCompatible).toBe(true);
  });

  it('should return client', () => {
    const client = adapter.getClient();
    expect(client).toEqual({ mockClient: true });
  });

  it('should execute queries', async () => {
    const result = await adapter.query<{ id: number }>('SELECT * FROM users');

    expect(result.rows).toEqual([]);
    expect(result.rowCount).toBe(0);
  });

  it('should execute mutations', async () => {
    const result = await adapter.execute('INSERT INTO users VALUES (?)');

    expect(result.rowsAffected).toBe(0);
  });

  it('should run transactions', async () => {
    const result = await adapter.transaction(async (tx) => {
      expect(tx).toEqual({ mockClient: true });
      return 'transaction result';
    });

    expect(result).toBe('transaction result');
  });

  it('should begin manual transactions', async () => {
    const tx = await adapter.beginTransaction();

    expect(tx.client).toEqual({ mockClient: true });
    expect(tx.isActive).toBe(true);

    await tx.commit();
  });

  it('should perform health checks', async () => {
    const health = await adapter.healthCheck();

    expect(health.healthy).toBe(true);
    expect(health.latencyMs).toBeGreaterThanOrEqual(0);
  });

  it('should disconnect without error', async () => {
    await expect(adapter.disconnect()).resolves.toBeUndefined();
  });
});
