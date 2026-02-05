import { describe, expect, test } from 'bun:test';
import {
  generateA11yId,
  getFieldA11y,
  getErrorA11y,
  getLabelA11y,
  getDescriptionA11y,
  getFieldsetA11y,
  getFieldWrapperA11y,
  getFormA11y,
  getErrorSummaryA11y,
  prefersReducedMotion,
} from './a11y';

describe('generateA11yId', () => {
  test('generates unique IDs', () => {
    const id1 = generateA11yId();
    const id2 = generateA11yId();
    expect(id1).not.toBe(id2);
  });

  test('uses custom prefix', () => {
    const id = generateA11yId('field');
    expect(id).toMatch(/^field-\d+$/);
  });

  test('uses default prefix', () => {
    const id = generateA11yId();
    expect(id).toMatch(/^ereo-\d+$/);
  });
});

describe('getFieldA11y', () => {
  test('returns empty object when no errors', () => {
    const attrs = getFieldA11y('name', { errors: [], touched: false });
    expect(Object.keys(attrs)).toHaveLength(0);
  });

  test('returns empty when errors exist but not touched', () => {
    const attrs = getFieldA11y('name', { errors: ['Required'], touched: false });
    expect(Object.keys(attrs)).toHaveLength(0);
  });

  test('returns aria-invalid when errors and touched', () => {
    const attrs = getFieldA11y('name', { errors: ['Required'], touched: true });
    expect(attrs['aria-invalid']).toBe(true);
    expect(attrs['aria-describedby']).toBe('name-error');
  });
});

describe('getErrorA11y', () => {
  test('returns correct ARIA attributes', () => {
    const attrs = getErrorA11y('email');
    expect(attrs.id).toBe('email-error');
    expect(attrs.role).toBe('alert');
    expect(attrs['aria-live']).toBe('polite');
  });
});

describe('getLabelA11y', () => {
  test('returns htmlFor and id', () => {
    const attrs = getLabelA11y('name');
    expect(attrs.htmlFor).toBe('name');
    expect(attrs.id).toBe('name-label');
  });

  test('uses custom id', () => {
    const attrs = getLabelA11y('name', { id: 'custom-label' });
    expect(attrs.id).toBe('custom-label');
  });
});

describe('getDescriptionA11y', () => {
  test('returns id', () => {
    const attrs = getDescriptionA11y('name');
    expect(attrs.id).toBe('name-description');
  });
});

describe('getFieldsetA11y', () => {
  test('returns role and labelledby', () => {
    const attrs = getFieldsetA11y('address');
    expect(attrs.role).toBe('group');
    expect(attrs['aria-labelledby']).toBe('address-legend');
  });
});

describe('getFieldWrapperA11y', () => {
  test('returns data-field attribute', () => {
    const attrs = getFieldWrapperA11y('name', { errors: [], touched: false });
    expect(attrs['data-field']).toBe('name');
  });

  test('returns data-invalid when errors and touched', () => {
    const attrs = getFieldWrapperA11y('name', { errors: ['Error'], touched: true });
    expect(attrs['data-invalid']).toBe(true);
  });
});

describe('getFormA11y', () => {
  test('returns form ARIA attributes', () => {
    const attrs = getFormA11y('my-form');
    expect(attrs.id).toBe('my-form');
    expect(attrs.role).toBe('form');
  });

  test('returns aria-busy when submitting', () => {
    const attrs = getFormA11y('my-form', { isSubmitting: true });
    expect(attrs['aria-busy']).toBe(true);
  });
});

describe('getErrorSummaryA11y', () => {
  test('returns summary ARIA attributes', () => {
    const attrs = getErrorSummaryA11y('my-form');
    expect(attrs.role).toBe('alert');
    expect(attrs['aria-labelledby']).toBe('my-form-error-summary');
  });
});

describe('prefersReducedMotion', () => {
  test('returns boolean', () => {
    // In test env (no window.matchMedia), should return false
    const result = prefersReducedMotion();
    expect(typeof result).toBe('boolean');
  });
});
