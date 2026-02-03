/**
 * Tests for SurrealDB configuration helpers.
 */

import { describe, it, expect } from 'bun:test';
import {
  defineSurrealConfig,
  rootAuth,
  namespaceAuth,
  databaseAuth,
  recordAccessAuth,
  buildSurrealUrl,
  parseSurrealUrl,
  localConfig,
  cloudConfig,
  envConfig,
  validateConfig,
} from './config';

describe('defineSurrealConfig', () => {
  it('should set default values', () => {
    const config = defineSurrealConfig({
      url: 'http://localhost:8000',
      namespace: 'test',
      database: 'test',
    });

    expect(config.timeout).toBe(30000);
    expect(config.debug).toBe(false);
  });

  it('should allow overriding defaults', () => {
    const config = defineSurrealConfig({
      url: 'http://localhost:8000',
      namespace: 'test',
      database: 'test',
      timeout: 5000,
      debug: true,
    });

    expect(config.timeout).toBe(5000);
    expect(config.debug).toBe(true);
  });
});

describe('Authentication helpers', () => {
  describe('rootAuth', () => {
    it('should create root credentials', () => {
      const auth = rootAuth('admin', 'password');

      expect(auth).toEqual({
        username: 'admin',
        password: 'password',
      });
    });
  });

  describe('namespaceAuth', () => {
    it('should create namespace credentials', () => {
      const auth = namespaceAuth('myns', 'user', 'pass');

      expect(auth).toEqual({
        namespace: 'myns',
        username: 'user',
        password: 'pass',
      });
    });
  });

  describe('databaseAuth', () => {
    it('should create database credentials', () => {
      const auth = databaseAuth('myns', 'mydb', 'user', 'pass');

      expect(auth).toEqual({
        namespace: 'myns',
        database: 'mydb',
        username: 'user',
        password: 'pass',
      });
    });
  });

  describe('recordAccessAuth', () => {
    it('should create record access credentials', () => {
      const auth = recordAccessAuth('myns', 'mydb', 'user_access', {
        email: 'test@example.com',
        password: 'secret',
      });

      expect(auth).toEqual({
        namespace: 'myns',
        database: 'mydb',
        access: 'user_access',
        variables: {
          email: 'test@example.com',
          password: 'secret',
        },
      });
    });

    it('should work without variables', () => {
      const auth = recordAccessAuth('myns', 'mydb', 'public_access');

      expect(auth).toEqual({
        namespace: 'myns',
        database: 'mydb',
        access: 'public_access',
        variables: undefined,
      });
    });
  });
});

describe('URL helpers', () => {
  describe('buildSurrealUrl', () => {
    it('should build HTTP URL', () => {
      const url = buildSurrealUrl('localhost', 8000, 'http');
      expect(url).toBe('http://localhost:8000');
    });

    it('should build HTTPS URL', () => {
      const url = buildSurrealUrl('cloud.surrealdb.com', 443, 'https');
      expect(url).toBe('https://cloud.surrealdb.com:443');
    });

    it('should build WebSocket URL', () => {
      const url = buildSurrealUrl('localhost', 8000, 'ws');
      expect(url).toBe('ws://localhost:8000');
    });

    it('should use default port', () => {
      const url = buildSurrealUrl('localhost');
      expect(url).toBe('http://localhost:8000');
    });
  });

  describe('parseSurrealUrl', () => {
    it('should parse HTTP URL', () => {
      const parsed = parseSurrealUrl('http://localhost:8000');

      expect(parsed.protocol).toBe('http');
      expect(parsed.host).toBe('localhost');
      expect(parsed.port).toBe(8000);
    });

    it('should parse HTTPS URL with default port', () => {
      const parsed = parseSurrealUrl('https://cloud.surrealdb.com');

      expect(parsed.protocol).toBe('https');
      expect(parsed.host).toBe('cloud.surrealdb.com');
      expect(parsed.port).toBe(443);
    });

    it('should parse WebSocket URL', () => {
      const parsed = parseSurrealUrl('wss://cloud.surrealdb.com:8080');

      expect(parsed.protocol).toBe('wss');
      expect(parsed.host).toBe('cloud.surrealdb.com');
      expect(parsed.port).toBe(8080);
    });
  });
});

