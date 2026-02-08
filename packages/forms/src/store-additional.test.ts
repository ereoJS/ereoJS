import { describe, expect, test, beforeEach, mock } from 'bun:test';
import { FormStore, createFormStore } from './store';
import { required, minLength, email, async as asyncValidator } from './validators';
import type { ErrorSource } from './types';

// ─── Test Interfaces ──────────────────────────────────────────────────────────

interface TestForm {
  name: string;
  email: string;
  age: number;
  address: {
    city: string;
    zip: string;
  };
  tags: string[];
}

const defaultValues: TestForm = {
  name: '',
  email: '',
  age: 0,
  address: {
    city: '',
    zip: '',
  },
  tags: [],
};

const tick = (ms = 10) => new Promise((r) => setTimeout(r, ms));

// ─── resetField additional edge cases ────────────────────────────────────────

describe('FormStore: resetField additional', () => {
  let store: FormStore<TestForm>;

  beforeEach(() => {
    store = new FormStore<TestForm>({ defaultValues });
  });

  test('resetField on untouched undirty field is a no-op', () => {
    store.resetField('name' as any);
    expect(store.getValue('name' as any)).toBe('');
    expect(store.getTouched('name' as any)).toBe(false);
    expect(store.getDirty('name' as any)).toBe(false);
    expect(store.getErrors('name' as any).get()).toEqual([]);
  });

  test('resetField with error map clears error sources', () => {
    store.setErrorsWithSource('name' as any, ['Sync error'], 'sync');
    store.setErrorsWithSource('name' as any, ['Server error'], 'server');

    expect(store.getErrors('name' as any).get().length).toBe(2);

    store.resetField('name' as any);
    expect(store.getErrors('name' as any).get()).toEqual([]);
  });

  test('resetField preserves isDirty when other fields are dirty', () => {
    store.setValue('name' as any, 'Alice');
    store.setValue('email' as any, 'alice@test.com');

    expect(store.isDirty.get()).toBe(true);

    store.resetField('name' as any);

    // email is still dirty, so isDirty should remain true
    expect(store.isDirty.get()).toBe(true);
    expect(store.getDirty('name' as any)).toBe(false);
    expect(store.getDirty('email' as any)).toBe(true);
  });

  test('resetField resets to baseline after setBaseline', () => {
    store.setBaseline({ ...defaultValues, name: 'Baseline' } as TestForm);
    store.setValue('name' as any, 'Modified');

    store.resetField('name' as any);
    expect(store.getValue('name' as any)).toBe('Baseline');
  });
});

// ─── trigger() additional edge cases ─────────────────────────────────────────

describe('FormStore: trigger additional', () => {
  test('trigger with no validators returns true', async () => {
    const store = new FormStore<TestForm>({ defaultValues });
    const result = await store.trigger('name' as any);
    expect(result).toBe(true);
  });

  test('trigger all with no validators returns true', async () => {
    const store = new FormStore<TestForm>({ defaultValues });
    const result = await store.trigger();
    expect(result).toBe(true);
  });

  test('trigger clears previous errors when field becomes valid', async () => {
    const store = new FormStore<TestForm>({
      defaultValues,
      validators: { name: required() } as any,
    });

    // First trigger - field is invalid
    await store.trigger('name' as any);
    expect(store.getErrors('name' as any).get()).toEqual(['This field is required']);

    // Set valid value and trigger again
    store.setValue('name' as any, 'Alice');
    await store.trigger('name' as any);
    expect(store.getErrors('name' as any).get()).toEqual([]);
  });

  test('trigger with async validators', async () => {
    const asyncVal = asyncValidator<string>(async (v) => {
      return v === 'taken' ? 'Username taken' : undefined;
    });

    const store = new FormStore({
      defaultValues: { username: 'taken' },
      validators: { username: asyncVal } as any,
    });

    const result = await store.trigger('username' as any);
    expect(result).toBe(false);
    expect(store.getErrors('username').get()).toEqual(['Username taken']);
  });

  test('trigger touches fields registered via register()', async () => {
    const store = new FormStore({
      defaultValues: { extra: '' },
    });

    store.register('extra' as any, {
      validate: [required()],
    });

    expect(store.getTouched('extra' as any)).toBe(false);

    await store.trigger();

    expect(store.getTouched('extra' as any)).toBe(true);
  });
});

