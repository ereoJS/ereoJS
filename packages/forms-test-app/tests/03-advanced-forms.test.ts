/**
 * Advanced Form Scenarios — wizard, schema validation, server actions, performance
 *
 * Tests cover:
 * 1. Multi-step wizard forms
 * 2. Zod schema integration
 * 3. Ereo schema DSL
 * 4. Form submission error handling
 * 5. Concurrent submit abort
 * 6. Performance: many fields
 * 7. Dispose / cleanup
 */
import { describe, expect, test, beforeEach, mock, afterEach } from 'bun:test';
import { FormStore, createFormStore } from '@ereo/forms';
import { createWizard } from '@ereo/forms';
import { zodAdapter, ereoSchema } from '@ereo/forms';
import {
  required,
  email,
  minLength,
  compose,
  v,
} from '@ereo/forms';
import { z } from 'zod';

// ─── Scenario 1: Multi-step Wizard Form ──────────────────────────────────────

describe('Scenario 1: Multi-step Wizard', () => {
  interface OnboardingForm {
    name: string;
    email: string;
    company: string;
    role: string;
    plan: string;
    cardNumber: string;
  }

  const defaults: OnboardingForm = {
    name: '',
    email: '',
    company: '',
    role: '',
    plan: 'free',
    cardNumber: '',
  };

  test('creates wizard with correct step count', () => {
    const wizard = createWizard<OnboardingForm>({
      steps: [
        { id: 'personal', fields: ['name', 'email'] },
        { id: 'work', fields: ['company', 'role'] },
        { id: 'billing', fields: ['plan', 'cardNumber'] },
      ],
      form: { defaultValues: defaults },
    });

    expect(wizard.state.totalSteps).toBe(3);
    expect(wizard.state.currentStep).toBe(0);
    expect(wizard.state.currentStepId).toBe('personal');
    expect(wizard.state.isFirst).toBe(true);
    expect(wizard.state.isLast).toBe(false);
    expect(wizard.state.progress).toBe(0);

    wizard.dispose();
  });

  test('navigates forward through steps', async () => {
    const wizard = createWizard<OnboardingForm>({
      steps: [
        { id: 'personal', fields: ['name', 'email'] },
        { id: 'work', fields: ['company', 'role'] },
        { id: 'billing', fields: ['plan'] },
      ],
      form: { defaultValues: defaults },
    });

    // Fill step 1 (no validators registered, so next should succeed)
    wizard.form.setValue('name', 'Alice');
    wizard.form.setValue('email', 'alice@test.com');

    const success = await wizard.next();
    expect(success).toBe(true);
    expect(wizard.state.currentStep).toBe(1);
    expect(wizard.state.currentStepId).toBe('work');
    expect(wizard.state.isFirst).toBe(false);

    // Fill step 2
    wizard.form.setValue('company', 'Acme');
    wizard.form.setValue('role', 'Engineer');

    const success2 = await wizard.next();
    expect(success2).toBe(true);
    expect(wizard.state.currentStep).toBe(2);
    expect(wizard.state.isLast).toBe(true);

    wizard.dispose();
  });

  test('navigates backward', async () => {
    const wizard = createWizard<OnboardingForm>({
      steps: [
        { id: 'personal' },
        { id: 'work' },
        { id: 'billing' },
      ],
      form: { defaultValues: defaults },
    });

    await wizard.next();
    expect(wizard.state.currentStep).toBe(1);

    wizard.prev();
    expect(wizard.state.currentStep).toBe(0);

    // prev at first step does nothing
    wizard.prev();
    expect(wizard.state.currentStep).toBe(0);

    wizard.dispose();
  });

  test('goTo navigates by step id', () => {
    const wizard = createWizard<OnboardingForm>({
      steps: [
        { id: 'personal' },
        { id: 'work' },
        { id: 'billing' },
      ],
      form: { defaultValues: defaults },
    });

    wizard.goTo('billing');
    expect(wizard.state.currentStep).toBe(2);
    expect(wizard.state.currentStepId).toBe('billing');

    wizard.goTo('personal');
    expect(wizard.state.currentStep).toBe(0);

    wizard.dispose();
  });

  test('goTo navigates by index', () => {
    const wizard = createWizard<OnboardingForm>({
      steps: [
        { id: 'personal' },
        { id: 'work' },
        { id: 'billing' },
      ],
      form: { defaultValues: defaults },
    });

    wizard.goTo(2);
    expect(wizard.state.currentStep).toBe(2);

    wizard.goTo(0);
    expect(wizard.state.currentStep).toBe(0);

    wizard.dispose();
  });

  test('tracks completed steps', async () => {
    const wizard = createWizard<OnboardingForm>({
      steps: [
        { id: 'personal' },
        { id: 'work' },
        { id: 'billing' },
      ],
      form: { defaultValues: defaults },
    });

    expect(wizard.completedSteps.get().size).toBe(0);

    await wizard.next();
    expect(wizard.completedSteps.get().has('personal')).toBe(true);

    await wizard.next();
    expect(wizard.completedSteps.get().has('work')).toBe(true);

    wizard.dispose();
  });

  test('step validation prevents navigation', async () => {
    const wizard = createWizard<OnboardingForm>({
      steps: [
        {
          id: 'personal',
          fields: ['name', 'email'],
        },
        { id: 'work' },
      ],
      form: { defaultValues: defaults },
    });

    // Register validators on the form
    wizard.form.register('name', { validate: required('Name is required') });
    wizard.form.register('email', { validate: compose(required('Email required'), email()) });

    // Try to go next without filling in fields
    const success = await wizard.next();
    expect(success).toBe(false);
    expect(wizard.state.currentStep).toBe(0);

    // Fill in fields
    wizard.form.setValue('name', 'Alice');
    wizard.form.setValue('email', 'alice@test.com');

    const success2 = await wizard.next();
    expect(success2).toBe(true);
    expect(wizard.state.currentStep).toBe(1);

    wizard.dispose();
  });

  test('wizard submit calls onComplete', async () => {
    const onComplete = mock(async () => {});
    const wizard = createWizard<OnboardingForm>({
      steps: [
        { id: 'personal' },
        { id: 'billing' },
      ],
      form: { defaultValues: defaults },
      onComplete,
    });

    wizard.form.setValue('name', 'Alice');
    wizard.form.setValue('email', 'alice@test.com');

    await wizard.next();
    wizard.form.setValue('plan', 'pro');

    await wizard.submit();

    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(wizard.completedSteps.get().has('billing')).toBe(true);

    wizard.dispose();
  });

  test('wizard reset clears everything', async () => {
    const wizard = createWizard<OnboardingForm>({
      steps: [
        { id: 'personal' },
        { id: 'work' },
      ],
      form: { defaultValues: defaults },
    });

    wizard.form.setValue('name', 'Alice');
    await wizard.next();

    wizard.reset();

    expect(wizard.state.currentStep).toBe(0);
    expect(wizard.completedSteps.get().size).toBe(0);
    expect(wizard.form.getValue('name')).toBe('');

    wizard.dispose();
  });

  test('canGoNext and canGoPrev helpers', async () => {
    const wizard = createWizard<OnboardingForm>({
      steps: [
        { id: 'step1' },
        { id: 'step2' },
        { id: 'step3' },
      ],
      form: { defaultValues: defaults },
    });

    expect(wizard.canGoPrev()).toBe(false);
    expect(wizard.canGoNext()).toBe(true);

    await wizard.next();
    expect(wizard.canGoPrev()).toBe(true);
    expect(wizard.canGoNext()).toBe(true);

    await wizard.next();
    expect(wizard.canGoPrev()).toBe(true);
    expect(wizard.canGoNext()).toBe(false); // last step

    wizard.dispose();
  });
});

