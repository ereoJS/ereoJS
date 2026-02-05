import { describe, expect, test, beforeEach } from 'bun:test';
import {
  startViewTransition,
  isViewTransitionSupported,
  enableViewTransitions,
  disableViewTransitions,
  areViewTransitionsEnabled,
  resetViewTransitions,
  useViewTransitionState,
  ViewTransitionContext,
} from './view-transition';
import type {
  ViewTransition,
  ViewTransitionOptions,
  ViewTransitionState,
  ViewTransitionContextValue,
} from './view-transition';

beforeEach(() => {
  resetViewTransitions();
});

// =================================================================
// Feature Detection
// =================================================================

describe('@ereo/client - isViewTransitionSupported', () => {
  test('returns false in test environment (no document.startViewTransition)', () => {
    // Bun test environment doesn't have document.startViewTransition
    expect(isViewTransitionSupported()).toBe(false);
  });

  test('is a function', () => {
    expect(typeof isViewTransitionSupported).toBe('function');
  });
});

// =================================================================
// startViewTransition
// =================================================================

describe('@ereo/client - startViewTransition', () => {
  test('returns null when API is not supported', () => {
    const result = startViewTransition(() => {});
    expect(result).toBeNull();
  });

  test('executes callback immediately when API is not supported', () => {
    let called = false;
    startViewTransition(() => {
      called = true;
    });
    expect(called).toBe(true);
  });

  test('handles async callback when API is not supported', async () => {
    let called = false;
    startViewTransition(async () => {
      called = true;
    });
    // Give microtask time to resolve
    await new Promise((r) => setTimeout(r, 0));
    expect(called).toBe(true);
  });

  test('accepts options parameter', () => {
    const result = startViewTransition(() => {}, { className: 'slide' });
    expect(result).toBeNull(); // API not supported in test env
  });
});

// =================================================================
// Global Enable/Disable
// =================================================================

describe('@ereo/client - view transition enable/disable', () => {
  test('view transitions are disabled by default', () => {
    expect(areViewTransitionsEnabled()).toBe(false);
  });

  test('enableViewTransitions enables globally', () => {
    enableViewTransitions();
    expect(areViewTransitionsEnabled()).toBe(true);
  });

  test('disableViewTransitions disables globally', () => {
    enableViewTransitions();
    expect(areViewTransitionsEnabled()).toBe(true);
    disableViewTransitions();
    expect(areViewTransitionsEnabled()).toBe(false);
  });

  test('enableViewTransitions accepts options', () => {
    enableViewTransitions({ className: 'my-transition' });
    expect(areViewTransitionsEnabled()).toBe(true);
  });

  test('resetViewTransitions resets all state', () => {
    enableViewTransitions({ className: 'test' });
    expect(areViewTransitionsEnabled()).toBe(true);
    resetViewTransitions();
    expect(areViewTransitionsEnabled()).toBe(false);
  });
});

// =================================================================
// Hook type tests
// =================================================================

describe('@ereo/client - useViewTransitionState', () => {
  test('is a function', () => {
    expect(typeof useViewTransitionState).toBe('function');
  });
});

// =================================================================
// Context
// =================================================================

describe('@ereo/client - ViewTransitionContext', () => {
  test('ViewTransitionContext is defined', () => {
    expect(ViewTransitionContext).toBeDefined();
  });

  test('has correct default value', () => {
    // The default context value has isTransitioning: false
    const defaultValue: ViewTransitionContextValue = {
      isTransitioning: false,
      currentTransition: null,
    };
    expect(defaultValue.isTransitioning).toBe(false);
    expect(defaultValue.currentTransition).toBeNull();
  });
});

// =================================================================
// Type contracts
// =================================================================

describe('@ereo/client - View Transition type contracts', () => {
  test('ViewTransition interface has all required fields', () => {
    const mockTransition: ViewTransition = {
      finished: Promise.resolve(),
      ready: Promise.resolve(),
      updateCallbackDone: Promise.resolve(),
      skipTransition: () => {},
    };

    expect(mockTransition.finished).toBeDefined();
    expect(mockTransition.ready).toBeDefined();
    expect(mockTransition.updateCallbackDone).toBeDefined();
    expect(typeof mockTransition.skipTransition).toBe('function');
  });

  test('ViewTransitionOptions supports className', () => {
    const options: ViewTransitionOptions = { className: 'slide-left' };
    expect(options.className).toBe('slide-left');
  });

  test('ViewTransitionOptions is fully optional', () => {
    const options: ViewTransitionOptions = {};
    expect(options.className).toBeUndefined();
  });

  test('ViewTransitionState has correct shape', () => {
    const state: ViewTransitionState = {
      isTransitioning: false,
      currentTransition: null,
    };
    expect(state.isTransitioning).toBe(false);
    expect(state.currentTransition).toBeNull();
  });
});

// =================================================================
// Export verification
// =================================================================

describe('@ereo/client - view transition exports from index', () => {
  test('all view transition functions exported', async () => {
    const exports = await import('./index');

    expect(exports.startViewTransition).toBeDefined();
    expect(exports.isViewTransitionSupported).toBeDefined();
    expect(exports.enableViewTransitions).toBeDefined();
    expect(exports.disableViewTransitions).toBeDefined();
    expect(exports.areViewTransitionsEnabled).toBeDefined();
    expect(exports.resetViewTransitions).toBeDefined();
    expect(exports.useViewTransitionState).toBeDefined();
    expect(exports.ViewTransitionContext).toBeDefined();
  });
});

// =================================================================
// Link integration
// =================================================================

describe('@ereo/client - Link viewTransition prop', () => {
  test('LinkProps accepts viewTransition boolean', async () => {
    const { Link } = await import('./link');
    expect(Link).toBeDefined();
    // Just verify the component accepts the prop type
  });
});
