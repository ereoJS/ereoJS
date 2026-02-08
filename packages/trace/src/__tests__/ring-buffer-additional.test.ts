/**
 * @ereo/trace - Additional Ring Buffer Tests
 *
 * Edge cases: capacity 1, getAll ordering, get after overwrite, toArray consistency.
 */

import { describe, it, expect } from 'bun:test';
import { RingBuffer } from '../ring-buffer';

describe('RingBuffer - capacity 1', () => {
  it('stores a single item', () => {
    const buf = new RingBuffer<{ id: string }>( 1);
    buf.push({ id: 'only' });
    expect(buf.size).toBe(1);
    expect(buf.get('only')?.id).toBe('only');
    expect(buf.toArray()).toEqual([{ id: 'only' }]);
  });

  it('evicts the single item when a new one is pushed', () => {
    const buf = new RingBuffer<{ id: string }>(1);
    buf.push({ id: 'first' });
    buf.push({ id: 'second' });

    expect(buf.size).toBe(1);
    expect(buf.get('first')).toBeUndefined();
    expect(buf.get('second')?.id).toBe('second');
    expect(buf.toArray()).toEqual([{ id: 'second' }]);
  });

  it('maintains size of 1 after many pushes', () => {
    const buf = new RingBuffer<{ id: string }>(1);
    for (let i = 0; i < 100; i++) {
      buf.push({ id: `item-${i}` });
    }
    expect(buf.size).toBe(1);
    expect(buf.get('item-99')?.id).toBe('item-99');
    expect(buf.get('item-0')).toBeUndefined();
    expect(buf.get('item-98')).toBeUndefined();
    expect(buf.toArray()).toEqual([{ id: 'item-99' }]);
  });

  it('clear works on capacity 1 buffer', () => {
    const buf = new RingBuffer<{ id: string }>(1);
    buf.push({ id: 'x' });
    buf.clear();
    expect(buf.size).toBe(0);
    expect(buf.get('x')).toBeUndefined();
    expect(buf.toArray()).toEqual([]);
  });

  it('can push after clear on capacity 1 buffer', () => {
    const buf = new RingBuffer<{ id: string }>(1);
    buf.push({ id: 'a' });
    buf.clear();
    buf.push({ id: 'b' });
    expect(buf.size).toBe(1);
    expect(buf.get('b')?.id).toBe('b');
    expect(buf.get('a')).toBeUndefined();
  });
});

describe('RingBuffer - toArray ordering', () => {
  it('returns items in insertion order when not full', () => {
    const buf = new RingBuffer<{ id: string }>(5);
    buf.push({ id: 'a' });
    buf.push({ id: 'b' });
    buf.push({ id: 'c' });

    expect(buf.toArray().map(x => x.id)).toEqual(['a', 'b', 'c']);
  });

  it('returns items oldest-first when buffer is exactly full', () => {
    const buf = new RingBuffer<{ id: string }>(3);
    buf.push({ id: 'a' });
    buf.push({ id: 'b' });
    buf.push({ id: 'c' });

    expect(buf.toArray().map(x => x.id)).toEqual(['a', 'b', 'c']);
  });

  it('returns items oldest-first after single eviction', () => {
    const buf = new RingBuffer<{ id: string }>(3);
    buf.push({ id: 'a' });
    buf.push({ id: 'b' });
    buf.push({ id: 'c' });
    buf.push({ id: 'd' }); // evicts 'a'

    expect(buf.toArray().map(x => x.id)).toEqual(['b', 'c', 'd']);
  });

  it('returns items oldest-first after many evictions wrapping multiple times', () => {
    const buf = new RingBuffer<{ id: string }>(3);
    // Push 10 items into capacity 3 buffer
    for (let i = 0; i < 10; i++) {
      buf.push({ id: `item-${i}` });
    }

    // Should contain the last 3: item-7, item-8, item-9
    expect(buf.toArray().map(x => x.id)).toEqual(['item-7', 'item-8', 'item-9']);
  });

  it('preserves ordering across wrap boundary', () => {
    const buf = new RingBuffer<{ id: string }>(4);
    buf.push({ id: '1' });
    buf.push({ id: '2' });
    buf.push({ id: '3' });
    buf.push({ id: '4' }); // full: [1,2,3,4], index=0
    buf.push({ id: '5' }); // evicts 1: [5,2,3,4], index=1
    buf.push({ id: '6' }); // evicts 2: [5,6,3,4], index=2

    // Oldest-first: 3, 4, 5, 6
    expect(buf.toArray().map(x => x.id)).toEqual(['3', '4', '5', '6']);
  });

  it('returns empty array for empty buffer', () => {
    const buf = new RingBuffer<{ id: string }>(10);
    expect(buf.toArray()).toEqual([]);
  });

  it('returns consistent results when called multiple times', () => {
    const buf = new RingBuffer<{ id: string }>(3);
    buf.push({ id: 'x' });
    buf.push({ id: 'y' });
    buf.push({ id: 'z' });
    buf.push({ id: 'w' }); // evicts x

    const result1 = buf.toArray().map(x => x.id);
    const result2 = buf.toArray().map(x => x.id);
    expect(result1).toEqual(result2);
    expect(result1).toEqual(['y', 'z', 'w']);
  });
});