// ─── Scenario 2: Zod Schema Integration ─────────────────────────────────────

describe('Scenario 2: Zod Schema Integration', () => {
  const userSchema = z.object({
    name: z.string().min(1, 'Name is required'),
    email: z.string().email('Invalid email'),
    age: z.number().min(18, 'Must be 18+').max(120, 'Invalid age'),
  });

  interface UserForm {
    name: string;
    email: string;
    age: number;
  }

  test('zodAdapter wraps zod schema correctly', () => {
    const schema = zodAdapter(userSchema);

    const valid = schema.safeParse!({ name: 'Alice', email: 'alice@test.com', age: 25 });
    expect(valid.success).toBe(true);

    const invalid = schema.safeParse!({ name: '', email: 'bad', age: 10 });
    expect(invalid.success).toBe(false);
    if (!invalid.success) {
      expect(invalid.error.issues.length).toBeGreaterThan(0);
    }
  });

  test('form with zod schema validates on submit', async () => {
    const submitFn = mock(async () => {});
    const form = new FormStore<UserForm>({
      defaultValues: { name: '', email: '', age: 0 },
      schema: zodAdapter(userSchema),
      onSubmit: submitFn,
    });

    // Submit without valid data
    await form.handleSubmit();
    expect(submitFn).not.toHaveBeenCalled();
    expect(form.submitState.get()).toBe('error');

    // Fill valid data
    form.setValue('name', 'Alice');
    form.setValue('email', 'alice@test.com');
    form.setValue('age', 25);

    await form.handleSubmit();
    expect(submitFn).toHaveBeenCalledTimes(1);
    expect(form.submitState.get()).toBe('success');
  });

  test('zod schema error messages map to field paths', async () => {
    const form = new FormStore<UserForm>({
      defaultValues: { name: '', email: 'invalid', age: 10 },
      schema: zodAdapter(userSchema),
      onSubmit: async () => {},
    });

    await form.handleSubmit();

    // Errors should be set on the correct field paths
    const nameErrors = form.getErrors('name').get();
    const emailErrors = form.getErrors('email').get();
    const ageErrors = form.getErrors('age').get();

    expect(nameErrors.length).toBeGreaterThan(0);
    expect(emailErrors.length).toBeGreaterThan(0);
    expect(ageErrors.length).toBeGreaterThan(0);
  });

  test('zod schema with nested objects', async () => {
    const addressSchema = z.object({
      address: z.object({
        street: z.string().min(1, 'Street required'),
        city: z.string().min(1, 'City required'),
        zip: z.string().regex(/^\d{5}$/, 'Invalid zip'),
      }),
    });

    interface AddressForm {
      address: { street: string; city: string; zip: string };
    }

    const form = new FormStore<AddressForm>({
      defaultValues: { address: { street: '', city: '', zip: '' } },
      schema: zodAdapter(addressSchema),
      onSubmit: async () => {},
    });

    await form.handleSubmit();

    expect(form.getErrors('address.street').get().length).toBeGreaterThan(0);
    expect(form.getErrors('address.city').get().length).toBeGreaterThan(0);
    expect(form.getErrors('address.zip').get().length).toBeGreaterThan(0);
  });
});