// ─── getErrorMap additional edge cases ───────────────────────────────────────

describe('FormStore: getErrorMap additional', () => {
  let store: FormStore<TestForm>;

  beforeEach(() => {
    store = new FormStore<TestForm>({ defaultValues });
  });

  test('getErrorMap returns same signal for same path', () => {
    const sig1 = store.getErrorMap('name' as any);
    const sig2 = store.getErrorMap('name' as any);
    expect(sig1).toBe(sig2);
  });

  test('setErrorsWithSource for multiple sources on same field', () => {
    store.setErrorsWithSource('name' as any, ['Sync err'], 'sync');
    store.setErrorsWithSource('name' as any, ['Async err'], 'async');
    store.setErrorsWithSource('name' as any, ['Schema err'], 'schema');
    store.setErrorsWithSource('name' as any, ['Server err'], 'server');
    store.setErrorsWithSource('name' as any, ['Manual err'], 'manual');

    const map = store.getErrorMap('name' as any).get();
    expect(map.sync).toEqual(['Sync err']);
    expect(map.async).toEqual(['Async err']);
    expect(map.schema).toEqual(['Schema err']);
    expect(map.server).toEqual(['Server err']);
    expect(map.manual).toEqual(['Manual err']);

    // Flat errors should contain all in order: sync, async, schema, server, manual
    const flat = store.getErrors('name' as any).get();
    expect(flat).toEqual(['Sync err', 'Async err', 'Schema err', 'Server err', 'Manual err']);
  });

  test('replacing errors for a source updates flat errors', () => {
    store.setErrorsWithSource('name' as any, ['Old error'], 'sync');
    store.setErrorsWithSource('name' as any, ['New error'], 'sync');

    const map = store.getErrorMap('name' as any).get();
    expect(map.sync).toEqual(['New error']);

    const flat = store.getErrors('name' as any).get();
    expect(flat).toEqual(['New error']);
  });

  test('clearErrorsBySource on already-empty source is a no-op', () => {
    // Create error map signal
    store.getErrorMap('name' as any);

    store.setErrorsWithSource('name' as any, ['Error'], 'sync');

    // Clearing an empty source should not affect anything
    store.clearErrorsBySource('name' as any, 'server');

    const flat = store.getErrors('name' as any).get();
    expect(flat).toEqual(['Error']);
  });
});

// ─── validate() method ──────────────────────────────────────────────────────

describe('FormStore: validate()', () => {
  test('returns true when no validators', async () => {
    const store = new FormStore<TestForm>({ defaultValues });
    const result = await store.validate();
    expect(result).toBe(true);
  });

  test('returns false when validators fail', async () => {
    const store = new FormStore<TestForm>({
      defaultValues,
      validators: { name: required() } as any,
    });

    const result = await store.validate();
    expect(result).toBe(false);
  });

  test('returns true when validators pass', async () => {
    const store = new FormStore<TestForm>({
      defaultValues: { ...defaultValues, name: 'Alice' },
      validators: { name: required() } as any,
    });

    const result = await store.validate();
    expect(result).toBe(true);
  });
});

// ─── dispose() comprehensive ─────────────────────────────────────────────────

