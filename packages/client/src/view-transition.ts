/**
 * @ereo/client - View Transitions API
 *
 * Integration with the browser View Transitions API for smooth
 * animated transitions between pages during SPA navigation.
 *
 * @see https://developer.mozilla.org/en-US/docs/Web/API/View_Transitions_API
 */

import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { onNavigate, type NavigationEvent } from './navigation';

// ============================================================================
// Types
// ============================================================================

/**
 * A ViewTransition object returned by document.startViewTransition().
 * Mirrors the browser's ViewTransition interface.
 */
export interface ViewTransition {
  /** Promise that resolves when the transition animation finishes. */
  finished: Promise<void>;
  /** Promise that resolves when the new view is ready. */
  ready: Promise<void>;
  /** Promise that resolves when the old view snapshot is captured. */
  updateCallbackDone: Promise<void>;
  /** Skip the transition animation. */
  skipTransition: () => void;
}

/**
 * Options for starting a view transition.
 */
export interface ViewTransitionOptions {
  /**
   * Custom CSS class to add to the document element during the transition.
   * Useful for scoping transition animations to specific navigations.
   */
  className?: string;
}

/**
 * State of the current view transition.
 */
export interface ViewTransitionState {
  /** Whether a view transition is currently in progress. */
  isTransitioning: boolean;
  /** The current ViewTransition object, if any. */
  currentTransition: ViewTransition | null;
}

// ============================================================================
// Feature Detection
// ============================================================================

/**
 * Check if the View Transitions API is supported.
 */
export function isViewTransitionSupported(): boolean {
  return (
    typeof document !== 'undefined' &&
    'startViewTransition' in document
  );
}

// ============================================================================
// Core Transition Function
// ============================================================================

/**
 * Start a view transition wrapping the given update callback.
 * Falls back to executing the callback directly if the API is not supported.
 *
 * @param callback - Function that updates the DOM (e.g., navigation)
 * @param options - Optional transition options
 * @returns A ViewTransition object, or null if the API is not supported
 *
 * @example
 * ```typescript
 * import { startViewTransition } from '@ereo/client';
 *
 * startViewTransition(() => {
 *   // Update the DOM here
 *   navigate('/about');
 * });
 * ```
 *
 * @example
 * ```typescript
 * // With custom animation class
 * const transition = startViewTransition(
 *   () => navigate('/dashboard'),
 *   { className: 'slide-left' }
 * );
 *
 * if (transition) {
 *   await transition.finished;
 *   console.log('Transition complete');
 * }
 * ```
 */
export function startViewTransition(
  callback: () => void | Promise<void>,
  options?: ViewTransitionOptions
): ViewTransition | null {
  if (!isViewTransitionSupported()) {
    // Fallback: just run the callback directly
    const result = callback();
    if (result && typeof (result as Promise<void>).then === 'function') {
      (result as Promise<void>).catch(() => {});
    }
    return null;
  }

  // Add custom class if provided
  if (options?.className) {
    document.documentElement.classList.add(options.className);
  }

  const transition = (document as any).startViewTransition(callback) as ViewTransition;

  // Clean up custom class after transition
  if (options?.className) {
    const className = options.className;
    transition.finished.then(() => {
      document.documentElement.classList.remove(className);
    }).catch(() => {
      document.documentElement.classList.remove(className);
    });
  }

  return transition;
}

// ============================================================================
// React Context & Hook
// ============================================================================

/**
 * Context value for view transition state.
 */
export interface ViewTransitionContextValue {
  isTransitioning: boolean;
  currentTransition: ViewTransition | null;
}

/**
 * Context for view transition state.
 */
export const ViewTransitionContext = createContext<ViewTransitionContextValue>({
  isTransitioning: false,
  currentTransition: null,
});

/**
 * Hook to get the current view transition state.
 *
 * @returns The current transition state
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { isTransitioning } = useViewTransitionState();
 *
 *   return (
 *     <div style={{ opacity: isTransitioning ? 0.5 : 1 }}>
 *       Content
 *     </div>
 *   );
 * }
 * ```
 */
export function useViewTransitionState(): ViewTransitionState {
  const context = useContext(ViewTransitionContext);
  return {
    isTransitioning: context.isTransitioning,
    currentTransition: context.currentTransition,
  };
}

// ============================================================================
// Navigation Integration
// ============================================================================

/** Global flag: when true, navigations will use view transitions. */
let viewTransitionsEnabled = false;

/** Global transition options. */
let globalTransitionOptions: ViewTransitionOptions | undefined;

/**
 * Enable view transitions globally for all navigations.
 * Call this in your app's initialization.
 *
 * @param options - Optional transition options applied to all navigations
 *
 * @example
 * ```typescript
 * import { enableViewTransitions } from '@ereo/client';
 *
 * // Enable for all navigations
 * enableViewTransitions();
 * ```
 */
export function enableViewTransitions(options?: ViewTransitionOptions): void {
  viewTransitionsEnabled = true;
  globalTransitionOptions = options;
}

/**
 * Disable view transitions globally.
 */
export function disableViewTransitions(): void {
  viewTransitionsEnabled = false;
  globalTransitionOptions = undefined;
}

/**
 * Check if view transitions are currently enabled.
 */
export function areViewTransitionsEnabled(): boolean {
  return viewTransitionsEnabled;
}

/**
 * Reset view transitions state (for testing).
 */
export function resetViewTransitions(): void {
  viewTransitionsEnabled = false;
  globalTransitionOptions = undefined;
}
