/**
 * Tests for SurrealDB type definitions and type guards.
 */

import { describe, it, expect } from 'bun:test';
import {
  isRootAuth,
  isNamespaceAuth,
  isDatabaseAuth,
  isRecordAccessAuth,
  isScopeAuth,
  type RootAuth,
  type NamespaceAuth,
  type DatabaseAuth,
  type RecordAccessAuth,
  type ScopeAuth,
} from './types';

describe('Type Guards', () => {
  describe('isRootAuth', () => {
    it('should return true for root auth', () => {
      const auth: RootAuth = {
        username: 'root',
        password: 'password',
      };

      expect(isRootAuth(auth)).toBe(true);
    });

    it('should return false for namespace auth', () => {
      const auth: NamespaceAuth = {
        namespace: 'test',
        username: 'user',
        password: 'pass',
      };

      expect(isRootAuth(auth)).toBe(false);
    });
  });

  describe('isNamespaceAuth', () => {
    it('should return true for namespace auth', () => {
      const auth: NamespaceAuth = {
        namespace: 'test',
        username: 'user',
        password: 'pass',
      };

      expect(isNamespaceAuth(auth)).toBe(true);
    });

    it('should return false for root auth', () => {
      const auth: RootAuth = {
        username: 'root',
        password: 'password',
      };

      expect(isNamespaceAuth(auth)).toBe(false);
    });

    it('should return false for database auth', () => {
      const auth: DatabaseAuth = {
        namespace: 'test',
        database: 'db',
        username: 'user',
        password: 'pass',
      };

      expect(isNamespaceAuth(auth)).toBe(false);
    });
  });

  describe('isDatabaseAuth', () => {
    it('should return true for database auth', () => {
      const auth: DatabaseAuth = {
        namespace: 'test',
        database: 'db',
        username: 'user',
        password: 'pass',
      };

      expect(isDatabaseAuth(auth)).toBe(true);
    });

    it('should return false for namespace auth', () => {
      const auth: NamespaceAuth = {
        namespace: 'test',
        username: 'user',
        password: 'pass',
      };

      expect(isDatabaseAuth(auth)).toBe(false);
    });

    it('should return false for record access auth', () => {
      const auth: RecordAccessAuth = {
        namespace: 'test',
        database: 'db',
        access: 'user',
      };

      expect(isDatabaseAuth(auth)).toBe(false);
    });
  });

  describe('isRecordAccessAuth', () => {
    it('should return true for record access auth', () => {
      const auth: RecordAccessAuth = {
        namespace: 'test',
        database: 'db',
        access: 'user',
        variables: { email: 'test@example.com' },
      };

      expect(isRecordAccessAuth(auth)).toBe(true);
    });

    it('should return true without variables', () => {
      const auth: RecordAccessAuth = {
        namespace: 'test',
        database: 'db',
        access: 'user',
      };

      expect(isRecordAccessAuth(auth)).toBe(true);
    });

    it('should return false for database auth', () => {
      const auth: DatabaseAuth = {
        namespace: 'test',
        database: 'db',
        username: 'user',
        password: 'pass',
      };

      expect(isRecordAccessAuth(auth)).toBe(false);
    });
  });

  describe('isScopeAuth', () => {
    it('should return true for scope auth', () => {
      const auth: ScopeAuth = {
        namespace: 'test',
        database: 'db',
        scope: 'user',
        email: 'test@example.com',
        password: 'pass',
      };

      expect(isScopeAuth(auth)).toBe(true);
    });

    it('should return false for record access auth', () => {
      const auth: RecordAccessAuth = {
        namespace: 'test',
        database: 'db',
        access: 'user',
      };

      expect(isScopeAuth(auth)).toBe(false);
    });

    it('should return false for database auth', () => {
      const auth: DatabaseAuth = {
        namespace: 'test',
        database: 'db',
        username: 'user',
        password: 'pass',
      };

      expect(isScopeAuth(auth)).toBe(false);
    });
  });
});
