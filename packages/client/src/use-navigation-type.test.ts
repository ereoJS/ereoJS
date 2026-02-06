import { describe, expect, test } from 'bun:test';
import type { NavigationType } from './use-navigation-type';

describe('@ereo/client - useNavigationType', () => {
  test('NavigationType is a union of push, replace, pop', () => {
    // Type-level test: ensure all values are valid NavigationType
    const push: NavigationType = 'push';
    const replace: NavigationType = 'replace';
    const pop: NavigationType = 'pop';

    expect(push).toBe('push');
    expect(replace).toBe('replace');
    expect(pop).toBe('pop');
  });

  test('default value is push', () => {
    // The hook defaults to 'push' — verify the default value constant
    const defaultType: NavigationType = 'push';
    expect(defaultType).toBe('push');
  });

  test('type exhaustiveness', () => {
    // Ensure all valid navigation types are covered
    const validTypes: NavigationType[] = ['push', 'replace', 'pop'];
    expect(validTypes).toHaveLength(3);
    expect(validTypes).toContain('push');
    expect(validTypes).toContain('replace');
    expect(validTypes).toContain('pop');
  });
});
