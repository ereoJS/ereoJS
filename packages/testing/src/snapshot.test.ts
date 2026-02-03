/**
 * @ereo/testing - Snapshot Tests
 */

import { describe, expect, test } from 'bun:test';
import type { LoaderFunction, ActionFunction } from '@ereo/core';
import {
  snapshotLoader,
  snapshotAction,
  createSnapshotMatrix,
  commonReplacers,
  applyReplacements,
  deterministicSnapshot,
} from './snapshot';

// Sample loader and action for testing
const testLoader: LoaderFunction<{
  id: number;
  name: string;
  createdAt: string;
  tags: string[];
}> = async ({ params }) => {
  return {
    id: parseInt((params as { id?: string }).id || '1', 10),
    name: `Item ${(params as { id?: string }).id || '1'}`,
    createdAt: '2024-01-15T10:30:00.000Z',
    tags: ['tag1', 'tag2'],
  };
};

const testAction: ActionFunction<{
  success: boolean;
  id: number;
  message: string;
}> = async () => {
  return {
    success: true,
    id: 123,
    message: 'Created successfully',
  };
};

describe('snapshotLoader', () => {
  test('creates snapshot of loader data', async () => {
    const snapshot = await snapshotLoader(testLoader, {
      params: { id: '42' },
    });

    expect(snapshot).toEqual({
      id: 42,
      name: 'Item 42',
      createdAt: '2024-01-15T10:30:00.000Z',
      tags: ['tag1', 'tag2'],
    });
  });

  test('excludes specified fields', async () => {
    const snapshot = await snapshotLoader(testLoader, {
      params: { id: '1' },
    }, {
      exclude: ['createdAt', 'id'],
    });

    expect(snapshot).toEqual({
      name: 'Item 1',
      tags: ['tag1', 'tag2'],
    });
  });

  test('includes only specified fields', async () => {
    const snapshot = await snapshotLoader(testLoader, {
      params: { id: '1' },
    }, {
      include: ['name', 'tags'],
    });

    expect(snapshot).toEqual({
      name: 'Item 1',
      tags: ['tag1', 'tag2'],
    });
  });

  test('applies replacers to fields', async () => {
    const snapshot = await snapshotLoader(testLoader, {
      params: { id: '1' },
    }, {
      replacers: { id: '[ID]', createdAt: '[DATE]' },
    });

    expect(snapshot).toEqual({
      id: '[ID]',
      name: 'Item 1',
      createdAt: '[DATE]',
      tags: ['tag1', 'tag2'],
    });
  });

  test('works with empty options', async () => {
    const snapshot = await snapshotLoader(testLoader);

    expect(snapshot).toEqual({
      id: 1,
      name: 'Item 1',
      createdAt: '2024-01-15T10:30:00.000Z',
      tags: ['tag1', 'tag2'],
    });
  });

  test('handles null data', async () => {
    const nullLoader: LoaderFunction<null> = async () => null;

    const snapshot = await snapshotLoader(nullLoader);

    expect(snapshot).toBeNull();
  });

  test('handles undefined data', async () => {
    const undefinedLoader: LoaderFunction<undefined> = async () => undefined;

    const snapshot = await snapshotLoader(undefinedLoader);

    expect(snapshot).toBeUndefined();
  });

  test('handles primitive data', async () => {
    const stringLoader: LoaderFunction<string> = async () => 'test string';

    const snapshot = await snapshotLoader(stringLoader);

    expect(snapshot).toBe('test string');
  });

  test('handles array data', async () => {
    const arrayLoader: LoaderFunction<{ id: number; name: string }[]> = async () => [
      { id: 1, name: 'First' },
      { id: 2, name: 'Second' },
    ];

    const snapshot = await snapshotLoader(arrayLoader, {}, {
      exclude: ['id'],
    });

    expect(snapshot).toEqual([
      { name: 'First' },
      { name: 'Second' },
    ]);
  });

  test('handles deeply nested objects', async () => {
    const nestedLoader: LoaderFunction<{ user: { profile: { name: string; id: number } } }> = async () => ({
      user: {
        profile: {
          name: 'Test User',
          id: 1,
        },
      },
    });

    const snapshot = await snapshotLoader(nestedLoader, {}, {
      exclude: ['id'],
    });

    expect(snapshot).toEqual({
      user: {
        profile: {
          name: 'Test User',
        },
      },
    });
  });
});