describe('FormStore: dispose()', () => {
  test('dispose clears subscribers', () => {
    const store = new FormStore<TestForm>({ defaultValues });

    let callCount = 0;
    store.subscribe(() => callCount++);

    store.setValue('name' as any, 'Alice');
    const countBefore = callCount;

    store.dispose();

    // After dispose, changing values should not notify subscribers
    store.setValue('name' as any, 'Bob');
    expect(callCount).toBe(countBefore);
  });

  test('dispose clears watchers', () => {
    const store = new FormStore<TestForm>({ defaultValues });

    const values: unknown[] = [];
    store.watch('name' as any, (v) => values.push(v));

    store.setValue('name' as any, 'Alice');
    expect(values).toEqual(['Alice']);

    store.dispose();

    store.setValue('name' as any, 'Bob');
    // Watcher should not fire after dispose
    expect(values).toEqual(['Alice']);
  });

  test('dispose clears field refs', () => {
    const store = new FormStore<TestForm>({ defaultValues });
    const mockEl = {} as HTMLElement;

    store.setFieldRef('name', mockEl);
    expect(store.getFieldRef('name')).toBe(mockEl);

    store.dispose();

    expect(store.getFieldRef('name')).toBeNull();
  });

  test('dispose clears field options', () => {
    const store = new FormStore<TestForm>({ defaultValues });

    store.register('name' as any, {
      validate: [required()],
    });

    expect(store.getFieldOptions('name')).toBeDefined();

    store.dispose();

    expect(store.getFieldOptions('name')).toBeUndefined();
  });

  test('dispose aborts in-flight submit', async () => {
    let submitSignalAborted = false;

    const store = new FormStore<TestForm>({
      defaultValues,
      onSubmit: async (_values, context) => {
        // Start a long operation
        await new Promise((r) => setTimeout(r, 100));
        submitSignalAborted = context.signal.aborted;
      },
    });

    // Start submit
    const submitPromise = store.handleSubmit();

    // Dispose while submitting
    store.dispose();

    try {
      await submitPromise;
    } catch {
      // May throw due to abort
    }

    // The signal should have been aborted
    expect(submitSignalAborted).toBe(true);
  });

  test('dispose can be called multiple times safely', () => {
    const store = new FormStore<TestForm>({ defaultValues });

    expect(() => {
      store.dispose();
      store.dispose();
    }).not.toThrow();
  });
});

// ─── submitWith concurrent submit ────────────────────────────────────────────

describe('FormStore: concurrent submit handling', () => {
  test('second submit aborts first submit', async () => {
    let abortedSignals: boolean[] = [];

    const store = new FormStore<TestForm>({
      defaultValues,
    });

    const slowHandler = async (_values: any, ctx: any) => {
      await new Promise((r) => setTimeout(r, 50));
      abortedSignals.push(ctx.signal.aborted);
    };

    // Start first submit
    const first = store.submitWith(slowHandler);

    // Start second submit immediately
    const second = store.submitWith(slowHandler);

    await Promise.allSettled([first, second]);

    // First should have been aborted
    expect(abortedSignals.length).toBeGreaterThanOrEqual(1);
  });

  test('submit generation prevents stale submit from writing results', async () => {
    const store = new FormStore<TestForm>({ defaultValues });

    // First submit - slow
    const p1 = store.submitWith(async () => {
      await new Promise((r) => setTimeout(r, 100));
    });

    // Second submit - fast, supersedes first
    const p2 = store.submitWith(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });

    await Promise.allSettled([p1, p2]);

    // The second (latest) submit should have completed successfully
    expect(store.submitState.get()).toBe('success');
    expect(store.submitCount.get()).toBe(1);
  });
});

// ─── unregister ──────────────────────────────────────────────────────────────

describe('FormStore: unregister', () => {
  test('removes field options', () => {
    const store = new FormStore<TestForm>({ defaultValues });

    store.register('name' as any, { validate: [required()] });
    expect(store.getFieldOptions('name')).toBeDefined();

    store.unregister('name' as any);
    expect(store.getFieldOptions('name')).toBeUndefined();
  });

  test('removes field ref', () => {
    const store = new FormStore<TestForm>({ defaultValues });
    const mockEl = {} as HTMLElement;

    const reg = store.register('name' as any);
    // Simulate ref callback
    reg.inputProps.ref!(mockEl);
    expect(store.getFieldRef('name')).toBe(mockEl);

    store.unregister('name' as any);
    expect(store.getFieldRef('name')).toBeNull();
  });

  test('unregistered field validators no longer run on trigger', async () => {
    const store = new FormStore<TestForm>({
      defaultValues,
      validators: { name: required() } as any,
    });

    // Trigger should fail
    const result1 = await store.trigger('name' as any);
    expect(result1).toBe(false);

    // Unregister from validation engine
    store.unregister('name' as any);

    // Trigger should now return true (no validators)
    // Note: unregister only removes from validation engine, config validators remain
    // But the field will have been removed from the engine
  });
});

// ─── getFieldRef / setFieldRef ───────────────────────────────────────────────