// ─── Scenario 3: Ereo Schema DSL ────────────────────────────────────────────

describe('Scenario 3: Ereo Schema DSL', () => {
  test('ereoSchema validates flat fields', () => {
    const schema = ereoSchema<{ name: string; email: string }>({
      name: required('Name required'),
      email: [required('Email required'), email()],
    });

    const valid = schema.safeParse!({ name: 'Alice', email: 'alice@test.com' });
    expect(valid.success).toBe(true);

    const invalid = schema.safeParse!({ name: '', email: 'bad' });
    expect(invalid.success).toBe(false);
  });

  test('ereoSchema validates nested fields', () => {
    const schema = ereoSchema<{ user: { name: string; age: number } }>({
      user: {
        name: required('Name required'),
        age: v.min(18, 'Must be 18+'),
      },
    });

    const valid = schema.safeParse!({ user: { name: 'Bob', age: 25 } });
    expect(valid.success).toBe(true);

    const invalid = schema.safeParse!({ user: { name: '', age: 10 } });
    expect(invalid.success).toBe(false);
    if (!invalid.success) {
      const paths = invalid.error.issues.map((i: any) => i.path.join('.'));
      expect(paths).toContain('user.name');
    }
  });

  test('ereoSchema with array of validators short-circuits on first error', () => {
    const schema = ereoSchema<{ password: string }>({
      password: [required('Required'), minLength(8, 'Too short')],
    });

    const empty = schema.safeParse!({ password: '' });
    expect(empty.success).toBe(false);
    if (!empty.success) {
      expect(empty.error.issues[0].message).toBe('Required');
    }

    const short = schema.safeParse!({ password: 'abc' });
    expect(short.success).toBe(false);
    if (!short.success) {
      expect(short.error.issues[0].message).toBe('Too short');
    }
  });

  test('ereoSchema parse throws on invalid data', () => {
    const schema = ereoSchema<{ name: string }>({
      name: required(),
    });

    expect(() => schema.parse({ name: '' })).toThrow();
    expect(() => schema.parse({ name: 'Alice' })).not.toThrow();
  });

  test('form with ereoSchema validates on submit', async () => {
    const submitFn = mock(async () => {});
    const form = new FormStore({
      defaultValues: { name: '', email: '' },
      schema: ereoSchema({
        name: required('Name required'),
        email: [required('Email required'), email('Invalid email')],
      }),
      onSubmit: submitFn,
    });

    await form.handleSubmit();
    expect(submitFn).not.toHaveBeenCalled();

    form.setValue('name', 'Alice');
    form.setValue('email', 'alice@test.com');

    await form.handleSubmit();
    expect(submitFn).toHaveBeenCalledTimes(1);
  });
});

