import { describe, expect, test, beforeEach, afterEach } from 'bun:test';

// ─── DOM Mocking Infrastructure ─────────────────────────────────────────────
// Bun tests run without DOM by default. We create minimal mocks to test
// the a11y functions that depend on document/window.

function createMockElement(overrides: Partial<HTMLElement> = {}): any {
  return {
    focus: () => {},
    scrollIntoView: () => {},
    textContent: '',
    setAttribute: function (key: string, val: string) { (this as any)[key] = val; },
    getAttribute: function (key: string) { return (this as any)[key] ?? null; },
    remove: function () {},
    addEventListener: function (_event: string, _handler: any) {},
    removeEventListener: function (_event: string, _handler: any) {},
    style: {} as any,
    querySelectorAll: () => [],
    querySelector: () => null,
    ...overrides,
  };
}

function createMockDocument() {
  const elements: any[] = [];
  const body = createMockElement({
    appendChild: (el: any) => { elements.push(el); return el; },
  });
  return {
    createElement: (tag: string) => createMockElement({ tagName: tag }),
    querySelectorAll: (_sel: string) => [],
    querySelector: (_sel: string) => null,
    body,
    activeElement: null as any,
    _elements: elements,
  };
}

function createMockWindow() {
  return {
    matchMedia: (query: string) => ({
      matches: false,
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    }),
    navigator: {
      userAgent: 'Mozilla/5.0 TestBrowser',
    },
  };
}

let savedDocument: any;
let savedWindow: any;
let savedRAF: any;

function setupDOM() {
  savedDocument = (globalThis as any).document;
  savedWindow = (globalThis as any).window;
  savedRAF = (globalThis as any).requestAnimationFrame;

  (globalThis as any).document = createMockDocument();
  (globalThis as any).window = createMockWindow();
  (globalThis as any).requestAnimationFrame = (cb: Function) => { cb(); return 0; };
}

