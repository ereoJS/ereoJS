/**
 * @ereo/runtime-bun - Bun runtime adapter tests
 */

import { describe, expect, test } from 'bun:test';
import {
  BunRuntime,
  createBunRuntime,
  serve,
  isBun,
  getBunVersion,
  randomUUID,
  env,
  requireEnv,
} from './index';

describe('BunRuntime', () => {
  test('creates runtime with default options', () => {
    const runtime = new BunRuntime();
    expect(runtime).toBeInstanceOf(BunRuntime);
    expect(runtime.getApp()).toBeDefined();
  });

  test('creates runtime with custom options', () => {
    const runtime = new BunRuntime({
      server: { port: 8080 },
    });
    expect(runtime).toBeInstanceOf(BunRuntime);
  });

  test('use() registers plugin and returns this', () => {
    const runtime = new BunRuntime();
    const plugin = {
      name: 'test-plugin',
      setup: () => {},
    };
    const result = runtime.use(plugin);
    expect(result).toBe(runtime);
  });

  test('handle() processes requests through app', async () => {
    const runtime = new BunRuntime();
    const request = new Request('http://localhost:3000/');
    const response = await runtime.handle(request);
    expect(response).toBeInstanceOf(Response);
  });
});

describe('createBunRuntime', () => {
  test('creates BunRuntime instance', () => {
    const runtime = createBunRuntime();
    expect(runtime).toBeInstanceOf(BunRuntime);
  });

  test('passes options to runtime', () => {
    const runtime = createBunRuntime({
      config: { server: { port: 4000 } },
    });
    expect(runtime).toBeInstanceOf(BunRuntime);
  });
});

describe('isBun', () => {
  test('returns true when running in Bun', () => {
    // When running in Bun environment
    expect(isBun()).toBe(true);
  });
});

describe('getBunVersion', () => {
  test('returns Bun version string', () => {
    const version = getBunVersion();
    expect(typeof version).toBe('string');
    expect(version.length).toBeGreaterThan(0);
  });
});

describe('randomUUID', () => {
  test('generates valid UUID', () => {
    const uuid = randomUUID();
    expect(typeof uuid).toBe('string');
    expect(uuid).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
  });

  test('generates unique UUIDs', () => {
    const uuid1 = randomUUID();
    const uuid2 = randomUUID();
    expect(uuid1).not.toBe(uuid2);
  });
});

describe('env', () => {
  test('returns existing environment variable', () => {
    // Set a test variable
    process.env.TEST_VAR = 'test-value';
    expect(env('TEST_VAR')).toBe('test-value');
    delete process.env.TEST_VAR;
  });

  test('returns default value when env var not set', () => {
    const result = env('NONEXISTENT_VAR', 'default');
    expect(result).toBe('default');
  });

  test('returns undefined when env var not set and no default', () => {
    const result = env('NONEXISTENT_VAR');
    expect(result).toBeUndefined();
  });
});

describe('requireEnv', () => {
  test('returns existing required environment variable', () => {
    process.env.REQUIRED_TEST = 'required-value';
    expect(requireEnv('REQUIRED_TEST')).toBe('required-value');
    delete process.env.REQUIRED_TEST;
  });

  test('throws when required env var not set', () => {
    expect(() => requireEnv('DEFINITELY_NOT_SET_VAR')).toThrow(
      'Missing required environment variable: DEFINITELY_NOT_SET_VAR'
    );
  });
});
