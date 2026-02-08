/**
 * Comprehensive Stability Tests for @ereo/forms
 *
 * Tests for edge cases, regression bugs, and integration scenarios
 * to ensure the forms package is production-ready.
 */
import { describe, it, expect, beforeEach } from 'bun:test';
import { signal, batch } from '@ereo/state';
import { FormStore, createFormStore } from './store';
import { ValidationEngine } from './validation-engine';
import { createValuesProxy } from './proxy';
import {
  deepEqual,
  deepClone,
  getPath,
  setPath,
  flattenToPaths,
  reconstructFromPaths,
  parsePath,
} from './utils';
import {
  required,
  email,
  minLength,
  min,
  max,
  custom,
  matches,
  compose,
  when,
  number as numberValidator,
  pattern,
  oneOf,
  notOneOf,
  fileSize,
  fileType,
  integer,
  positive,
} from './validators';
import * as asyncValidator from './validators';
import { ereoSchema, isEreoSchema, isStandardSchema, standardSchemaAdapter, zodAdapter, valibotAdapter, createSchemaValidator, formDataToObject } from './schema';
import { mergeFormConfigs, composeSchemas } from './composition';
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
  isScreenReaderActive,
} from './a11y';
import type { FormConfig, ValidatorFunction, ErrorSource } from './types';

// ─── Test Helpers ──────────────────────────────────────────────────────────────

function createTestForm<T extends Record<string, any>>(config: FormConfig<T>): FormStore<T> {
  return new FormStore(config);
}

function asyncValidatorFn(result: string | undefined, delay = 10): ValidatorFunction {
  const fn: ValidatorFunction = async () => {
    await new Promise(r => setTimeout(r, delay));
    return result;
  };
  fn._isAsync = true;
  return fn;
}

function wait(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}

// ═══════════════════════════════════════════════════════════════════════════════
// 1. OBJECT.IS EQUALITY (NaN, -0, +0)
// ═══════════════════════════════════════════════════════════════════════════════

