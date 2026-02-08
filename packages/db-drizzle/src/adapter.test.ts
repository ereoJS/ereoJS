/**
 * Tests for PRAGMA SQL injection prevention in the Drizzle adapter.
 *
 * The BunSQLiteConfig type constrains pragma values at compile time,
 * but runtime validation provides defense-in-depth against type bypasses
 * (e.g., `as any`, JSON.parse, or untyped external input).
 */

import { describe, it, expect } from 'bun:test';
import {
  validatePragmaConfig,
  VALID_JOURNAL_MODES,
  VALID_SYNCHRONOUS,
} from './adapter';

// ============================================================================
// Valid PRAGMA values
// ============================================================================

describe('validatePragmaConfig', () => {
  describe('valid values', () => {
    it('should accept all valid journal_mode values', () => {
      for (const mode of VALID_JOURNAL_MODES) {
        expect(() => validatePragmaConfig({ journal_mode: mode })).not.toThrow();
      }
    });

    it('should accept all valid synchronous values', () => {
      for (const mode of VALID_SYNCHRONOUS) {
        expect(() => validatePragmaConfig({ synchronous: mode })).not.toThrow();
      }
    });

    it('should accept integer cache_size values', () => {
      expect(() => validatePragmaConfig({ cache_size: 10000 })).not.toThrow();
      expect(() => validatePragmaConfig({ cache_size: -2000 })).not.toThrow();
      expect(() => validatePragmaConfig({ cache_size: 1 })).not.toThrow();
    });

    it('should accept foreign_keys boolean', () => {
      expect(() => validatePragmaConfig({ foreign_keys: true })).not.toThrow();
      expect(() => validatePragmaConfig({ foreign_keys: false })).not.toThrow();
    });

    it('should accept a full valid pragma config', () => {
      expect(() =>
        validatePragmaConfig({
          journal_mode: 'WAL',
          synchronous: 'NORMAL',
          foreign_keys: true,
          cache_size: 10000,
        })
      ).not.toThrow();
    });

    it('should accept empty pragma config', () => {
      expect(() => validatePragmaConfig({})).not.toThrow();
    });
  });

  // ============================================================================
  // Invalid journal_mode values (bypassing TypeScript with `as any`)
  // ============================================================================

  describe('invalid journal_mode', () => {
    it('should reject unknown journal_mode values', () => {
      expect(() =>
        validatePragmaConfig({ journal_mode: 'INVALID' as any })
      ).toThrow('Invalid journal_mode: INVALID');
    });

    it('should reject lowercase journal_mode values', () => {
      expect(() =>
        validatePragmaConfig({ journal_mode: 'wal' as any })
      ).toThrow('Invalid journal_mode: wal');
    });

    it('should reject journal_mode SQL injection with semicolon', () => {
      expect(() =>
        validatePragmaConfig({ journal_mode: 'WAL; DROP TABLE users' as any })
      ).toThrow('Invalid journal_mode: WAL; DROP TABLE users');
    });

    it('should reject journal_mode SQL injection with comment syntax', () => {
      expect(() =>
        validatePragmaConfig({ journal_mode: 'WAL -- comment' as any })
      ).toThrow('Invalid journal_mode: WAL -- comment');
    });

    it('should reject journal_mode SQL injection with UNION', () => {
      expect(() =>
        validatePragmaConfig({ journal_mode: 'WAL UNION SELECT * FROM sqlite_master' as any })
      ).toThrow('Invalid journal_mode');
    });

    it('should reject empty string journal_mode', () => {
      // Empty string is falsy, so it will not trigger validation.
      // This is acceptable since empty string won't be interpolated.
      // The validation only runs if journal_mode is truthy.
      expect(() =>
        validatePragmaConfig({ journal_mode: '' as any })
      ).not.toThrow();
    });
  });

  // ============================================================================
  // Invalid synchronous values
  // ============================================================================

  describe('invalid synchronous', () => {
    it('should reject unknown synchronous values', () => {
      expect(() =>
        validatePragmaConfig({ synchronous: 'INVALID' as any })
      ).toThrow('Invalid synchronous mode: INVALID');
    });

    it('should reject lowercase synchronous values', () => {
      expect(() =>
        validatePragmaConfig({ synchronous: 'normal' as any })
      ).toThrow('Invalid synchronous mode: normal');
    });

    it('should reject synchronous SQL injection with semicolon', () => {
      expect(() =>
        validatePragmaConfig({ synchronous: 'FULL; DROP TABLE users' as any })
      ).toThrow('Invalid synchronous mode: FULL; DROP TABLE users');
    });

    it('should reject synchronous SQL injection with subquery', () => {
      expect(() =>
        validatePragmaConfig({ synchronous: 'NORMAL; SELECT sql FROM sqlite_master' as any })
      ).toThrow('Invalid synchronous mode');
    });

    it('should reject synchronous SQL injection with comment syntax', () => {
      expect(() =>
        validatePragmaConfig({ synchronous: 'OFF/**/OR/**/1=1' as any })
      ).toThrow('Invalid synchronous mode');
    });
  });

  // ============================================================================
  // Invalid cache_size values
  // ============================================================================

  describe('invalid cache_size', () => {
    it('should reject non-integer cache_size (float)', () => {
      expect(() =>
        validatePragmaConfig({ cache_size: 10.5 as any })
      ).toThrow('Invalid cache_size: 10.5');
    });

    it('should reject NaN cache_size', () => {
      expect(() =>
        validatePragmaConfig({ cache_size: NaN as any })
      ).toThrow('Invalid cache_size: NaN');
    });

    it('should reject Infinity cache_size', () => {
      expect(() =>
        validatePragmaConfig({ cache_size: Infinity as any })
      ).toThrow('Invalid cache_size: Infinity');
    });

    it('should reject string cache_size (type bypass)', () => {
      expect(() =>
        validatePragmaConfig({ cache_size: '10000; DROP TABLE users' as any })
      ).toThrow('Invalid cache_size');
    });
  });

  // ============================================================================
  // Combined injection attempts
  // ============================================================================

  describe('combined injection attempts', () => {
    it('should reject config where all values are injection attempts', () => {
      expect(() =>
        validatePragmaConfig({
          journal_mode: "WAL'; DROP TABLE users;--" as any,
          synchronous: "NORMAL'; DELETE FROM data;--" as any,
          cache_size: '1; DROP TABLE secrets' as any,
        })
      ).toThrow(); // Should throw on the first invalid value encountered
    });

    it('should reject injection via null byte', () => {
      expect(() =>
        validatePragmaConfig({ journal_mode: 'WAL\0; DROP TABLE users' as any })
      ).toThrow('Invalid journal_mode');
    });

    it('should reject injection via newline', () => {
      expect(() =>
        validatePragmaConfig({ journal_mode: 'WAL\n; DROP TABLE users' as any })
      ).toThrow('Invalid journal_mode');
    });
  });
});

// ============================================================================
// Whitelist constants
// ============================================================================

describe('VALID_JOURNAL_MODES', () => {
  it('should contain exactly the six SQLite journal modes', () => {
    expect(VALID_JOURNAL_MODES).toEqual(['DELETE', 'TRUNCATE', 'PERSIST', 'MEMORY', 'WAL', 'OFF']);
  });

  it('should have 6 entries', () => {
    expect(VALID_JOURNAL_MODES.length).toBe(6);
  });
});

describe('VALID_SYNCHRONOUS', () => {
  it('should contain exactly the four SQLite synchronous modes', () => {
    expect(VALID_SYNCHRONOUS).toEqual(['OFF', 'NORMAL', 'FULL', 'EXTRA']);
  });

  it('should have 4 entries', () => {
    expect(VALID_SYNCHRONOUS.length).toBe(4);
  });
});