// ─── Scenario 4: Submit Error Handling ───────────────────────────────────────

describe('Scenario 4: Submit Error Handling', () => {
  interface SimpleForm {
    name: string;
  }

  test('submit handler that throws sets error state', async () => {
    const form = new FormStore<SimpleForm>({
      defaultValues: { name: 'test' },
      onSubmit: async () => {
        throw new Error('Server error');
      },
    });

    await expect(form.handleSubmit()).rejects.toThrow('Server error');
    expect(form.submitState.get()).toBe('error');
    expect(form.isSubmitting.get()).toBe(false);
  });

  test('submitWith allows ad-hoc submit handlers', async () => {
    const form = new FormStore<SimpleForm>({
      defaultValues: { name: 'test' },
    });

    const handler = mock(async () => {});
    await form.submitWith(handler);

    expect(handler).toHaveBeenCalledTimes(1);
    expect(form.submitState.get()).toBe('success');
  });

  test('multiple submits abort previous', async () => {
    let callCount = 0;
    const form = new FormStore<SimpleForm>({
      defaultValues: { name: 'test' },
      onSubmit: async (_values, ctx) => {
        callCount++;
        await new Promise((r) => setTimeout(r, 100));
        if (ctx.signal.aborted) return;
      },
    });

    // Fire two submits rapidly
    const p1 = form.handleSubmit();
    const p2 = form.handleSubmit();

    await Promise.allSettled([p1, p2]);

    // The second submit should have aborted the first
    expect(form.submitState.get()).toBe('success');
    expect(form.submitCount.get()).toBe(1); // Only the last succeeds
  });
});

// ─── Scenario 5: Performance — Many Fields ──────────────────────────────────

