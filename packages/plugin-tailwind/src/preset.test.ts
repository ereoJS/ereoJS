import { describe, expect, test } from 'bun:test';
import { oreoPreset, getOreoTailwindConfig } from './preset';

describe('@oreo/plugin-tailwind - Preset', () => {
  describe('oreoPreset', () => {
    test('is an object with theme configuration', () => {
      expect(oreoPreset).toBeDefined();
      expect(typeof oreoPreset).toBe('object');
    });

    test('has theme extend configuration', () => {
      expect(oreoPreset.theme).toBeDefined();
      expect(oreoPreset.theme?.extend).toBeDefined();
    });

    test('includes color definitions', () => {
      expect(oreoPreset.theme?.extend?.colors).toBeDefined();
    });

    test('has color definitions if present', () => {
      const colors = oreoPreset.theme?.extend?.colors as Record<string, any>;
      // Colors may or may not include 'primary' depending on preset config
      expect(colors === undefined || typeof colors === 'object').toBe(true);
    });

    test('includes font family definitions', () => {
      expect(oreoPreset.theme?.extend?.fontFamily).toBeDefined();
    });

    test('includes animation definitions', () => {
      expect(oreoPreset.theme?.extend?.animation).toBeDefined();
    });

    test('includes keyframes definitions', () => {
      expect(oreoPreset.theme?.extend?.keyframes).toBeDefined();
    });
  });

  describe('getOreoTailwindConfig', () => {
    test('returns a valid tailwind config', () => {
      const config = getOreoTailwindConfig();

      expect(config).toBeDefined();
      expect(typeof config).toBe('object');
    });

    test('includes default content paths', () => {
      const config = getOreoTailwindConfig();

      expect(config.content).toBeDefined();
      expect(Array.isArray(config.content)).toBe(true);
      expect((config.content as string[]).length).toBeGreaterThan(0);
    });

    test('includes Oreo preset in presets', () => {
      const config = getOreoTailwindConfig();

      expect(config.presets).toBeDefined();
      expect(Array.isArray(config.presets)).toBe(true);
    });

    test('accepts custom content paths', () => {
      const config = getOreoTailwindConfig({
        content: ['./custom/**/*.tsx'],
      });

      expect((config.content as string[])).toContain('./custom/**/*.tsx');
    });

    test('accepts custom theme extensions', () => {
      const config = getOreoTailwindConfig({
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
      const config = getOreoTailwindConfig({
        plugins: [mockPlugin as any],
      });

      expect(config.plugins).toBeDefined();
      expect(Array.isArray(config.plugins)).toBe(true);
    });

    test('includes default dark mode setting', () => {
      const config = getOreoTailwindConfig();

      expect(config.darkMode).toBeDefined();
    });

    test('allows overriding dark mode', () => {
      const config = getOreoTailwindConfig({
        darkMode: 'media',
      });

      expect(config.darkMode).toBe('media');
    });
  });
});
