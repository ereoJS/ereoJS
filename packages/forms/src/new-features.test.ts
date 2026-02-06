import { describe, expect, test, beforeEach } from 'bun:test';
import { FormStore } from './store';
import { required, minLength, async as asyncValidator } from './validators';
import { ValidationEngine } from './validation-engine';

// ─── Test Form ────────────────────────────────────────────────────────────────

interface TestForm {
  name: string;
  email: string;
  age: number;
  address: {
    city: string;
    zip: string;
  };
}

const defaultValues: TestForm = {
  name: '',
  email: '',
  age: 0,
  address: { city: '', zip: '' },
};

// ─── resetField Tests ─────────────────────────────────────────────────────────

describe('resetField', () => {
  let store: FormStore<TestForm>;

  beforeEach(() => {
    store = new FormStore<TestForm>({
      defaultValues,
      validators: { name: required() } as any,
    });
  });

  test('resets value to baseline', () => {
    store.setValue('name' as any, 'Alice');
    expect(store.getValue('name' as any)).toBe('Alice');

    store.resetField('name' as any);
    expect(store.getValue('name' as any)).toBe('');
  });

  test('clears errors', () => {
    store.setErrors('name' as any, ['Required']);
    expect(store.getErrors('name' as any).get()).toEqual(['Required']);

    store.resetField('name' as any);
    expect(store.getErrors('name' as any).get()).toEqual([]);
  });

  test('clears touched state', () => {
    store.setTouched('name' as any, true);
    expect(store.getTouched('name' as any)).toBe(true);

    store.resetField('name' as any);
    expect(store.getTouched('name' as any)).toBe(false);
  });

  test('clears dirty state', () => {
    store.setValue('name' as any, 'Alice');
    expect(store.getDirty('name' as any)).toBe(true);

    store.resetField('name' as any);
    expect(store.getDirty('name' as any)).toBe(false);
    expect(store.isDirty.get()).toBe(false);
  });

  test('does not affect other fields', () => {
    store.setValue('name' as any, 'Alice');
    store.setValue('email' as any, 'alice@test.com');
    store.setTouched('email' as any, true);

    store.resetField('name' as any);

    // email should be unchanged
    expect(store.getValue('email' as any)).toBe('alice@test.com');
    expect(store.getTouched('email' as any)).toBe(true);
    expect(store.getDirty('email' as any)).toBe(true);
  });

  test('resets nested field', () => {
    store.setValue('address.city' as any, 'NYC');
    store.setTouched('address.city' as any, true);

    store.resetField('address.city' as any);

    expect(store.getValue('address.city' as any)).toBe('');
    expect(store.getTouched('address.city' as any)).toBe(false);
    expect(store.getDirty('address.city' as any)).toBe(false);
  });
});

// ─── trigger Tests ────────────────────────────────────────────────────────────

describe('trigger', () => {
  test('validates single field and returns true when valid', async () => {
    const store = new FormStore<TestForm>({
      defaultValues: { ...defaultValues, name: 'Alice' },
      validators: { name: required() } as any,
    });

    const result = await store.trigger('name' as any);
    expect(result).toBe(true);
  });

  test('validates single field and returns false when invalid', async () => {
    const store = new FormStore<TestForm>({
      defaultValues,
      validators: { name: required() } as any,
    });

    const result = await store.trigger('name' as any);
    expect(result).toBe(false);
  });

  test('touches the field so errors become visible', async () => {
    const store = new FormStore<TestForm>({
      defaultValues,
      validators: { name: required() } as any,
    });

    expect(store.getTouched('name' as any)).toBe(false);
    await store.trigger('name' as any);
    expect(store.getTouched('name' as any)).toBe(true);
  });

  test('sets errors on the field', async () => {
    const store = new FormStore<TestForm>({
      defaultValues,
      validators: { name: required() } as any,
    });

    await store.trigger('name' as any);
    expect(store.getErrors('name' as any).get()).toEqual(['This field is required']);
  });

  test('validates all fields when no path given', async () => {
    const store = new FormStore<TestForm>({
      defaultValues,
      validators: {
        name: required(),
        email: required(),
      } as any,
    });

    const result = await store.trigger();
    expect(result).toBe(false);
    expect(store.getErrors('name' as any).get().length).toBeGreaterThan(0);
    expect(store.getErrors('email' as any).get().length).toBeGreaterThan(0);
  });

  test('validates all and returns true when all valid', async () => {
    const store = new FormStore<TestForm>({
      defaultValues: { ...defaultValues, name: 'Alice', email: 'alice@test.com' },
      validators: {
        name: required(),
        email: required(),
      } as any,
    });

    const result = await store.trigger();
    expect(result).toBe(true);
  });

  test('touches all validated fields when validating all', async () => {
    const store = new FormStore<TestForm>({
      defaultValues,
      validators: {
        name: required(),
        email: required(),
      } as any,
    });

    // Fields have validators registered via config — trigger() should touch them
    expect(store.getTouched('name' as any)).toBe(false);
    expect(store.getTouched('email' as any)).toBe(false);

    await store.trigger();

    expect(store.getTouched('name' as any)).toBe(true);
    expect(store.getTouched('email' as any)).toBe(true);
  });
});

