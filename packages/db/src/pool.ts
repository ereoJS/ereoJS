/**
 * @ereo/db - Connection Pool Primitives
 *
 * Abstract connection pooling utilities that adapters can extend.
 * Provides retry logic, health monitoring, and edge-optimized configurations.
 */

import type { PoolConfig, HealthCheckResult } from './types';
import { ConnectionError, TimeoutError } from './types';

// ============================================================================
// Pool Configuration Presets
// ============================================================================

/**
 * Default pool configuration for server environments.
 */
export const DEFAULT_POOL_CONFIG: Required<PoolConfig> = {
  min: 2,
  max: 10,
  idleTimeoutMs: 30000, // 30 seconds
  acquireTimeoutMs: 10000, // 10 seconds
  acquireRetries: 3,
};

/**
 * Create pool configuration optimized for edge environments.
 * Edge runtimes have limited connection lifetime, so we use aggressive settings.
 */
export function createEdgePoolConfig(overrides?: Partial<PoolConfig>): PoolConfig {
  return {
    // Edge environments typically don't benefit from connection pooling
    // because each request may run in a different isolate
    min: 0,
    max: 1,
    idleTimeoutMs: 0, // Close immediately when idle
    acquireTimeoutMs: 5000, // 5 seconds - faster timeout for edge
    acquireRetries: 2, // Fewer retries for edge
    ...overrides,
  };
}

/**
 * Create pool configuration for serverless environments.
 * Optimized for environments like AWS Lambda, Vercel Functions.
 */
export function createServerlessPoolConfig(overrides?: Partial<PoolConfig>): PoolConfig {
  return {
    min: 0, // Don't maintain idle connections
    max: 5, // Limit concurrent connections
    idleTimeoutMs: 10000, // 10 seconds - shorter idle timeout
    acquireTimeoutMs: 8000,
    acquireRetries: 2,
    ...overrides,
  };
}

// ============================================================================
// Abstract Connection Pool
// ============================================================================

/**
 * Pool statistics for monitoring.
 */
export interface PoolStats {
  /** Number of connections currently in use */
  active: number;
  /** Number of idle connections available */
  idle: number;
  /** Total connections (active + idle) */
  total: number;
  /** Number of requests waiting for a connection */
  waiting: number;
  /** Total connections created over pool lifetime */
  totalCreated: number;
  /** Total connections closed over pool lifetime */
  totalClosed: number;
}

/**
 * Abstract connection pool that adapters can extend.
 * Provides common pooling functionality.
 *
 * @template T - The connection type
 */
export abstract class ConnectionPool<T> {
  protected config: Required<PoolConfig>;
  protected connections: T[] = [];
  protected activeConnections = new Set<T>();
  protected waitQueue: Array<{
    resolve: (conn: T) => void;
    reject: (err: Error) => void;
    timeout: ReturnType<typeof setTimeout>;
  }> = [];
  protected closed = false;
  protected stats = {
    totalCreated: 0,
    totalClosed: 0,
  };

  constructor(config?: PoolConfig) {
    this.config = {
      ...DEFAULT_POOL_CONFIG,
      ...config,
    };
  }

  /**
   * Create a new connection.
   * Implement this in subclasses.
   */
  protected abstract createConnection(): Promise<T>;

  /**
   * Close a connection.
   * Implement this in subclasses.
   */
  protected abstract closeConnection(connection: T): Promise<void>;

  /**
   * Validate that a connection is still healthy.
   * Implement this in subclasses.
   */
  protected abstract validateConnection(connection: T): Promise<boolean>;

  /**
   * Acquire a connection from the pool.
   */
  async acquire(): Promise<T> {
    if (this.closed) {
      throw new ConnectionError('Pool is closed');
    }

    // Try to get an idle connection
    const idle = this.connections.pop();
    if (idle) {
      // Validate the connection before returning
      try {
        const isValid = await this.validateConnection(idle);
        if (isValid) {
          this.activeConnections.add(idle);
          return idle;
        }
        // Connection is stale, close it and try again
        await this.closeConnection(idle);
        this.stats.totalClosed++;
      } catch {
        // Connection validation failed, try again
      }
    }

    // Create a new connection if under limit
    if (this.activeConnections.size + this.connections.length < this.config.max) {
      return this.createAndAcquire();
    }

    // Wait for a connection to become available
    return this.waitForConnection();
  }

  /**
   * Release a connection back to the pool.
   */
  async release(connection: T): Promise<void> {
    if (!this.activeConnections.has(connection)) {
      return; // Already released or not from this pool
    }

    this.activeConnections.delete(connection);

    // Check if someone is waiting
    if (this.waitQueue.length > 0) {
      const waiter = this.waitQueue.shift()!;
      clearTimeout(waiter.timeout);
      this.activeConnections.add(connection);
      waiter.resolve(connection);
      return;
    }

    // Return to idle pool if not closed
    if (!this.closed && this.connections.length < this.config.max) {
      this.connections.push(connection);
      this.scheduleIdleTimeout(connection);
    } else {
      await this.closeConnection(connection);
      this.stats.totalClosed++;
    }
  }

