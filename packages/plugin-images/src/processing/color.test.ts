/**
 * @ereo/plugin-images - Color Utility Tests
 *
 * Tests for pure color utility functions (no sharp dependency).
 */

import { describe, expect, test } from 'bun:test';
import { rgbToHex, hexToRgb, getContrastColor } from './color';

describe('rgbToHex', () => {
  test('converts black', () => {
    expect(rgbToHex({ r: 0, g: 0, b: 0 })).toBe('#000000');
  });

  test('converts white', () => {
    expect(rgbToHex({ r: 255, g: 255, b: 255 })).toBe('#ffffff');
  });

  test('converts red', () => {
    expect(rgbToHex({ r: 255, g: 0, b: 0 })).toBe('#ff0000');
  });

  test('converts green', () => {
    expect(rgbToHex({ r: 0, g: 255, b: 0 })).toBe('#00ff00');
  });

  test('converts blue', () => {
    expect(rgbToHex({ r: 0, g: 0, b: 255 })).toBe('#0000ff');
  });

  test('converts mixed color', () => {
    expect(rgbToHex({ r: 171, g: 205, b: 239 })).toBe('#abcdef');
  });
});

describe('hexToRgb', () => {
  test('converts #000000', () => {
    expect(hexToRgb('#000000')).toEqual({ r: 0, g: 0, b: 0 });
  });

  test('converts #ffffff', () => {
    expect(hexToRgb('#ffffff')).toEqual({ r: 255, g: 255, b: 255 });
  });

  test('converts without # prefix', () => {
    expect(hexToRgb('ff0000')).toEqual({ r: 255, g: 0, b: 0 });
  });

  test('is case insensitive', () => {
    expect(hexToRgb('#ABCDEF')).toEqual({ r: 171, g: 205, b: 239 });
  });

  test('throws for invalid hex', () => {
    expect(() => hexToRgb('#xyz')).toThrow('Invalid hex color');
  });

  test('throws for too-short hex', () => {
    expect(() => hexToRgb('#fff')).toThrow('Invalid hex color');
  });
});

describe('rgbToHex + hexToRgb roundtrip', () => {
  test('roundtrips correctly', () => {
    const original = { r: 42, g: 128, b: 200 };
    const hex = rgbToHex(original);
    const result = hexToRgb(hex);
    expect(result).toEqual(original);
  });
});

describe('getContrastColor', () => {
  test('returns white for dark backgrounds', () => {
    expect(getContrastColor({ r: 0, g: 0, b: 0 })).toBe('#ffffff');
  });

  test('returns black for light backgrounds', () => {
    expect(getContrastColor({ r: 255, g: 255, b: 255 })).toBe('#000000');
  });

  test('returns white for dark blue', () => {
    expect(getContrastColor({ r: 0, g: 0, b: 128 })).toBe('#ffffff');
  });

  test('returns black for yellow', () => {
    expect(getContrastColor({ r: 255, g: 255, b: 0 })).toBe('#000000');
  });

  test('returns black for light gray', () => {
    expect(getContrastColor({ r: 200, g: 200, b: 200 })).toBe('#000000');
  });

  test('returns white for dark gray', () => {
    expect(getContrastColor({ r: 50, g: 50, b: 50 })).toBe('#ffffff');
  });
});