// ─── focusOnError Tests ───────────────────────────────────────────────────────

describe('focusOnError config', () => {
  test('default behavior: focusOnError is enabled by default', async () => {
    const store = new FormStore<TestForm>({
      defaultValues,
      validators: { name: required() } as any,
      onSubmit: async () => {},
    });

    // Just verify the config doesn't have focusOnError set explicitly
    expect(store.config.focusOnError).toBeUndefined();
    // The behavior itself (calling focusFirstError) is tested via integration
    // since we can't easily mock document in Bun without jsdom
  });

  test('focusOnError: false does not focus', async () => {
    const store = new FormStore<TestForm>({
      defaultValues,
      validators: { name: required() } as any,
      focusOnError: false,
      onSubmit: async () => {},
    });

    expect(store.config.focusOnError).toBe(false);
    // submitWith should not throw even when focusFirstError would need document
    await store.submitWith(async () => {});
    // If focusFirstError was called without document, it would silently return (SSR guard)
    // The key thing is this doesn't error
  });
});

// ─── Sync-gate-async Tests ────────────────────────────────────────────────────

describe('Sync validators gate async validators', () => {
  test('sync validators fail → async validators NOT called', async () => {
    let asyncCallCount = 0;

    const asyncVal = asyncValidator<string>(async () => {
      asyncCallCount++;
      return undefined;
    });

    const store = new FormStore({
      defaultValues: { username: '' },
      validators: {
        username: [required(), asyncVal],
      } as any,
    });

    const engine = (store as any)._validationEngine as ValidationEngine<any>;
    const errors = await engine.validateField('username');

    expect(errors).toEqual(['This field is required']);
    expect(asyncCallCount).toBe(0);
  });

  test('sync validators pass → async validators ARE called', async () => {
    let asyncCallCount = 0;

    const asyncVal = asyncValidator<string>(async () => {
      asyncCallCount++;
      return 'Username taken';
    });

    const store = new FormStore({
      defaultValues: { username: 'alice' },
      validators: {
        username: [required(), asyncVal],
      } as any,
    });

    const engine = (store as any)._validationEngine as ValidationEngine<any>;
    const errors = await engine.validateField('username');

    expect(errors).toEqual(['Username taken']);
    expect(asyncCallCount).toBe(1);
  });

  test('multiple sync fail → async not called', async () => {
    let asyncCallCount = 0;

    const asyncVal = asyncValidator<string>(async () => {
      asyncCallCount++;
      return undefined;
    });

    const store = new FormStore({
      defaultValues: { password: '' },
      validators: {
        password: [required(), minLength(8), asyncVal],
      } as any,
    });

    const engine = (store as any)._validationEngine as ValidationEngine<any>;
    const errors = await engine.validateField('password');

    // required() should fail, minLength shouldn't even matter since required fails first
    expect(errors.length).toBeGreaterThan(0);
    expect(asyncCallCount).toBe(0);
  });

  test('sync-gate-async works in validateAll too', async () => {
    let asyncCallCount = 0;

    const asyncVal = asyncValidator<string>(async () => {
      asyncCallCount++;
      return undefined;
    });

    const store = new FormStore({
      defaultValues: { username: '' },
      validators: {
        username: [required(), asyncVal],
      } as any,
    });

    const engine = (store as any)._validationEngine as ValidationEngine<any>;
    const result = await engine.validateAll();

    expect(result.success).toBe(false);
    expect(asyncCallCount).toBe(0);
  });

  test('all sync pass in validateAll → async runs', async () => {
    let asyncCallCount = 0;

    const asyncVal = asyncValidator<string>(async () => {
      asyncCallCount++;
      return undefined;
    });

    const store = new FormStore({
      defaultValues: { username: 'alice' },
      validators: {
        username: [required(), asyncVal],
      } as any,
    });

    const engine = (store as any)._validationEngine as ValidationEngine<any>;
    const result = await engine.validateAll();

    expect(result.success).toBe(true);
    expect(asyncCallCount).toBe(1);
  });
});
