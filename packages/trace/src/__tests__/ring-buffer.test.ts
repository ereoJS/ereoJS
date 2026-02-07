import { describe, it, expect } from 'bun:test';
import { RingBuffer } from '../ring-buffer';

describe('RingBuffer', () => {
  it('stores items up to capacity', () => {
    const buf = new RingBuffer<{ id: string }>(3);
    buf.push({ id: 'a' });
    buf.push({ id: 'b' });
    buf.push({ id: 'c' });
    expect(buf.size).toBe(3);
    expect(buf.toArray().map((x) => x.id)).toEqual(['a', 'b', 'c']);
  });

  it('evicts oldest when over capacity', () => {
    const buf = new RingBuffer<{ id: string }>(3);
    buf.push({ id: 'a' });
    buf.push({ id: 'b' });
    buf.push({ id: 'c' });
    buf.push({ id: 'd' });
    expect(buf.size).toBe(3);
    expect(buf.toArray().map((x) => x.id)).toEqual(['b', 'c', 'd']);
    expect(buf.get('a')).toBeUndefined();
    expect(buf.get('d')?.id).toBe('d');
  });

  it('wraps around correctly', () => {
    const buf = new RingBuffer<{ id: string }>(2);
    buf.push({ id: '1' });
    buf.push({ id: '2' });
    buf.push({ id: '3' });
    buf.push({ id: '4' });
    buf.push({ id: '5' });
    expect(buf.toArray().map((x) => x.id)).toEqual(['4', '5']);
  });

  it('get returns item by id', () => {
    const buf = new RingBuffer<{ id: string }>(5);
    buf.push({ id: 'x' });
    buf.push({ id: 'y' });
    expect(buf.get('x')?.id).toBe('x');
    expect(buf.get('z')).toBeUndefined();
  });

  it('clear removes all items', () => {
    const buf = new RingBuffer<{ id: string }>(3);
    buf.push({ id: 'a' });
    buf.push({ id: 'b' });
    buf.clear();
    expect(buf.size).toBe(0);
    expect(buf.toArray()).toEqual([]);
    expect(buf.get('a')).toBeUndefined();
  });
});
