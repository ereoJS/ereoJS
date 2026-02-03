/**
 * Tests for Drizzle configuration helpers.
 */

import { describe, it, expect } from 'bun:test';
import {
  defineDrizzleConfig,
  definePostgresConfig,
  defineNeonHttpConfig,
  defineNeonWebSocketConfig,
  definePlanetScaleConfig,
  defineLibSQLConfig,
  defineBunSQLiteConfig,
  defineBetterSQLite3Config,
  defineD1Config,
  defineEdgeConfig,
  detectRuntime,
  isEdgeRuntime,
  suggestDrivers,
} from './config';

describe('defineDrizzleConfig', () => {
  it('should pass through configuration unchanged', () => {
    const config = defineDrizzleConfig({
      driver: 'postgres-js',
      url: 'postgres://localhost/test',
    });

    expect(config.driver).toBe('postgres-js');
    expect(config.url).toBe('postgres://localhost/test');
  });
});

describe('definePostgresConfig', () => {
  it('should set driver to postgres-js', () => {
    const config = definePostgresConfig({
      url: 'postgres://localhost/test',
    });

    expect(config.driver).toBe('postgres-js');
  });

  it('should have sensible connection defaults', () => {
    const config = definePostgresConfig({
      url: 'postgres://localhost/test',
    });

    expect(config.connection?.ssl).toBe('require');
    expect(config.connection?.max).toBe(10);
    expect(config.connection?.prepare).toBe(true);
  });

  it('should allow overriding connection options', () => {
    const config = definePostgresConfig({
      url: 'postgres://localhost/test',
      connection: {
        ssl: false,
        max: 5,
      },
    });

    expect(config.connection?.ssl).toBe(false);
    expect(config.connection?.max).toBe(5);
  });
});

describe('defineNeonHttpConfig', () => {
  it('should set driver to neon-http', () => {
    const config = defineNeonHttpConfig({
      url: 'postgres://...',
    });

    expect(config.driver).toBe('neon-http');
  });

  it('should be edge compatible', () => {
    const config = defineNeonHttpConfig({
      url: 'postgres://...',
    });

    expect(config.edgeCompatible).toBe(true);
  });
});

describe('defineNeonWebSocketConfig', () => {
  it('should set driver to neon-websocket', () => {
    const config = defineNeonWebSocketConfig({
      url: 'postgres://...',
    });

    expect(config.driver).toBe('neon-websocket');
  });

  it('should have pool defaults', () => {
    const config = defineNeonWebSocketConfig({
      url: 'postgres://...',
    });

    expect(config.pool?.max).toBe(5);
    expect(config.pool?.idleTimeoutMs).toBe(10000);
  });
});

describe('definePlanetScaleConfig', () => {
  it('should set driver to planetscale', () => {
    const config = definePlanetScaleConfig({
      url: 'mysql://...',
    });

    expect(config.driver).toBe('planetscale');
    expect(config.edgeCompatible).toBe(true);
  });
});

describe('defineLibSQLConfig', () => {
  it('should set driver to libsql', () => {
    const config = defineLibSQLConfig({
      url: 'libsql://...',
    });

    expect(config.driver).toBe('libsql');
    expect(config.edgeCompatible).toBe(true);
  });

  it('should accept auth token', () => {
    const config = defineLibSQLConfig({
      url: 'libsql://...',
      authToken: 'secret-token',
    });

    expect(config.authToken).toBe('secret-token');
  });
});

describe('defineBunSQLiteConfig', () => {
  it('should set driver to bun-sqlite', () => {
    const config = defineBunSQLiteConfig({
      url: './data.db',
    });

    expect(config.driver).toBe('bun-sqlite');
  });

  it('should not be edge compatible', () => {
    const config = defineBunSQLiteConfig({
      url: './data.db',
    });

    expect(config.edgeCompatible).toBe(false);
  });

  it('should have sensible PRAGMA defaults', () => {
    const config = defineBunSQLiteConfig({
      url: './data.db',
    });

    expect(config.pragma?.journal_mode).toBe('WAL');
    expect(config.pragma?.synchronous).toBe('NORMAL');
    expect(config.pragma?.foreign_keys).toBe(true);
  });
});

describe('defineBetterSQLite3Config', () => {
  it('should set driver to better-sqlite3', () => {
    const config = defineBetterSQLite3Config({
      url: './data.db',
    });

    expect(config.driver).toBe('better-sqlite3');
    expect(config.edgeCompatible).toBe(false);
  });
});

describe('defineD1Config', () => {
  it('should set driver to d1', () => {
    const config = defineD1Config({
      url: '',
    });

    expect(config.driver).toBe('d1');
    expect(config.edgeCompatible).toBe(true);
  });
});

describe('defineEdgeConfig', () => {
  it('should create neon-http config', () => {
    const config = defineEdgeConfig({
      driver: 'neon-http',
      url: 'postgres://...',
    });

    expect(config.driver).toBe('neon-http');
    expect(config.edgeCompatible).toBe(true);
  });

  it('should create planetscale config', () => {
    const config = defineEdgeConfig({
      driver: 'planetscale',
      url: 'mysql://...',
    });

    expect(config.driver).toBe('planetscale');
  });

  it('should create libsql config with auth token', () => {
    const config = defineEdgeConfig({
      driver: 'libsql',
      url: 'libsql://...',
      authToken: 'token',
    });

    expect(config.driver).toBe('libsql');
    expect((config as any).authToken).toBe('token');
  });

  it('should throw for unknown driver', () => {
    expect(() =>
      defineEdgeConfig({
        driver: 'unknown' as any,
        url: '',
      })
    ).toThrow();
  });
});

describe('detectRuntime', () => {
  it('should detect bun runtime', () => {
    // In Bun test environment, this should detect Bun
    const runtime = detectRuntime();
    expect(runtime).toBe('bun');
  });
});

describe('isEdgeRuntime', () => {
  it('should return false in Bun environment', () => {
    // Bun is not an edge runtime
    expect(isEdgeRuntime()).toBe(false);
  });
});

describe('suggestDrivers', () => {
  it('should suggest bun-sqlite for Bun runtime', () => {
    const suggestions = suggestDrivers();

    // Running in Bun, should suggest bun-sqlite first
    expect(suggestions).toContain('bun-sqlite');
  });

  it('should return an array', () => {
    const suggestions = suggestDrivers();

    expect(Array.isArray(suggestions)).toBe(true);
    expect(suggestions.length).toBeGreaterThan(0);
  });
});