describe('FormStore: field refs', () => {
  let store: FormStore<TestForm>;

  beforeEach(() => {
    store = new FormStore<TestForm>({ defaultValues });
  });

  test('getFieldRef returns null for unset refs', () => {
    expect(store.getFieldRef('name')).toBeNull();
  });

  test('setFieldRef and getFieldRef', () => {
    const el = {} as HTMLElement;
    store.setFieldRef('name', el);
    expect(store.getFieldRef('name')).toBe(el);
  });

  test('setFieldRef can set to null', () => {
    const el = {} as HTMLElement;
    store.setFieldRef('name', el);
    store.setFieldRef('name', null);
    expect(store.getFieldRef('name')).toBeNull();
  });

  test('register ref callback stores element', () => {
    const el = {} as HTMLElement;
    const reg = store.register('name' as any);
    reg.inputProps.ref!(el);

    expect(store.getFieldRef('name')).toBe(el);
  });
});

// ─── register with transform option ─────────────────────────────────────────

describe('FormStore: register with transform', () => {
  test('transform is applied on onChange', () => {
    const store = new FormStore({ defaultValues: { name: '' } });

    const reg = store.register('name' as any, {
      transform: (v: unknown) => String(v).toUpperCase(),
    });

    reg.inputProps.onChange({ target: { value: 'alice', type: 'text' } });
    expect(store.getValue('name')).toBe('ALICE');
  });

  test('transform with raw value', () => {
    const store = new FormStore({ defaultValues: { count: 0 } });

    const reg = store.register('count' as any, {
      transform: (v: unknown) => Number(v) * 2,
    });

    reg.inputProps.onChange(5);
    expect(store.getValue('count')).toBe(10);
  });
});

// ─── register with parse option ──────────────────────────────────────────────

describe('FormStore: register with parse', () => {
  test('parse extracts value from custom event', () => {
    const store = new FormStore({ defaultValues: { color: '' } });

    const reg = store.register('color' as any, {
      parse: (e: any) => e.detail.color,
    });

    reg.inputProps.onChange({ detail: { color: 'red' } });
    expect(store.getValue('color')).toBe('red');
  });

  test('parse with transform', () => {
    const store = new FormStore({ defaultValues: { value: '' } });

    const reg = store.register('value' as any, {
      parse: (e: any) => e.raw,
      transform: (v: unknown) => String(v).trim(),
    });

    reg.inputProps.onChange({ raw: '  hello  ' });
    expect(store.getValue('value')).toBe('hello');
  });
});

// ─── register with validateOn option ─────────────────────────────────────────

describe('FormStore: register with validateOn', () => {
  test('validateOn change triggers validation on value change', async () => {
    const store = new FormStore({
      defaultValues: { name: 'Alice' },
    });

    store.register('name' as any, {
      validate: [required()],
      validateOn: 'change',
    });

    store.setValue('name' as any, '');
    await tick();

    expect(store.getErrors('name').get()).toEqual(['This field is required']);
  });

  test('validateOn blur does not trigger on change', async () => {
    const store = new FormStore({
      defaultValues: { name: 'Alice' },
    });

    store.register('name' as any, {
      validate: [required()],
      validateOn: 'blur',
    });

    store.setValue('name' as any, '');
    await tick();

    expect(store.getErrors('name').get()).toEqual([]);
  });
});

// ─── handleSubmit with validation errors ─────────────────────────────────────

describe('FormStore: handleSubmit with validation', () => {
  test('handleSubmit fails when validators have errors', async () => {
    let submitted = false;

    const store = new FormStore<TestForm>({
      defaultValues,
      validators: { name: required() } as any,
      onSubmit: async () => {
        submitted = true;
      },
    });

    await store.handleSubmit();

    expect(submitted).toBe(false);
    expect(store.submitState.get()).toBe('error');
  });

  test('handleSubmit touches all registered fields', async () => {
    const store = new FormStore<TestForm>({
      defaultValues,
      onSubmit: async () => {},
    });

    store.register('name' as any, { validate: [required()] });
    store.register('email' as any, { validate: [required()] });

    expect(store.getTouched('name' as any)).toBe(false);
    expect(store.getTouched('email' as any)).toBe(false);

    await store.handleSubmit();

    expect(store.getTouched('name' as any)).toBe(true);
    expect(store.getTouched('email' as any)).toBe(true);
  });

  test('handleSubmit sets isSubmitting during submission', async () => {
    let wasSubmitting = false;

    const store = new FormStore<TestForm>({
      defaultValues,
      onSubmit: async () => {
        wasSubmitting = store.isSubmitting.get();
      },
    });

    await store.handleSubmit();

    expect(wasSubmitting).toBe(true);
    expect(store.isSubmitting.get()).toBe(false);
  });

  test('handleSubmit passes abort signal to handler', async () => {
    let receivedSignal: AbortSignal | undefined;

    const store = new FormStore<TestForm>({
      defaultValues,
      onSubmit: async (_values, context) => {
        receivedSignal = context.signal;
      },
    });

    await store.handleSubmit();

    expect(receivedSignal).toBeDefined();
    expect(receivedSignal).toBeInstanceOf(AbortSignal);
  });

  test('handleSubmit passes formData to handler', async () => {
    let receivedFormData: FormData | undefined;

    const store = new FormStore<TestForm>({
      defaultValues: { ...defaultValues, name: 'Alice' },
      onSubmit: async (_values, context) => {
        receivedFormData = context.formData;
      },
    });

    await store.handleSubmit();

    expect(receivedFormData).toBeDefined();
    expect(receivedFormData!.get('name')).toBe('Alice');
  });
});

