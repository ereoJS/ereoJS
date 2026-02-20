/**
 * @ereo/deploy-cloudflare - Cloudflare deployment adapter tests
 */

import { describe, expect, test } from 'bun:test';
import { cloudflare, generateWranglerToml } from './index';

describe('cloudflare', () => {
  test('returns default configuration', () => {
    const config = cloudflare();
    expect(config).toEqual({
      build: {
        target: 'cloudflare',
      },
    });
  });

  test('can be called with empty config object', () => {
    const config = cloudflare({});
    expect(config.build?.target).toBe('cloudflare');
  });

  test('ignores extra config properties in return', () => {
    const config = cloudflare({
      target: 'workers',
      accountId: 'test-account',
    });
    // Only returns the build target
    expect(config).toEqual({
      build: {
        target: 'cloudflare',
      },
    });
  });
});

describe('generateWranglerToml', () => {
  test('generates basic wrangler.toml', () => {
    const toml = generateWranglerToml({});
    expect(toml).toContain('name = "ereo-app"');
    expect(toml).toContain('compatibility_date = "2024-01-01"');
    expect(toml).toContain('main = "dist/server.js"');
  });

  test('includes routes when provided', () => {
    const toml = generateWranglerToml({
      routes: ['/api/*', '/static/*'],
    });
    expect(toml).toContain('[[routes]]');
    expect(toml).toContain('pattern = "/api/*"');
    expect(toml).toContain('pattern = "/static/*"');
  });

  test('includes KV namespace bindings', () => {
    const toml = generateWranglerToml({
      kvNamespaces: ['CACHE', 'SESSIONS'],
    });
    expect(toml).toContain('[[kv_namespaces]]');
    expect(toml).toContain('binding = "CACHE"');
    expect(toml).toContain('binding = "SESSIONS"');
    expect(toml).toContain('id = "your-namespace-id"');
  });

  test('handles empty KV namespaces array', () => {
    const toml = generateWranglerToml({
      kvNamespaces: [],
    });
    expect(toml).not.toContain('[[kv_namespaces]]');
  });

  test('combines routes and KV namespaces', () => {
    const toml = generateWranglerToml({
      target: 'workers',
      accountId: 'acc-123',
      routes: ['/api/*'],
      kvNamespaces: ['DATA'],
    });
    expect(toml).toContain('pattern = "/api/*"');
    expect(toml).toContain('binding = "DATA"');
    expect(toml).toContain('name = "ereo-app"');
  });
});
