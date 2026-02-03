import { describe, expect, test, beforeEach, afterEach } from 'bun:test';
import {
  IslandRegistration,
  islandRegistry,
  registerIslandComponent,
  getIslandComponent,
  registerIslandComponents,
  cleanupIslands,
  createIsland,
  initializeIslands,
} from './islands';
import { resetIslandCounter } from './hydration';

// Mock DOM environment for testing
class MockElement {
  getAttribute(name: string): string | null {
    return null;
  }
}

describe('@ereo/client - Islands', () => {
  // Store original globals to restore after tests
  let originalWindow: any;
  let originalDocument: any;
  let originalRIC: any;
  let originalCIC: any;
  let originalIO: any;

  beforeEach(() => {
    // Store original globals
    originalWindow = (globalThis as any).window;
    originalDocument = (globalThis as any).document;
    originalRIC = (globalThis as any).requestIdleCallback;
    originalCIC = (globalThis as any).cancelIdleCallback;
    originalIO = (globalThis as any).IntersectionObserver;

    // Provide minimal window and cancelIdleCallback to prevent errors during cleanup
    if (!(globalThis as any).window) {
      (globalThis as any).window = {};
    }
    if (!(globalThis as any).cancelIdleCallback) {
      (globalThis as any).cancelIdleCallback = () => {};
    }

    // Clean up registry between tests
    cleanupIslands();
  });

  afterEach(() => {
    // Restore original globals
    if (originalWindow !== undefined) {
      (globalThis as any).window = originalWindow;
    } else {
      delete (globalThis as any).window;
    }
    if (originalDocument !== undefined) {
      (globalThis as any).document = originalDocument;
    } else {
      delete (globalThis as any).document;
    }
    if (originalRIC !== undefined) {
      (globalThis as any).requestIdleCallback = originalRIC;
    } else {
      delete (globalThis as any).requestIdleCallback;
    }
    if (originalCIC !== undefined) {
      (globalThis as any).cancelIdleCallback = originalCIC;
    } else {
      delete (globalThis as any).cancelIdleCallback;
    }
    if (originalIO !== undefined) {
      (globalThis as any).IntersectionObserver = originalIO;
    } else {
      delete (globalThis as any).IntersectionObserver;
    }
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

  describe('createIsland', () => {
    beforeEach(() => {
      resetIslandCounter();
    });

    test('creates an island wrapper component', () => {
      const TestComponent = (props: { name: string }) => null;

      const IslandComponent = createIsland(TestComponent, 'TestComponent');

      expect(typeof IslandComponent).toBe('function');
      expect(getIslandComponent('TestComponent')).toBe(TestComponent);
    });

    test('island wrapper returns element with data attributes', () => {
      const TestComponent = (props: { name: string }) => null;
      const IslandComponent = createIsland(TestComponent, 'TestIsland');

      const result = IslandComponent({ name: 'test', 'client:load': true });

      expect(result.type).toBe('div');
      expect(result.props['data-island']).toMatch(/^island-\d+$/);
      expect(result.props['data-component']).toBe('TestIsland');
      expect(result.props['data-props']).toBe(JSON.stringify({ name: 'test' }));
      expect(result.props['data-strategy']).toBe('load');
    });

    test('island wrapper handles media strategy', () => {
      const TestComponent = (props: { value: number }) => null;
      const IslandComponent = createIsland(TestComponent, 'MediaIsland');

      const result = IslandComponent({ value: 42, 'client:media': '(max-width: 768px)' });

      expect(result.props['data-strategy']).toBe('media');
      expect(result.props['data-media']).toBe('(max-width: 768px)');
    });

    test('island wrapper strips hydration props from child props', () => {
      const TestComponent = (props: { data: string }) => null;
      const IslandComponent = createIsland(TestComponent, 'StripTest');

      const result = IslandComponent({
        data: 'test',
        'client:load': true,
        'client:idle': true,
      });

      const propsString = result.props['data-props'];
      const parsedProps = JSON.parse(propsString);

      expect(parsedProps).toEqual({ data: 'test' });
      expect(parsedProps['client:load']).toBeUndefined();
    });
  });

  describe('initializeIslands', () => {
    test('returns early when document is undefined', () => {
      const originalDocument = (globalThis as any).document;
      delete (globalThis as any).document;

      // Should not throw
      expect(() => initializeIslands()).not.toThrow();

      if (originalDocument) {
        (globalThis as any).document = originalDocument;
      }
    });

    test('adds DOMContentLoaded listener when document is loading', () => {
      let listenerAdded = false;
      let eventType = '';

      (globalThis as any).document = {
        readyState: 'loading',
        addEventListener: (type: string, cb: () => void) => {
          listenerAdded = true;
          eventType = type;
        },
      };

      initializeIslands();

      expect(listenerAdded).toBe(true);
      expect(eventType).toBe('DOMContentLoaded');

      delete (globalThis as any).document;
    });

    test('calls hydrateIslands immediately when document is already loaded', () => {
      (globalThis as any).document = {
        readyState: 'complete',
        querySelectorAll: () => [],
      };

      // Should not throw - hydrateIslands will be called but querySelectorAll returns empty
      expect(() => initializeIslands()).not.toThrow();

      delete (globalThis as any).document;
    });
  });

  describe('hydrateIslands', () => {
    const { hydrateIslands } = require('./islands');

    beforeEach(() => {
      cleanupIslands();
      resetIslandCounter();
    });

    test('skips islands without required attributes', async () => {
      const mockElementNoId = {
        getAttribute: (name: string) => {
          const attrs: Record<string, string | null> = {
            'data-island': null,
            'data-component': 'SomeComponent',
            'data-props': '{}',
            'data-strategy': 'load',
            'data-media': null,
          };
          return attrs[name] ?? null;
        },
      };

      const mockElementNoComponent = {
        getAttribute: (name: string) => {
          const attrs: Record<string, string | null> = {
            'data-island': 'island-2',
            'data-component': null,
            'data-props': '{}',
            'data-strategy': 'load',
            'data-media': null,
          };
          return attrs[name] ?? null;
        },
      };

      (globalThis as any).document = {
        querySelectorAll: () => [mockElementNoId, mockElementNoComponent],
      };

      // Should not throw - just skip invalid islands
      await hydrateIslands();

      delete (globalThis as any).document;
    });

    test('warns when island component is not found', async () => {
      const originalWarn = console.warn;
      let warnCalled = false;
      let warnMessage = '';
      console.warn = (msg: string) => {
        warnCalled = true;
        warnMessage = msg;
      };

      const mockElement = {
        getAttribute: (name: string) => {
          const attrs: Record<string, string | null> = {
            'data-island': 'missing-component-island',
            'data-component': 'NonExistentComponent',
            'data-props': '{}',
            'data-strategy': 'load',
            'data-media': null,
          };
          return attrs[name] ?? null;
        },
      };

      (globalThis as any).document = {
        querySelectorAll: () => [mockElement],
      };

      await hydrateIslands();

      expect(warnCalled).toBe(true);
      expect(warnMessage).toContain('NonExistentComponent');

      console.warn = originalWarn;
      delete (globalThis as any).document;
    });

    test('registers and sets up hydration trigger for visible strategy', async () => {
      const VisibleComponent = () => null;
      registerIslandComponent('VisibleComponent', VisibleComponent);

      const mockElement = {
        getAttribute: (name: string) => {
          const attrs: Record<string, string | null> = {
            'data-island': 'visible-island',
            'data-component': 'VisibleComponent',
            'data-props': JSON.stringify({ value: 42 }),
            'data-strategy': 'visible', // Use visible strategy to avoid immediate hydration
            'data-media': null,
          };
          return attrs[name] ?? null;
        },
      };

      (globalThis as any).document = {
        querySelectorAll: () => [mockElement],
      };

      // Mock IntersectionObserver - don't trigger intersection
      const originalIO = (globalThis as any).IntersectionObserver;
      (globalThis as any).IntersectionObserver = class {
        observe() {}
        disconnect() {}
      };

      await hydrateIslands();

      // Verify island was registered
      const island = islandRegistry.get('visible-island');
      expect(island).toBeDefined();
      expect(island?.strategy).toBe('visible');
      expect(island?.props).toEqual({ value: 42 });
      expect(island?.hydrated).toBe(false);

      delete (globalThis as any).document;
      (globalThis as any).IntersectionObserver = originalIO;
    });

    test('registers island with idle strategy', async () => {
      const IdleComponent = () => null;
      registerIslandComponent('IdleComponent', IdleComponent);

      const mockElement = {
        getAttribute: (name: string) => {
          const attrs: Record<string, string | null> = {
            'data-island': 'idle-island',
            'data-component': 'IdleComponent',
            'data-props': '{}',
            'data-strategy': 'idle',
            'data-media': null,
          };
          return attrs[name] ?? null;
        },
      };

      (globalThis as any).document = {
        querySelectorAll: () => [mockElement],
      };

      // Mock requestIdleCallback to not execute immediately
      const originalWindow = (globalThis as any).window;
      const originalRIC = (globalThis as any).requestIdleCallback;
      const originalCIC = (globalThis as any).cancelIdleCallback;

      (globalThis as any).window = {
        ...(originalWindow || {}),
        requestIdleCallback: () => 999,
        cancelIdleCallback: () => {},
      };
      (globalThis as any).requestIdleCallback = () => 999;
      (globalThis as any).cancelIdleCallback = () => {};

      await hydrateIslands();

      // Verify island was registered
      const island = islandRegistry.get('idle-island');
      expect(island).toBeDefined();
      expect(island?.strategy).toBe('idle');

      delete (globalThis as any).document;
      if (originalWindow) {
        (globalThis as any).window = originalWindow;
      } else {
        delete (globalThis as any).window;
      }
      if (originalRIC) {
        (globalThis as any).requestIdleCallback = originalRIC;
      } else {
        delete (globalThis as any).requestIdleCallback;
      }
      if (originalCIC) {
        (globalThis as any).cancelIdleCallback = originalCIC;
      } else {
        delete (globalThis as any).cancelIdleCallback;
      }
    });

    test('handles islands with none strategy', async () => {
      const NoneComponent = () => null;
      registerIslandComponent('NoneComponent', NoneComponent);

      const mockElement = {
        getAttribute: (name: string) => {
          const attrs: Record<string, string | null> = {
            'data-island': 'none-island',
            'data-component': 'NoneComponent',
            'data-props': null, // No props
            'data-strategy': 'none',
            'data-media': null,
          };
          return attrs[name] ?? null;
        },
      };

      (globalThis as any).document = {
        querySelectorAll: () => [mockElement],
      };

      await hydrateIslands();

      // Verify island was registered
      const island = islandRegistry.get('none-island');
      expect(island).toBeDefined();
      expect(island?.strategy).toBe('none');
      expect(island?.props).toEqual({});

      delete (globalThis as any).document;
    });

    test('handles islands with media strategy that does not match', async () => {
      const MediaComponent = () => null;
      registerIslandComponent('MediaComponent', MediaComponent);

      const mockElement = {
        getAttribute: (name: string) => {
          const attrs: Record<string, string | null> = {
            'data-island': 'media-island',
            'data-component': 'MediaComponent',
            'data-props': '{}',
            'data-strategy': 'media',
            'data-media': '(min-width: 768px)',
          };
          return attrs[name] ?? null;
        },
      };

      (globalThis as any).document = {
        querySelectorAll: () => [mockElement],
      };

      // Mock matchMedia for media strategy - does not match
      (globalThis as any).window = {
        matchMedia: (query: string) => ({
          matches: false,
          addEventListener: () => {},
          removeEventListener: () => {},
        }),
      };

      await hydrateIslands();

      // Verify island was registered but not hydrated
      const island = islandRegistry.get('media-island');
      expect(island).toBeDefined();
      expect(island?.strategy).toBe('media');
      expect(island?.hydrated).toBe(false);

      delete (globalThis as any).document;
      delete (globalThis as any).window;
    });

    test('processes multiple islands', async () => {
      const ComponentA = () => null;
      const ComponentB = () => null;
      registerIslandComponent('ComponentA', ComponentA);
      registerIslandComponent('ComponentB', ComponentB);

      const mockElement1 = {
        getAttribute: (name: string) => {
          const attrs: Record<string, string | null> = {
            'data-island': 'island-a',
            'data-component': 'ComponentA',
            'data-props': '{"a": 1}',
            'data-strategy': 'none',
            'data-media': null,
          };
          return attrs[name] ?? null;
        },
      };

      const mockElement2 = {
        getAttribute: (name: string) => {
          const attrs: Record<string, string | null> = {
            'data-island': 'island-b',
            'data-component': 'ComponentB',
            'data-props': '{"b": 2}',
            'data-strategy': 'none',
            'data-media': null,
          };
          return attrs[name] ?? null;
        },
      };

      (globalThis as any).document = {
        querySelectorAll: () => [mockElement1, mockElement2],
      };

      await hydrateIslands();

      expect(islandRegistry.get('island-a')).toBeDefined();
      expect(islandRegistry.get('island-b')).toBeDefined();
      expect(islandRegistry.getAll()).toHaveLength(2);

      delete (globalThis as any).document;
    });

    test('hydration callback skips hydration when island is already hydrated', async () => {
      const SkipHydrationComponent = () => null;
      registerIslandComponent('SkipHydrationComponent', SkipHydrationComponent);

      const mockElement = {
        getAttribute: (name: string) => {
          const attrs: Record<string, string | null> = {
            'data-island': 'skip-hydration-island',
            'data-component': 'SkipHydrationComponent',
            'data-props': '{}',
            'data-strategy': 'visible',
            'data-media': null,
          };
          return attrs[name] ?? null;
        },
      };

      (globalThis as any).document = {
        querySelectorAll: () => [mockElement],
      };

      // Store the intersection callback so we can trigger it
      let intersectionCallback: IntersectionObserverCallback | null = null;
      (globalThis as any).IntersectionObserver = class {
        callback: IntersectionObserverCallback;
        constructor(cb: IntersectionObserverCallback) {
          this.callback = cb;
          intersectionCallback = cb;
        }
        observe() {}
        disconnect() {}
      };

      await hydrateIslands();

      // The island should be registered but not yet hydrated
      const island = islandRegistry.get('skip-hydration-island');
      expect(island).toBeDefined();
      expect(island?.hydrated).toBe(false);

      // Manually mark as hydrated first
      islandRegistry.markHydrated('skip-hydration-island');

      // Now trigger the intersection - it should early return because already hydrated
      if (intersectionCallback) {
        // This should not throw because it returns early before calling hydrateRoot
        expect(() => {
          intersectionCallback!([{ isIntersecting: true }] as IntersectionObserverEntry[], {} as IntersectionObserver);
        }).not.toThrow();
      }

      delete (globalThis as any).document;
    });

    test('hydration callback skips if island is already hydrated', async () => {
      const AlreadyHydratedComponent = () => null;
      registerIslandComponent('AlreadyHydratedComponent', AlreadyHydratedComponent);

      const mockElement = {
        getAttribute: (name: string) => {
          const attrs: Record<string, string | null> = {
            'data-island': 'already-hydrated-island',
            'data-component': 'AlreadyHydratedComponent',
            'data-props': '{}',
            'data-strategy': 'visible',
            'data-media': null,
          };
          return attrs[name] ?? null;
        },
      };

      (globalThis as any).document = {
        querySelectorAll: () => [mockElement],
      };

      // Store the intersection callback so we can trigger it multiple times
      let intersectionCallback: IntersectionObserverCallback | null = null;
      let callCount = 0;
      (globalThis as any).IntersectionObserver = class {
        callback: IntersectionObserverCallback;
        constructor(cb: IntersectionObserverCallback) {
          this.callback = cb;
          intersectionCallback = cb;
        }
        observe() {}
        disconnect() {}
      };

      await hydrateIslands();

      // Manually mark the island as hydrated to test the skip logic
      islandRegistry.markHydrated('already-hydrated-island');

      // Now trigger the intersection - the callback should early return
      // because the island is already hydrated
      if (intersectionCallback) {
        // This should not throw even though hydrateRoot would fail
        // because the callback should return early
        expect(() => {
          intersectionCallback!([{ isIntersecting: true }] as IntersectionObserverEntry[], {} as IntersectionObserver);
        }).not.toThrow();
      }

      delete (globalThis as any).document;
    });
  });
});
