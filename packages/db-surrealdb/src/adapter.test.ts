/**
 * Tests for SurrealDB adapter.
 */

import { describe, it, expect } from 'bun:test';
import {
  select,
  create,
  update,
  deleteFrom,
} from './adapter';

describe('Query Helpers', () => {
  describe('select', () => {
    it('should create basic SELECT query', () => {
      const query = select('users');
      expect(query).toBe('SELECT * FROM users');
    });

    it('should add WHERE clause', () => {
      const query = select('users', { where: 'active = true' });
      expect(query).toBe('SELECT * FROM users WHERE active = true');
    });

    it('should add ORDER BY clause', () => {
      const query = select('users', { orderBy: 'name ASC' });
      expect(query).toBe('SELECT * FROM users ORDER BY name ASC');
    });

    it('should add LIMIT clause', () => {
      const query = select('users', { limit: 10 });
      expect(query).toBe('SELECT * FROM users LIMIT 10');
    });

    it('should add START clause', () => {
      const query = select('users', { start: 20 });
      expect(query).toBe('SELECT * FROM users START 20');
    });

    it('should combine all clauses', () => {
      const query = select('users', {
        where: 'active = true',
        orderBy: 'created_at DESC',
        limit: 10,
        start: 0,
      });
      expect(query).toBe(
        'SELECT * FROM users WHERE active = true ORDER BY created_at DESC LIMIT 10 START 0'
      );
    });
  });

  describe('create', () => {
    it('should create basic CREATE query', () => {
      const query = create('users');
      expect(query).toBe('CREATE users');
    });

    it('should create CREATE query with ID', () => {
      const query = create('users', 'john');
      expect(query).toBe('CREATE users:john');
    });
  });

  describe('update', () => {
    it('should create basic UPDATE query', () => {
      const query = update('users');
      expect(query).toBe('UPDATE users');
    });

    it('should create UPDATE query with ID', () => {
      const query = update('users', 'john');
      expect(query).toBe('UPDATE users:john');
    });
  });

  describe('deleteFrom', () => {
    it('should create basic DELETE query', () => {
      const query = deleteFrom('users');
      expect(query).toBe('DELETE users');
    });

    it('should create DELETE query with ID', () => {
      const query = deleteFrom('users', 'john');
      expect(query).toBe('DELETE users:john');
    });
  });
});

// Note: Integration tests with actual SurrealDB connection would require
// a running SurrealDB instance. These would be added to an integration test file.
