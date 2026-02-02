import { describe, expect, test, beforeEach } from 'bun:test';
import {
  parseHydrationDirective,
  stripHydrationProps,
  generateIslandId,
  resetIslandCounter,
  getIslandCount,
  shouldHydrate,
} from './hydration';

describe('@oreo/client - Hydration', () => {
  beforeEach(() => {
    resetIslandCounter();
  });

  describe('parseHydrationDirective', () => {
    test('parses client:load', () => {
      const result = parseHydrationDirective({ 'client:load': true });
      expect(result.strategy).toBe('load');
    });

    test('parses client:idle', () => {
      const result = parseHydrationDirective({ 'client:idle': true });
      expect(result.strategy).toBe('idle');
    });

    test('parses client:visible', () => {
      const result = parseHydrationDirective({ 'client:visible': true });
      expect(result.strategy).toBe('visible');
    });

    test('parses client:media with value', () => {
      const result = parseHydrationDirective({ 'client:media': '(max-width: 768px)' });
      expect(result.strategy).toBe('media');
      expect(result.media).toBe('(max-width: 768px)');
    });

    test('parses client:only as load', () => {
      const result = parseHydrationDirective({ 'client:only': true });
      expect(result.strategy).toBe('load');
    });

    test('returns none for no directives', () => {
      const result = parseHydrationDirective({});
      expect(result.strategy).toBe('none');
    });
  });

  describe('stripHydrationProps', () => {
    test('removes hydration props', () => {
      const props = {
        'client:load': true,
        className: 'test',
        onClick: () => {},
      };

      const stripped = stripHydrationProps(props);

      expect(stripped).not.toHaveProperty('client:load');
      expect(stripped).toHaveProperty('className');
      expect(stripped).toHaveProperty('onClick');
    });

    test('removes all hydration props', () => {
      const props = {
        'client:load': true,
        'client:idle': true,
        'client:visible': true,
        'client:media': '(max-width: 768px)',
        'client:only': true,
        otherProp: 'value',
      };

      const stripped = stripHydrationProps(props);

      expect(Object.keys(stripped)).toEqual(['otherProp']);
    });
  });

  describe('generateIslandId', () => {
    test('generates unique IDs', () => {
      const id1 = generateIslandId();
      const id2 = generateIslandId();

      expect(id1).not.toBe(id2);
      expect(id1).toMatch(/^island-\d+$/);
    });

    test('increments counter', () => {
      generateIslandId();
      generateIslandId();
      generateIslandId();

      expect(getIslandCount()).toBe(3);
    });
  });

  describe('resetIslandCounter', () => {
    test('resets counter to 0', () => {
      generateIslandId();
      generateIslandId();

      resetIslandCounter();

      expect(getIslandCount()).toBe(0);
    });
  });

  describe('shouldHydrate', () => {
    test('returns true for load strategy', () => {
      expect(shouldHydrate('load')).toBe(true);
    });

    test('returns false for idle strategy (deferred)', () => {
      expect(shouldHydrate('idle')).toBe(false);
    });

    test('returns false for visible strategy (deferred)', () => {
      expect(shouldHydrate('visible')).toBe(false);
    });

    test('returns false for none strategy', () => {
      expect(shouldHydrate('none')).toBe(false);
    });
  });
});
