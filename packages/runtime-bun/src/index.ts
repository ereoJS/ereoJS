/**
 * @areo/runtime-bun
 *
 * Bun runtime adapter for the Areo framework.
 * This is the default runtime, optimized for Bun's performance.
 */

import type { Server, ServerWebSocket } from 'bun';
import type { FrameworkConfig, Plugin } from '@areo/core';
import { createApp, AreoApp } from '@areo/core';
import { createServer, type ServerOptions } from '@areo/server';

/**
 * Bun runtime options.
 */
export interface BunRuntimeOptions {
  /** Server configuration */
  server?: ServerOptions;
  /** Framework configuration */
  config?: FrameworkConfig;
}

/**
 * Bun runtime adapter.
 */
export class BunRuntime {
  private app: AreoApp;
  private server: ReturnType<typeof createServer> | null = null;
  private bunServer: Server | null = null;
  private options: BunRuntimeOptions;

  constructor(options: BunRuntimeOptions = {}) {
    this.options = options;
    this.app = createApp({ config: options.config });
  }

  /**
   * Get the Areo app instance.
   */
  getApp(): AreoApp {
    return this.app;
  }

  /**
   * Register a plugin.
   */
  use(plugin: Plugin): this {
    this.app.use(plugin);
    return this;
  }

  /**
   * Start the server.
   */
  async start(): Promise<Server> {
    this.server = createServer(this.options.server);
    this.server.setApp(this.app);

    this.bunServer = await this.server.start();
    return this.bunServer;
  }

  /**
   * Stop the server.
   */
  stop(): void {
    if (this.server) {
      this.server.stop();
    }
  }

  /**
   * Handle a request directly (for testing or custom integrations).
   */
  async handle(request: Request): Promise<Response> {
    return this.app.handle(request);
  }
}

/**
 * Create a Bun runtime.
 */
export function createBunRuntime(options?: BunRuntimeOptions): BunRuntime {
  return new BunRuntime(options);
}

/**
 * Quick start helper.
 */
export async function serve(options?: BunRuntimeOptions): Promise<BunRuntime> {
  const runtime = createBunRuntime(options);
  await runtime.start();
  return runtime;
}

// ============================================================================
// Bun-specific utilities
// ============================================================================

/**
 * Get Bun's SQLite database.
 */
export function getDatabase(path: string) {
  const { Database } = require('bun:sqlite');
  return new Database(path);
}

/**
 * Check if running in Bun.
 */
export function isBun(): boolean {
  return typeof Bun !== 'undefined';
}

/**
 * Get Bun version.
 */
export function getBunVersion(): string {
  return Bun.version;
}

/**
 * Bun-optimized file reading.
 */
export async function readFile(path: string): Promise<string> {
  return Bun.file(path).text();
}

/**
 * Bun-optimized file writing.
 */
export async function writeFile(path: string, content: string): Promise<void> {
  await Bun.write(path, content);
}

/**
 * Bun-optimized JSON reading.
 */
export async function readJSON<T = unknown>(path: string): Promise<T> {
  return Bun.file(path).json();
}

/**
 * Bun-optimized gzip compression.
 */
export function gzip(data: string | ArrayBuffer): Uint8Array {
  return Bun.gzipSync(data);
}

/**
 * Bun-optimized gunzip decompression.
 */
export function gunzip(data: ArrayBuffer): Uint8Array {
  return Bun.gunzipSync(data);
}

/**
 * Bun password hashing.
 */
export async function hashPassword(password: string): Promise<string> {
  return Bun.password.hash(password);
}

/**
 * Bun password verification.
 */
export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  return Bun.password.verify(password, hash);
}

/**
 * Generate crypto-random UUID.
 */
export function randomUUID(): string {
  return crypto.randomUUID();
}

/**
 * Sleep utility using Bun.sleep.
 */
export async function sleep(ms: number): Promise<void> {
  return Bun.sleep(ms);
}

/**
 * Spawn a shell command.
 */
export function spawn(
  command: string[],
  options?: { cwd?: string; env?: Record<string, string> }
) {
  return Bun.spawn(command, options);
}

/**
 * Get environment variable with type safety.
 */
export function env<T extends string = string>(key: string, defaultValue?: T): T {
  return (process.env[key] as T) ?? (defaultValue as T);
}

/**
 * Get required environment variable (throws if missing).
 */
export function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

// Re-export core and server for convenience
export { createApp, createServer };
export type { FrameworkConfig, Plugin, ServerOptions };
