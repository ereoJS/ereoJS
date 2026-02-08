import { describe, expect, test, beforeEach, mock } from 'bun:test';
import { FormStore } from './store';
import { ValidationEngine } from './validation-engine';
import {
  required,
  minLength,
  email,
  async as asyncValidator,
  matches,
  compose,
} from './validators';
import type { ValidatorFunction } from './types';

const tick = (ms = 10) => new Promise((r) => setTimeout(r, ms));

// ─── onFieldBlur behavior ────────────────────────────────────────────────────

describe('ValidationEngine: onFieldBlur', () => {
  test('blur trigger runs validation for blur-configured validators', async () => {
    const store = new FormStore({
      defaultValues: { name: '' },
      validators: { name: required() } as any,
    });

    const engine = (store as any)._validationEngine as ValidationEngine<any>;

    // required() derives 'blur' trigger, so onFieldChange should NOT validate
    store.setValue('name', 'a');
    store.setValue('name', '');
    await tick();
    // No errors from change alone (blur trigger)
    expect(store.getErrors('name').get()).toEqual([]);

    // Now trigger blur
    engine.onFieldBlur('name');
    await tick();

    expect(store.getErrors('name').get()).toEqual(['This field is required']);
  });

  test('blur does nothing for submit-trigger validators', async () => {
    const store = new FormStore({
      defaultValues: { name: '' },
    });

    // Register with explicit 'submit' trigger
    store.register('name' as any, {
      validate: [required()],
      validateOn: 'submit',
    });

    const engine = (store as any)._validationEngine as ValidationEngine<any>;
    engine.onFieldBlur('name');
    await tick();

    // No errors because trigger is 'submit'
    expect(store.getErrors('name').get()).toEqual([]);
  });

  test('blur cancels pending debounce and validates immediately', async () => {
    let validateCallCount = 0;
    const slowAsync = asyncValidator<string>(async (v) => {
      validateCallCount++;
      return v === '' ? 'Required' : undefined;
    }, { debounce: 500 });

    const store = new FormStore({
      defaultValues: { username: 'test' },
    });

    store.register('username' as any, {
      validate: [slowAsync],
      validateOn: 'change',
    });

    const engine = (store as any)._validationEngine as ValidationEngine<any>;

    // Trigger a change (starts debounce)
    store.setValue('username' as any, '');
    // Debounce timer started, validation not yet called
    expect(validateCallCount).toBe(0);

    // Now blur immediately - should cancel debounce and validate right away
    engine.onFieldBlur('username');
    await tick(50);

    expect(validateCallCount).toBe(1);
    expect(store.getErrors('username').get()).toEqual(['Required']);
  });

  test('blur on unregistered field does nothing', () => {
    const store = new FormStore({ defaultValues: { name: '' } });
    const engine = (store as any)._validationEngine as ValidationEngine<any>;

    // Should not throw
    expect(() => engine.onFieldBlur('nonexistent')).not.toThrow();
  });
});

// ─── onFieldChange behavior ──────────────────────────────────────────────────