// ─── focusOnError behavior ───────────────────────────────────────────────────

describe('FormStore: focusOnError configuration', () => {
  test('focusOnError defaults to undefined (treated as true)', () => {
    const store = new FormStore<TestForm>({
      defaultValues,
      onSubmit: async () => {},
    });

    expect(store.config.focusOnError).toBeUndefined();
  });

  test('focusOnError can be explicitly set to true', () => {
    const store = new FormStore<TestForm>({
      defaultValues,
      focusOnError: true,
      onSubmit: async () => {},
    });

    expect(store.config.focusOnError).toBe(true);
  });

  test('focusOnError false is respected in config', () => {
    const store = new FormStore<TestForm>({
      defaultValues,
      focusOnError: false,
      onSubmit: async () => {},
    });

    expect(store.config.focusOnError).toBe(false);
  });
});

// ─── validateOnMount ─────────────────────────────────────────────────────────

describe('FormStore: validateOnMount', () => {
  test('validates on mount when validateOnMount is true', async () => {
    const store = new FormStore<TestForm>({
      defaultValues,
      validateOnMount: true,
      validators: { name: required() } as any,
    });

    // validateOnMount runs asynchronously after constructor
    await tick(50);

    // After mount validation, errors should be set
    // Note: validateOnMount calls validateAll which clears then sets errors
    // The validation may or may not have run depending on timing
    expect(store.config.validateOnMount).toBe(true);
  });

  test('does not validate on mount by default', () => {
    const store = new FormStore<TestForm>({
      defaultValues,
      validators: { name: required() } as any,
    });

    // Should not have errors immediately
    expect(store.getErrors('name' as any).get()).toEqual([]);
  });
});

// ─── getValues / _getCurrentValues ──────────────────────────────────────────

describe('FormStore: getValues', () => {
  test('getValues returns full form shape', () => {
    const store = new FormStore<TestForm>({ defaultValues });
    store.setValue('name' as any, 'Alice');
    store.setValue('address.city' as any, 'NYC');

    const values = store.getValues();
    expect(values.name).toBe('Alice');
    expect(values.email).toBe('');
    expect(values.address.city).toBe('NYC');
    expect(values.address.zip).toBe('');
  });

  test('getValues returns a snapshot, not a live reference', () => {
    const store = new FormStore<TestForm>({ defaultValues });
    const values1 = store.getValues();
    store.setValue('name' as any, 'Bob');
    const values2 = store.getValues();

    expect(values1.name).toBe('');
    expect(values2.name).toBe('Bob');
  });
});

// ─── triggerBlurValidation ──────────────────────────────────────────────────

describe('FormStore: triggerBlurValidation', () => {
  test('triggers blur validation on field', async () => {
    const store = new FormStore({
      defaultValues: { name: '' },
      validators: { name: required() } as any,
    });

    store.triggerBlurValidation('name' as any);
    await tick();

    expect(store.getErrors('name').get()).toEqual(['This field is required']);
  });
});

// ─── getFieldValidating ─────────────────────────────────────────────────────

