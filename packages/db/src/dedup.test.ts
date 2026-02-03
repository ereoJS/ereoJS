/**
 * Tests for query deduplication logic.
 */

import { describe, it, expect, beforeEach } from 'bun:test';
import { RequestContext } from '@ereo/core';
import {
  generateFingerprint,
  dedupQuery,
  clearDedupCache,
  invalidateTables,
  getRequestDedupStats,
  debugGetCacheContents,
} from './dedup';

// Create a mock request for context
function createMockContext(): RequestContext {
  const request = new Request('http://localhost/test');
  return new RequestContext(request);
}

describe('generateFingerprint', () => {
  it('should generate consistent fingerprints for same query and params', () => {
    const query = 'SELECT * FROM users WHERE id = ?';
    const params = [1];

    const fp1 = generateFingerprint(query, params);
    const fp2 = generateFingerprint(query, params);

    expect(fp1).toBe(fp2);
  });

  it('should generate different fingerprints for different queries', () => {
    const fp1 = generateFingerprint('SELECT * FROM users', []);
    const fp2 = generateFingerprint('SELECT * FROM posts', []);

    expect(fp1).not.toBe(fp2);
  });

  it('should generate different fingerprints for different params', () => {
    const query = 'SELECT * FROM users WHERE id = ?';
    const fp1 = generateFingerprint(query, [1]);
    const fp2 = generateFingerprint(query, [2]);

    expect(fp1).not.toBe(fp2);
  });

  it('should normalize whitespace in queries', () => {
    const fp1 = generateFingerprint('SELECT * FROM users', []);
    const fp2 = generateFingerprint('SELECT  *  FROM  users', []);
    const fp3 = generateFingerprint('SELECT *\nFROM users', []);

    expect(fp1).toBe(fp2);
    expect(fp1).toBe(fp3);
  });

  it('should handle special types in params', () => {
    const date = new Date('2024-01-01');
    const fp1 = generateFingerprint('SELECT * FROM users WHERE created_at = ?', [date]);
    const fp2 = generateFingerprint('SELECT * FROM users WHERE created_at = ?', [date]);

    expect(fp1).toBe(fp2);
  });

  it('should handle bigint params', () => {
    const fp1 = generateFingerprint('SELECT * FROM users WHERE id = ?', [BigInt(123)]);
    const fp2 = generateFingerprint('SELECT * FROM users WHERE id = ?', [BigInt(123)]);

    expect(fp1).toBe(fp2);
  });

  it('should handle undefined params', () => {
    const fp1 = generateFingerprint('SELECT * FROM users', undefined);
    const fp2 = generateFingerprint('SELECT * FROM users', undefined);

    expect(fp1).toBe(fp2);
  });

  it('should handle empty params array', () => {
    const fp1 = generateFingerprint('SELECT * FROM users', []);
    const fp2 = generateFingerprint('SELECT * FROM users', []);

    expect(fp1).toBe(fp2);
  });
});

describe('dedupQuery', () => {
  let context: RequestContext;

  beforeEach(() => {
    context = createMockContext();
  });

  it('should execute query on first call', async () => {
    let executionCount = 0;
    const executor = async () => {
      executionCount++;
      return [{ id: 1, name: 'Alice' }];
    };

    const result = await dedupQuery(context, 'SELECT * FROM users', [], executor);

    expect(executionCount).toBe(1);
    expect(result.fromCache).toBe(false);
    expect(result.result).toEqual([{ id: 1, name: 'Alice' }]);
  });

  it('should return cached result on duplicate query', async () => {
    let executionCount = 0;
    const executor = async () => {
      executionCount++;
      return [{ id: 1, name: 'Alice' }];
    };

    const query = 'SELECT * FROM users WHERE id = ?';
    const params = [1];

    const result1 = await dedupQuery(context, query, params, executor);
    const result2 = await dedupQuery(context, query, params, executor);

    expect(executionCount).toBe(1);
    expect(result1.fromCache).toBe(false);
    expect(result2.fromCache).toBe(true);
    expect(result1.result).toEqual(result2.result);
  });

  it('should execute both queries when params differ', async () => {
    let executionCount = 0;
    const executor = async () => {
      executionCount++;
      return [{ id: executionCount }];
    };

    const query = 'SELECT * FROM users WHERE id = ?';

    await dedupQuery(context, query, [1], executor);
    await dedupQuery(context, query, [2], executor);

    expect(executionCount).toBe(2);
  });

  it('should skip cache when noCache option is true', async () => {
    let executionCount = 0;
    const executor = async () => {
      executionCount++;
      return [{ id: 1 }];
    };

    const query = 'SELECT * FROM users';

    await dedupQuery(context, query, [], executor, { noCache: true });
    await dedupQuery(context, query, [], executor, { noCache: true });

    expect(executionCount).toBe(2);
  });

  it('should track tables for selective invalidation', async () => {
    const executor = async () => [{ id: 1 }];

    await dedupQuery(context, 'SELECT * FROM users', [], executor, {
      tables: ['users'],
    });

    const contents = debugGetCacheContents(context);
    expect(contents.length).toBe(1);
    expect(contents[0].tables).toEqual(['users']);
  });
});

