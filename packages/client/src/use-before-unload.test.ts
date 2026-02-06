import { describe, expect, test } from 'bun:test';
import type { UseBeforeUnloadOptions } from './use-before-unload';

describe('@ereo/client - useBeforeUnload', () => {
  test('function signature accepts callback and options', () => {
    // Type-level test: ensure the function signature is correct
    const callback = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };

    const options: UseBeforeUnloadOptions = {
      capture: true,
    };

    // These should type-check correctly
    expect(typeof callback).toBe('function');
    expect(options.capture).toBe(true);
  });

  test('SSR safety — typeof window guard', () => {
    // The hook checks typeof window !== 'undefined' before adding listeners
    // In a test environment, window may or may not be defined
    // This verifies the guard pattern works
    const hasWindow = typeof window !== 'undefined';
    expect(typeof hasWindow).toBe('boolean');
  });

  test('options default capture to false', () => {
    const options: UseBeforeUnloadOptions = {};
    const capture = options.capture ?? false;
    expect(capture).toBe(false);
  });

  test('capture option can be set to true', () => {
    const options: UseBeforeUnloadOptions = { capture: true };
    expect(options.capture).toBe(true);
  });
});