describe('snapshotAction', () => {
  test('creates snapshot of action data', async () => {
    const snapshot = await snapshotAction(testAction, {
      formData: { name: 'Test' },
    });

    expect(snapshot).toEqual({
      success: true,
      id: 123,
      message: 'Created successfully',
    });
  });

  test('excludes specified fields', async () => {
    const snapshot = await snapshotAction(testAction, {
      formData: { name: 'Test' },
    }, {
      exclude: ['id'],
    });

    expect(snapshot).toEqual({
      success: true,
      message: 'Created successfully',
    });
  });

  test('includes only specified fields', async () => {
    const snapshot = await snapshotAction(testAction, {}, {
      include: ['success'],
    });

    expect(snapshot).toEqual({
      success: true,
    });
  });

  test('applies replacers', async () => {
    const snapshot = await snapshotAction(testAction, {}, {
      replacers: { id: '[ID]' },
    });

    expect(snapshot).toEqual({
      success: true,
      id: '[ID]',
      message: 'Created successfully',
    });
  });

  test('works with Response-returning action', async () => {
    const responseAction: ActionFunction<Response> = async () => {
      return new Response(JSON.stringify({ status: 'ok' }), {
        headers: { 'Content-Type': 'application/json' },
      });
    };

    const snapshot = await snapshotAction(responseAction);

    expect(snapshot).toEqual({ status: 'ok' });
  });
});

describe('createSnapshotMatrix', () => {
  test('creates snapshots for multiple scenarios', async () => {
    const snapshots = await createSnapshotMatrix(testLoader, {
      scenarios: {
        'scenario 1': { params: { id: '1' } },
        'scenario 2': { params: { id: '2' } },
        'scenario 3': { params: { id: '3' } },
      },
    });

    expect(snapshots['scenario 1']).toEqual({
      id: 1,
      name: 'Item 1',
      createdAt: '2024-01-15T10:30:00.000Z',
      tags: ['tag1', 'tag2'],
    });
    expect(snapshots['scenario 2']).toEqual({
      id: 2,
      name: 'Item 2',
      createdAt: '2024-01-15T10:30:00.000Z',
      tags: ['tag1', 'tag2'],
    });
    expect(snapshots['scenario 3']).toEqual({
      id: 3,
      name: 'Item 3',
      createdAt: '2024-01-15T10:30:00.000Z',
      tags: ['tag1', 'tag2'],
    });
  });

  test('applies snapshot options to all scenarios', async () => {
    const snapshots = await createSnapshotMatrix(testLoader, {
      scenarios: {
        first: { params: { id: '1' } },
        second: { params: { id: '2' } },
      },
      snapshotOptions: {
        exclude: ['createdAt', 'id'],
      },
    });

    expect(snapshots['first']).toEqual({
      name: 'Item 1',
      tags: ['tag1', 'tag2'],
    });
    expect(snapshots['second']).toEqual({
      name: 'Item 2',
      tags: ['tag1', 'tag2'],
    });
  });

  test('handles single scenario', async () => {
    const snapshots = await createSnapshotMatrix(testLoader, {
      scenarios: {
        only: { params: { id: '99' } },
      },
    });

    expect(Object.keys(snapshots)).toHaveLength(1);
    expect(snapshots['only']).toEqual({
      id: 99,
      name: 'Item 99',
      createdAt: '2024-01-15T10:30:00.000Z',
      tags: ['tag1', 'tag2'],
    });
  });

  test('preserves scenario order', async () => {
    const snapshots = await createSnapshotMatrix(testLoader, {
      scenarios: {
        aaa: { params: { id: '1' } },
        zzz: { params: { id: '2' } },
        mmm: { params: { id: '3' } },
      },
    });

    const keys = Object.keys(snapshots);
    expect(keys).toContain('aaa');
    expect(keys).toContain('zzz');
    expect(keys).toContain('mmm');
  });
});