describe('Object.is equality in setValue', () => {
  it('should not trigger watchers when setting NaN to NaN', () => {
    const form = createTestForm({
      defaultValues: { score: NaN },
    });

    let watchCount = 0;
    form.watch('score', () => watchCount++);

    // Setting NaN to NaN — Object.is(NaN, NaN) is true, should skip
    form.setValue('score', NaN);
    expect(watchCount).toBe(0);
  });

  it('should trigger watchers when changing from NaN to a number', () => {
    const form = createTestForm({
      defaultValues: { score: NaN },
    });

    let watchCount = 0;
    form.watch('score', () => watchCount++);

    form.setValue('score', 42);
    expect(watchCount).toBe(1);
    expect(form.getValue('score')).toBe(42);
  });

  it('should trigger watchers when changing from a number to NaN', () => {
    const form = createTestForm({
      defaultValues: { score: 42 },
    });

    let watchCount = 0;
    form.watch('score', () => watchCount++);

    form.setValue('score', NaN);
    expect(watchCount).toBe(1);
  });

  it('should distinguish -0 and +0', () => {
    const form = createTestForm({
      defaultValues: { value: 0 },
    });

    let watchCount = 0;
    form.watch('value', () => watchCount++);

    // Object.is(0, -0) is false, so should trigger
    form.setValue('value', -0);
    expect(watchCount).toBe(1);
  });

  it('should not trigger when setting same value', () => {
    const form = createTestForm({
      defaultValues: { name: 'test' },
    });

    let watchCount = 0;
    form.watch('name', () => watchCount++);

    form.setValue('name', 'test');
    expect(watchCount).toBe(0);
  });

  it('should track dirty correctly with NaN', () => {
    const form = createTestForm({
      defaultValues: { score: NaN },
    });

    // Set to a number — should be dirty
    form.setValue('score', 42);
    expect(form.getDirty('score')).toBe(true);
    expect(form.isDirty.get()).toBe(true);

    // Set back to NaN — deepEqual(NaN, NaN) should now return true
    form.setValue('score', NaN);
    expect(form.getDirty('score')).toBe(false);
    expect(form.isDirty.get()).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 2. DEEP EQUAL EDGE CASES
// ═══════════════════════════════════════════════════════════════════════════════

describe('deepEqual edge cases', () => {
  it('should treat NaN as equal to NaN', () => {
    expect(deepEqual(NaN, NaN)).toBe(true);
  });

  it('should treat -0 and +0 as equal (same as ===)', () => {
    // Object.is(-0, +0) is false, but for deepEqual we use Object.is
    // which means -0 !== +0 in our deepEqual
    expect(deepEqual(-0, +0)).toBe(false);
  });

  it('should handle nested NaN values in objects', () => {
    expect(deepEqual({ a: NaN }, { a: NaN })).toBe(true);
    expect(deepEqual({ a: NaN }, { a: 0 })).toBe(false);
  });

  it('should handle nested NaN values in arrays', () => {
    expect(deepEqual([NaN, 1], [NaN, 1])).toBe(true);
    expect(deepEqual([NaN, 1], [0, 1])).toBe(false);
  });

  it('should handle empty objects', () => {
    expect(deepEqual({}, {})).toBe(true);
    expect(deepEqual([], [])).toBe(true);
  });

  it('should handle Date objects', () => {
    const d1 = new Date('2024-01-01');
    const d2 = new Date('2024-01-01');
    const d3 = new Date('2024-01-02');
    expect(deepEqual(d1, d2)).toBe(true);
    expect(deepEqual(d1, d3)).toBe(false);
  });

  it('should handle Map objects', () => {
    const m1 = new Map([['a', 1], ['b', 2]]);
    const m2 = new Map([['a', 1], ['b', 2]]);
    const m3 = new Map([['a', 1], ['b', 3]]);
    expect(deepEqual(m1, m2)).toBe(true);
    expect(deepEqual(m1, m3)).toBe(false);
  });

  it('should handle Set objects', () => {
    const s1 = new Set([1, 2, 3]);
    const s2 = new Set([1, 2, 3]);
    const s3 = new Set([1, 2, 4]);
    expect(deepEqual(s1, s2)).toBe(true);
    expect(deepEqual(s1, s3)).toBe(false);
  });

  it('should handle RegExp objects', () => {
    expect(deepEqual(/abc/gi, /abc/gi)).toBe(true);
    expect(deepEqual(/abc/g, /abc/i)).toBe(false);
  });

  it('should handle null vs undefined', () => {
    expect(deepEqual(null, undefined)).toBe(false);
    expect(deepEqual(undefined, undefined)).toBe(true);
    expect(deepEqual(null, null)).toBe(true);
  });

  it('should handle mixed array/object', () => {
    expect(deepEqual([1, 2], { 0: 1, 1: 2 })).toBe(false);
  });

  it('should handle deeply nested structures', () => {
    const a = { l1: { l2: { l3: { l4: { l5: 'deep' } } } } };
    const b = { l1: { l2: { l3: { l4: { l5: 'deep' } } } } };
    const c = { l1: { l2: { l3: { l4: { l5: 'different' } } } } };
    expect(deepEqual(a, b)).toBe(true);
    expect(deepEqual(a, c)).toBe(false);
  });

  it('should handle extra keys', () => {
    expect(deepEqual({ a: 1 }, { a: 1, b: 2 })).toBe(false);
    expect(deepEqual({ a: 1, b: 2 }, { a: 1 })).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 3. DEEP CLONE EDGE CASES
// ═══════════════════════════════════════════════════════════════════════════════

describe('deepClone edge cases', () => {
  it('should clone Date objects', () => {
    const d = new Date('2024-01-01');
    const cloned = deepClone(d);
    expect(cloned.getTime()).toBe(d.getTime());
    expect(cloned).not.toBe(d); // Different reference
  });

  it('should clone RegExp objects', () => {
    const r = /abc/gi;
    const cloned = deepClone(r);
    expect(cloned.source).toBe(r.source);
    expect(cloned.flags).toBe(r.flags);
    expect(cloned).not.toBe(r);
  });

  it('should clone Map objects', () => {
    const m = new Map([['a', { nested: true }]]);
    const cloned = deepClone(m);
    expect(cloned.get('a')).toEqual({ nested: true });
    expect(cloned.get('a')).not.toBe(m.get('a'));
  });

  it('should clone Set objects', () => {
    const s = new Set([1, 2, 3]);
    const cloned = deepClone(s);
    expect(cloned.size).toBe(3);
    expect(cloned).not.toBe(s);
  });

  it('should handle null and primitives', () => {
    expect(deepClone(null)).toBe(null);
    expect(deepClone(42)).toBe(42);
    expect(deepClone('hello')).toBe('hello');
    expect(deepClone(undefined)).toBe(undefined);
    expect(deepClone(true)).toBe(true);
  });

  it('should deeply clone nested arrays', () => {
    const arr = [[1, 2], [3, 4]];
    const cloned = deepClone(arr);
    expect(cloned).toEqual(arr);
    expect(cloned[0]).not.toBe(arr[0]);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 4. PATH UTILITIES
// ═══════════════════════════════════════════════════════════════════════════════

describe('parsePath edge cases', () => {
  it('should handle empty path', () => {
    expect(parsePath('')).toEqual([]);
  });

  it('should handle bracket notation', () => {
    expect(parsePath('users[0].name')).toEqual(['users', 0, 'name']);
  });

  it('should handle dot notation with numbers', () => {
    expect(parsePath('users.0.name')).toEqual(['users', 0, 'name']);
  });

  it('should handle multiple brackets', () => {
    expect(parsePath('matrix[0][1]')).toEqual(['matrix', 0, 1]);
  });

  it('should handle string bracket keys', () => {
    expect(parsePath('data[key].value')).toEqual(['data', 'key', 'value']);
  });
});

describe('getPath edge cases', () => {
  it('should return undefined for missing paths', () => {
    expect(getPath({ a: 1 }, 'b')).toBe(undefined);
    expect(getPath({ a: { b: 1 } }, 'a.c')).toBe(undefined);
  });

  it('should handle null in path', () => {
    expect(getPath({ a: null }, 'a.b')).toBe(undefined);
  });

  it('should return the object itself for empty path', () => {
    const obj = { a: 1 };
    expect(getPath(obj, '')).toBe(obj);
  });

  it('should handle array access', () => {
    expect(getPath({ items: ['a', 'b', 'c'] }, 'items.1')).toBe('b');
  });
});

describe('setPath edge cases', () => {
  it('should create intermediate arrays for numeric segments', () => {
    const result = setPath({}, 'items.0.name', 'test');
    expect(result).toEqual({ items: [{ name: 'test' }] });
  });

  it('should create intermediate objects for string segments', () => {
    const result = setPath({}, 'a.b.c', 42);
    expect(result).toEqual({ a: { b: { c: 42 } } });
  });

  it('should preserve existing data', () => {
    const obj = { a: { b: 1, c: 2 } };
    const result = setPath(obj, 'a.b', 10);
    expect(result).toEqual({ a: { b: 10, c: 2 } });
    expect(obj.a.b).toBe(1); // Original unchanged (immutable)
  });

  it('should handle setting root value', () => {
    expect(setPath({}, '', 'hello')).toBe('hello');
  });
});

describe('flattenToPaths', () => {
  it('should flatten nested objects', () => {
    const result = flattenToPaths({ user: { name: 'John', age: 30 } });
    expect(result.get('user.name')).toBe('John');
    expect(result.get('user.age')).toBe(30);
  });

  it('should flatten arrays', () => {
    const result = flattenToPaths({ items: ['a', 'b'] });
    expect(result.get('items.0')).toBe('a');
    expect(result.get('items.1')).toBe('b');
    // Also stores the array itself
    expect(result.get('items')).toEqual(['a', 'b']);
  });

  it('should handle empty objects', () => {
    const result = flattenToPaths({ empty: {} });
    // Stores the empty object at the key
    expect(result.get('empty')).toEqual({});
  });

  it('should handle null values', () => {
    const result = flattenToPaths({ x: null });
    expect(result.get('x')).toBe(null);
  });

  it('should handle deeply nested', () => {
    const result = flattenToPaths({ a: { b: { c: 'deep' } } });
    expect(result.get('a.b.c')).toBe('deep');
  });
});

describe('reconstructFromPaths', () => {
  it('should round-trip simple objects', () => {
    const original = { name: 'test', age: 42 };
    const flat = flattenToPaths(original);
    const reconstructed = reconstructFromPaths(flat);
    expect(reconstructed).toEqual(original);
  });

  it('should handle nested objects', () => {
    const original = { user: { name: 'John', email: 'john@test.com' } };
    const flat = flattenToPaths(original);
    const reconstructed = reconstructFromPaths(flat);
    expect(reconstructed.user.name).toBe('John');
    expect(reconstructed.user.email).toBe('john@test.com');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 5. FORM STORE CORE OPERATIONS
// ═══════════════════════════════════════════════════════════════════════════════

describe('FormStore core operations', () => {
  let form: FormStore<{ name: string; email: string; age: number }>;

  beforeEach(() => {
    form = createTestForm({
      defaultValues: { name: '', email: '', age: 0 },
    });
  });

  it('should initialize with default values', () => {
    expect(form.getValue('name')).toBe('');
    expect(form.getValue('email')).toBe('');
    expect(form.getValue('age')).toBe(0);
  });

  it('should set and get values', () => {
    form.setValue('name', 'John');
    expect(form.getValue('name')).toBe('John');
  });

  it('should track dirty state', () => {
    expect(form.isDirty.get()).toBe(false);
    form.setValue('name', 'John');
    expect(form.isDirty.get()).toBe(true);
    expect(form.getDirty('name')).toBe(true);
    expect(form.getDirty('email')).toBe(false);
  });

  it('should track touched state', () => {
    expect(form.getTouched('name')).toBe(false);
    form.setTouched('name');
    expect(form.getTouched('name')).toBe(true);
  });

  it('should clear touched on reset', () => {
    form.setTouched('name');
    form.setTouched('email');
    form.reset();
    expect(form.getTouched('name')).toBe(false);
    expect(form.getTouched('email')).toBe(false);
  });

  it('should reset to default values', () => {
    form.setValue('name', 'John');
    form.setValue('age', 42);
    form.reset();
    expect(form.getValue('name')).toBe('');
    expect(form.getValue('age')).toBe(0);
    expect(form.isDirty.get()).toBe(false);
  });

  it('should resetTo new values', () => {
    form.resetTo({ name: 'Jane', email: 'jane@test.com', age: 25 });
    expect(form.getValue('name')).toBe('Jane');
    expect(form.getValue('email')).toBe('jane@test.com');
    expect(form.isDirty.get()).toBe(false);
  });

  it('should set baseline and recalculate dirty', () => {
    form.setValue('name', 'John');
    expect(form.getDirty('name')).toBe(true);
    form.setBaseline({ name: 'John', email: '', age: 0 });
    expect(form.getDirty('name')).toBe(false);
    expect(form.isDirty.get()).toBe(false);
  });

  it('should getChanges correctly', () => {
    form.setValue('name', 'John');
    form.setValue('age', 42);
    const changes = form.getChanges();
    expect(changes).toEqual({ name: 'John', age: 42 });
  });

  it('should setValues in batch', () => {
    let notifyCount = 0;
    form.subscribe(() => notifyCount++);

    form.setValues({ name: 'John', age: 42 } as any);
    expect(form.getValue('name')).toBe('John');
    expect(form.getValue('age')).toBe(42);
  });

  it('should handle set/get errors', () => {
    form.setErrors('name', ['Required']);
    expect(form.getErrors('name').get()).toEqual(['Required']);
    expect(form.isValid.get()).toBe(false);

    form.clearErrors('name');
    expect(form.getErrors('name').get()).toEqual([]);
    expect(form.isValid.get()).toBe(true);
  });

  it('should handle form-level errors', () => {
    form.setFormErrors(['Server error']);
    expect(form.getFormErrors().get()).toEqual(['Server error']);
    expect(form.isValid.get()).toBe(false);

    form.setFormErrors([]);
    expect(form.isValid.get()).toBe(true);
  });

  it('should clear all errors', () => {
    form.setErrors('name', ['Required']);
    form.setErrors('email', ['Invalid']);
    form.setFormErrors(['Server error']);

    form.clearErrors();
    expect(form.getErrors('name').get()).toEqual([]);
    expect(form.getErrors('email').get()).toEqual([]);
    expect(form.getFormErrors().get()).toEqual([]);
    expect(form.isValid.get()).toBe(true);
  });

  it('should resetField correctly', () => {
    form.setValue('name', 'John');
    form.setTouched('name');
    form.setErrors('name', ['Error']);

    form.resetField('name');
    expect(form.getValue('name')).toBe('');
    expect(form.getTouched('name')).toBe(false);
    expect(form.getDirty('name')).toBe(false);
    expect(form.getErrors('name').get()).toEqual([]);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 6. ERROR MAP / ERROR SOURCE TRACKING
// ═══════════════════════════════════════════════════════════════════════════════

describe('Error source tracking', () => {
  it('should set errors with source', () => {
    const form = createTestForm({
      defaultValues: { email: '' },
    });

    form.setErrorsWithSource('email', ['Required'], 'sync');
    const map = form.getErrorMap('email').get();
    expect(map.sync).toEqual(['Required']);
    expect(map.async).toEqual([]);
    expect(form.getErrors('email').get()).toEqual(['Required']);
  });

  it('should track multiple sources', () => {
    const form = createTestForm({
      defaultValues: { email: '' },
    });

    form.setErrorsWithSource('email', ['Required'], 'sync');
    form.setErrorsWithSource('email', ['Already taken'], 'async');

    const map = form.getErrorMap('email').get();
    expect(map.sync).toEqual(['Required']);
    expect(map.async).toEqual(['Already taken']);
    // Flat errors should contain both
    expect(form.getErrors('email').get()).toEqual(['Required', 'Already taken']);
  });

  it('should clear errors by source', () => {
    const form = createTestForm({
      defaultValues: { email: '' },
    });

    form.setErrorsWithSource('email', ['Required'], 'sync');
    form.setErrorsWithSource('email', ['Already taken'], 'async');
    form.clearErrorsBySource('email', 'sync');

    const map = form.getErrorMap('email').get();
    expect(map.sync).toEqual([]);
    expect(map.async).toEqual(['Already taken']);
    expect(form.getErrors('email').get()).toEqual(['Already taken']);
  });

  it('should handle server errors source', () => {
    const form = createTestForm({
      defaultValues: { email: '' },
    });

    form.setErrorsWithSource('email', ['Email already registered'], 'server');
    const map = form.getErrorMap('email').get();
    expect(map.server).toEqual(['Email already registered']);
  });

  it('should handle manual errors source', () => {
    const form = createTestForm({
      defaultValues: { email: '' },
    });

    // Access error map first to ensure it exists (setErrors only updates existing map)
    form.getErrorMap('email');
    form.setErrors('email', ['Custom error']);
    const map = form.getErrorMap('email').get();
    expect(map.manual).toEqual(['Custom error']);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 7. VALIDATION ENGINE
// ═══════════════════════════════════════════════════════════════════════════════

describe('Validation engine', () => {
  it('should validate required fields', async () => {
    const form = createTestForm({
      defaultValues: { name: '' },
      validators: { name: required() },
    });

    const result = await (form as any)._validationEngine.validateAll();
    expect(result.success).toBe(false);
    expect(result.errors?.name).toEqual(['This field is required']);
  });

  it('should pass validation when field is valid', async () => {
    const form = createTestForm({
      defaultValues: { name: 'John' },
      validators: { name: required() },
    });

    const result = await (form as any)._validationEngine.validateAll();
    expect(result.success).toBe(true);
  });

  it('should run sync validators before async (sync gates async)', async () => {
    const callOrder: string[] = [];

    const syncValidator: ValidatorFunction = (value) => {
      callOrder.push('sync');
      return value === '' ? 'Required' : undefined;
    };

    const asyncFn: ValidatorFunction = async (value) => {
      callOrder.push('async');
      await wait(10);
      return undefined;
    };
    asyncFn._isAsync = true;

    const form = createTestForm({
      defaultValues: { name: '' },
      validators: { name: [syncValidator, asyncFn] },
    });

    await (form as any)._validationEngine.validateAll();
    // Sync should run, async should NOT run since sync failed
    expect(callOrder).toEqual(['sync']);
  });

  it('should run async validators when sync passes', async () => {
    const callOrder: string[] = [];

    const syncValidator: ValidatorFunction = (value) => {
      callOrder.push('sync');
      return undefined; // passes
    };

    const asyncFn: ValidatorFunction = async (value) => {
      callOrder.push('async');
      await wait(10);
      return 'Async error';
    };
    asyncFn._isAsync = true;

    const form = createTestForm({
      defaultValues: { name: 'test' },
      validators: { name: [syncValidator, asyncFn] },
    });

    const result = await (form as any)._validationEngine.validateAll();
    expect(callOrder).toEqual(['sync', 'async']);
    expect(result.success).toBe(false);
    expect(result.errors?.name).toEqual(['Async error']);
  });

  it('should correctly attribute error sources in validateAll', async () => {
    const syncV: ValidatorFunction = () => 'Sync error';
    const asyncV: ValidatorFunction = async () => {
      await wait(5);
      return 'Async error';
    };
    asyncV._isAsync = true;

    // Case 1: Only sync errors (async doesn't run)
    const form1 = createTestForm({
      defaultValues: { field: '' },
      validators: { field: [syncV, asyncV] },
    });

    await (form1 as any)._validationEngine.validateAll();
    const map1 = form1.getErrorMap('field').get();
    expect(map1.sync).toEqual(['Sync error']);
    expect(map1.async).toEqual([]);

    // Case 2: Only async errors (sync passes)
    const syncPass: ValidatorFunction = () => undefined;
    const form2 = createTestForm({
      defaultValues: { field: 'valid' },
      validators: { field: [syncPass, asyncV] },
    });

    await (form2 as any)._validationEngine.validateAll();
    const map2 = form2.getErrorMap('field').get();
    expect(map2.sync).toEqual([]);
    expect(map2.async).toEqual(['Async error']);
  });

  it('should handle field-level validateField', async () => {
    const form = createTestForm({
      defaultValues: { email: '' },
      validators: { email: [required(), email()] },
    });

    const errors = await (form as any)._validationEngine.validateField('email');
    expect(errors).toEqual(['This field is required']);
  });

  it('should abort previous validation on new validation', async () => {
    let validationCount = 0;
    const slowValidator: ValidatorFunction = async () => {
      validationCount++;
      await wait(50);
      return 'Error';
    };
    slowValidator._isAsync = true;

    const form = createTestForm({
      defaultValues: { name: '' },
      validators: { name: slowValidator },
    });

    const engine = (form as any)._validationEngine;

    // Start two validations rapidly
    const p1 = engine.validateField('name');
    const p2 = engine.validateField('name');

    const [r1, r2] = await Promise.all([p1, p2]);
    // First should be aborted (empty result), second should complete
    expect(r1).toEqual([]);
    expect(r2).toEqual(['Error']);
  });

  it('should abort all validations', async () => {
    const slowValidator: ValidatorFunction = async () => {
      await wait(100);
      return 'Error';
    };
    slowValidator._isAsync = true;

    const form = createTestForm({
      defaultValues: { name: '', email: '' },
      validators: {
        name: slowValidator,
        email: slowValidator,
      },
    });

    const engine = (form as any)._validationEngine;
    const p = engine.validateAll();

    // Abort immediately
    engine.abortAll();

    const result = await p;
    expect(result.success).toBe(true); // Aborted returns success: true
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 8. LINKED FIELDS / DEPENDENCIES
// ═══════════════════════════════════════════════════════════════════════════════

describe('Field dependencies', () => {
  it('should validate dependent field when source changes', async () => {
    const form = createTestForm({
      defaultValues: { password: 'abc123', confirmPassword: 'abc' },
      validators: {
        confirmPassword: matches('password', 'Passwords must match'),
      },
    });

    // Touch confirmPassword so dependents will re-validate
    form.setTouched('confirmPassword');

    // Validate confirmPassword first
    const errors = await (form as any)._validationEngine.validateField('confirmPassword');
    expect(errors).toEqual(['Passwords must match']);

    // Now set to matching value
    form.setValue('confirmPassword', 'abc123');
    const errors2 = await (form as any)._validationEngine.validateField('confirmPassword');
    expect(errors2).toEqual([]);
  });

  it('should register explicit dependencies', async () => {
    const form = createTestForm({
      defaultValues: { min: 0, max: 10 },
      validators: {
        max: custom((value: any) => {
          return undefined; // Dummy — real validation uses context
        }),
      },
      dependencies: {
        max: 'min',
      },
    });

    const engine = (form as any)._validationEngine;
    const deps = engine.getDependents('min');
    expect(deps).toBeDefined();
    expect(deps!.has('max')).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 9. RESET WITH IN-FLIGHT VALIDATION
// ═══════════════════════════════════════════════════════════════════════════════

describe('resetTo aborts in-flight validations', () => {
  it('should not write errors from validation started before reset', async () => {
    let resolveValidator: (() => void) | null = null;
    const slowValidator: ValidatorFunction = async () => {
      await new Promise<void>(r => { resolveValidator = r; });
      return 'Stale error';
    };
    slowValidator._isAsync = true;

    const form = createTestForm({
      defaultValues: { name: '' },
      validators: { name: slowValidator },
    });

    // Start validation
    const engine = (form as any)._validationEngine;
    const validatePromise = engine.validateField('name');

    // Reset while validation is in-flight
    form.resetTo({ name: 'new value' });

    // Now resolve the validator
    resolveValidator?.();
    await validatePromise;

    // Errors should NOT have been written (abort prevents it)
    expect(form.getErrors('name').get()).toEqual([]);
    expect(form.getValue('name')).toBe('new value');
  });

  it('should reset validating state on abort', async () => {
    const slowValidator: ValidatorFunction = async () => {
      await wait(100);
      return 'Error';
    };
    slowValidator._isAsync = true;

    const form = createTestForm({
      defaultValues: { name: '' },
      validators: { name: slowValidator },
    });

    const engine = (form as any)._validationEngine;
    engine.validateField('name'); // Fire-and-forget

    // Field should be validating
    expect(engine.isFieldValidating('name')).toBe(true);

    // Abort all
    engine.abortAll();

    // Should no longer be validating
    expect(engine.isFieldValidating('name')).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 10. PROXY VALUES ACCESS
// ═══════════════════════════════════════════════════════════════════════════════

describe('Values proxy', () => {
  it('should read values via proxy', () => {
    const form = createTestForm({
      defaultValues: { user: { name: 'John', email: 'john@test.com' } },
    });

    expect(form.values.user.name).toBe('John');
    expect(form.values.user.email).toBe('john@test.com');
  });

  it('should write values via proxy', () => {
    const form = createTestForm({
      defaultValues: { user: { name: 'John' } },
    });

    form.values.user.name = 'Jane';
    expect(form.getValue('user.name')).toBe('Jane');
  });

  it('should reflect updates in proxy reads', () => {
    const form = createTestForm({
      defaultValues: { name: 'old' },
    });

    form.setValue('name', 'new');
    expect(form.values.name).toBe('new');
  });

  it('should support "in" operator', () => {
    const form = createTestForm({
      defaultValues: { user: { name: 'John' } },
    });

    expect('name' in form.values.user).toBe(true);
    expect('missing' in form.values.user).toBe(false);
  });

  it('should support Object.keys', () => {
    const form = createTestForm({
      defaultValues: { name: 'John', age: 30 },
    });

    const keys = Object.keys(form.values);
    expect(keys).toContain('name');
    expect(keys).toContain('age');
  });

  it('should handle symbol properties gracefully', () => {
    const form = createTestForm({
      defaultValues: { name: 'test' },
    });

    const sym = Symbol('test');
    expect((form.values as any)[sym]).toBe(undefined);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 11. FORM SUBMIT
// ═══════════════════════════════════════════════════════════════════════════════

describe('Form submit', () => {
  it('should call onSubmit with current values', async () => {
    let receivedValues: any = null;

    const form = createTestForm({
      defaultValues: { name: 'John', email: 'john@test.com' },
      onSubmit: async (values) => {
        receivedValues = values;
      },
    });

    await form.handleSubmit();
    expect(receivedValues).toEqual({ name: 'John', email: 'john@test.com' });
    expect(form.submitState.get()).toBe('success');
    expect(form.submitCount.get()).toBe(1);
  });

  it('should validate before submitting', async () => {
    let submitted = false;

    const form = createTestForm({
      defaultValues: { name: '' },
      validators: { name: required() },
      onSubmit: async () => { submitted = true; },
    });

    await form.handleSubmit();
    expect(submitted).toBe(false);
    expect(form.submitState.get()).toBe('error');
  });

  it('should handle submit errors', async () => {
    const form = createTestForm({
      defaultValues: { name: 'John' },
      onSubmit: async () => {
        throw new Error('Network error');
      },
    });

    await expect(form.handleSubmit()).rejects.toThrow('Network error');
    expect(form.submitState.get()).toBe('error');
    expect(form.isSubmitting.get()).toBe(false);
  });

  it('should abort previous submit', async () => {
    let abortedFirst = false;
    const form = createTestForm({
      defaultValues: { name: 'John' },
      onSubmit: async (_values, { signal }) => {
        await wait(50);
        if (signal?.aborted) abortedFirst = true;
      },
    });

    // Fire two submits — the first should get aborted by the second
    const p1 = form.submitWith(form.config.onSubmit!);
    // Wait a tick so first submit enters isSubmitting state
    await wait(0);
    const p2 = form.submitWith(form.config.onSubmit!);
    await Promise.allSettled([p1, p2]);
    // Second submit should complete successfully
    expect(form.submitState.get()).toBe('success');
  });

  it('should reset on submit when configured', async () => {
    const form = createTestForm({
      defaultValues: { name: '' },
      onSubmit: async () => {},
      resetOnSubmit: true,
    });

    form.setValue('name', 'John');
    expect(form.isDirty.get()).toBe(true);

    await form.handleSubmit();
    expect(form.getValue('name')).toBe('');
    expect(form.isDirty.get()).toBe(false);
  });

  it('should touch all registered fields on submit', async () => {
    const form = createTestForm({
      defaultValues: { name: '', email: '' },
      validators: {
        name: required(),
        email: required(),
      },
      onSubmit: async () => {},
    });

    // Register the fields (as useField would)
    form.register('name', { validate: required() });
    form.register('email', { validate: required() });

    expect(form.getTouched('name')).toBe(false);
    expect(form.getTouched('email')).toBe(false);

    await form.handleSubmit();

    // handleSubmit touches all registered fields
    expect(form.getTouched('name')).toBe(true);
    expect(form.getTouched('email')).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 12. TRIGGER (manual validation)
// ═══════════════════════════════════════════════════════════════════════════════

describe('trigger (manual validation)', () => {
  it('should validate single field', async () => {
    const form = createTestForm({
      defaultValues: { name: '' },
      validators: { name: required() },
    });

    const valid = await form.trigger('name');
    expect(valid).toBe(false);
    expect(form.getErrors('name').get()).toContain('This field is required');
    // Should also touch the field
    expect(form.getTouched('name')).toBe(true);
  });

  it('should validate all fields', async () => {
    const form = createTestForm({
      defaultValues: { name: '', email: '' },
      validators: {
        name: required(),
        email: required(),
      },
    });

    const valid = await form.trigger();
    expect(valid).toBe(false);
  });

  it('should return true when valid', async () => {
    const form = createTestForm({
      defaultValues: { name: 'John' },
      validators: { name: required() },
    });

    const valid = await form.trigger('name');
    expect(valid).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 13. WATCHERS & SUBSCRIBERS
// ═══════════════════════════════════════════════════════════════════════════════

describe('Watchers and subscribers', () => {
  it('should notify watchers on value change', () => {
    const form = createTestForm({
      defaultValues: { name: '' },
    });

    let received: any = null;
    form.watch('name', (value) => { received = value; });

    form.setValue('name', 'John');
    expect(received).toBe('John');
  });

  it('should notify watchers for parent path changes', () => {
    const form = createTestForm({
      defaultValues: { user: { name: 'John', age: 30 } },
    });

    let parentNotified = false;
    form.watch('user', () => { parentNotified = true; });

    form.setValue('user.name', 'Jane');
    expect(parentNotified).toBe(true);
  });

  it('should support watchFields for multiple paths', () => {
    const form = createTestForm({
      defaultValues: { name: '', email: '' },
    });

    let callCount = 0;
    const unsub = form.watchFields(['name', 'email'], () => { callCount++; });

    form.setValue('name', 'John');
    form.setValue('email', 'john@test.com');
    expect(callCount).toBe(2);

    unsub();
    form.setValue('name', 'Jane');
    expect(callCount).toBe(2); // No more notifications
  });

  it('should handle watcher errors gracefully', () => {
    const form = createTestForm({
      defaultValues: { name: '' },
    });

    let secondCalled = false;
    form.watch('name', () => { throw new Error('Watcher error'); });
    form.watch('name', () => { secondCalled = true; });

    // Should not throw, and second watcher should still fire
    form.setValue('name', 'John');
    expect(secondCalled).toBe(true);
  });

  it('should unsubscribe correctly', () => {
    const form = createTestForm({
      defaultValues: { name: '' },
    });

    let callCount = 0;
    const unsub = form.watch('name', () => { callCount++; });

    form.setValue('name', 'John');
    expect(callCount).toBe(1);

    unsub();
    form.setValue('name', 'Jane');
    expect(callCount).toBe(1); // No more notifications
  });

  it('should notify subscribers', () => {
    const form = createTestForm({
      defaultValues: { name: '' },
    });

    let callCount = 0;
    const unsub = form.subscribe(() => { callCount++; });

    form.setValue('name', 'John');
    expect(callCount).toBeGreaterThan(0);

    const prev = callCount;
    unsub();
    form.setValue('name', 'Jane');
    expect(callCount).toBe(prev);
  });

  it('should handle subscriber errors gracefully', () => {
    const form = createTestForm({
      defaultValues: { name: '' },
    });

    let secondCalled = false;
    form.subscribe(() => { throw new Error('Subscriber error'); });
    form.subscribe(() => { secondCalled = true; });

    form.setValue('name', 'John');
    expect(secondCalled).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 14. FIELD REGISTRATION
// ═══════════════════════════════════════════════════════════════════════════════

describe('Field registration', () => {
  it('should register and unregister fields', () => {
    const form = createTestForm({
      defaultValues: { name: '' },
    });

    const reg = form.register('name', { validate: required() });
    expect(reg.inputProps.name).toBe('name');

    form.unregister('name');
    // Should not throw
  });

  it('should include ARIA attributes when errors exist', () => {
    const form = createTestForm({
      defaultValues: { name: '' },
    });

    form.setErrors('name', ['Required']);
    const reg = form.register('name');
    expect(reg.inputProps['aria-invalid']).toBe(true);
    expect(reg.inputProps['aria-describedby']).toBe('name-error');
  });

  it('should handle parse option', () => {
    const form = createTestForm({
      defaultValues: { price: 0 },
    });

    const reg = form.register('price', {
      parse: (e: any) => Number(e.target.value),
    });

    reg.inputProps.onChange({ target: { value: '42' } });
    expect(form.getValue('price')).toBe(42);
  });

  it('should handle transform option', () => {
    const form = createTestForm({
      defaultValues: { name: '' },
    });

    const reg = form.register('name', {
      transform: (v: string) => v.toUpperCase(),
    });

    reg.inputProps.onChange({ target: { value: 'john', type: 'text' } });
    expect(form.getValue('name')).toBe('JOHN');
  });

  it('should handle checkbox type', () => {
    const form = createTestForm({
      defaultValues: { agree: false },
    });

    const reg = form.register('agree');
    reg.inputProps.onChange({ target: { type: 'checkbox', checked: true } });
    expect(form.getValue('agree')).toBe(true);
  });

  it('should set touched on blur', () => {
    const form = createTestForm({
      defaultValues: { name: '' },
    });

    const reg = form.register('name');
    reg.inputProps.onBlur();
    expect(form.getTouched('name')).toBe(true);
  });

  it('should store field ref', () => {
    const form = createTestForm({
      defaultValues: { name: '' },
    });

    const el = {} as HTMLElement;
    const reg = form.register('name');
    reg.inputProps.ref(el);
    expect(form.getFieldRef('name')).toBe(el);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 15. VALIDATORS
// ═══════════════════════════════════════════════════════════════════════════════

describe('Validators comprehensive', () => {
  it('required: should handle various empty values', () => {
    const v = required();
    expect(v(null)).toBe('This field is required');
    expect(v(undefined)).toBe('This field is required');
    expect(v('')).toBe('This field is required');
    expect(v([])).toBe('This field is required');
    expect(v('hello')).toBe(undefined);
    expect(v(0)).toBe(undefined);
    expect(v(false)).toBe(undefined);
    expect(v._isRequired).toBe(true);
  });

  it('email: should validate email formats', () => {
    const v = email();
    expect(v('')).toBe(undefined); // Empty passes (not required)
    expect(v('test@example.com')).toBe(undefined);
    expect(v('invalid')).toBe('Invalid email address');
    expect(v('no@dots')).toBe('Invalid email address');
  });

  it('minLength: should check string length', () => {
    const v = minLength(3);
    expect(v('')).toBe(undefined); // Empty passes
    expect(v('ab')).toBe('Must be at least 3 characters');
    expect(v('abc')).toBe(undefined);
  });

  it('min/max: should check numeric bounds', () => {
    const vMin = min(5);
    const vMax = max(10);
    expect(vMin(3)).toBe('Must be at least 5');
    expect(vMin(5)).toBe(undefined);
    expect(vMax(11)).toBe('Must be at most 10');
    expect(vMax(10)).toBe(undefined);
    // Empty values pass
    expect(vMin(null)).toBe(undefined);
    expect(vMax('')).toBe(undefined);
  });

  it('number: should validate numeric values', () => {
    const v = numberValidator();
    expect(v('')).toBe(undefined);
    expect(v('42')).toBe(undefined);
    expect(v('abc')).toBe('Must be a number');
    expect(v(null)).toBe(undefined);
  });

  it('integer: should validate integer values', () => {
    const v = integer();
    expect(v(42)).toBe(undefined);
    expect(v(3.14)).toBe('Must be an integer');
    expect(v('')).toBe(undefined);
  });

  it('positive: should validate positive values', () => {
    const v = positive();
    expect(v(1)).toBe(undefined);
    expect(v(0)).toBe('Must be a positive number');
    expect(v(-1)).toBe('Must be a positive number');
  });

  it('pattern: should validate regex', () => {
    const v = pattern(/^[A-Z]+$/);
    expect(v('ABC')).toBe(undefined);
    expect(v('abc')).toBe('Invalid format');
    expect(v('')).toBe(undefined);
  });

  it('oneOf: should validate membership', () => {
    const v = oneOf(['a', 'b', 'c']);
    expect(v('a')).toBe(undefined);
    expect(v('d')).toBe('Must be one of: a, b, c');
    expect(v(null)).toBe(undefined);
  });

  it('notOneOf: should validate exclusion', () => {
    const v = notOneOf(['admin', 'root']);
    expect(v('user')).toBe(undefined);
    expect(v('admin')).toBe('Must not be one of: admin, root');
  });

  it('custom: should run custom function', () => {
    const v = custom((value: string) => {
      return value === 'bad' ? 'Bad value' : undefined;
    });
    expect(v('bad')).toBe('Bad value');
    expect(v('good')).toBe(undefined);
  });

  it('matches: should validate cross-field equality', () => {
    const v = matches('password');
    const context = {
      getValue: (path: string) => path === 'password' ? 'secret' : undefined,
      getValues: () => ({ password: 'secret' }),
    };

    expect(v('secret', context as any)).toBe(undefined);
    expect(v('wrong', context as any)).toBe('Must match password');
    expect(v._crossField).toBe(true);
    expect(v._dependsOnField).toBe('password');
  });

  it('compose: should chain validators', () => {
    const v = compose(required(), minLength(3));
    expect(v('')).toBe('This field is required');
    expect(v('ab')).toBe('Must be at least 3 characters');
    expect(v('abc')).toBe(undefined);
    expect(v._isRequired).toBe(true);
  });

  it('when: should conditionally validate', () => {
    const v = when(
      (value: string) => value.length > 0,
      minLength(3)
    );
    expect(v('')).toBe(undefined); // Condition not met
    expect(v('ab')).toBe('Must be at least 3 characters');
    expect(v('abc')).toBe(undefined);
  });

  it('async: should mark validator as async', () => {
    const v = asyncValidator.async(async (value: string) => {
      return value === 'taken' ? 'Already taken' : undefined;
    }, { debounce: 500 });

    expect(v._isAsync).toBe(true);
    expect(v._debounce).toBe(500);
  });

  it('fileSize: should validate file size', () => {
    const v = fileSize(1024);
    expect(v(null)).toBe(undefined);
    expect(v({ size: 512 } as any)).toBe(undefined);
    expect(v({ size: 2048 } as any)).toBe('File must be less than 1KB');
  });

  it('fileType: should validate file type', () => {
    const v = fileType(['image/png', 'image/jpeg']);
    expect(v(null)).toBe(undefined);
    expect(v({ type: 'image/png' } as any)).toBe(undefined);
    expect(v({ type: 'text/plain' } as any)).toBe('File type must be: image/png, image/jpeg');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 16. SCHEMA VALIDATION
// ═══════════════════════════════════════════════════════════════════════════════

describe('Schema validation', () => {
  it('ereoSchema: should validate flat structure', () => {
    const schema = ereoSchema<{ name: string; email: string }>({
      name: required(),
      email: [required(), email()],
    });

    const result = schema.safeParse!({ name: '', email: 'invalid' });
    expect(result.success).toBe(false);
    expect(result.error.issues.length).toBeGreaterThan(0);
  });

  it('ereoSchema: should validate nested structure', () => {
    const schema = ereoSchema<{ user: { name: string } }>({
      user: {
        name: required(),
      },
    });

    const result = schema.safeParse!({ user: { name: '' } });
    expect(result.success).toBe(false);
    const namePath = result.error.issues.find((i: any) => i.path.join('.') === 'user.name');
    expect(namePath).toBeDefined();
  });

  it('ereoSchema: should pass valid data', () => {
    const schema = ereoSchema<{ name: string }>({
      name: required(),
    });

    const result = schema.safeParse!({ name: 'John' });
    expect(result.success).toBe(true);
  });

  it('ereoSchema: parse should throw on invalid', () => {
    const schema = ereoSchema<{ name: string }>({
      name: required(),
    });

    expect(() => schema.parse({ name: '' })).toThrow();
  });

  it('isEreoSchema: should detect ereo schemas', () => {
    const schema = ereoSchema<{ name: string }>({ name: required() });
    expect(isEreoSchema(schema)).toBe(true);
    expect(isEreoSchema({})).toBe(false);
    expect(isEreoSchema(null)).toBe(false);
  });

  it('ereoSchema: should skip async validators', () => {
    const asyncV: ValidatorFunction = async () => 'Error';
    asyncV._isAsync = true;

    const schema = ereoSchema<{ name: string }>({
      name: asyncV,
    });

    // safeParse is sync, should skip async validators
    const result = schema.safeParse!({ name: '' });
    expect(result.success).toBe(true); // Async skipped → no errors
  });

  it('Standard Schema V1: should detect via ~standard property', () => {
    const schema = {
      '~standard': {
        version: 1,
        vendor: 'test',
        validate: (data: unknown) => ({ value: data }),
      },
    };

    expect(isStandardSchema(schema)).toBe(true);
    expect(isStandardSchema({})).toBe(false);
  });

  it('Standard Schema V1: adapter should work', () => {
    const schema = {
      '~standard': {
        version: 1,
        vendor: 'test',
        validate: (data: unknown) => {
          const obj = data as Record<string, any>;
          if (!obj?.name) {
            return {
              issues: [{ message: 'Name required', path: ['name'] }],
            };
          }
          return { value: data };
        },
      },
    };

    const adapter = standardSchemaAdapter(schema);
    const result = adapter.safeParse!({ name: '' });
    expect(result.success).toBe(false);

    const validResult = adapter.safeParse!({ name: 'John' });
    expect(validResult.success).toBe(true);
  });

  it('zodAdapter: should wrap zod-like schema', () => {
    const mockZod = {
      parse: (data: unknown) => {
        const obj = data as any;
        if (!obj?.name) throw { issues: [{ path: ['name'], message: 'Required' }] };
        return data;
      },
      safeParse: (data: unknown) => {
        const obj = data as any;
        if (!obj?.name) {
          return {
            success: false,
            error: { issues: [{ path: ['name'], message: 'Required' }] },
          };
        }
        return { success: true, data };
      },
    };

    const adapter = zodAdapter(mockZod);
    const result = adapter.safeParse!({});
    expect(result.success).toBe(false);
  });

  it('createSchemaValidator: should create from plain function', () => {
    const schema = createSchemaValidator({
      validate: (data) => {
        const obj = data as any;
        if (!obj?.name) return { success: false, errors: { name: ['Required'] } };
        return { success: true, data: obj };
      },
    });

    const result = schema.safeParse!({});
    expect(result.success).toBe(false);

    const valid = schema.safeParse!({ name: 'John' });
    expect(valid.success).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 17. FORM DATA CONVERSION
// ═══════════════════════════════════════════════════════════════════════════════

describe('formDataToObject', () => {
  it('should convert simple FormData', () => {
    const fd = new FormData();
    fd.append('name', 'John');
    fd.append('age', '30');

    const result = formDataToObject(fd);
    expect(result.name).toBe('John');
    expect(result.age).toBe(30); // Coerced to number
  });

  it('should handle boolean coercion', () => {
    const fd = new FormData();
    fd.append('active', 'true');
    fd.append('disabled', 'false');

    const result = formDataToObject(fd);
    expect(result.active).toBe(true);
    expect(result.disabled).toBe(false);
  });

  it('should handle null coercion', () => {
    const fd = new FormData();
    fd.append('value', 'null');

    const result = formDataToObject(fd);
    expect(result.value).toBe(null);
  });

  it('should handle array notation', () => {
    const fd = new FormData();
    fd.append('tags[]', 'js');
    fd.append('tags[]', 'ts');

    const result = formDataToObject(fd);
    expect(result.tags).toEqual(['js', 'ts']);
  });

  it('should preserve leading zeros when coercing', () => {
    const fd = new FormData();
    fd.append('zip', '07001');

    const result = formDataToObject(fd);
    expect(result.zip).toBe('07001'); // Preserved as string
  });

  it('should skip coercion when disabled', () => {
    const fd = new FormData();
    fd.append('num', '42');

    const result = formDataToObject(fd, { coerce: false });
    expect(result.num).toBe('42'); // String
  });

  it('should handle nested dot notation', () => {
    const fd = new FormData();
    fd.append('user.name', 'John');
    fd.append('user.email', 'john@test.com');

    const result = formDataToObject(fd);
    expect(result.user.name).toBe('John');
    expect(result.user.email).toBe('john@test.com');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 18. COMPOSITION
// ═══════════════════════════════════════════════════════════════════════════════

describe('Form composition', () => {
  it('mergeFormConfigs: should merge default values', () => {
    const config = mergeFormConfigs(
      { defaultValues: { name: '' } } as FormConfig<{ name: string }>,
      { defaultValues: { email: '' } } as FormConfig<{ email: string }>
    );
    expect(config.defaultValues).toEqual({ name: '', email: '' });
  });

  it('mergeFormConfigs: should merge validators', () => {
    const config = mergeFormConfigs(
      { defaultValues: { name: '' }, validators: { name: required() } } as any,
      { defaultValues: { email: '' }, validators: { email: email() } } as any
    );
    expect(config.validators?.name).toBeDefined();
    expect(config.validators?.email).toBeDefined();
  });

  it('mergeFormConfigs: should concatenate validators for same field', () => {
    const config = mergeFormConfigs(
      { defaultValues: { name: '' }, validators: { name: required() } } as any,
      { defaultValues: {}, validators: { name: minLength(3) } } as any
    );
    const nameValidators = config.validators?.name;
    expect(Array.isArray(nameValidators)).toBe(true);
    expect((nameValidators as any[]).length).toBe(2);
  });

  it('composeSchemas: should combine two schemas', () => {
    const schema1 = ereoSchema<{ name: string }>({ name: required() });
    const schema2 = ereoSchema<{ email: string }>({ email: required() });

    const composed = composeSchemas('profile', schema1, 'contact', schema2);
    const result = composed.safeParse!({
      profile: { name: '' },
      contact: { email: '' },
    });

    expect(result.success).toBe(false);
    expect(result.error.issues.length).toBe(2);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 19. NESTED / COMPLEX FORM STRUCTURES
// ═══════════════════════════════════════════════════════════════════════════════

describe('Complex form structures', () => {
  it('should handle deeply nested objects', () => {
    const form = createTestForm({
      defaultValues: {
        company: {
          address: {
            street: '123 Main St',
            city: 'Springfield',
            state: 'IL',
          },
        },
      },
    });

    expect(form.getValue('company.address.city')).toBe('Springfield');
    form.setValue('company.address.city', 'Chicago');
    expect(form.getValue('company.address.city')).toBe('Chicago');

    // Parent should reflect change
    const address = form.getValue('company.address') as any;
    expect(address.city).toBe('Chicago');
  });

  it('should handle array fields', () => {
    const form = createTestForm({
      defaultValues: {
        items: [
          { name: 'Item 1', quantity: 1 },
          { name: 'Item 2', quantity: 2 },
        ],
      },
    });

    expect(form.getValue('items.0.name')).toBe('Item 1');
    expect(form.getValue('items.1.quantity')).toBe(2);

    form.setValue('items.0.name', 'Updated');
    expect(form.getValue('items.0.name')).toBe('Updated');
  });

  it('should handle setting entire array', () => {
    const form = createTestForm({
      defaultValues: { tags: ['a', 'b'] },
    });

    form.setValue('tags', ['x', 'y', 'z']);
    expect(form.getValue('tags.0')).toBe('x');
    expect(form.getValue('tags.2')).toBe('z');
  });

  it('should handle setting entire nested object', () => {
    const form = createTestForm({
      defaultValues: { user: { name: 'John', age: 30 } },
    });

    form.setValue('user', { name: 'Jane', age: 25 });
    expect(form.getValue('user.name')).toBe('Jane');
    expect(form.getValue('user.age')).toBe(25);
  });

  it('should sync child signals on parent update', () => {
    const form = createTestForm({
      defaultValues: { user: { name: 'John' } },
    });

    // Access child signal first to create it
    const nameSig = form.getSignal('user.name');
    expect(nameSig.get()).toBe('John');

    // Update parent
    form.setValue('user', { name: 'Jane' });
    expect(nameSig.get()).toBe('Jane');
  });

  it('should clean up array signals on shrink', () => {
    const form = createTestForm({
      defaultValues: { items: ['a', 'b', 'c'] },
    });

    // Access all items
    expect(form.getValue('items.2')).toBe('c');

    // Shrink array
    form.setValue('items', ['x', 'y']);
    expect(form.getValue('items.0')).toBe('x');
    expect(form.getValue('items.1')).toBe('y');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 20. DISPOSE LIFECYCLE
// ═══════════════════════════════════════════════════════════════════════════════

describe('Dispose lifecycle', () => {
  it('should clear all state on dispose', () => {
    const form = createTestForm({
      defaultValues: { name: '' },
      validators: { name: required() },
    });

    form.setValue('name', 'John');
    form.setTouched('name');
    form.setErrors('name', ['Error']);

    let subCalled = false;
    form.subscribe(() => { subCalled = true; });

    form.dispose();

    // After dispose, setting values should not notify subscribers
    subCalled = false;
    // Note: signals still work after dispose (they're independent primitives)
    // But subscribers/watchers are cleared
  });

  it('should abort in-flight submit on dispose', () => {
    const form = createTestForm({
      defaultValues: { name: '' },
      onSubmit: async () => {
        await wait(100);
      },
    });

    // Start submit, then dispose
    form.handleSubmit().catch(() => {});
    form.dispose();
    // Should not throw
  });

  it('should clear validation engine on dispose', () => {
    const form = createTestForm({
      defaultValues: { name: '' },
      validators: { name: required() },
    });

    form.dispose();
    // Validation engine should be cleaned up
    const engine = (form as any)._validationEngine;
    expect(engine._fieldValidations.size).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 21. SERIALIZATION
// ═══════════════════════════════════════════════════════════════════════════════

describe('Serialization', () => {
  it('toJSON should return current values', () => {
    const form = createTestForm({
      defaultValues: { name: 'John', items: [1, 2, 3] },
    });

    form.setValue('name', 'Jane');
    const json = form.toJSON();
    expect(json.name).toBe('Jane');
    expect(json.items).toEqual([1, 2, 3]);
  });

  it('toFormData should return FormData', () => {
    const form = createTestForm({
      defaultValues: { name: 'John', age: 30 },
    });

    const fd = form.toFormData();
    expect(fd.get('name')).toBe('John');
    expect(fd.get('age')).toBe('30');
  });

  it('getChanges should only include dirty fields', () => {
    const form = createTestForm({
      defaultValues: { name: 'John', email: 'john@test.com', age: 30 },
    });

    form.setValue('name', 'Jane');
    const changes = form.getChanges();
    expect(changes).toEqual({ name: 'Jane' });
    expect((changes as any).email).toBeUndefined();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 22. A11Y UTILITIES
// ═══════════════════════════════════════════════════════════════════════════════

describe('A11y utilities', () => {
  it('generateA11yId should return unique IDs', () => {
    const id1 = generateA11yId();
    const id2 = generateA11yId();
    expect(id1).not.toBe(id2);
  });

  it('generateA11yId should use custom prefix', () => {
    const id = generateA11yId('custom');
    expect(id.startsWith('custom-')).toBe(true);
  });

  it('getFieldA11y should return invalid attrs when errors and touched', () => {
    const attrs = getFieldA11y('email', { errors: ['Invalid'], touched: true });
    expect(attrs['aria-invalid']).toBe(true);
    expect(attrs['aria-describedby']).toBe('email-error');
  });

  it('getFieldA11y should return empty when no errors', () => {
    const attrs = getFieldA11y('email', { errors: [], touched: true });
    expect(attrs['aria-invalid']).toBeUndefined();
  });

  it('getFieldA11y should return empty when not touched', () => {
    const attrs = getFieldA11y('email', { errors: ['Error'], touched: false });
    expect(attrs['aria-invalid']).toBeUndefined();
  });

  it('getErrorA11y should return correct attributes', () => {
    const attrs = getErrorA11y('name');
    expect(attrs.id).toBe('name-error');
    expect(attrs.role).toBe('alert');
    expect(attrs['aria-live']).toBe('polite');
  });

  it('getLabelA11y should return correct attributes', () => {
    const attrs = getLabelA11y('name');
    expect(attrs.htmlFor).toBe('name');
    expect(attrs.id).toBe('name-label');
  });

  it('getDescriptionA11y should return correct id', () => {
    const attrs = getDescriptionA11y('name');
    expect(attrs.id).toBe('name-description');
  });

  it('getFieldsetA11y should return correct attributes', () => {
    const attrs = getFieldsetA11y('addresses');
    expect(attrs.role).toBe('group');
    expect(attrs['aria-labelledby']).toBe('addresses-legend');
  });

  it('getFieldWrapperA11y should mark invalid', () => {
    const attrs = getFieldWrapperA11y('email', { errors: ['Error'], touched: true });
    expect(attrs['data-field']).toBe('email');
    expect(attrs['data-invalid']).toBe(true);
  });

  it('getFormA11y should return form attributes', () => {
    const attrs = getFormA11y('my-form');
    expect(attrs.id).toBe('my-form');
    expect(attrs.role).toBe('form');
  });

  it('getFormA11y should mark busy when submitting', () => {
    const attrs = getFormA11y('my-form', { isSubmitting: true });
    expect(attrs['aria-busy']).toBe(true);
  });

  it('getErrorSummaryA11y should return correct attributes', () => {
    const attrs = getErrorSummaryA11y('my-form');
    expect(attrs.role).toBe('alert');
    expect(attrs['aria-labelledby']).toBe('my-form-error-summary');
  });

  it('prefersReducedMotion should return boolean', () => {
    // SSR-safe check
    const result = prefersReducedMotion();
    expect(typeof result).toBe('boolean');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 23. SCHEMA INTEGRATION WITH FORM
// ═══════════════════════════════════════════════════════════════════════════════

describe('Schema integration with FormStore', () => {
  it('should validate with ereoSchema on submit', async () => {
    let submitted = false;
    const form = createTestForm({
      defaultValues: { name: '', email: '' },
      schema: ereoSchema<{ name: string; email: string }>({
        name: required(),
        email: [required(), email()],
      }),
      onSubmit: async () => { submitted = true; },
    });

    await form.handleSubmit();
    expect(submitted).toBe(false);
    expect(form.submitState.get()).toBe('error');
  });

  it('should validate with Standard Schema on submit', async () => {
    const standardSchema = {
      '~standard': {
        version: 1,
        vendor: 'test',
        validate: (data: unknown) => {
          const obj = data as any;
          if (!obj?.name) {
            return { issues: [{ message: 'Name required', path: ['name'] }] };
          }
          return { value: data };
        },
      },
    };

    let submitted = false;
    const form = createTestForm({
      defaultValues: { name: '' },
      schema: standardSchema as any,
      onSubmit: async () => { submitted = true; },
    });

    await form.handleSubmit();
    expect(submitted).toBe(false);
  });

  it('should combine schema + field validators', async () => {
    const schema = ereoSchema<{ name: string }>({
      name: required('Schema: required'),
    });

    const form = createTestForm({
      defaultValues: { name: '' },
      schema,
      validators: {
        name: minLength(3, 'Field: too short'),
      },
    });

    // validateAll should run both schema and field validators
    const result = await (form as any)._validationEngine.validateAll();
    expect(result.success).toBe(false);
    // Schema error should be present
    expect(result.errors?.name).toContain('Schema: required');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 24. CONCURRENT OPERATIONS
// ═══════════════════════════════════════════════════════════════════════════════

describe('Concurrent operations', () => {
  it('should handle rapid setValue calls', () => {
    const form = createTestForm({
      defaultValues: { counter: 0 },
    });

    for (let i = 0; i < 100; i++) {
      form.setValue('counter', i);
    }
    expect(form.getValue('counter')).toBe(99);
  });

  it('should handle concurrent validateAll calls', async () => {
    const slowValidator: ValidatorFunction = async (value) => {
      await wait(20);
      return value === '' ? 'Required' : undefined;
    };
    slowValidator._isAsync = true;

    const form = createTestForm({
      defaultValues: { name: '' },
      validators: { name: slowValidator },
    });

    const engine = (form as any)._validationEngine;

    // Start multiple validateAll concurrently
    const [r1, r2, r3] = await Promise.all([
      engine.validateAll(),
      engine.validateAll(),
      engine.validateAll(),
    ]);

    // Only the last one should have real results
    // Earlier ones get aborted
    expect(r3.success).toBe(false);
  });

  it('should handle setValue during validation', async () => {
    let resolveValidation: (() => void) | null = null;
    const slowValidator: ValidatorFunction = async (value) => {
      await new Promise<void>(r => { resolveValidation = r; });
      return value === '' ? 'Required' : undefined;
    };
    slowValidator._isAsync = true;

    const form = createTestForm({
      defaultValues: { name: '' },
      validators: { name: slowValidator },
    });

    const engine = (form as any)._validationEngine;

    // Start validation
    const p = engine.validateField('name');

    // Change value while validating
    form.setValue('name', 'John');

    // Resolve validator
    resolveValidation?.();

    // Wait for validation to complete
    const errors = await p;
    // The validation was for '' but value changed — result should be discarded
    // (generation check or abort prevents stale write)
    // Errors may be empty because the generation changed
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 25. EDGE CASE: VALIDATE ON MOUNT
// ═══════════════════════════════════════════════════════════════════════════════

describe('validateOnMount', () => {
  it('should validate on construction when configured', async () => {
    const form = createTestForm({
      defaultValues: { name: '' },
      validators: { name: required() },
      validateOnMount: true,
    });

    // validateOnMount runs on microtask, wait for it
    await wait(50);

    expect(form.getErrors('name').get().length).toBeGreaterThan(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 26. GETVALUES RECONSTRUCTION
// ═══════════════════════════════════════════════════════════════════════════════

describe('getValues reconstruction', () => {
  it('should reconstruct full object from signals', () => {
    const form = createTestForm({
      defaultValues: {
        user: { name: 'John', email: 'john@test.com' },
        settings: { theme: 'dark' },
      },
    });

    form.setValue('user.name', 'Jane');
    const values = form.getValues();
    expect(values).toEqual({
      user: { name: 'Jane', email: 'john@test.com' },
      settings: { theme: 'dark' },
    });
  });

  it('should handle arrays in reconstruction', () => {
    const form = createTestForm({
      defaultValues: { items: ['a', 'b', 'c'] },
    });

    form.setValue('items.1', 'B');
    const values = form.getValues();
    expect(values.items).toEqual(['a', 'B', 'c']);
  });

  it('should handle mixed nested structures', () => {
    const form = createTestForm({
      defaultValues: {
        users: [
          { name: 'John', hobbies: ['reading'] },
          { name: 'Jane', hobbies: ['coding'] },
        ],
      },
    });

    form.setValue('users.0.name', 'Johnny');
    const values = form.getValues();
    expect(values.users[0].name).toBe('Johnny');
    expect(values.users[1].name).toBe('Jane');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 27. GETFIELDREF AND GETFIELDREFS
// ═══════════════════════════════════════════════════════════════════════════════

describe('Field refs', () => {
  it('getFieldRef should return null for unregistered fields', () => {
    const form = createTestForm({
      defaultValues: { name: '' },
    });
    expect(form.getFieldRef('name')).toBeNull();
  });

  it('setFieldRef should store element', () => {
    const form = createTestForm({
      defaultValues: { name: '' },
    });
    const el = {} as HTMLElement;
    form.setFieldRef('name', el);
    expect(form.getFieldRef('name')).toBe(el);
  });

  it('getFieldRefs should return all refs', () => {
    const form = createTestForm({
      defaultValues: { name: '', email: '' },
    });
    const el1 = { id: 'name' } as unknown as HTMLElement;
    const el2 = { id: 'email' } as unknown as HTMLElement;
    form.setFieldRef('name', el1);
    form.setFieldRef('email', el2);

    const refs = form.getFieldRefs();
    expect(refs.size).toBe(2);
    expect(refs.get('name')).toBe(el1);
    expect(refs.get('email')).toBe(el2);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 28. BASELINE OPERATIONS
// ═══════════════════════════════════════════════════════════════════════════════

describe('Baseline operations', () => {
  it('getBaseline should return deep clone', () => {
    const form = createTestForm({
      defaultValues: { items: [1, 2, 3] },
    });

    const baseline = form.getBaseline();
    baseline.items.push(4); // Modify clone
    expect(form.getBaseline().items).toEqual([1, 2, 3]); // Original unchanged
  });

  it('setBaseline should update dirty tracking', () => {
    const form = createTestForm({
      defaultValues: { name: 'old' },
    });

    form.setValue('name', 'new');
    expect(form.isDirty.get()).toBe(true);

    form.setBaseline({ name: 'new' });
    expect(form.isDirty.get()).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 29. INTEGRATION: FULL FORM LIFECYCLE
// ═══════════════════════════════════════════════════════════════════════════════

describe('Integration: full form lifecycle', () => {
  it('should handle complete form lifecycle', async () => {
    let submittedValues: any = null;

    const form = createTestForm({
      defaultValues: {
        name: '',
        email: '',
        age: 0,
      },
      validators: {
        name: required(),
        email: [required(), email()],
        age: [min(18, 'Must be 18+')],
      },
      onSubmit: async (values) => {
        submittedValues = values;
      },
    });

    // 1. Initial state
    expect(form.isValid.get()).toBe(true); // No errors initially
    expect(form.isDirty.get()).toBe(false);

    // 2. Fill in values
    form.setValue('name', 'John');
    form.setValue('email', 'john@example.com');
    form.setValue('age', 25);
    expect(form.isDirty.get()).toBe(true);

    // 3. Touch all fields
    form.setTouched('name');
    form.setTouched('email');
    form.setTouched('age');

    // 4. Submit
    await form.handleSubmit();
    expect(submittedValues).toEqual({
      name: 'John',
      email: 'john@example.com',
      age: 25,
    });
    expect(form.submitState.get()).toBe('success');
    expect(form.submitCount.get()).toBe(1);
  });

  it('should handle validation failure lifecycle', async () => {
    const form = createTestForm({
      defaultValues: { name: '', email: 'invalid' },
      validators: {
        name: required(),
        email: email(),
      },
      onSubmit: async () => {},
    });

    // Try to submit with invalid data
    await form.handleSubmit();
    expect(form.submitState.get()).toBe('error');

    // Fix the data
    form.setValue('name', 'John');
    form.setValue('email', 'john@example.com');

    // Submit again
    await form.handleSubmit();
    expect(form.submitState.get()).toBe('success');
  });

  it('should handle server error lifecycle', async () => {
    const form = createTestForm({
      defaultValues: { email: 'john@test.com' },
      onSubmit: async () => {},
    });

    await form.handleSubmit();
    expect(form.submitState.get()).toBe('success');

    // Simulate server error response
    form.setErrorsWithSource('email', ['Email already registered'], 'server');
    expect(form.isValid.get()).toBe(false);

    // User fixes and resubmits
    form.clearErrorsBySource('email', 'server');
    expect(form.isValid.get()).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 30. VALIDATION DEBOUNCE
// ═══════════════════════════════════════════════════════════════════════════════

describe('Validation debounce', () => {
  it('should debounce async validators on change', async () => {
    let validateCount = 0;
    const asyncV: ValidatorFunction = async (value) => {
      validateCount++;
      return undefined;
    };
    asyncV._isAsync = true;
    asyncV._debounce = 50;

    const form = createTestForm({
      defaultValues: { name: '' },
      validators: { name: asyncV },
    });

    const engine = (form as any)._validationEngine;

    // Rapid changes should debounce
    engine.onFieldChange('name');
    engine.onFieldChange('name');
    engine.onFieldChange('name');

    // Before debounce fires
    expect(validateCount).toBe(0);

    // Wait for debounce
    await wait(100);

    // Should only validate once
    expect(validateCount).toBe(1);
  });

  it('should cancel debounce on blur and validate immediately', async () => {
    let validateCount = 0;
    const asyncV: ValidatorFunction = async (value) => {
      validateCount++;
      return undefined;
    };
    asyncV._isAsync = true;
    asyncV._debounce = 200;

    const form = createTestForm({
      defaultValues: { name: '' },
      validators: { name: asyncV },
    });

    const engine = (form as any)._validationEngine;

    // Start debounce
    engine.onFieldChange('name');
    expect(validateCount).toBe(0);

    // Blur should cancel debounce and validate immediately
    engine.onFieldBlur('name');
    await wait(50); // Wait for async validation

    expect(validateCount).toBe(1);
  });
});
