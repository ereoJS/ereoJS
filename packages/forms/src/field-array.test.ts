import { describe, expect, test, beforeEach } from 'bun:test';
import { FormStore } from './store';

interface TestForm {
  tags: string[];
  items: { name: string; qty: number }[];
}

const defaultValues: TestForm = {
  tags: ['a', 'b', 'c'],
  items: [
    { name: 'Item 1', qty: 1 },
    { name: 'Item 2', qty: 2 },
  ],
};

describe('Field Array operations via FormStore', () => {
  let store: FormStore<TestForm>;

  beforeEach(() => {
    store = new FormStore<TestForm>({ defaultValues });
  });

  describe('basic array access', () => {
    test('reads array values', () => {
      expect(store.getValue('tags' as any)).toEqual(['a', 'b', 'c']);
    });

    test('reads individual array items', () => {
      expect(store.getValue('tags.0' as any)).toBe('a');
      expect(store.getValue('tags.1' as any)).toBe('b');
    });

    test('reads nested object array items', () => {
      expect(store.getValue('items.0.name' as any)).toBe('Item 1');
      expect(store.getValue('items.1.qty' as any)).toBe(2);
    });
  });

  describe('append', () => {
    test('appends item to array', () => {
      const current = (store.getValue('tags' as any) as string[]) ?? [];
      store.setValue('tags' as any, [...current, 'd']);
      expect(store.getValue('tags' as any)).toEqual(['a', 'b', 'c', 'd']);
    });

    test('appended value persists', () => {
      const current = (store.getValue('tags' as any) as string[]) ?? [];
      store.setValue('tags' as any, [...current, 'x']);
      expect(store.getValue('tags.3' as any)).toBe('x');
    });
  });

  describe('remove', () => {
    test('removes item at index', () => {
      const current = [...(store.getValue('tags' as any) as string[])];
      current.splice(1, 1); // remove 'b'
      store.setValue('tags' as any, current);
      expect(store.getValue('tags' as any)).toEqual(['a', 'c']);
    });

    test('remaining items have correct indices', () => {
      const current = [...(store.getValue('tags' as any) as string[])];
      current.splice(0, 1); // remove 'a'
      store.setValue('tags' as any, current);
      expect(store.getValue('tags.0' as any)).toBe('b');
      expect(store.getValue('tags.1' as any)).toBe('c');
    });
  });

  describe('swap', () => {
    test('swaps two indices', () => {
      const current = [...(store.getValue('tags' as any) as string[])];
      [current[0], current[2]] = [current[2], current[0]];
      store.setValue('tags' as any, current);
      expect(store.getValue('tags' as any)).toEqual(['c', 'b', 'a']);
    });
  });

  describe('move', () => {
    test('moves item from index A to B', () => {
      const current = [...(store.getValue('tags' as any) as string[])];
      const [item] = current.splice(0, 1); // take 'a'
      current.splice(2, 0, item); // insert at end
      store.setValue('tags' as any, current);
      expect(store.getValue('tags' as any)).toEqual(['b', 'c', 'a']);
    });
  });

  describe('insert', () => {
    test('inserts at middle position', () => {
      const current = [...(store.getValue('tags' as any) as string[])];
      current.splice(1, 0, 'x');
      store.setValue('tags' as any, current);
      expect(store.getValue('tags' as any)).toEqual(['a', 'x', 'b', 'c']);
    });
  });

  describe('clone (duplicate)', () => {
    test('duplicates item at index+1', () => {
      const current = [...(store.getValue('tags' as any) as string[])];
      const cloned = current[1]; // 'b'
      current.splice(2, 0, cloned);
      store.setValue('tags' as any, current);
      expect(store.getValue('tags' as any)).toEqual(['a', 'b', 'b', 'c']);
    });
  });

  describe('replaceAll', () => {
    test('replaces entire array', () => {
      store.setValue('tags' as any, ['x', 'y']);
      expect(store.getValue('tags' as any)).toEqual(['x', 'y']);
    });
  });

  describe('edge cases', () => {
    test('operations on empty array', () => {
      const emptyStore = new FormStore<{ items: string[] }>({
        defaultValues: { items: [] },
      });
      // Append to empty
      emptyStore.setValue('items' as any, ['first']);
      expect(emptyStore.getValue('items' as any)).toEqual(['first']);
    });

    test('nested object arrays maintain structure', () => {
      const current = [...(store.getValue('items' as any) as any[])];
      current.push({ name: 'Item 3', qty: 3 });
      store.setValue('items' as any, current);
      expect(store.getValue('items.2.name' as any)).toBe('Item 3');
      expect(store.getValue('items.2.qty' as any)).toBe(3);
    });
  });
});