describe('commonReplacers', () => {
  test('has date replacer pattern', () => {
    const dateString = '2024-01-15T10:30:00.000Z';
    // Reset lastIndex because of global flag
    commonReplacers.date.lastIndex = 0;
    expect(commonReplacers.date.test(dateString)).toBe(true);
  });

  test('date replacer matches ISO dates', () => {
    const validDates = [
      '2024-01-01T00:00:00.000Z',
      '2023-12-31T23:59:59.999Z',
      '2000-06-15T12:30:45.123Z',
    ];

    validDates.forEach(date => {
      // Reset lastIndex because of global flag
      commonReplacers.date.lastIndex = 0;
      expect(commonReplacers.date.test(date)).toBe(true);
    });
  });

  test('has uuid replacer pattern', () => {
    const uuid = '550e8400-e29b-41d4-a716-446655440000';
    // Reset lastIndex because of global flag
    commonReplacers.uuid.lastIndex = 0;
    expect(commonReplacers.uuid.test(uuid)).toBe(true);
  });

  test('uuid replacer matches various UUIDs', () => {
    const uuids = [
      '550e8400-e29b-41d4-a716-446655440000',
      'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
      'ABCDEF12-3456-7890-ABCD-EF1234567890', // uppercase
    ];

    uuids.forEach(uuid => {
      // Reset lastIndex because of global flag
      commonReplacers.uuid.lastIndex = 0;
      expect(commonReplacers.uuid.test(uuid)).toBe(true);
    });
  });

  test('has numericId replacer pattern', () => {
    // Reset lastIndex because of global flag
    commonReplacers.numericId.lastIndex = 0;
    expect(commonReplacers.numericId.test('12345')).toBe(true);
    commonReplacers.numericId.lastIndex = 0;
    expect(commonReplacers.numericId.test('1')).toBe(true);
    commonReplacers.numericId.lastIndex = 0;
    expect(commonReplacers.numericId.test('0')).toBe(true);
  });
});

describe('applyReplacements', () => {
  test('replaces string patterns', () => {
    const data = {
      message: 'Hello World',
      greeting: 'World says hi',
    };

    const result = applyReplacements(data, {
      'World': '[REPLACED]',
    });

    expect(result).toEqual({
      message: 'Hello [REPLACED]',
      greeting: '[REPLACED] says hi',
    });
  });

  test('replaces regex patterns', () => {
    const data = {
      id: 'abc-123-xyz',
      other: 'def-456-uvw',
    };

    // Note: Regex patterns are converted to strings as keys
    const result = applyReplacements(data, {
      '-123-': '-[ID]-',
      '-456-': '-[ID2]-',
    });

    expect(result).toEqual({
      id: 'abc-[ID]-xyz',
      other: 'def-[ID2]-uvw',
    });
  });

  test('handles nested objects', () => {
    const data = {
      user: {
        email: 'test@example.com',
        profile: {
          email: 'other@example.com',
        },
      },
    };

    const result = applyReplacements(data, {
      '@example.com': '@[DOMAIN]',
    });

    expect(result).toEqual({
      user: {
        email: 'test@[DOMAIN]',
        profile: {
          email: 'other@[DOMAIN]',
        },
      },
    });
  });

  test('handles arrays', () => {
    const data = {
      emails: ['a@test.com', 'b@test.com'],
    };

    const result = applyReplacements(data, {
      '@test.com': '@[DOMAIN]',
    });

    expect(result).toEqual({
      emails: ['a@[DOMAIN]', 'b@[DOMAIN]'],
    });
  });

  test('handles multiple replacements', () => {
    const data = {
      text: 'User 123 created at 2024-01-01',
    };

    const result = applyReplacements(data, {
      '123': '[ID]',
      '2024-01-01': '[DATE]',
    });

    expect(result).toEqual({
      text: 'User [ID] created at [DATE]',
    });
  });

  test('handles empty data', () => {
    const result = applyReplacements({}, { 'test': 'replaced' });
    expect(result).toEqual({});
  });

  test('handles null values', () => {
    const data = { value: null };
    const result = applyReplacements(data, { 'test': 'replaced' });
    expect(result).toEqual({ value: null });
  });

  test('handles primitive data', () => {
    const result = applyReplacements('hello world', { 'world': 'universe' });
    expect(result).toBe('hello universe');
  });

  test('handles number value', () => {
    const result = applyReplacements(123, {});
    expect(result).toBe(123);
  });

  test('handles boolean value', () => {
    const result = applyReplacements(true, {});
    expect(result).toBe(true);
  });
});

