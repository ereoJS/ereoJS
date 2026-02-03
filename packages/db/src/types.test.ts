/**
 * Tests for type definitions and error classes.
 */

import { describe, it, expect } from 'bun:test';
import {
  DatabaseError,
  ConnectionError,
  QueryError,
  TransactionError,
  TimeoutError,
} from './types';

describe('Error Classes', () => {
  describe('DatabaseError', () => {
    it('should create error with message', () => {
      const error = new DatabaseError('Something went wrong');

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(DatabaseError);
      expect(error.name).toBe('DatabaseError');
      expect(error.message).toBe('Something went wrong');
    });

    it('should include error code', () => {
      const error = new DatabaseError('Connection failed', 'CONN_ERROR');

      expect(error.code).toBe('CONN_ERROR');
    });

    it('should include cause', () => {
      const cause = new Error('Original error');
      const error = new DatabaseError('Wrapped error', 'CODE', cause);

      expect(error.cause).toBe(cause);
    });
  });

  describe('ConnectionError', () => {
    it('should create connection error', () => {
      const error = new ConnectionError('Failed to connect');

      expect(error).toBeInstanceOf(DatabaseError);
      expect(error).toBeInstanceOf(ConnectionError);
      expect(error.name).toBe('ConnectionError');
      expect(error.code).toBe('CONNECTION_ERROR');
    });

    it('should include cause', () => {
      const cause = new Error('ECONNREFUSED');
      const error = new ConnectionError('Failed to connect', cause);

      expect(error.cause).toBe(cause);
    });
  });

  describe('QueryError', () => {
    it('should create query error', () => {
      const error = new QueryError('Query failed');

      expect(error).toBeInstanceOf(DatabaseError);
      expect(error).toBeInstanceOf(QueryError);
      expect(error.name).toBe('QueryError');
      expect(error.code).toBe('QUERY_ERROR');
    });

    it('should include query details', () => {
      const sql = 'SELECT * FROM users WHERE id = ?';
      const params = [1];
      const error = new QueryError('Syntax error', sql, params);

      expect(error.query).toBe(sql);
      expect(error.params).toEqual(params);
    });
  });

  describe('TransactionError', () => {
    it('should create transaction error', () => {
      const error = new TransactionError('Transaction rolled back');

      expect(error).toBeInstanceOf(DatabaseError);
      expect(error).toBeInstanceOf(TransactionError);
      expect(error.name).toBe('TransactionError');
      expect(error.code).toBe('TRANSACTION_ERROR');
    });
  });

  describe('TimeoutError', () => {
    it('should create timeout error', () => {
      const error = new TimeoutError('Query timed out', 5000);

      expect(error).toBeInstanceOf(DatabaseError);
      expect(error).toBeInstanceOf(TimeoutError);
      expect(error.name).toBe('TimeoutError');
      expect(error.code).toBe('TIMEOUT_ERROR');
      expect(error.timeoutMs).toBe(5000);
    });
  });
});