  /**
   * Close the pool and all connections.
   */
  async close(): Promise<void> {
    this.closed = true;

    // Reject all waiters
    for (const waiter of this.waitQueue) {
      clearTimeout(waiter.timeout);
      waiter.reject(new ConnectionError('Pool is closing'));
    }
    this.waitQueue = [];

    // Close all idle connections
    const closePromises = this.connections.map(async (conn) => {
      try {
        await this.closeConnection(conn);
        this.stats.totalClosed++;
      } catch {
        // Ignore close errors
      }
    });
    this.connections = [];

    await Promise.all(closePromises);
  }

  /**
   * Get pool statistics.
   */
  getStats(): PoolStats {
    return {
      active: this.activeConnections.size,
      idle: this.connections.length,
      total: this.activeConnections.size + this.connections.length,
      waiting: this.waitQueue.length,
      totalCreated: this.stats.totalCreated,
      totalClosed: this.stats.totalClosed,
    };
  }

  /**
   * Check if the pool is healthy.
   */
  async healthCheck(): Promise<HealthCheckResult> {
    const start = Date.now();

    try {
      const conn = await this.acquire();
      const isValid = await this.validateConnection(conn);
      await this.release(conn);

      return {
        healthy: isValid,
        latencyMs: Date.now() - start,
        metadata: this.getStats() as unknown as Record<string, unknown>,
      };
    } catch (error) {
      return {
        healthy: false,
        latencyMs: Date.now() - start,
        error: error instanceof Error ? error.message : String(error),
        metadata: this.getStats() as unknown as Record<string, unknown>,
      };
    }
  }

  /**
   * Create a new connection and acquire it.
   */
  private async createAndAcquire(): Promise<T> {
    let lastError: Error | undefined;

    for (let attempt = 0; attempt < this.config.acquireRetries; attempt++) {
      try {
        const connection = await this.createConnection();
        this.stats.totalCreated++;
        this.activeConnections.add(connection);
        return connection;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        // Wait before retry with exponential backoff
        if (attempt < this.config.acquireRetries - 1) {
          await this.delay(Math.pow(2, attempt) * 100);
        }
      }
    }

    throw new ConnectionError(
      `Failed to create connection after ${this.config.acquireRetries} attempts`,
      lastError
    );
  }

  /**
   * Wait for a connection to become available.
   */
  private waitForConnection(): Promise<T> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        const index = this.waitQueue.findIndex(w => w.resolve === resolve);
        if (index !== -1) {
          this.waitQueue.splice(index, 1);
        }
        reject(
          new TimeoutError(
            'Timed out waiting for connection',
            this.config.acquireTimeoutMs
          )
        );
      }, this.config.acquireTimeoutMs);

      this.waitQueue.push({ resolve, reject, timeout });
    });
  }

  /**
   * Schedule idle timeout for a connection.
   */
  private scheduleIdleTimeout(connection: T): void {
    if (this.config.idleTimeoutMs <= 0) return;

    setTimeout(async () => {
      const index = this.connections.indexOf(connection);
      if (index !== -1) {
        this.connections.splice(index, 1);
        try {
          await this.closeConnection(connection);
          this.stats.totalClosed++;
        } catch {
          // Ignore close errors
        }
      }
    }, this.config.idleTimeoutMs);
  }

  /**
   * Utility delay function.
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// ============================================================================
// Retry Utilities
// ============================================================================

/**
 * Retry configuration for database operations.
 */
export interface RetryConfig {
  /** Maximum number of retry attempts */
  maxAttempts: number;
  /** Base delay between retries in milliseconds */
  baseDelayMs: number;
  /** Maximum delay between retries in milliseconds */
  maxDelayMs: number;
  /** Whether to use exponential backoff */
  exponential: boolean;
  /** Function to determine if an error is retryable */
  isRetryable?: (error: Error) => boolean;
}

/**
 * Default retry configuration.
 */
export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxAttempts: 3,
  baseDelayMs: 100,
  maxDelayMs: 5000,
  exponential: true,
};

/**
 * Execute an operation with retry logic.
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  config: Partial<RetryConfig> = {}
): Promise<T> {
  const {
    maxAttempts,
    baseDelayMs,
    maxDelayMs,
    exponential,
    isRetryable,
  } = { ...DEFAULT_RETRY_CONFIG, ...config };

  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Check if error is retryable
      if (isRetryable && !isRetryable(lastError)) {
        throw lastError;
      }

      // Don't delay after last attempt
      if (attempt < maxAttempts) {
        const delay = exponential
          ? Math.min(baseDelayMs * Math.pow(2, attempt - 1), maxDelayMs)
          : baseDelayMs;

        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError!;
}

/**
 * Common retryable error patterns for databases.
 */
export function isCommonRetryableError(error: Error): boolean {
  const message = error.message.toLowerCase();

  // Connection errors
  if (message.includes('connection') &&
      (message.includes('refused') ||
       message.includes('reset') ||
       message.includes('closed') ||
       message.includes('timeout'))) {
    return true;
  }

  // Deadlock errors
  if (message.includes('deadlock')) {
    return true;
  }

  // Serialization failures
  if (message.includes('serialization failure') ||
      message.includes('could not serialize')) {
    return true;
  }

  // Too many connections
  if (message.includes('too many connections')) {
    return true;
  }

  return false;
}