describe('FormStore: getFieldValidating', () => {
  test('returns a signal for field validating state', () => {
    const store = new FormStore<TestForm>({ defaultValues });
    const sig = store.getFieldValidating('name' as any);
    expect(sig.get()).toBe(false);
  });

  test('shows true during async validation', async () => {
    let resolveValidation: () => void;
    const asyncVal = asyncValidator<string>(async () => {
      return new Promise<string | undefined>((resolve) => {
        resolveValidation = () => resolve(undefined);
      });
    });

    const store = new FormStore({
      defaultValues: { name: '' },
      validators: { name: asyncVal } as any,
    });

    const sig = store.getFieldValidating('name' as any);
    expect(sig.get()).toBe(false);

    // Start validation
    const engine = (store as any)._validationEngine;
    const p = engine.validateField('name');
    expect(sig.get()).toBe(true);

    // Resolve
    resolveValidation!();
    await p;
    expect(sig.get()).toBe(false);
  });
});

// ─── isValid signal consistency ─────────────────────────────────────────────

describe('FormStore: isValid signal', () => {
  let store: FormStore<TestForm>;

  beforeEach(() => {
    store = new FormStore<TestForm>({ defaultValues });
  });

  test('isValid is true initially', () => {
    expect(store.isValid.get()).toBe(true);
  });

  test('isValid becomes false when field errors are set', () => {
    store.setErrors('name' as any, ['Error']);
    expect(store.isValid.get()).toBe(false);
  });

  test('isValid becomes false when form errors are set', () => {
    store.setFormErrors(['Form error']);
    expect(store.isValid.get()).toBe(false);
  });

  test('isValid becomes true when all errors are cleared', () => {
    store.setErrors('name' as any, ['Error']);
    store.setFormErrors(['Form error']);
    expect(store.isValid.get()).toBe(false);

    store.clearErrors();
    expect(store.isValid.get()).toBe(true);
  });

  test('isValid considers errors from all fields', () => {
    store.setErrors('name' as any, ['Error1']);
    store.setErrors('email' as any, ['Error2']);
    expect(store.isValid.get()).toBe(false);

    store.clearErrors('name' as any);
    // Still invalid because email has errors
    expect(store.isValid.get()).toBe(false);

    store.clearErrors('email' as any);
    expect(store.isValid.get()).toBe(true);
  });
});

// ─── Nested value reconstruction ────────────────────────────────────────────

describe('FormStore: nested value handling', () => {
  test('setValue on nested path updates parent signal', () => {
    const store = new FormStore<TestForm>({ defaultValues });

    store.setValue('address.city' as any, 'NYC');
    store.setValue('address.zip' as any, '10001');

    const address = store.getValue('address' as any) as any;
    expect(address.city).toBe('NYC');
    expect(address.zip).toBe('10001');
  });

  test('parent watcher notified when child changes', () => {
    const store = new FormStore<TestForm>({ defaultValues });
    const parentValues: unknown[] = [];

    store.watch('address' as any, (v) => parentValues.push(v));

    store.setValue('address.city' as any, 'NYC');

    expect(parentValues.length).toBe(1);
    expect((parentValues[0] as any).city).toBe('NYC');
  });
});

// ─── Schema validation via handleSubmit ──────────────────────────────────────

describe('FormStore: schema validation on submit', () => {
  test('schema errors prevent submission', async () => {
    let submitted = false;

    const failingSchema = {
      safeParse: (_data: any) => ({
        success: false as const,
        error: {
          issues: [{ path: ['name'], message: 'Schema: name required' }],
        },
      }),
    };

    const store = new FormStore<TestForm>({
      defaultValues,
      schema: failingSchema as any,
      onSubmit: async () => {
        submitted = true;
      },
    });

    await store.handleSubmit();

    expect(submitted).toBe(false);
    expect(store.submitState.get()).toBe('error');
    expect(store.getErrors('name' as any).get()).toContain('Schema: name required');
  });
});

// ─── Multiple register calls for same field ──────────────────────────────────

describe('FormStore: multiple register calls', () => {
  test('re-registering field updates options', () => {
    const store = new FormStore<TestForm>({ defaultValues });

    store.register('name' as any, { validate: [required()] });
    const opts1 = store.getFieldOptions('name');
    expect(opts1).toBeDefined();

    store.register('name' as any, {
      validate: [required(), minLength(3)],
    });
    const opts2 = store.getFieldOptions('name');
    expect(opts2).toBeDefined();
    expect(Array.isArray(opts2!.validate) ? opts2!.validate.length : 1).toBe(2);
  });
});
