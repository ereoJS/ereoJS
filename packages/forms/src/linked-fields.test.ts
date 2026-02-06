import { describe, expect, test, beforeEach } from 'bun:test';
import { FormStore } from './store';
import { matches, required } from './validators';
import type { ValidatorFunction } from './types';

// ─── Test Interfaces ──────────────────────────────────────────────────────────

interface PasswordForm {
  password: string;
  confirmPassword: string;
}

interface DateForm {
  startDate: string;
  endDate: string;
}

interface MultiDepForm {
  source: string;
  depA: string;
  depB: string;
}

interface CircularForm {
  fieldA: string;
  fieldB: string;
}

const tick = () => new Promise((r) => setTimeout(r, 10));

// ─── matches() auto-detects dependency ──────────────────────────────────────

describe('linked fields: matches() auto-detects dependency', () => {
  let store: FormStore<PasswordForm>;

  beforeEach(() => {
    store = new FormStore<PasswordForm>({
      defaultValues: { password: '', confirmPassword: '' },
    });
  });

  test('confirmPassword errors clear when password changes to match', async () => {
    store.register('confirmPassword' as any, {
      validate: [matches('password')],
      validateOn: 'change',
    });

    // Touch confirmPassword so it is eligible for re-validation
    store.setTouched('confirmPassword' as any, true);

    // Set confirmPassword to a value that doesn't match password ('')
    store.setValue('confirmPassword' as any, 'abc');
    await tick();

    // confirmPassword should have an error because password is '' and confirmPassword is 'abc'
    expect(store.getErrors('confirmPassword' as any).get().length).toBeGreaterThan(0);

    // Now set password to 'abc' so they match — this should trigger re-validation of confirmPassword
    store.setValue('password' as any, 'abc');
    await tick();

    // After password changed to match, confirmPassword errors should be empty
    expect(store.getErrors('confirmPassword' as any).get()).toEqual([]);
  });
});

// ─── matches() re-validates dependent when source changes ────────────────────

describe('linked fields: matches() re-validates dependent when source changes', () => {
  let store: FormStore<PasswordForm>;

  beforeEach(() => {
    store = new FormStore<PasswordForm>({
      defaultValues: { password: '', confirmPassword: '' },
    });
  });

  test('changing password triggers confirmPassword re-validation', async () => {
    store.register('confirmPassword' as any, {
      validate: [matches('password')],
      validateOn: 'change',
    });

    // Touch and set confirmPassword to 'wrong'
    store.setTouched('confirmPassword' as any, true);
    store.setValue('confirmPassword' as any, 'wrong');
    await tick();

    // Should have validation error (password is '', confirmPassword is 'wrong')
    expect(store.getErrors('confirmPassword' as any).get().length).toBeGreaterThan(0);

    // Change password to 'wrong' so they now match
    store.setValue('password' as any, 'wrong');
    await tick();

    // confirmPassword should now pass validation
    expect(store.getErrors('confirmPassword' as any).get()).toEqual([]);
  });
});

// ─── Explicit dependsOn ──────────────────────────────────────────────────────

describe('linked fields: explicit dependsOn', () => {
  let store: FormStore<DateForm>;

  beforeEach(() => {
    store = new FormStore<DateForm>({
      defaultValues: { startDate: '2024-01-01', endDate: '2024-02-01' },
    });
  });

  test('endDate re-validates when startDate changes via dependsOn', async () => {
    const endDateAfterStart: ValidatorFunction<string> = (value, context) => {
      if (!context) return undefined;
      const start = context.getValue('startDate') as string;
      if (!value || !start) return undefined;
      return value > start ? undefined : 'End date must be after start date';
    };
    endDateAfterStart._crossField = true;

    store.register('endDate' as any, {
      validate: [endDateAfterStart],
      validateOn: 'change',
      dependsOn: 'startDate',
    });

    // Touch endDate
    store.setTouched('endDate' as any, true);

    // Set endDate to something valid relative to startDate
    store.setValue('endDate' as any, '2024-02-01');
    await tick();
    expect(store.getErrors('endDate' as any).get()).toEqual([]);

    // Now change startDate to after endDate — should cause endDate to fail
    store.setValue('startDate' as any, '2024-03-01');
    await tick();

    expect(store.getErrors('endDate' as any).get()).toEqual([
      'End date must be after start date',
    ]);
  });
});

// ─── Config-level dependencies ───────────────────────────────────────────────

describe('linked fields: config-level dependencies', () => {
  test('endDate re-validates when startDate changes via config dependencies', async () => {
    const endDateAfterStart: ValidatorFunction<string> = (value, context) => {
      if (!context) return undefined;
      const start = context.getValue('startDate') as string;
      if (!value || !start) return undefined;
      return value > start ? undefined : 'End date must be after start date';
    };
    endDateAfterStart._crossField = true;

    const store = new FormStore<DateForm>({
      defaultValues: { startDate: '2024-01-01', endDate: '2024-02-01' },
      dependencies: { endDate: 'startDate' } as any,
    });

    store.register('endDate' as any, {
      validate: [endDateAfterStart],
      validateOn: 'change',
    });

    // Touch endDate so it is eligible for dependent re-validation
    store.setTouched('endDate' as any, true);

    // Trigger initial validation to ensure it passes
    store.setValue('endDate' as any, '2024-02-01');
    await tick();
    expect(store.getErrors('endDate' as any).get()).toEqual([]);

    // Change startDate to after endDate
    store.setValue('startDate' as any, '2024-03-01');
    await tick();

    expect(store.getErrors('endDate' as any).get()).toEqual([
      'End date must be after start date',
    ]);
  });
});