describe('RingBuffer - get after overwrite', () => {
  it('returns undefined for evicted items', () => {
    const buf = new RingBuffer<{ id: string }>(2);
    buf.push({ id: 'old' });
    buf.push({ id: 'newer' });
    buf.push({ id: 'newest' }); // evicts 'old'

    expect(buf.get('old')).toBeUndefined();
    expect(buf.get('newer')?.id).toBe('newer');
    expect(buf.get('newest')?.id).toBe('newest');
  });

  it('returns correct item when same slot is reused', () => {
    const buf = new RingBuffer<{ id: string; value: number }>(2);
    buf.push({ id: 'a', value: 1 });
    buf.push({ id: 'b', value: 2 });
    buf.push({ id: 'c', value: 3 }); // overwrites slot 0 (was 'a')

    expect(buf.get('a')).toBeUndefined();
    expect(buf.get('b')?.value).toBe(2);
    expect(buf.get('c')?.value).toBe(3);
  });

  it('lookup map stays in sync after many overwrites', () => {
    const buf = new RingBuffer<{ id: string }>(3);

    for (let i = 0; i < 20; i++) {
      buf.push({ id: `item-${i}` });
    }

    // Only the last 3 should be findable
    for (let i = 0; i < 17; i++) {
      expect(buf.get(`item-${i}`)).toBeUndefined();
    }
    expect(buf.get('item-17')?.id).toBe('item-17');
    expect(buf.get('item-18')?.id).toBe('item-18');
    expect(buf.get('item-19')?.id).toBe('item-19');
  });

  it('get returns undefined for items never pushed', () => {
    const buf = new RingBuffer<{ id: string }>(5);
    buf.push({ id: 'exists' });

    expect(buf.get('nonexistent')).toBeUndefined();
    expect(buf.get('')).toBeUndefined();
    expect(buf.get('exists')?.id).toBe('exists');
  });

  it('get returns undefined after clear even for previously existing items', () => {
    const buf = new RingBuffer<{ id: string }>(5);
    buf.push({ id: 'a' });
    buf.push({ id: 'b' });

    expect(buf.get('a')?.id).toBe('a');
    buf.clear();
    expect(buf.get('a')).toBeUndefined();
    expect(buf.get('b')).toBeUndefined();
  });
});

describe('RingBuffer - toArray consistency', () => {
  it('toArray returns a new array each time (not a reference)', () => {
    const buf = new RingBuffer<{ id: string }>(3);
    buf.push({ id: 'a' });
    buf.push({ id: 'b' });

    const arr1 = buf.toArray();
    const arr2 = buf.toArray();
    expect(arr1).toEqual(arr2);
    expect(arr1).not.toBe(arr2); // different reference
  });

  it('toArray is not affected by subsequent pushes', () => {
    const buf = new RingBuffer<{ id: string }>(3);
    buf.push({ id: 'a' });
    buf.push({ id: 'b' });

    const snapshotBefore = buf.toArray();
    buf.push({ id: 'c' });
    const snapshotAfter = buf.toArray();

    expect(snapshotBefore.map(x => x.id)).toEqual(['a', 'b']);
    expect(snapshotAfter.map(x => x.id)).toEqual(['a', 'b', 'c']);
  });

  it('size matches toArray length before buffer is full', () => {
    const buf = new RingBuffer<{ id: string }>(10);
    for (let i = 0; i < 7; i++) {
      buf.push({ id: `${i}` });
    }
    expect(buf.size).toBe(7);
    expect(buf.toArray().length).toBe(7);
  });

  it('size matches toArray length after buffer wraps', () => {
    const buf = new RingBuffer<{ id: string }>(5);
    for (let i = 0; i < 12; i++) {
      buf.push({ id: `${i}` });
    }
    expect(buf.size).toBe(5);
    expect(buf.toArray().length).toBe(5);
  });

  it('size and toArray length are both 0 after clear', () => {
    const buf = new RingBuffer<{ id: string }>(5);
    buf.push({ id: 'a' });
    buf.push({ id: 'b' });
    buf.clear();
    expect(buf.size).toBe(0);
    expect(buf.toArray().length).toBe(0);
  });

  it('toArray returns correct order after push-clear-push cycle', () => {
    const buf = new RingBuffer<{ id: string }>(3);
    buf.push({ id: 'old-1' });
    buf.push({ id: 'old-2' });
    buf.push({ id: 'old-3' });
    buf.clear();
    buf.push({ id: 'new-1' });
    buf.push({ id: 'new-2' });

    expect(buf.size).toBe(2);
    expect(buf.toArray().map(x => x.id)).toEqual(['new-1', 'new-2']);
  });

  it('capacity property is preserved throughout lifecycle', () => {
    const buf = new RingBuffer<{ id: string }>(7);
    expect(buf.capacity).toBe(7);

    for (let i = 0; i < 20; i++) {
      buf.push({ id: `${i}` });
    }
    expect(buf.capacity).toBe(7);

    buf.clear();
    expect(buf.capacity).toBe(7);
  });

  it('items with duplicate IDs overwrite lookup but both occupy buffer slots', () => {
    const buf = new RingBuffer<{ id: string; v: number }>(5);
    buf.push({ id: 'dup', v: 1 });
    buf.push({ id: 'other', v: 2 });
    buf.push({ id: 'dup', v: 3 }); // same id, different value

    // lookup should return the latest version
    expect(buf.get('dup')?.v).toBe(3);
    // Both occupy buffer slots
    expect(buf.size).toBe(3);
    // toArray should contain both entries since buffer slots are separate
    const arr = buf.toArray();
    expect(arr.length).toBe(3);
  });
});