describe('ValidationEngine: onFieldChange', () => {
  test('change trigger validates immediately for sync validators with change trigger', async () => {
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

  test('change trigger with async uses debounce', async () => {
    let callCount = 0;
    const asyncVal = asyncValidator<string>(async (v) => {
      callCount++;
      return v === 'bad' ? 'Error' : undefined;
    });

    const store = new FormStore({
      defaultValues: { field: '' },
    });

    store.register('field' as any, {
      validate: [asyncVal],
    });

    // Async validators derive 'change' trigger with default 300ms debounce
    store.setValue('field' as any, 'b');
    store.setValue('field' as any, 'ba');
    store.setValue('field' as any, 'bad');

    // Should not have validated yet (debounce pending)
    expect(callCount).toBe(0);

    // Wait for debounce to fire
    await tick(400);

    // Should only have validated once (debounced)
    expect(callCount).toBe(1);
  });

  test('change does not trigger blur-only validators', async () => {
    const store = new FormStore({
      defaultValues: { name: '' },
      validators: { name: required() } as any,
    });

    // required() derives blur trigger
    store.setValue('name', 'test');
    store.setValue('name', '');
    await tick();

    // No validation from change events
    expect(store.getErrors('name').get()).toEqual([]);
  });
});

// ─── isFieldValidating / getFieldValidatingSignal ────────────────────────────

describe('ValidationEngine: field validating state', () => {
  test('getFieldValidatingSignal returns a signal that updates during validation', async () => {
    let resolveValidation: (v: string | undefined) => void;
    const slowValidator = asyncValidator<string>(async () => {
      return new Promise<string | undefined>((resolve) => {
        resolveValidation = resolve;
      });
    });

    const store = new FormStore({
      defaultValues: { name: '' },
      validators: { name: slowValidator } as any,
    });

    const engine = (store as any)._validationEngine as ValidationEngine<any>;
    const validatingSig = engine.getFieldValidatingSignal('name');

    expect(validatingSig.get()).toBe(false);

    // Start validation
    const p = engine.validateField('name');
    expect(validatingSig.get()).toBe(true);
    expect(engine.isFieldValidating('name')).toBe(true);

    // Resolve
    resolveValidation!(undefined);
    await p;

    expect(validatingSig.get()).toBe(false);
    expect(engine.isFieldValidating('name')).toBe(false);
  });

  test('getFieldValidatingSignal for unregistered field returns false signal', () => {
    const store = new FormStore({ defaultValues: { name: '' } });
    const engine = (store as any)._validationEngine as ValidationEngine<any>;

    const sig = engine.getFieldValidatingSignal('unknown');
    expect(sig.get()).toBe(false);
  });
});

// ─── getRegisteredPaths ──────────────────────────────────────────────────────

describe('ValidationEngine: getRegisteredPaths', () => {
  test('returns all registered validator paths', () => {
    const store = new FormStore({
      defaultValues: { name: '', email: '', age: 0 },
      validators: {
        name: required(),
        email: [required(), email()],
      } as any,
    });

    const engine = (store as any)._validationEngine as ValidationEngine<any>;
    const paths = Array.from(engine.getRegisteredPaths());

    expect(paths).toContain('name');
    expect(paths).toContain('email');
    expect(paths).not.toContain('age');
  });

  test('includes paths registered via register()', () => {
    const store = new FormStore({
      defaultValues: { name: '', extra: '' },
    });

    store.register('extra' as any, {
      validate: [required()],
    });

    const engine = (store as any)._validationEngine as ValidationEngine<any>;
    const paths = Array.from(engine.getRegisteredPaths());

    expect(paths).toContain('extra');
  });
});

// ─── unregisterField ─────────────────────────────────────────────────────────

describe('ValidationEngine: unregisterField', () => {
  test('removes field validators', async () => {
    const store = new FormStore({
      defaultValues: { name: '' },
      validators: { name: required() } as any,
    });

    const engine = (store as any)._validationEngine as ValidationEngine<any>;

    // Verify field is registered
    const paths = Array.from(engine.getRegisteredPaths());
    expect(paths).toContain('name');

    // Unregister
    engine.unregisterField('name');

    // Should no longer be registered
    const pathsAfter = Array.from(engine.getRegisteredPaths());
    expect(pathsAfter).not.toContain('name');

    // validateField should return empty
    const errors = await engine.validateField('name');
    expect(errors).toEqual([]);
  });

  test('unregisterField cancels pending validation', async () => {
    let resolveValidation: (v: string | undefined) => void;
    const slowValidator = asyncValidator<string>(async () => {
      return new Promise<string | undefined>((resolve) => {
        resolveValidation = resolve;
      });
    });

    const store = new FormStore({
      defaultValues: { name: '' },
      validators: { name: slowValidator } as any,
    });

    const engine = (store as any)._validationEngine as ValidationEngine<any>;

    // Start validation
    const p = engine.validateField('name');

    // Unregister while validation is in-flight
    engine.unregisterField('name');

    // Resolve the pending validation
    resolveValidation!(undefined);
    await p;

    // Field should not be validating
    expect(engine.isFieldValidating('name')).toBe(false);
  });

  test('removes dependency entries for the field', () => {
    const store = new FormStore({
      defaultValues: { password: '', confirmPassword: '' },
    });

    store.register('confirmPassword' as any, {
      validate: [matches('password')],
      validateOn: 'change',
    });

    const engine = (store as any)._validationEngine as ValidationEngine<any>;

    // Verify dependency exists
    const dependents = engine.getDependents('password');
    expect(dependents?.has('confirmPassword')).toBe(true);

    // Unregister
    engine.unregisterField('confirmPassword');

    // Dependency should be removed
    const dependentsAfter = engine.getDependents('password');
    expect(dependentsAfter?.has('confirmPassword')).toBeFalsy();
  });
});

// ─── dispose ─────────────────────────────────────────────────────────────────

describe('ValidationEngine: dispose', () => {
  test('dispose clears all internal state', () => {
    const store = new FormStore({
      defaultValues: { name: '', email: '' },
      validators: {
        name: required(),
        email: required(),
      } as any,
    });

    const engine = (store as any)._validationEngine as ValidationEngine<any>;

    engine.dispose();

    // After dispose, isFieldValidating should be false
    expect(engine.isFieldValidating('name')).toBe(false);
    expect(engine.isFieldValidating('email')).toBe(false);
  });

  test('dispose cancels pending debounce timers', async () => {
    let callCount = 0;
    const asyncVal = asyncValidator<string>(async () => {
      callCount++;
      return undefined;
    }, { debounce: 100 });

    const store = new FormStore({
      defaultValues: { field: '' },
    });

    store.register('field' as any, {
      validate: [asyncVal],
    });

    // Trigger a change to start debounce timer
    store.setValue('field' as any, 'test');

    // Dispose before debounce fires
    const engine = (store as any)._validationEngine as ValidationEngine<any>;
    engine.dispose();

    // Wait for what would have been the debounce delay
    await tick(200);

    // Validation should NOT have fired
    expect(callCount).toBe(0);
  });
});

// ─── Schema validation: parse (throw) path ──────────────────────────────────

describe('ValidationEngine: schema with parse (no safeParse)', () => {
  test('validates using parse method (throws on error)', async () => {
    const throwingSchema = {
      parse: (data: any) => {
        if (!data.name) {
          throw {
            issues: [{ path: ['name'], message: 'Name is required' }],
          };
        }
        return data;
      },
    };

    const store = new FormStore({
      defaultValues: { name: '' },
      schema: throwingSchema as any,
    });

    const engine = (store as any)._validationEngine as ValidationEngine<any>;
    const result = await engine.validateAll();

    expect(result.success).toBe(false);
    expect(result.errors?.name).toEqual(['Name is required']);
  });

  test('schema parse with generic error (no issues)', async () => {
    const throwingSchema = {
      parse: (_data: any) => {
        throw new Error('Validation failed');
      },
    };

    const store = new FormStore({
      defaultValues: { name: '' },
      schema: throwingSchema as any,
    });

    const engine = (store as any)._validationEngine as ValidationEngine<any>;
    const result = await engine.validateAll();

    expect(result.success).toBe(false);
    expect(result.errors?.['']).toEqual(['Validation failed']);
  });

  test('schema parse success returns valid result', async () => {
    const passingSchema = {
      parse: (data: any) => data,
    };

    const store = new FormStore({
      defaultValues: { name: 'Alice' },
      schema: passingSchema as any,
    });

    const engine = (store as any)._validationEngine as ValidationEngine<any>;
    const result = await engine.validateAll();

    expect(result.success).toBe(true);
  });
});

// ─── Custom debounce values ──────────────────────────────────────────────────

describe('ValidationEngine: custom debounce', () => {
  test('respects custom debounce value on async validator', async () => {
    let callCount = 0;
    const asyncVal = asyncValidator<string>(async () => {
      callCount++;
      return undefined;
    }, { debounce: 50 });

    const store = new FormStore({
      defaultValues: { field: '' },
    });

    store.register('field' as any, {
      validate: [asyncVal],
    });

    // Trigger multiple rapid changes
    store.setValue('field' as any, 'a');
    store.setValue('field' as any, 'ab');
    store.setValue('field' as any, 'abc');

    // Wait less than debounce - should not have validated
    await tick(20);
    expect(callCount).toBe(0);

    // Wait for debounce to fire
    await tick(100);
    expect(callCount).toBe(1);
  });
});

// ─── Derive-don't-configure: combined async+sync ────────────────────────────

describe('ValidationEngine: derive-don-t-configure', () => {
  test('async validators derive change trigger', () => {
    const asyncVal = asyncValidator<string>(async () => undefined);

    const store = new FormStore({
      defaultValues: { field: '' },
      validators: { field: asyncVal } as any,
    });

    const engine = (store as any)._validationEngine as ValidationEngine<any>;
    const validation = (engine as any)._fieldValidations.get('field');

    expect(validation.derivedTrigger).toBe('change');
  });

  test('required-only validators derive blur trigger', () => {
    const store = new FormStore({
      defaultValues: { field: '' },
      validators: { field: required() } as any,
    });

    const engine = (store as any)._validationEngine as ValidationEngine<any>;
    const validation = (engine as any)._fieldValidations.get('field');

    expect(validation.derivedTrigger).toBe('blur');
  });

  test('mixed sync validators derive blur trigger', () => {
    const store = new FormStore({
      defaultValues: { field: '' },
      validators: { field: [required(), minLength(3)] } as any,
    });

    const engine = (store as any)._validationEngine as ValidationEngine<any>;
    const validation = (engine as any)._fieldValidations.get('field');

    expect(validation.derivedTrigger).toBe('blur');
  });

  test('explicit validateOn overrides derived trigger', () => {
    const store = new FormStore({
      defaultValues: { field: '' },
      validateOn: 'submit',
      validators: { field: required() } as any,
    });

    const engine = (store as any)._validationEngine as ValidationEngine<any>;
    const validation = (engine as any)._fieldValidations.get('field');

    // The explicit validateOn is stored
    expect(validation.validateOn).toBe('submit');
  });
});

// ─── Multiple validators per field ───────────────────────────────────────────

describe('ValidationEngine: multiple validator errors', () => {
  test('collects errors from all failing sync validators', async () => {
    const customA: ValidatorFunction = (value) =>
      value === '' ? 'Error A' : undefined;
    const customB: ValidatorFunction = (value) =>
      value === '' ? 'Error B' : undefined;

    const store = new FormStore({
      defaultValues: { field: '' },
      validators: { field: [customA, customB] } as any,
    });

    const engine = (store as any)._validationEngine as ValidationEngine<any>;
    const errors = await engine.validateField('field');

    expect(errors).toEqual(['Error A', 'Error B']);
  });

  test('collects errors from multiple async validators when sync pass', async () => {
    const asyncA = asyncValidator<string>(async (v) =>
      v === 'test' ? 'Async A' : undefined
    );
    const asyncB = asyncValidator<string>(async (v) =>
      v === 'test' ? 'Async B' : undefined
    );

    const store = new FormStore({
      defaultValues: { field: 'test' },
      validators: { field: [asyncA, asyncB] } as any,
    });

    const engine = (store as any)._validationEngine as ValidationEngine<any>;
    const errors = await engine.validateField('field');

    expect(errors).toEqual(['Async A', 'Async B']);
  });
});

// ─── Config-level dependencies in engine ────────────────────────────────────

describe('ValidationEngine: config-level dependencies', () => {
  test('getDependents reflects config-level dependencies', () => {
    const store = new FormStore({
      defaultValues: { start: '', end: '' },
      dependencies: { end: 'start' } as any,
    });

    const engine = (store as any)._validationEngine as ValidationEngine<any>;
    const deps = engine.getDependents('start');

    expect(deps?.has('end')).toBe(true);
  });

  test('getDependents reflects multiple config-level dependencies', () => {
    const store = new FormStore({
      defaultValues: { a: '', b: '', c: '' },
      dependencies: { c: ['a', 'b'] } as any,
    });

    const engine = (store as any)._validationEngine as ValidationEngine<any>;

    expect(engine.getDependents('a')?.has('c')).toBe(true);
    expect(engine.getDependents('b')?.has('c')).toBe(true);
  });
});
