/**
 * @ereo/trace - Ring Buffer
 *
 * Fixed-capacity circular buffer for completed traces.
 * FIFO eviction when capacity is reached.
 */

export class RingBuffer<T extends { id: string }> {
  private buffer: (T | undefined)[];
  private index = 0;
  private count = 0;
  private lookup = new Map<string, T>();

  constructor(readonly capacity: number) {
    this.buffer = new Array(capacity);
  }

  /** Add an item, evicting the oldest if at capacity */
  push(item: T): void {
    const evicted = this.buffer[this.index];
    if (evicted) {
      this.lookup.delete(evicted.id);
    }

    this.buffer[this.index] = item;
    this.lookup.set(item.id, item);
    this.index = (this.index + 1) % this.capacity;
    if (this.count < this.capacity) this.count++;
  }

  /** Get an item by ID */
  get(id: string): T | undefined {
    return this.lookup.get(id);
  }

  /** Get all items in insertion order (oldest first) */
  toArray(): T[] {
    const result: T[] = [];
    if (this.count < this.capacity) {
      for (let i = 0; i < this.count; i++) {
        const item = this.buffer[i];
        if (item) result.push(item);
      }
    } else {
      for (let i = 0; i < this.capacity; i++) {
        const item = this.buffer[(this.index + i) % this.capacity];
        if (item) result.push(item);
      }
    }
    return result;
  }

  /** Number of items currently stored */
  get size(): number {
    return this.count;
  }

  /** Clear all items */
  clear(): void {
    this.buffer = new Array(this.capacity);
    this.index = 0;
    this.count = 0;
    this.lookup.clear();
  }
}
