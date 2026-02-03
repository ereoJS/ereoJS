/**
 * Tests for connection pool primitives.
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import {
  ConnectionPool,
  DEFAULT_POOL_CONFIG,
  createEdgePoolConfig,
  createServerlessPoolConfig,
  withRetry,
  isCommonRetryableError,
  type PoolStats,
} from './pool';
import { ConnectionError, TimeoutError } from './types';

// Mock connection for testing
class MockConnection {
  id: number;
  closed: boolean = false;
  valid: boolean = true;

  constructor(id: number) {
    this.id = id;
  }
}

// Concrete implementation of ConnectionPool for testing
class TestPool extends ConnectionPool<MockConnection> {
  private connectionCounter = 0;
  public createDelay = 0;
  public createError: Error | null = null;
  public validateResult = true;

  protected async createConnection(): Promise<MockConnection> {
    if (this.createDelay > 0) {
      await new Promise(resolve => setTimeout(resolve, this.createDelay));
    }
    if (this.createError) {
      throw this.createError;
    }
    return new MockConnection(++this.connectionCounter);
  }

  protected async closeConnection(connection: MockConnection): Promise<void> {
    connection.closed = true;
  }

  protected async validateConnection(connection: MockConnection): Promise<boolean> {
    return this.validateResult && connection.valid && !connection.closed;
  }
}

describe('ConnectionPool', () => {
  let pool: TestPool;

  beforeEach(() => {
    pool = new TestPool({
      min: 0,
      max: 3,
      idleTimeoutMs: 1000,
      acquireTimeoutMs: 500,
      acquireRetries: 2,
    });
  });

  afterEach(async () => {
    await pool.close();
  });

  describe('acquire', () => {
    it('should create a new connection when pool is empty', async () => {
      const conn = await pool.acquire();

      expect(conn).toBeInstanceOf(MockConnection);
      expect(conn.id).toBe(1);
    });

    it('should reuse released connections', async () => {
      const conn1 = await pool.acquire();
      await pool.release(conn1);

      const conn2 = await pool.acquire();

      expect(conn2.id).toBe(conn1.id);
    });

    it('should create multiple connections up to max', async () => {
      const conn1 = await pool.acquire();
      const conn2 = await pool.acquire();
      const conn3 = await pool.acquire();

      expect(conn1.id).toBe(1);
      expect(conn2.id).toBe(2);
      expect(conn3.id).toBe(3);
    });

    it('should wait when pool is exhausted', async () => {
      // Acquire all connections
      const conn1 = await pool.acquire();
      const conn2 = await pool.acquire();
      const conn3 = await pool.acquire();

      // Start waiting for a connection
      const waitPromise = pool.acquire();

      // Release one after a short delay
      setTimeout(() => pool.release(conn1), 50);

      const conn4 = await waitPromise;
      expect(conn4.id).toBe(conn1.id);
    });

    it('should timeout when waiting too long', async () => {
      // Acquire all connections
      await pool.acquire();
      await pool.acquire();
      await pool.acquire();

      // Try to acquire another (should timeout)
      await expect(pool.acquire()).rejects.toBeInstanceOf(TimeoutError);
    });

    it('should retry on connection creation failure', async () => {
      let attempts = 0;
      pool.createError = new Error('Connection failed');

      // Override to fail once then succeed
      const originalCreate = pool['createConnection'].bind(pool);
      pool['createConnection'] = async () => {
        attempts++;
        if (attempts < 2) {
          throw new Error('Connection failed');
        }
        pool.createError = null;
        return originalCreate();
      };

      const conn = await pool.acquire();
      expect(conn).toBeInstanceOf(MockConnection);
      expect(attempts).toBe(2);
    });

    it('should throw after max retries', async () => {
      pool.createError = new Error('Connection failed');

      await expect(pool.acquire()).rejects.toBeInstanceOf(ConnectionError);
    });

    it('should discard invalid connections and create new ones', async () => {
      const conn1 = await pool.acquire();
      await pool.release(conn1);

      // Mark connection as invalid
      conn1.valid = false;

      const conn2 = await pool.acquire();

      expect(conn2.id).not.toBe(conn1.id);
      expect(conn1.closed).toBe(true);
    });
  });

  describe('release', () => {
    it('should return connection to idle pool', async () => {
      const conn = await pool.acquire();
      await pool.release(conn);

      const stats = pool.getStats();
      expect(stats.idle).toBe(1);
      expect(stats.active).toBe(0);
    });

    it('should give connection to waiting request', async () => {
      // Acquire all connections
      const conn1 = await pool.acquire();
      const conn2 = await pool.acquire();
      const conn3 = await pool.acquire();

      // Start waiting
      const waitPromise = pool.acquire();

      // Release one
      await pool.release(conn2);

      const conn4 = await waitPromise;
      expect(conn4.id).toBe(conn2.id);
    });

    it('should ignore double release', async () => {
      const conn = await pool.acquire();

      await pool.release(conn);
      await pool.release(conn); // Should not error

      const stats = pool.getStats();
      expect(stats.idle).toBe(1);
    });
  });

  describe('close', () => {
    it('should close all idle connections', async () => {
      const conn1 = await pool.acquire();
      const conn2 = await pool.acquire();

      await pool.release(conn1);
      await pool.release(conn2);

      await pool.close();

      expect(conn1.closed).toBe(true);
      expect(conn2.closed).toBe(true);
    });

    it('should reject waiting requests', async () => {
      // Acquire all connections
      await pool.acquire();
      await pool.acquire();
      await pool.acquire();

      // Start waiting
      const waitPromise = pool.acquire();

      // Close the pool
      await pool.close();

      await expect(waitPromise).rejects.toBeInstanceOf(ConnectionError);
    });

    it('should prevent further acquisitions', async () => {
      await pool.close();

      await expect(pool.acquire()).rejects.toBeInstanceOf(ConnectionError);
    });
  });

  describe('getStats', () => {
    it('should return accurate statistics', async () => {
      const conn1 = await pool.acquire();
      const conn2 = await pool.acquire();
      await pool.release(conn1);

      const stats = pool.getStats();

      expect(stats.active).toBe(1);
      expect(stats.idle).toBe(1);
      expect(stats.total).toBe(2);
      expect(stats.waiting).toBe(0);
      expect(stats.totalCreated).toBe(2);
    });
  });

  describe('healthCheck', () => {
    it('should return healthy status when pool works', async () => {
      const health = await pool.healthCheck();

      expect(health.healthy).toBe(true);
      expect(health.latencyMs).toBeGreaterThanOrEqual(0);
    });

    it('should return unhealthy status on connection failure', async () => {
      pool.createError = new Error('Connection failed');

      const health = await pool.healthCheck();

      expect(health.healthy).toBe(false);
      expect(health.error).toBeDefined();
    });

    it('should return unhealthy status on validation failure', async () => {
      pool.validateResult = false;

      const health = await pool.healthCheck();

      expect(health.healthy).toBe(false);
    });
  });
});

describe('Pool Configuration Presets', () => {
  describe('DEFAULT_POOL_CONFIG', () => {
    it('should have reasonable defaults', () => {
      expect(DEFAULT_POOL_CONFIG.min).toBe(2);
      expect(DEFAULT_POOL_CONFIG.max).toBe(10);
      expect(DEFAULT_POOL_CONFIG.idleTimeoutMs).toBe(30000);
      expect(DEFAULT_POOL_CONFIG.acquireTimeoutMs).toBe(10000);
      expect(DEFAULT_POOL_CONFIG.acquireRetries).toBe(3);
    });
  });

  describe('createEdgePoolConfig', () => {
    it('should return edge-optimized settings', () => {
      const config = createEdgePoolConfig();

      expect(config.min).toBe(0);
      expect(config.max).toBe(1);
      expect(config.idleTimeoutMs).toBe(0);
    });

    it('should allow overrides', () => {
      const config = createEdgePoolConfig({ max: 2 });

      expect(config.max).toBe(2);
    });
  });

  describe('createServerlessPoolConfig', () => {
    it('should return serverless-optimized settings', () => {
      const config = createServerlessPoolConfig();

      expect(config.min).toBe(0);
      expect(config.max).toBe(5);
      expect(config.idleTimeoutMs).toBe(10000);
    });
  });
});

describe('withRetry', () => {
  it('should return result on success', async () => {
    const result = await withRetry(async () => 'success');

    expect(result).toBe('success');
  });

  it('should retry on failure', async () => {
    let attempts = 0;
    const result = await withRetry(
      async () => {
        attempts++;
        if (attempts < 3) {
          throw new Error('Temporary failure');
        }
        return 'success';
      },
      { maxAttempts: 3 }
    );

    expect(result).toBe('success');
    expect(attempts).toBe(3);
  });

  it('should throw after max attempts', async () => {
    let attempts = 0;

    await expect(
      withRetry(
        async () => {
          attempts++;
          throw new Error('Permanent failure');
        },
        { maxAttempts: 3, baseDelayMs: 10 }
      )
    ).rejects.toThrow('Permanent failure');

    expect(attempts).toBe(3);
  });

  it('should not retry non-retryable errors', async () => {
    let attempts = 0;

    await expect(
      withRetry(
        async () => {
          attempts++;
          throw new Error('Non-retryable');
        },
        {
          maxAttempts: 3,
          isRetryable: () => false,
        }
      )
    ).rejects.toThrow('Non-retryable');

    expect(attempts).toBe(1);
  });

  it('should apply exponential backoff', async () => {
    const delays: number[] = [];
    let lastTime = Date.now();
    let attempts = 0;

    await expect(
      withRetry(
        async () => {
          const now = Date.now();
          if (attempts > 0) {
            delays.push(now - lastTime);
          }
          lastTime = now;
          attempts++;
          throw new Error('Failure');
        },
        {
          maxAttempts: 4,
          baseDelayMs: 50,
          exponential: true,
        }
      )
    ).rejects.toThrow();

    // Delays should roughly follow exponential pattern: 50, 100, 200
    expect(delays[0]).toBeGreaterThanOrEqual(40);
    expect(delays[1]).toBeGreaterThanOrEqual(90);
    expect(delays[2]).toBeGreaterThanOrEqual(180);
  });
});

describe('isCommonRetryableError', () => {
  it('should identify connection refused errors', () => {
    expect(isCommonRetryableError(new Error('Connection refused'))).toBe(true);
  });

  it('should identify connection reset errors', () => {
    expect(isCommonRetryableError(new Error('Connection reset by peer'))).toBe(true);
  });

  it('should identify timeout errors', () => {
    expect(isCommonRetryableError(new Error('Connection timeout'))).toBe(true);
  });

  it('should identify deadlock errors', () => {
    expect(isCommonRetryableError(new Error('Deadlock detected'))).toBe(true);
  });

  it('should identify serialization errors', () => {
    expect(isCommonRetryableError(new Error('Could not serialize access'))).toBe(true);
  });

  it('should identify too many connections errors', () => {
    expect(isCommonRetryableError(new Error('Too many connections'))).toBe(true);
  });

  it('should not match unrelated errors', () => {
    expect(isCommonRetryableError(new Error('Syntax error'))).toBe(false);
    expect(isCommonRetryableError(new Error('Invalid input'))).toBe(false);
    expect(isCommonRetryableError(new Error('Permission denied'))).toBe(false);
  });
});
