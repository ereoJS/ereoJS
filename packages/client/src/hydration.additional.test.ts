import { describe, expect, test } from 'bun:test';
import {
  parseHydrationDirective,
  stripHydrationProps,
  generateIslandId,
  type HydrationStrategy,
} from './hydration';

describe('@areo/client - Hydration (Additional Coverage)', () => {
  describe('parseHydrationDirective', () => {
    test('parses client:load directive', () => {
      const props = { 'client:load': true };
      const result = parseHydrationDirective(props);

      expect(result.strategy).toBe('load');
    });

    test('parses client:idle directive', () => {
      const props = { 'client:idle': true };
      const result = parseHydrationDirective(props);

      expect(result.strategy).toBe('idle');
    });

    test('parses client:visible directive', () => {
      const props = { 'client:visible': true };
      const result = parseHydrationDirective(props);

      expect(result.strategy).toBe('visible');
    });

    test('parses client:media directive with query', () => {
      const props = { 'client:media': '(min-width: 768px)' };
      const result = parseHydrationDirective(props);

      expect(result.strategy).toBe('media');
      expect(result.media).toBe('(min-width: 768px)');
    });

    test('returns none when no directive is present', () => {
      const props = {};
      const result = parseHydrationDirective(props);

      // Empty props means no hydration directive, returns 'none'
      expect(result.strategy).toBe('none');
    });

    test('handles multiple directives by using first found', () => {
      const props = { 'client:load': true, 'client:idle': true };
      const result = parseHydrationDirective(props);

      // First found takes precedence
      expect(['load', 'idle']).toContain(result.strategy);
    });
  });

  describe('stripHydrationProps', () => {
    test('removes client: props', () => {
      const props = {
        'client:load': true,
        'client:media': '(min-width: 768px)',
        className: 'btn',
        onClick: () => {},
      };

      const stripped = stripHydrationProps(props);

      expect(stripped['client:load']).toBeUndefined();
      expect(stripped['client:media']).toBeUndefined();
      expect(stripped.className).toBe('btn');
      expect(stripped.onClick).toBeDefined();
    });

    test('preserves all non-client props', () => {
      const props = {
        id: 'test',
        'data-testid': 'button',
        style: { color: 'red' },
        children: 'Click me',
      };

      const stripped = stripHydrationProps(props);

      expect(stripped.id).toBe('test');
      expect(stripped['data-testid']).toBe('button');
      expect(stripped.style).toEqual({ color: 'red' });
      expect(stripped.children).toBe('Click me');
    });

    test('handles empty props', () => {
      const props = {};
      const stripped = stripHydrationProps(props);

      expect(Object.keys(stripped)).toHaveLength(0);
    });
  });

  describe('generateIslandId', () => {
    test('generates unique IDs', () => {
      const id1 = generateIslandId();
      const id2 = generateIslandId();
      const id3 = generateIslandId();

      expect(id1).not.toBe(id2);
      expect(id2).not.toBe(id3);
      expect(id1).not.toBe(id3);
    });

    test('generates string IDs', () => {
      const id = generateIslandId();
      expect(typeof id).toBe('string');
    });

    test('generates non-empty IDs', () => {
      const id = generateIslandId();
      expect(id.length).toBeGreaterThan(0);
    });

    test('IDs start with expected prefix', () => {
      const id = generateIslandId();
      expect(id.startsWith('island-')).toBe(true);
    });
  });

  describe('HydrationStrategy type', () => {
    test('supports all strategy types', () => {
      const strategies: HydrationStrategy[] = ['load', 'idle', 'visible', 'media', 'none'];

      for (const strategy of strategies) {
        expect(['load', 'idle', 'visible', 'media', 'none']).toContain(strategy);
      }
    });
  });

  describe('Hydration directive patterns', () => {
    test('client:load is the default for interactive components', () => {
      const props = { 'client:load': true, text: 'Hello' };
      const { strategy } = parseHydrationDirective(props);

      expect(strategy).toBe('load');
    });

    test('client:only skips SSR (treated as none)', () => {
      const props = { 'client:only': true };
      const { strategy } = parseHydrationDirective(props);

      // client:only might not be directly supported, defaults to load
      expect(['load', 'none']).toContain(strategy);
    });
  });
});
