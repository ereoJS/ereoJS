import { describe, expect, test, beforeEach } from 'bun:test';
import {
  IslandRegistration,
  islandRegistry,
  registerIslandComponent,
  getIslandComponent,
  registerIslandComponents,
  cleanupIslands,
} from './islands';

// Mock DOM environment for testing
class MockElement {
  getAttribute(name: string): string | null {
    return null;
  }
}

describe('@oreo/client - Islands', () => {
  beforeEach(() => {
    // Clean up registry between tests
    cleanupIslands();
  });

  describe('islandRegistry', () => {
    test('registers an island', () => {
      const mockComponent = () => null;
      const mockElement = new MockElement() as unknown as Element;

      islandRegistry.register(
        'test-island',
        mockComponent,
        { prop: 'value' },
        'load',
        mockElement
      );

      const island = islandRegistry.get('test-island');
      expect(island).toBeDefined();
      expect(island?.id).toBe('test-island');
      expect(island?.props).toEqual({ prop: 'value' });
      expect(island?.strategy).toBe('load');
      expect(island?.hydrated).toBe(false);
    });

    test('registers island with media query', () => {
      const mockComponent = () => null;
      const mockElement = new MockElement() as unknown as Element;

      islandRegistry.register(
        'media-island',
        mockComponent,
        {},
        'media',
        mockElement,
        '(min-width: 768px)'
      );

      const island = islandRegistry.get('media-island');
      expect(island?.media).toBe('(min-width: 768px)');
    });

    test('returns undefined for unknown island', () => {
      expect(islandRegistry.get('unknown')).toBeUndefined();
    });

    test('marks island as hydrated', () => {
      const mockComponent = () => null;
      const mockElement = new MockElement() as unknown as Element;

      islandRegistry.register('hydrate-test', mockComponent, {}, 'load', mockElement);

      expect(islandRegistry.isHydrated('hydrate-test')).toBe(false);

      islandRegistry.markHydrated('hydrate-test');

      expect(islandRegistry.isHydrated('hydrate-test')).toBe(true);
    });

    test('handles marking unknown island as hydrated', () => {
      islandRegistry.markHydrated('unknown');
      expect(islandRegistry.isHydrated('unknown')).toBe(false);
    });

    test('sets and runs cleanup function', () => {
      const mockComponent = () => null;
      const mockElement = new MockElement() as unknown as Element;
      let cleanupCalled = false;

      islandRegistry.register('cleanup-test', mockComponent, {}, 'load', mockElement);
      islandRegistry.setCleanup('cleanup-test', () => {
        cleanupCalled = true;
      });

      islandRegistry.cleanup('cleanup-test');

      expect(cleanupCalled).toBe(true);
      expect(islandRegistry.get('cleanup-test')).toBeUndefined();
    });

    test('cleanupAll removes all islands', () => {
      const mockComponent = () => null;
      const mockElement = new MockElement() as unknown as Element;

      islandRegistry.register('island-1', mockComponent, {}, 'load', mockElement);
      islandRegistry.register('island-2', mockComponent, {}, 'idle', mockElement);
      islandRegistry.register('island-3', mockComponent, {}, 'visible', mockElement);

      expect(islandRegistry.getAll()).toHaveLength(3);

      islandRegistry.cleanupAll();

      expect(islandRegistry.getAll()).toHaveLength(0);
    });

    test('getAll returns all registered islands', () => {
      const mockComponent = () => null;
      const mockElement = new MockElement() as unknown as Element;

      islandRegistry.register('island-a', mockComponent, {}, 'load', mockElement);
      islandRegistry.register('island-b', mockComponent, {}, 'idle', mockElement);

      const all = islandRegistry.getAll();

      expect(all).toHaveLength(2);
      expect(all.map((i) => i.id)).toContain('island-a');
      expect(all.map((i) => i.id)).toContain('island-b');
    });

    test('getByStrategy filters islands by strategy', () => {
      const mockComponent = () => null;
      const mockElement = new MockElement() as unknown as Element;

      islandRegistry.register('load-1', mockComponent, {}, 'load', mockElement);
      islandRegistry.register('load-2', mockComponent, {}, 'load', mockElement);
      islandRegistry.register('idle-1', mockComponent, {}, 'idle', mockElement);
      islandRegistry.register('visible-1', mockComponent, {}, 'visible', mockElement);

      const loadIslands = islandRegistry.getByStrategy('load');
      expect(loadIslands).toHaveLength(2);

      const idleIslands = islandRegistry.getByStrategy('idle');
      expect(idleIslands).toHaveLength(1);

      const visibleIslands = islandRegistry.getByStrategy('visible');
      expect(visibleIslands).toHaveLength(1);
    });

    test('getPending returns non-hydrated islands', () => {
      const mockComponent = () => null;
      const mockElement = new MockElement() as unknown as Element;

      islandRegistry.register('pending-1', mockComponent, {}, 'load', mockElement);
      islandRegistry.register('pending-2', mockComponent, {}, 'load', mockElement);
      islandRegistry.register('hydrated-1', mockComponent, {}, 'load', mockElement);

      islandRegistry.markHydrated('hydrated-1');

      const pending = islandRegistry.getPending();

      expect(pending).toHaveLength(2);
      expect(pending.map((i) => i.id)).toContain('pending-1');
      expect(pending.map((i) => i.id)).toContain('pending-2');
      expect(pending.map((i) => i.id)).not.toContain('hydrated-1');
    });
  });

  describe('Component Registry', () => {
    test('registers and retrieves components', () => {
      const TestComponent = () => null;

      registerIslandComponent('TestComponent', TestComponent);

      expect(getIslandComponent('TestComponent')).toBe(TestComponent);
    });

    test('returns undefined for unknown component', () => {
      expect(getIslandComponent('UnknownComponent')).toBeUndefined();
    });

    test('registers multiple components at once', () => {
      const ComponentA = () => null;
      const ComponentB = () => null;
      const ComponentC = () => null;

      registerIslandComponents({
        ComponentA,
        ComponentB,
        ComponentC,
      });

      expect(getIslandComponent('ComponentA')).toBe(ComponentA);
      expect(getIslandComponent('ComponentB')).toBe(ComponentB);
      expect(getIslandComponent('ComponentC')).toBe(ComponentC);
    });

    test('overwrites component with same name', () => {
      const Original = () => null;
      const Replacement = () => null;

      registerIslandComponent('Overwrite', Original);
      registerIslandComponent('Overwrite', Replacement);

      expect(getIslandComponent('Overwrite')).toBe(Replacement);
    });
  });
});
