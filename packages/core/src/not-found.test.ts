import { describe, expect, test } from 'bun:test';
import { notFound, NotFoundError } from './types';

// =================================================================
// NotFoundError class tests
// =================================================================

describe('@ereo/core - NotFoundError', () => {
  test('is an instance of Error', () => {
    const error = new NotFoundError();
    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(NotFoundError);
  });

  test('has status 404', () => {
    const error = new NotFoundError();
    expect(error.status).toBe(404);
  });

  test('has name "NotFoundError"', () => {
    const error = new NotFoundError();
    expect(error.name).toBe('NotFoundError');
  });

  test('has message "Not Found"', () => {
    const error = new NotFoundError();
    expect(error.message).toBe('Not Found');
  });

  test('stores optional data', () => {
    const error = new NotFoundError({ reason: 'User not found', id: '42' });
    expect(error.data).toEqual({ reason: 'User not found', id: '42' });
  });

  test('data defaults to undefined', () => {
    const error = new NotFoundError();
    expect(error.data).toBeUndefined();
  });

  test('data can be a string', () => {
    const error = new NotFoundError('Product does not exist');
    expect(error.data).toBe('Product does not exist');
  });

  test('data can be null', () => {
    const error = new NotFoundError(null);
    expect(error.data).toBeNull();
  });

  test('has a stack trace', () => {
    const error = new NotFoundError();
    expect(error.stack).toBeDefined();
    expect(error.stack).toContain('NotFoundError');
  });
});

// =================================================================
// notFound() helper tests
// =================================================================

describe('@ereo/core - notFound()', () => {
  test('throws a NotFoundError', () => {
    expect(() => notFound()).toThrow(NotFoundError);
  });

  test('thrown error has status 404', () => {
    try {
      notFound();
    } catch (e) {
      expect(e).toBeInstanceOf(NotFoundError);
      expect((e as NotFoundError).status).toBe(404);
    }
  });

  test('thrown error includes data', () => {
    try {
      notFound({ message: 'Post not found' });
    } catch (e) {
      expect((e as NotFoundError).data).toEqual({ message: 'Post not found' });
    }
  });

  test('thrown error without data', () => {
    try {
      notFound();
    } catch (e) {
      expect((e as NotFoundError).data).toBeUndefined();
    }
  });

  test('works in a loader-like function', async () => {
    const loader = async (id: string) => {
      const user = id === '1' ? { name: 'Alice' } : null;
      if (!user) notFound({ message: `User ${id} not found` });
      return { user };
    };

    // Existing user
    const result = await loader('1');
    expect(result.user.name).toBe('Alice');

    // Non-existing user
    try {
      await loader('999');
      expect(true).toBe(false); // should not reach here
    } catch (e) {
      expect(e).toBeInstanceOf(NotFoundError);
      expect((e as NotFoundError).status).toBe(404);
      expect((e as NotFoundError).data).toEqual({ message: 'User 999 not found' });
    }
  });
});

// =================================================================
// Export verification
// =================================================================

describe('@ereo/core - notFound exports', () => {
  test('notFound and NotFoundError are exported from index', async () => {
    const coreExports = await import('./index');
    expect(coreExports.notFound).toBeDefined();
    expect(coreExports.NotFoundError).toBeDefined();
    expect(typeof coreExports.notFound).toBe('function');
  });
});