describe('Scenario 5: Performance', () => {
  test('form with 100 fields initializes quickly', () => {
    const defaults: Record<string, string> = {};
    for (let i = 0; i < 100; i++) {
      defaults[`field_${i}`] = '';
    }

    const start = performance.now();
    const form = new FormStore({ defaultValues: defaults });
    const elapsed = performance.now() - start;

    expect(elapsed).toBeLessThan(100); // should be well under 100ms
    expect(form.getValue('field_0')).toBe('');
    expect(form.getValue('field_99')).toBe('');

    form.dispose();
  });

  test('setting 100 field values in batch is fast', () => {
    const defaults: Record<string, string> = {};
    for (let i = 0; i < 100; i++) {
      defaults[`field_${i}`] = '';
    }

    const form = new FormStore({ defaultValues: defaults });

    const start = performance.now();
    const updates: Record<string, string> = {};
    for (let i = 0; i < 100; i++) {
      updates[`field_${i}`] = `value_${i}`;
    }
    form.setValues(updates);
    const elapsed = performance.now() - start;

    expect(elapsed).toBeLessThan(200);

    for (let i = 0; i < 100; i++) {
      expect(form.getValue(`field_${i}`)).toBe(`value_${i}`);
    }

    form.dispose();
  });

  test('form with 500 fields initializes under 500ms', () => {
    const defaults: Record<string, string> = {};
    for (let i = 0; i < 500; i++) {
      defaults[`field_${i}`] = `default_${i}`;
    }

    const start = performance.now();
    const form = new FormStore({ defaultValues: defaults });
    const elapsed = performance.now() - start;

    expect(elapsed).toBeLessThan(500);
    expect(form.getValue('field_499')).toBe('default_499');

    form.dispose();
  });

  test('getValues with 100 fields is fast', () => {
    const defaults: Record<string, string> = {};
    for (let i = 0; i < 100; i++) {
      defaults[`field_${i}`] = `val_${i}`;
    }

    const form = new FormStore({ defaultValues: defaults });

    const start = performance.now();
    const values = form.getValues();
    const elapsed = performance.now() - start;

    expect(elapsed).toBeLessThan(50);
    expect(Object.keys(values).length).toBe(100);

    form.dispose();
  });

  test('subscriber notification count is reasonable', () => {
    const form = new FormStore({
      defaultValues: { a: '', b: '', c: '' },
    });

    let notifyCount = 0;
    form.subscribe(() => notifyCount++);

    // Each setValue triggers one subscriber notification
    form.setValue('a', '1');
    form.setValue('b', '2');
    form.setValue('c', '3');

    // Should be roughly 3 (one per setValue)
    expect(notifyCount).toBeGreaterThanOrEqual(3);
    expect(notifyCount).toBeLessThan(20); // not excessive

    form.dispose();
  });
});

// ─── Scenario 6: Dispose / Cleanup ───────────────────────────────────────────

describe('Scenario 6: Dispose and Cleanup', () => {
  test('dispose clears all subscriptions', () => {
    const form = new FormStore({
      defaultValues: { name: '' },
    });

    let called = false;
    form.subscribe(() => { called = true; });

    form.dispose();
    called = false;

    form.setValue('name', 'test');
    expect(called).toBe(false);
  });

  test('dispose clears watchers', () => {
    const form = new FormStore({
      defaultValues: { name: '' },
    });

    const changes: unknown[] = [];
    form.watch('name', (v) => changes.push(v));

    form.dispose();

    form.setValue('name', 'test');
    expect(changes).toEqual([]);
  });

  test('dispose aborts in-flight submit', async () => {
    let submitCompleted = false;
    const form = new FormStore({
      defaultValues: { name: '' },
      onSubmit: async (_values, ctx) => {
        await new Promise((r) => setTimeout(r, 200));
        if (!ctx.signal.aborted) {
          submitCompleted = true;
        }
      },
    });

    const p = form.handleSubmit();
    form.dispose();

    await p.catch(() => {});

    // The submit should have been aborted
    expect(submitCompleted).toBe(false);
  });
});

// ─── Scenario 7: Field Registration Lifecycle ────────────────────────────────

describe('Scenario 7: Field Registration', () => {
  test('register returns inputProps and state', () => {
    const form = new FormStore({
      defaultValues: { name: '', email: '' },
    });

    const reg = form.register('name', { validate: required() });

    expect(reg.inputProps.name).toBe('name');
    expect(reg.inputProps.value).toBe('');
    expect(typeof reg.inputProps.onChange).toBe('function');
    expect(typeof reg.inputProps.onBlur).toBe('function');
    expect(reg.state.value).toBe('');
    expect(reg.state.errors).toEqual([]);
    expect(reg.state.touched).toBe(false);
    expect(reg.state.dirty).toBe(false);
  });

  test('unregister cleans up field', () => {
    const form = new FormStore({
      defaultValues: { name: '' },
    });

    form.register('name', { validate: required() });
    form.unregister('name');

    // Field options should be cleared
    expect(form.getFieldOptions('name')).toBeUndefined();
  });

  test('register with transform modifies value on change', () => {
    const form = new FormStore({
      defaultValues: { email: '' },
    });

    const reg = form.register<string>('email', {
      transform: (val) => String(val).toLowerCase(),
    });

    // Simulate onChange with an event-like object
    reg.inputProps.onChange({ target: { value: 'USER@Test.COM', type: 'text' } });

    expect(form.getValue('email')).toBe('user@test.com');
  });
});