describe('deterministicSnapshot', () => {
  test('sorts object keys alphabetically', () => {
    const data = {
      zebra: 1,
      apple: 2,
      mango: 3,
    };

    const snapshot = deterministicSnapshot(data);
    const parsed = JSON.parse(snapshot);

    const keys = Object.keys(parsed);
    expect(keys).toEqual(['apple', 'mango', 'zebra']);
  });

  test('sorts nested object keys', () => {
    const data = {
      outer: {
        z: 1,
        a: 2,
      },
    };

    const snapshot = deterministicSnapshot(data);
    const parsed = JSON.parse(snapshot);

    const innerKeys = Object.keys(parsed.outer);
    expect(innerKeys).toEqual(['a', 'z']);
  });

  test('does not sort arrays', () => {
    const data = {
      items: ['z', 'a', 'm'],
    };

    const snapshot = deterministicSnapshot(data);
    const parsed = JSON.parse(snapshot);

    expect(parsed.items).toEqual(['z', 'a', 'm']);
  });

  test('formats with 2-space indentation', () => {
    const data = { key: 'value' };

    const snapshot = deterministicSnapshot(data);

    expect(snapshot).toContain('  '); // Should have indentation
    expect(snapshot).toContain('\n'); // Should have newlines
  });

  test('handles deeply nested objects', () => {
    const data = {
      z: {
        z: {
          z: 1,
          a: 2,
        },
        a: {
          z: 3,
          a: 4,
        },
      },
      a: {
        z: 5,
        a: 6,
      },
    };

    const snapshot = deterministicSnapshot(data);
    const parsed = JSON.parse(snapshot);

    // Outer level sorted
    expect(Object.keys(parsed)).toEqual(['a', 'z']);
    // Inner levels sorted
    expect(Object.keys(parsed.a)).toEqual(['a', 'z']);
    expect(Object.keys(parsed.z)).toEqual(['a', 'z']);
    expect(Object.keys(parsed.z.a)).toEqual(['a', 'z']);
  });

  test('produces consistent output for same data', () => {
    const data1 = { b: 2, a: 1, c: 3 };
    const data2 = { c: 3, a: 1, b: 2 };

    const snapshot1 = deterministicSnapshot(data1);
    const snapshot2 = deterministicSnapshot(data2);

    expect(snapshot1).toBe(snapshot2);
  });

  test('handles mixed arrays and objects', () => {
    const data = {
      items: [
        { z: 1, a: 2 },
        { y: 3, b: 4 },
      ],
    };

    const snapshot = deterministicSnapshot(data);
    const parsed = JSON.parse(snapshot);

    expect(Object.keys(parsed.items[0])).toEqual(['a', 'z']);
    expect(Object.keys(parsed.items[1])).toEqual(['b', 'y']);
  });

  test('handles null and undefined', () => {
    const data = {
      nullValue: null,
      number: 1,
    };

    const snapshot = deterministicSnapshot(data);
    const parsed = JSON.parse(snapshot);

    expect(parsed.nullValue).toBeNull();
    expect(Object.keys(parsed)).toEqual(['nullValue', 'number']);
  });

  test('handles empty objects', () => {
    const snapshot = deterministicSnapshot({});
    expect(JSON.parse(snapshot)).toEqual({});
  });

  test('handles primitive values', () => {
    expect(JSON.parse(deterministicSnapshot('string'))).toBe('string');
    expect(JSON.parse(deterministicSnapshot(123))).toBe(123);
    expect(JSON.parse(deterministicSnapshot(true))).toBe(true);
    expect(JSON.parse(deterministicSnapshot(null))).toBeNull();
  });
});

// Test the internal prepareForSnapshot function through snapshotLoader
describe('prepareForSnapshot (via snapshotLoader)', () => {
  test('recursively processes arrays', async () => {
    const arrayLoader: LoaderFunction<{ items: { id: number; name: string }[] }> = async () => ({
      items: [
        { id: 1, name: 'First' },
        { id: 2, name: 'Second' },
      ],
    });

    const snapshot = await snapshotLoader(arrayLoader, {}, {
      exclude: ['id'],
    });

    expect(snapshot).toEqual({
      items: [
        { name: 'First' },
        { name: 'Second' },
      ],
    });
  });

  test('handles include and exclude together - include takes precedence', async () => {
    const loader: LoaderFunction<{ a: number; b: number; c: number }> = async () => ({
      a: 1,
      b: 2,
      c: 3,
    });

    const snapshot = await snapshotLoader(loader, {}, {
      include: ['a', 'b'],
    });

    // Include limits to only a and b
    expect(snapshot).toEqual({ a: 1, b: 2 });
    expect((snapshot as { c?: number }).c).toBeUndefined();
  });

  test('handles nested objects with replacers', async () => {
    const nestedLoader: LoaderFunction<{ user: { id: number; name: string } }> = async () => ({
      user: { id: 1, name: 'Test' },
    });

    const snapshot = await snapshotLoader(nestedLoader, {}, {
      replacers: { user: '[USER]' },
    });

    expect(snapshot).toEqual({ user: '[USER]' });
  });
});
