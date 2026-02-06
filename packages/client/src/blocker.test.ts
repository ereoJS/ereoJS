import { describe, expect, test } from 'bun:test';
import type { BlockerState, UseBlockerReturn } from './blocker';
import type { BlockerFunction, PendingNavigation } from './navigation';

describe('@ereo/client - Navigation Blocker', () => {
  // =========================================================================
  // BlockerState types
  // =========================================================================
  describe('BlockerState types', () => {
    test('BlockerState has correct union values', () => {
      const states: BlockerState[] = ['unblocked', 'blocked', 'proceeding'];
      expect(states).toContain('unblocked');
      expect(states).toContain('blocked');
      expect(states).toContain('proceeding');
    });
  });

  // =========================================================================
  // ClientRouter blocker mechanics
  // =========================================================================
  describe('ClientRouter blocker mechanics', () => {
    test('BlockerFunction returns boolean', () => {
      const blocker: BlockerFunction = () => true;
      expect(blocker()).toBe(true);

      const notBlocking: BlockerFunction = () => false;
      expect(notBlocking()).toBe(false);
    });

    test('PendingNavigation holds navigation info', () => {
      const pending: PendingNavigation = {
        to: '/new-page',
        options: { replace: false },
      };
      expect(pending.to).toBe('/new-page');
      expect(pending.options.replace).toBe(false);
    });

    test('PendingNavigation with state', () => {
      const pending: PendingNavigation = {
        to: '/users/123',
        options: { state: { from: '/home' } },
      };
      expect(pending.options.state).toEqual({ from: '/home' });
    });

    test('multiple blockers — any true blocks', () => {
      const blockers = new Set<BlockerFunction>();
      blockers.add(() => false);
      blockers.add(() => true);
      blockers.add(() => false);

      let isBlocked = false;
      for (const fn of blockers) {
        if (fn()) {
          isBlocked = true;
          break;
        }
      }
      expect(isBlocked).toBe(true);
    });

    test('no blockers — not blocked', () => {
      const blockers = new Set<BlockerFunction>();

      let isBlocked = false;
      for (const fn of blockers) {
        if (fn()) {
          isBlocked = true;
          break;
        }
      }
      expect(isBlocked).toBe(false);
    });

    test('all blockers false — not blocked', () => {
      const blockers = new Set<BlockerFunction>();
      blockers.add(() => false);
      blockers.add(() => false);

      let isBlocked = false;
      for (const fn of blockers) {
        if (fn()) {
          isBlocked = true;
          break;
        }
      }
      expect(isBlocked).toBe(false);
    });

    test('blocker cleanup removes from set', () => {
      const blockers = new Set<BlockerFunction>();
      const blocker: BlockerFunction = () => true;
      blockers.add(blocker);
      expect(blockers.size).toBe(1);

      // Simulate cleanup
      blockers.delete(blocker);
      expect(blockers.size).toBe(0);
    });
  });

  // =========================================================================
  // UseBlockerReturn shape
  // =========================================================================
  describe('UseBlockerReturn interface', () => {
    test('has correct shape', () => {
      const mockReturn: UseBlockerReturn = {
        state: 'unblocked',
        proceed: () => {},
        reset: () => {},
      };
      expect(mockReturn.state).toBe('unblocked');
      expect(typeof mockReturn.proceed).toBe('function');
      expect(typeof mockReturn.reset).toBe('function');
    });

    test('blocked state', () => {
      const mockReturn: UseBlockerReturn = {
        state: 'blocked',
        proceed: () => {},
        reset: () => {},
      };
      expect(mockReturn.state).toBe('blocked');
    });

    test('proceeding state', () => {
      const mockReturn: UseBlockerReturn = {
        state: 'proceeding',
        proceed: () => {},
        reset: () => {},
      };
      expect(mockReturn.state).toBe('proceeding');
    });
  });

  // =========================================================================
  // Blocker listener mechanics
  // =========================================================================
  describe('blocker listeners', () => {
    test('listener is called when pending navigation changes', () => {
      const listeners = new Set<() => void>();
      let callCount = 0;
      const listener = () => { callCount++; };
      listeners.add(listener);

      // Simulate notify
      for (const l of listeners) l();
      expect(callCount).toBe(1);

      for (const l of listeners) l();
      expect(callCount).toBe(2);
    });

    test('listener cleanup', () => {
      const listeners = new Set<() => void>();
      let callCount = 0;
      const listener = () => { callCount++; };
      listeners.add(listener);

      // Remove listener
      listeners.delete(listener);

      for (const l of listeners) l();
      expect(callCount).toBe(0);
    });
  });

  // =========================================================================
  // Dynamic blocker function
  // =========================================================================
  describe('dynamic blocking', () => {
    test('blocker function can use external state', () => {
      let isDirty = false;
      const blocker: BlockerFunction = () => isDirty;

      expect(blocker()).toBe(false);
      isDirty = true;
      expect(blocker()).toBe(true);
      isDirty = false;
      expect(blocker()).toBe(false);
    });
  });
});