function teardownDOM() {
  (globalThis as any).document = savedDocument;
  (globalThis as any).window = savedWindow;
  (globalThis as any).requestAnimationFrame = savedRAF;
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('a11y DOM functions', () => {
  beforeEach(() => {
    setupDOM();
    // Reset module-level liveRegion state by cleaning up
  });

  afterEach(() => {
    // Clean up live region before restoring
    try {
      const { cleanupLiveRegion } = require('./a11y');
      cleanupLiveRegion();
    } catch {}
    teardownDOM();
  });

  describe('focusFirstError', () => {
    test('focuses first element with errors from field refs', () => {
      const { focusFirstError } = require('./a11y');
      let focused = false;
      let scrolledIntoView = false;

      const mockEl = createMockElement({
        focus: () => { focused = true; },
        scrollIntoView: () => { scrolledIntoView = true; },
      });

      const mockForm: any = {
        getFieldRefs: () => new Map([
          ['name', mockEl],
          ['email', null],
        ]),
        getErrors: (path: string) => ({
          get: () => path === 'name' ? ['Required'] : [],
        }),
      };

      focusFirstError(mockForm);
      expect(focused).toBe(true);
      expect(scrolledIntoView).toBe(true);
    });

    test('skips null refs and focuses next valid error field', () => {
      const { focusFirstError } = require('./a11y');
      let focusedField = '';

      const mockForm: any = {
        getFieldRefs: () => new Map([
          ['name', null], // null ref
          ['email', createMockElement({
            focus: () => { focusedField = 'email'; },
            scrollIntoView: () => {},
          })],
        ]),
        getErrors: (path: string) => ({
          get: () => path === 'name' ? ['Required'] : path === 'email' ? ['Invalid'] : [],
        }),
      };

      focusFirstError(mockForm);
      expect(focusedField).toBe('email');
    });

    test('falls back to global query when no field refs', () => {
      const { focusFirstError } = require('./a11y');
      let focused = false;
      const mockEl = createMockElement({
        focus: () => { focused = true; },
        scrollIntoView: () => {},
      });

      (globalThis as any).document.querySelectorAll = (_sel: string) => [mockEl];

      const mockForm: any = {
        getErrors: () => ({ get: () => [] }),
      };

      focusFirstError(mockForm);
      expect(focused).toBe(true);
    });

    test('does nothing when no error elements found', () => {
      const { focusFirstError } = require('./a11y');

      const mockForm: any = {
        getFieldRefs: () => new Map([
          ['name', createMockElement()],
        ]),
        getErrors: () => ({ get: () => [] }),
      };

      // Should not throw
      expect(() => focusFirstError(mockForm)).not.toThrow();
    });

    test('uses _fieldRefs fallback when getFieldRefs is not available', () => {
      const { focusFirstError } = require('./a11y');
      let focused = false;

      const mockEl = createMockElement({
        focus: () => { focused = true; },
        scrollIntoView: () => {},
      });

      const mockForm: any = {
        _fieldRefs: new Map([['name', mockEl]]),
        getErrors: (path: string) => ({
          get: () => path === 'name' ? ['Error'] : [],
        }),
      };

      focusFirstError(mockForm);
      expect(focused).toBe(true);
    });
  });

  describe('focusField', () => {
    test('focuses element found by name attribute', () => {
      const { focusField } = require('./a11y');
      let focused = false;

      const mockEl = createMockElement({
        focus: () => { focused = true; },
        scrollIntoView: () => {},
      });

      (globalThis as any).document.querySelector = (sel: string) => {
        return sel === '[name="email"]' ? mockEl : null;
      };

      focusField('email');
      expect(focused).toBe(true);
    });

    test('does nothing when element not found', () => {
      const { focusField } = require('./a11y');

      (globalThis as any).document.querySelector = () => null;

      // Should not throw
      expect(() => focusField('nonexistent')).not.toThrow();
    });
  });

  describe('trapFocus', () => {
    test('traps tab focus to first and last focusable elements', () => {
      const { trapFocus } = require('./a11y');

      let currentFocus = '';
      const firstEl = createMockElement({
        focus: () => { currentFocus = 'first'; },
      });
      const lastEl = createMockElement({
        focus: () => { currentFocus = 'last'; },
      });

      let keydownHandler: any;
      const container = createMockElement({
        querySelectorAll: () => [firstEl, lastEl],
        addEventListener: (_event: string, handler: any) => {
          keydownHandler = handler;
        },
        removeEventListener: () => {},
      });

      const cleanup = trapFocus(container);
      expect(typeof cleanup).toBe('function');

      // Simulate Tab on last element → should wrap to first
      (globalThis as any).document.activeElement = lastEl;
      keydownHandler({
        key: 'Tab',
        shiftKey: false,
        preventDefault: () => {},
      });
      expect(currentFocus).toBe('first');

      // Simulate Shift+Tab on first element → should wrap to last
      (globalThis as any).document.activeElement = firstEl;
      keydownHandler({
        key: 'Tab',
        shiftKey: true,
        preventDefault: () => {},
      });
      expect(currentFocus).toBe('last');
    });

    test('ignores non-Tab keys', () => {
      const { trapFocus } = require('./a11y');

      let keydownHandler: any;
      const container = createMockElement({
        querySelectorAll: () => [createMockElement()],
        addEventListener: (_event: string, handler: any) => {
          keydownHandler = handler;
        },
        removeEventListener: () => {},
      });

      trapFocus(container);

      // Should not throw for non-Tab keys
      expect(() => {
        keydownHandler({ key: 'Enter', shiftKey: false, preventDefault: () => {} });
        keydownHandler({ key: 'Escape', shiftKey: false, preventDefault: () => {} });
      }).not.toThrow();
    });

    test('handles empty container (no focusable elements)', () => {
      const { trapFocus } = require('./a11y');

      let keydownHandler: any;
      const container = createMockElement({
        querySelectorAll: () => [],
        addEventListener: (_event: string, handler: any) => {
          keydownHandler = handler;
        },
        removeEventListener: () => {},
      });

      trapFocus(container);

      // Should not throw with empty focusable list
      expect(() => {
        keydownHandler({ key: 'Tab', shiftKey: false, preventDefault: () => {} });
      }).not.toThrow();
    });

    test('cleanup removes event listener', () => {
      const { trapFocus } = require('./a11y');

      let removedHandler: any;
      const container = createMockElement({
        querySelectorAll: () => [],
        addEventListener: () => {},
        removeEventListener: (_event: string, handler: any) => {
          removedHandler = handler;
        },
      });

      const cleanup = trapFocus(container);
      cleanup();

      expect(removedHandler).toBeDefined();
    });

    test('tab does not wrap when activeElement is not first or last', () => {
      const { trapFocus } = require('./a11y');

      let preventDefaultCalled = false;
      const firstEl = createMockElement();
      const middleEl = createMockElement();
      const lastEl = createMockElement();

      let keydownHandler: any;
      const container = createMockElement({
        querySelectorAll: () => [firstEl, middleEl, lastEl],
        addEventListener: (_event: string, handler: any) => {
          keydownHandler = handler;
        },
        removeEventListener: () => {},
      });

      trapFocus(container);

      // Active element is middle - no wrapping needed
      (globalThis as any).document.activeElement = middleEl;
      keydownHandler({
        key: 'Tab',
        shiftKey: false,
        preventDefault: () => { preventDefaultCalled = true; },
      });
      expect(preventDefaultCalled).toBe(false);
    });
  });

  describe('announce', () => {
    test('creates live region and sets message', () => {
      const { announce } = require('./a11y');

      announce('Form submitted');

      const doc = (globalThis as any).document;
      // Should have appended a live region to body
      expect(doc._elements.length).toBeGreaterThan(0);

      const region = doc._elements[0];
      expect(region.textContent).toBe('Form submitted');
    });

    test('respects priority parameter', () => {
      const { announce } = require('./a11y');

      announce('Error occurred', 'assertive');

      const doc = (globalThis as any).document;
      const region = doc._elements[0];
      expect(region['aria-live']).toBe('assertive');
    });

    test('reuses existing live region', () => {
      const { announce } = require('./a11y');

      announce('First message');
      announce('Second message');

      const doc = (globalThis as any).document;
      // Should only have created one region
      expect(doc._elements.length).toBe(1);
      expect(doc._elements[0].textContent).toBe('Second message');
    });
  });

  describe('cleanupLiveRegion', () => {
    test('removes the live region element', () => {
      const { announce, cleanupLiveRegion } = require('./a11y');

      announce('Test');

      let removed = false;
      const doc = (globalThis as any).document;
      if (doc._elements[0]) {
        doc._elements[0].remove = () => { removed = true; };
      }

      cleanupLiveRegion();
      expect(removed).toBe(true);
    });

    test('does nothing when no live region exists', () => {
      const { cleanupLiveRegion } = require('./a11y');

      // Should not throw
      expect(() => cleanupLiveRegion()).not.toThrow();
    });
  });

  describe('announceErrors', () => {
    test('announces error messages with default prefix', () => {
      const { announceErrors } = require('./a11y');

      announceErrors({ name: ['Required'], email: ['Invalid email'] });

      const doc = (globalThis as any).document;
      const region = doc._elements[0];
      expect(region.textContent).toContain('Form has errors:');
      expect(region.textContent).toContain('name: Required');
      expect(region.textContent).toContain('email: Invalid email');
    });

    test('uses custom prefix', () => {
      const { announceErrors } = require('./a11y');

      announceErrors(
        { name: ['Required'] },
        { prefix: 'Please fix:' }
      );

      const doc = (globalThis as any).document;
      const region = doc._elements[0];
      expect(region.textContent).toContain('Please fix:');
    });

    test('does nothing when no errors', () => {
      const { announceErrors } = require('./a11y');

      announceErrors({});
      announceErrors({ name: [] });

      const doc = (globalThis as any).document;
      expect(doc._elements.length).toBe(0);
    });
  });

  describe('announceSubmitStatus', () => {
    test('announces submitting status', () => {
      const { announceSubmitStatus } = require('./a11y');

      announceSubmitStatus('submitting');

      const doc = (globalThis as any).document;
      const region = doc._elements[0];
      expect(region.textContent).toContain('Submitting');
    });

    test('announces success status', () => {
      const { announceSubmitStatus } = require('./a11y');

      announceSubmitStatus('success');

      const doc = (globalThis as any).document;
      const region = doc._elements[0];
      expect(region.textContent).toContain('successfully');
    });

    test('announces error status', () => {
      const { announceSubmitStatus } = require('./a11y');

      announceSubmitStatus('error');

      const doc = (globalThis as any).document;
      const region = doc._elements[0];
      expect(region.textContent).toContain('failed');
    });

    test('uses custom messages', () => {
      const { announceSubmitStatus } = require('./a11y');

      announceSubmitStatus('success', { successMessage: 'All good!' });

      const doc = (globalThis as any).document;
      const region = doc._elements[0];
      expect(region.textContent).toBe('All good!');
    });

    test('uses custom submitting message', () => {
      const { announceSubmitStatus, cleanupLiveRegion } = require('./a11y');

      announceSubmitStatus('submitting', { submittingMessage: 'Saving...' });

      const doc = (globalThis as any).document;
      const region = doc._elements[0];
      expect(region.textContent).toBe('Saving...');
      cleanupLiveRegion();
    });

    test('uses custom error message', () => {
      const { announceSubmitStatus, cleanupLiveRegion } = require('./a11y');

      announceSubmitStatus('error', { errorMessage: 'Oops!' });

      const doc = (globalThis as any).document;
      const region = doc._elements[0];
      expect(region.textContent).toBe('Oops!');
      cleanupLiveRegion();
    });

    test('idle status does nothing', () => {
      const { announceSubmitStatus } = require('./a11y');

      announceSubmitStatus('idle');

      const doc = (globalThis as any).document;
      expect(doc._elements.length).toBe(0);
    });
  });

  describe('isScreenReaderActive', () => {
    test('returns false by default', () => {
      const { isScreenReaderActive } = require('./a11y');
      expect(isScreenReaderActive()).toBe(false);
    });

    test('returns true when NVDA in user agent', () => {
      const { isScreenReaderActive } = require('./a11y');

      (globalThis as any).window.navigator.userAgent = 'Mozilla/5.0 NVDA';
      expect(isScreenReaderActive()).toBe(true);
    });

    test('returns true when JAWS in user agent', () => {
      const { isScreenReaderActive } = require('./a11y');

      (globalThis as any).window.navigator.userAgent = 'Mozilla/5.0 JAWS';
      expect(isScreenReaderActive()).toBe(true);
    });

    test('returns true when role=application element exists', () => {
      const { isScreenReaderActive } = require('./a11y');

      (globalThis as any).document.querySelector = (sel: string) => {
        return sel === '[role="application"]' ? createMockElement() : null;
      };
      expect(isScreenReaderActive()).toBe(true);
    });
  });

  describe('prefersReducedMotion', () => {
    test('returns false by default in mock', () => {
      const { prefersReducedMotion } = require('./a11y');
      expect(prefersReducedMotion()).toBe(false);
    });

    test('returns true when prefers-reduced-motion matches', () => {
      const { prefersReducedMotion } = require('./a11y');

      (globalThis as any).window.matchMedia = () => ({ matches: true });
      expect(prefersReducedMotion()).toBe(true);
    });
  });
});

// Test SSR safety (no document/window)
// These tests temporarily remove globals to simulate SSR environment
describe('a11y SSR safety', () => {
  let savedDoc: any;
  let savedWin: any;

  function enterSSR() {
    savedDoc = (globalThis as any).document;
    savedWin = (globalThis as any).window;
    delete (globalThis as any).document;
    delete (globalThis as any).window;
  }

  function exitSSR() {
    (globalThis as any).document = savedDoc;
    (globalThis as any).window = savedWin;
  }

  test('focusFirstError does nothing without document', () => {
    enterSSR();
    try {
      const { focusFirstError } = require('./a11y');
      const mockForm: any = {
        getErrors: () => ({ get: () => [] }),
      };
      expect(() => focusFirstError(mockForm)).not.toThrow();
    } finally {
      exitSSR();
    }
  });

  test('focusField does nothing without document', () => {
    enterSSR();
    try {
      const { focusField } = require('./a11y');
      expect(() => focusField('name')).not.toThrow();
    } finally {
      exitSSR();
    }
  });

  test('trapFocus returns noop without document', () => {
    enterSSR();
    try {
      const { trapFocus } = require('./a11y');
      const cleanup = trapFocus(null as any);
      expect(typeof cleanup).toBe('function');
      expect(() => cleanup()).not.toThrow();
    } finally {
      exitSSR();
    }
  });

  test('prefersReducedMotion returns false without window', () => {
    enterSSR();
    try {
      const { prefersReducedMotion } = require('./a11y');
      expect(prefersReducedMotion()).toBe(false);
    } finally {
      exitSSR();
    }
  });

  test('isScreenReaderActive returns false without window', () => {
    enterSSR();
    try {
      const { isScreenReaderActive } = require('./a11y');
      expect(isScreenReaderActive()).toBe(false);
    } finally {
      exitSSR();
    }
  });
});
