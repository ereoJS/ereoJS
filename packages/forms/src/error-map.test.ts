import { describe, expect, test, beforeEach } from 'bun:test';
import { FormStore } from './store';
import { required, matches } from './validators';
import type { ErrorSource } from './types';

// ─── Test Form ────────────────────────────────────────────────────────────────

interface TestForm {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
}

const defaultValues: TestForm = {
  name: '',
  email: '',
  password: '',
  confirmPassword: '',
};

const EMPTY_ERROR_MAP: Record<ErrorSource, string[]> = {
  sync: [],
  async: [],
  schema: [],
  server: [],
  manual: [],
};

// ─── Error Map Tests ──────────────────────────────────────────────────────────

describe('Error Map (Error Origin Tracking)', () => {
  let store: FormStore<TestForm>;

  beforeEach(() => {
    store = new FormStore<TestForm>({ defaultValues });
  });

  // 1
  test('getErrorMap returns empty map by default', () => {
    const errorMap = store.getErrorMap('name' as any).get();
    expect(errorMap).toEqual(EMPTY_ERROR_MAP);
  });

  // 2
  test('setErrorsWithSource stores errors under correct source', () => {
    store.setErrorsWithSource('name' as any, ['Required'], 'sync');
    const errorMap = store.getErrorMap('name' as any).get();
    expect(errorMap.sync).toEqual(['Required']);
    expect(errorMap.async).toEqual([]);
    expect(errorMap.schema).toEqual([]);
    expect(errorMap.server).toEqual([]);
    expect(errorMap.manual).toEqual([]);
  });

  // 3
  test('setErrorsWithSource updates flat errors', () => {
    store.setErrorsWithSource('name' as any, ['Required'], 'sync');
    const flatErrors = store.getErrors('name' as any).get();
    expect(flatErrors).toContain('Required');
  });

  // 4
  test('multiple sources accumulate in flat errors', () => {
    store.setErrorsWithSource('name' as any, ['Required'], 'sync');
    store.setErrorsWithSource('name' as any, ['Name already taken'], 'server');
    const flatErrors = store.getErrors('name' as any).get();
    expect(flatErrors).toContain('Required');
    expect(flatErrors).toContain('Name already taken');
    expect(flatErrors).toHaveLength(2);
  });

  // 5
  test('clearErrorsBySource only clears specified source', () => {
    store.setErrorsWithSource('name' as any, ['Required'], 'sync');
    store.setErrorsWithSource('name' as any, ['Name already taken'], 'server');

    store.clearErrorsBySource('name' as any, 'server');

    const errorMap = store.getErrorMap('name' as any).get();
    expect(errorMap.sync).toEqual(['Required']);
    expect(errorMap.server).toEqual([]);

    const flatErrors = store.getErrors('name' as any).get();
    expect(flatErrors).toEqual(['Required']);
  });

  // 6
  test('clearErrors clears all sources', () => {
    store.setErrorsWithSource('name' as any, ['Required'], 'sync');
    store.setErrorsWithSource('name' as any, ['Name already taken'], 'server');
    store.setErrorsWithSource('name' as any, ['Custom error'], 'manual');

    store.clearErrors('name' as any);

    const errorMap = store.getErrorMap('name' as any).get();
    expect(errorMap).toEqual(EMPTY_ERROR_MAP);

    const flatErrors = store.getErrors('name' as any).get();
    expect(flatErrors).toEqual([]);
  });

  // 7
  test('setErrors tags with manual source', () => {
    // Initialize the error map for this path (lazy creation)
    const errorMap = store.getErrorMap('name' as any);
    expect(errorMap.get()).toEqual(EMPTY_ERROR_MAP);

    store.setErrors('name' as any, ['Custom error']);

    expect(errorMap.get().manual).toEqual(['Custom error']);
  });

  // 8
  test('sync validation tags errors with sync source', async () => {
    const storeWithValidation = new FormStore<TestForm>({
      defaultValues: { ...defaultValues, name: 'Alice' },
      validators: { name: required() } as any,
    });

    // Register the field with validateOn: 'change' to trigger on change
    storeWithValidation.register('name' as any, {
      validate: [required()],
      validateOn: 'change',
    });

    // Initialize error map so it tracks sources
    storeWithValidation.getErrorMap('name' as any);

    // Set value to empty string to trigger validation (value must change to trigger)
    storeWithValidation.setValue('name' as any, '');

    // Wait for validation to complete
    await new Promise(r => setTimeout(r, 50));

    const errorMap = storeWithValidation.getErrorMap('name' as any).get();
    expect(errorMap.sync).toEqual(['This field is required']);

    storeWithValidation.dispose();
  });

  // 9
  test('schema validation tags errors with schema source', async () => {
    const failingSchema = {
      parse: (d: any) => d,
      safeParse: (_d: any) => ({
        success: false as const,
        error: {
          issues: [{ path: ['name'], message: 'Schema error' }],
        },
      }),
    };

    const storeWithSchema = new FormStore<TestForm>({
      defaultValues,
      schema: failingSchema as any,
    });

    // Initialize error map so it tracks sources
    storeWithSchema.getErrorMap('name' as any);

    await storeWithSchema.validate();

    const errorMap = storeWithSchema.getErrorMap('name' as any).get();
    expect(errorMap.schema).toEqual(['Schema error']);

    storeWithSchema.dispose();
  });

  // 10
  test('clearErrorsBySource for non-existent path does nothing', () => {
    // Should not throw
    expect(() => {
      store.clearErrorsBySource('nonexistent' as any, 'server');
    }).not.toThrow();
  });

  // 11
  test('error map isValid stays in sync', () => {
    // Initially valid
    expect(store.isValid.get()).toBe(true);

    // Set errors with source -> isValid should be false
    store.setErrorsWithSource('name' as any, ['Required'], 'sync');
    expect(store.isValid.get()).toBe(false);

    // Clear all errors -> isValid should be true
    store.clearErrors('name' as any);
    expect(store.isValid.get()).toBe(true);
  });
});
