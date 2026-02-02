/**
 * @oreo/client - Islands Architecture
 *
 * Selective hydration for interactive components.
 * Static content stays static, only islands get hydrated.
 */

import type { ComponentType } from 'react';
import type { HydrationStrategy } from '@oreo/core';
import {
  parseHydrationDirective,
  createHydrationTrigger,
  stripHydrationProps,
  generateIslandId,
  type HydrationProps,
} from './hydration';

/**
 * Island registration.
 */
export interface IslandRegistration {
  id: string;
  component: ComponentType<any>;
  props: Record<string, unknown>;
  strategy: HydrationStrategy;
  media?: string;
  element: Element;
  hydrated: boolean;
}

/**
 * Island registry - tracks all islands on the page.
 */
class IslandRegistry {
  private islands = new Map<string, IslandRegistration>();
  private cleanups = new Map<string, () => void>();

  /**
   * Register an island for hydration.
   */
  register(
    id: string,
    component: ComponentType<any>,
    props: Record<string, unknown>,
    strategy: HydrationStrategy,
    element: Element,
    media?: string
  ): void {
    this.islands.set(id, {
      id,
      component,
      props,
      strategy,
      media,
      element,
      hydrated: false,
    });
  }

  /**
   * Get an island by ID.
   */
  get(id: string): IslandRegistration | undefined {
    return this.islands.get(id);
  }

  /**
   * Mark an island as hydrated.
   */
  markHydrated(id: string): void {
    const island = this.islands.get(id);
    if (island) {
      island.hydrated = true;
    }
  }

  /**
   * Check if an island is hydrated.
   */
  isHydrated(id: string): boolean {
    return this.islands.get(id)?.hydrated ?? false;
  }

  /**
   * Set cleanup function for an island.
   */
  setCleanup(id: string, cleanup: () => void): void {
    this.cleanups.set(id, cleanup);
  }

  /**
   * Cleanup an island.
   */
  cleanup(id: string): void {
    const cleanupFn = this.cleanups.get(id);
    if (cleanupFn) {
      cleanupFn();
      this.cleanups.delete(id);
    }
    this.islands.delete(id);
  }

  /**
   * Cleanup all islands.
   */
  cleanupAll(): void {
    for (const id of this.islands.keys()) {
      this.cleanup(id);
    }
  }

  /**
   * Get all islands.
   */
  getAll(): IslandRegistration[] {
    return Array.from(this.islands.values());
  }

  /**
   * Get islands by strategy.
   */
  getByStrategy(strategy: HydrationStrategy): IslandRegistration[] {
    return this.getAll().filter((i) => i.strategy === strategy);
  }

  /**
   * Get pending (not hydrated) islands.
   */
  getPending(): IslandRegistration[] {
    return this.getAll().filter((i) => !i.hydrated);
  }
}

/**
 * Global island registry.
 */
export const islandRegistry = new IslandRegistry();

/**
 * Hydrate all islands on the page.
 */
export async function hydrateIslands(): Promise<void> {
  // Dynamic import to avoid SSR issues
  const { hydrateRoot } = await import('react-dom/client');
  const { createElement } = await import('react');

  // Find all island markers in the DOM
  const islandElements = document.querySelectorAll('[data-island]');

  for (const element of islandElements) {
    const islandId = element.getAttribute('data-island');
    const componentName = element.getAttribute('data-component');
    const propsJson = element.getAttribute('data-props');
    const strategy = (element.getAttribute('data-strategy') || 'load') as HydrationStrategy;
    const media = element.getAttribute('data-media') || undefined;

    if (!islandId || !componentName) continue;

    // Get component from global registry
    const component = getIslandComponent(componentName);
    if (!component) {
      console.warn(`Island component not found: ${componentName}`);
      continue;
    }

    // Parse props
    const props = propsJson ? JSON.parse(propsJson) : {};

    // Register island
    islandRegistry.register(islandId, component, props, strategy, element, media);

    // Create hydration trigger
    const cleanup = createHydrationTrigger(
      strategy,
      element,
      () => {
        if (islandRegistry.isHydrated(islandId)) return;

        // Hydrate the island
        const root = hydrateRoot(element, createElement(component, props));
        islandRegistry.markHydrated(islandId);

        // Store cleanup
        islandRegistry.setCleanup(islandId, () => root.unmount());
      },
      media
    );

    islandRegistry.setCleanup(islandId, cleanup);
  }
}

/**
 * Island component registry.
 */
const componentRegistry = new Map<string, ComponentType<any>>();

/**
 * Register an island component.
 */
export function registerIslandComponent(name: string, component: ComponentType<any>): void {
  componentRegistry.set(name, component);
}

/**
 * Get an island component by name.
 */
export function getIslandComponent(name: string): ComponentType<any> | undefined {
  return componentRegistry.get(name);
}

/**
 * Register multiple island components.
 */
export function registerIslandComponents(
  components: Record<string, ComponentType<any>>
): void {
  for (const [name, component] of Object.entries(components)) {
    registerIslandComponent(name, component);
  }
}

/**
 * Create an island wrapper component.
 * This is used during SSR to mark components for hydration.
 */
export function createIsland<P extends Record<string, unknown>>(
  component: ComponentType<P>,
  name: string
): ComponentType<P & HydrationProps> {
  // Register the component
  registerIslandComponent(name, component);

  // Return wrapper component
  return function IslandWrapper(props: P & HydrationProps) {
    const { strategy, media } = parseHydrationDirective(props);
    const cleanProps = stripHydrationProps(props);
    const islandId = generateIslandId();

    // During SSR, we'll render the component with data attributes
    // The actual hydration happens on the client

    return {
      type: 'div',
      props: {
        'data-island': islandId,
        'data-component': name,
        'data-props': JSON.stringify(cleanProps),
        'data-strategy': strategy,
        'data-media': media || undefined,
        children: {
          type: component,
          props: cleanProps,
        },
      },
    } as any;
  };
}

/**
 * Auto-initialize islands on DOM ready.
 */
export function initializeIslands(): void {
  if (typeof document === 'undefined') return;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => hydrateIslands());
  } else {
    hydrateIslands();
  }
}

/**
 * Cleanup all islands (for SPA navigation).
 */
export function cleanupIslands(): void {
  islandRegistry.cleanupAll();
}