describe('clearDedupCache', () => {
  let context: RequestContext;

  beforeEach(() => {
    context = createMockContext();
  });

  it('should clear all cached queries', async () => {
    let executionCount = 0;
    const executor = async () => {
      executionCount++;
      return [{ id: 1 }];
    };

    const query = 'SELECT * FROM users';

    await dedupQuery(context, query, [], executor);
    expect(executionCount).toBe(1);

    clearDedupCache(context);

    await dedupQuery(context, query, [], executor);
    expect(executionCount).toBe(2);
  });

  it('should not error when cache is empty', () => {
    expect(() => clearDedupCache(context)).not.toThrow();
  });
});

describe('invalidateTables', () => {
  let context: RequestContext;

  beforeEach(() => {
    context = createMockContext();
  });

  it('should invalidate queries for specific tables', async () => {
    let executionCount = 0;
    const executor = async () => {
      executionCount++;
      return [{ id: 1 }];
    };

    // Cache queries for different tables
    await dedupQuery(context, 'SELECT * FROM users', [], executor, { tables: ['users'] });
    await dedupQuery(context, 'SELECT * FROM posts', [], executor, { tables: ['posts'] });

    expect(executionCount).toBe(2);

    // Invalidate only users table
    invalidateTables(context, ['users']);

    // Users query should re-execute
    await dedupQuery(context, 'SELECT * FROM users', [], executor, { tables: ['users'] });
    expect(executionCount).toBe(3);

    // Posts query should still be cached
    await dedupQuery(context, 'SELECT * FROM posts', [], executor, { tables: ['posts'] });
    expect(executionCount).toBe(3);
  });

  it('should be case-insensitive for table names', async () => {
    let executionCount = 0;
    const executor = async () => {
      executionCount++;
      return [{ id: 1 }];
    };

    await dedupQuery(context, 'SELECT * FROM Users', [], executor, { tables: ['Users'] });
    invalidateTables(context, ['USERS']);

    await dedupQuery(context, 'SELECT * FROM Users', [], executor, { tables: ['Users'] });
    expect(executionCount).toBe(2);
  });
});

describe('getRequestDedupStats', () => {
  let context: RequestContext;

  beforeEach(() => {
    context = createMockContext();
  });

  it('should return zero stats for empty context', () => {
    const stats = getRequestDedupStats(context);

    expect(stats.total).toBe(0);
    expect(stats.deduplicated).toBe(0);
    expect(stats.unique).toBe(0);
    expect(stats.hitRate).toBe(0);
  });

  it('should track query statistics correctly', async () => {
    const executor = async () => [{ id: 1 }];

    // Execute same query 3 times
    await dedupQuery(context, 'SELECT * FROM users', [], executor);
    await dedupQuery(context, 'SELECT * FROM users', [], executor);
    await dedupQuery(context, 'SELECT * FROM users', [], executor);

    const stats = getRequestDedupStats(context);

    expect(stats.total).toBe(3);
    expect(stats.deduplicated).toBe(2);
    expect(stats.unique).toBe(1);
    expect(stats.hitRate).toBeCloseTo(2 / 3, 5);
  });

  it('should track mixed query patterns', async () => {
    const executor = async () => [{ id: 1 }];

    // 2 unique queries, each called twice
    await dedupQuery(context, 'SELECT * FROM users', [], executor);
    await dedupQuery(context, 'SELECT * FROM posts', [], executor);
    await dedupQuery(context, 'SELECT * FROM users', [], executor);
    await dedupQuery(context, 'SELECT * FROM posts', [], executor);

    const stats = getRequestDedupStats(context);

    expect(stats.total).toBe(4);
    expect(stats.deduplicated).toBe(2);
    expect(stats.unique).toBe(2);
    expect(stats.hitRate).toBe(0.5);
  });
});

describe('debugGetCacheContents', () => {
  let context: RequestContext;

  beforeEach(() => {
    context = createMockContext();
  });

  it('should return empty array for fresh context', () => {
    const contents = debugGetCacheContents(context);
    expect(contents).toEqual([]);
  });

  it('should return cache entries with metadata', async () => {
    const executor = async () => [{ id: 1 }];

    await dedupQuery(context, 'SELECT * FROM users', [], executor, { tables: ['users'] });

    const contents = debugGetCacheContents(context);

    expect(contents.length).toBe(1);
    expect(contents[0]).toHaveProperty('key');
    expect(contents[0]).toHaveProperty('tables');
    expect(contents[0]).toHaveProperty('age');
    expect(contents[0].tables).toEqual(['users']);
    expect(contents[0].age).toBeGreaterThanOrEqual(0);
  });
});
