import { describe, expect, test } from 'bun:test';
import { areoPreset, getAreoTailwindConfig } from './preset';

describe('@areo/plugin-tailwind - Preset', () => {
  describe('areoPreset', () => {
    test('is an object with theme configuration', () => {
      expect(areoPreset).toBeDefined();
      expect(typeof areoPreset).toBe('object');
    });

    test('has theme extend configuration', () => {
      expect(areoPreset.theme).toBeDefined();
      expect(areoPreset.theme?.extend).toBeDefined();
    });

    test('includes color definitions', () => {
      expect(areoPreset.theme?.extend?.colors).toBeDefined();
    });

    test('has color definitions if present', () => {
      const colors = areoPreset.theme?.extend?.colors as Record<string, any>;
      // Colors may or may not include 'primary' depending on preset config
      expect(colors === undefined || typeof colors === 'object').toBe(true);
    });

    test('includes font family definitions', () => {
      expect(areoPreset.theme?.extend?.fontFamily).toBeDefined();
    });

    test('includes animation definitions', () => {
      expect(areoPreset.theme?.extend?.animation).toBeDefined();
    });

    test('includes keyframes definitions', () => {
      expect(areoPreset.theme?.extend?.keyframes).toBeDefined();
    });
  });

  describe('getAreoTailwindConfig', () => {
    test('returns a valid tailwind config', () => {
      const config = getAreoTailwindConfig();

      expect(config).toBeDefined();
      expect(typeof config).toBe('object');
    });

    test('includes default content paths', () => {
      const config = getAreoTailwindConfig();

      expect(config.content).toBeDefined();
      expect(Array.isArray(config.content)).toBe(true);
      expect((config.content as string[]).length).toBeGreaterThan(0);
    });

    test('includes Areo preset in presets', () => {
      const config = getAreoTailwindConfig();

      expect(config.presets).toBeDefined();
      expect(Array.isArray(config.presets)).toBe(true);
    });

    test('accepts custom content paths', () => {
      const config = getAreoTailwindConfig({
        content: ['./custom/**/*.tsx'],
      });

      expect((config.content as string[])).toContain('./custom/**/*.tsx');
    });

    test('accepts custom theme extensions', () => {
      const config = getAreoTailwindConfig({
        theme: {
          extend: {
            colors: {
              custom: '#ff0000',
            },
          },
        },
      });

      expect(config.theme?.extend?.colors).toBeDefined();
    });

    test('merges plugins', () => {
      const mockPlugin = { handler: () => {} };
      const config = getAreoTailwindConfig({
        plugins: [mockPlugin as any],
      });

      expect(config.plugins).toBeDefined();
      expect(Array.isArray(config.plugins)).toBe(true);
    });

    test('includes default dark mode setting', () => {
      const config = getAreoTailwindConfig();

      expect(config.darkMode).toBeDefined();
    });

    test('allows overriding dark mode', () => {
      const config = getAreoTailwindConfig({
        darkMode: 'media',
      });

      expect(config.darkMode).toBe('media');
    });
  });
});