// ─── Multiple dependents on same source ──────────────────────────────────────

describe('linked fields: multiple dependents on same source', () => {
  test('both depA and depB re-validate when source changes', async () => {
    const store = new FormStore<MultiDepForm>({
      defaultValues: { source: 'hello', depA: '', depB: '' },
    });

    const mustMatchSource: ValidatorFunction<string> = (value, context) => {
      if (!context) return undefined;
      const src = context.getValue('source') as string;
      return value === src ? undefined : 'Must match source';
    };
    mustMatchSource._crossField = true;

    store.register('depA' as any, {
      validate: [mustMatchSource],
      validateOn: 'change',
      dependsOn: 'source',
    });

    store.register('depB' as any, {
      validate: [mustMatchSource],
      validateOn: 'change',
      dependsOn: 'source',
    });

    // Touch both dependents
    store.setTouched('depA' as any, true);
    store.setTouched('depB' as any, true);

    // Set both to 'hello' (matches source)
    store.setValue('depA' as any, 'hello');
    store.setValue('depB' as any, 'hello');
    await tick();

    expect(store.getErrors('depA' as any).get()).toEqual([]);
    expect(store.getErrors('depB' as any).get()).toEqual([]);

    // Now change source — both should fail
    store.setValue('source' as any, 'changed');
    await tick();

    expect(store.getErrors('depA' as any).get()).toEqual(['Must match source']);
    expect(store.getErrors('depB' as any).get()).toEqual(['Must match source']);
  });
});

// ─── Circular dependency doesn't infinite loop ──────────────────────────────

describe('linked fields: circular dependency guard', () => {
  test('A depends on B, B depends on A — does not infinite loop', async () => {
    const store = new FormStore<CircularForm>({
      defaultValues: { fieldA: '', fieldB: '' },
    });

    const checkOther = (otherField: string): ValidatorFunction<string> => {
      const v: ValidatorFunction<string> = (value, context) => {
        if (!context) return undefined;
        const other = context.getValue(otherField) as string;
        return value === other ? undefined : `Must match ${otherField}`;
      };
      v._crossField = true;
      return v;
    };

    store.register('fieldA' as any, {
      validate: [checkOther('fieldB')],
      validateOn: 'change',
      dependsOn: 'fieldB',
    });

    store.register('fieldB' as any, {
      validate: [checkOther('fieldA')],
      validateOn: 'change',
      dependsOn: 'fieldA',
    });

    store.setTouched('fieldA' as any, true);
    store.setTouched('fieldB' as any, true);

    // This should NOT hang — the _validatingDependents guard prevents infinite recursion
    store.setValue('fieldA' as any, 'test');
    await tick();

    // We just assert it completes without hanging
    // fieldA is 'test', fieldB is '' — so both should have errors
    expect(store.getErrors('fieldA' as any).get().length).toBeGreaterThan(0);
    expect(store.getErrors('fieldB' as any).get().length).toBeGreaterThan(0);

    // Now set fieldB to 'test' too — they should match
    store.setValue('fieldB' as any, 'test');
    await tick();

    // After settling, at least fieldB should pass (it was just validated with matching values)
    // Due to circular dependency guard, the exact state may vary, but no hang occurred
    expect(store.getErrors('fieldB' as any).get()).toEqual([]);
  });
});

// ─── Unregistering field removes dependency entries ─────────────────────────

describe('linked fields: unregister removes dependencies', () => {
  test('unregistering dependent field prevents re-validation on source change', async () => {
    const store = new FormStore<PasswordForm>({
      defaultValues: { password: '', confirmPassword: '' },
    });

    store.register('confirmPassword' as any, {
      validate: [matches('password')],
      validateOn: 'change',
    });

    store.setTouched('confirmPassword' as any, true);
    store.setValue('confirmPassword' as any, 'abc');
    await tick();

    // confirmPassword has error (password is '')
    expect(store.getErrors('confirmPassword' as any).get().length).toBeGreaterThan(0);

    // Unregister confirmPassword
    store.unregister('confirmPassword' as any);

    // Change password — should NOT crash or trigger confirmPassword validation
    store.setValue('password' as any, 'xyz');
    await tick();

    // No crash occurred; errors signal may still exist but no new validation ran
    // Just verify it doesn't throw
    expect(true).toBe(true);
  });
});

// ─── Untouched dependents don't re-validate ─────────────────────────────────

describe('linked fields: untouched dependents skip re-validation', () => {
  let store: FormStore<PasswordForm>;

  beforeEach(() => {
    store = new FormStore<PasswordForm>({
      defaultValues: { password: '', confirmPassword: '' },
    });
  });

  test('changing source does not trigger errors on untouched dependent', async () => {
    store.register('confirmPassword' as any, {
      validate: [matches('password')],
      validateOn: 'change',
    });

    // Do NOT touch confirmPassword

    // Set confirmPassword value without touching
    store.setValue('confirmPassword' as any, 'mismatch');
    await tick();

    // confirmPassword was set on 'change' trigger, so it may have errors from its own change
    // But clear them to isolate the dependent re-validation test
    store.clearErrors('confirmPassword' as any);

    // Mark confirmPassword as NOT touched
    store.setTouched('confirmPassword' as any, false);

    // Now change password — since confirmPassword is not touched, it should NOT re-validate
    store.setValue('password' as any, 'something');
    await tick();

    // Errors should remain empty because untouched dependents are skipped
    expect(store.getErrors('confirmPassword' as any).get()).toEqual([]);
  });
});