describe('Preset configurations', () => {
  describe('localConfig', () => {
    it('should create local development config', () => {
      const config = localConfig('test', 'test');

      expect(config.url).toBe('http://127.0.0.1:8000');
      expect(config.namespace).toBe('test');
      expect(config.database).toBe('test');
      expect(config.debug).toBe(true);
    });

    it('should allow options override', () => {
      const config = localConfig('test', 'test', {
        debug: false,
        auth: rootAuth('root', 'root'),
      });

      expect(config.debug).toBe(false);
      expect(config.auth).toEqual({ username: 'root', password: 'root' });
    });
  });

  describe('cloudConfig', () => {
    it('should create cloud config with auth', () => {
      const config = cloudConfig(
        'https://cloud.surrealdb.com',
        'prod',
        'mydb',
        rootAuth('user', 'pass')
      );

      expect(config.url).toBe('https://cloud.surrealdb.com');
      expect(config.namespace).toBe('prod');
      expect(config.database).toBe('mydb');
      expect(config.auth).toEqual({ username: 'user', password: 'pass' });
      expect(config.debug).toBe(false);
    });
  });

  describe('envConfig', () => {
    it('should create config from environment', () => {
      const env = {
        SURREAL_URL: 'http://localhost:8000',
        SURREAL_NAMESPACE: 'test',
        SURREAL_DATABASE: 'test',
        SURREAL_USERNAME: 'root',
        SURREAL_PASSWORD: 'root',
      };

      const config = envConfig(env);

      expect(config.url).toBe('http://localhost:8000');
      expect(config.namespace).toBe('test');
      expect(config.database).toBe('test');
      expect(config.auth).toEqual({ username: 'root', password: 'root' });
    });

    it('should work without auth', () => {
      const env = {
        SURREAL_URL: 'http://localhost:8000',
        SURREAL_NAMESPACE: 'test',
        SURREAL_DATABASE: 'test',
      };

      const config = envConfig(env);

      expect(config.auth).toBeUndefined();
    });

    it('should throw on missing URL', () => {
      const env = {
        SURREAL_NAMESPACE: 'test',
        SURREAL_DATABASE: 'test',
      };

      expect(() => envConfig(env)).toThrow('SURREAL_URL');
    });

    it('should throw on missing namespace', () => {
      const env = {
        SURREAL_URL: 'http://localhost:8000',
        SURREAL_DATABASE: 'test',
      };

      expect(() => envConfig(env)).toThrow('SURREAL_NAMESPACE');
    });

    it('should throw on missing database', () => {
      const env = {
        SURREAL_URL: 'http://localhost:8000',
        SURREAL_NAMESPACE: 'test',
      };

      expect(() => envConfig(env)).toThrow('SURREAL_DATABASE');
    });
  });
});

describe('validateConfig', () => {
  it('should accept valid config', () => {
    expect(() =>
      validateConfig({
        url: 'http://localhost:8000',
        namespace: 'test',
        database: 'test',
      })
    ).not.toThrow();
  });

  it('should throw on missing URL', () => {
    expect(() =>
      validateConfig({
        url: '',
        namespace: 'test',
        database: 'test',
      })
    ).toThrow('url is required');
  });

  it('should throw on missing namespace', () => {
    expect(() =>
      validateConfig({
        url: 'http://localhost:8000',
        namespace: '',
        database: 'test',
      })
    ).toThrow('namespace is required');
  });

  it('should throw on missing database', () => {
    expect(() =>
      validateConfig({
        url: 'http://localhost:8000',
        namespace: 'test',
        database: '',
      })
    ).toThrow('database is required');
  });

  it('should throw on invalid URL', () => {
    expect(() =>
      validateConfig({
        url: 'not-a-valid-url',
        namespace: 'test',
        database: 'test',
      })
    ).toThrow('Invalid SurrealDB URL');
  });

  it('should accept memory URL', () => {
    expect(() =>
      validateConfig({
        url: 'mem://',
        namespace: 'test',
        database: 'test',
      })
    ).not.toThrow();
  });

  it('should accept surrealkv URL', () => {
    expect(() =>
      validateConfig({
        url: 'surrealkv://./data',
        namespace: 'test',
        database: 'test',
      })
    ).not.toThrow();
  });
});
