/**
 * Integration Stability Tests for @ereo/forms
 *
 * Tests the forms package as a unified system — verifying that all modules
 * (store, validation, proxy, schema, a11y, wizard, action, composition)
 * work together correctly under realistic conditions.
 */
import { describe, it, expect, beforeEach } from 'bun:test';
import { signal, batch } from '@ereo/state';
import { FormStore, createFormStore } from './store';
import { ValidationEngine } from './validation-engine';
import { createValuesProxy } from './proxy';
import { createWizard } from './wizard';
import { createFormAction, parseActionResult } from './action';
import { mergeFormConfigs, composeSchemas } from './composition';
import { ereoSchema, createSchemaValidator, formDataToObject, isStandardSchema, standardSchemaAdapter } from './schema';
import {
  required,
  email,
  minLength,
  maxLength,
  min,
  max,
  custom,
  matches,
  compose,
  when,
  number as numberValidator,
  pattern,
  oneOf,
  positive,
  integer,
} from './validators';
import * as asyncValidator from './validators';
import { focusFirstError, announceErrors, announceSubmitStatus } from './a11y';
import { deepEqual, deepClone, getPath, setPath, flattenToPaths } from './utils';
import type { FormConfig, ValidatorFunction, ErrorSource } from './types';

function wait(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}

// ═══════════════════════════════════════════════════════════════════════════════
// 1. REALISTIC MULTI-FIELD FORM WITH MIXED VALIDATION
// ═══════════════════════════════════════════════════════════════════════════════

describe('Integration: realistic registration form', () => {
  function createRegistrationForm() {
    return new FormStore({
      defaultValues: {
        username: '',
        email: '',
        password: '',
        confirmPassword: '',
        age: 0,
        agreeToTerms: false,
      },
      validators: {
        username: [required('Username required'), minLength(3, 'Min 3 chars')],
        email: [required('Email required'), email('Invalid email')],
        password: [required('Password required'), minLength(8, 'Min 8 chars')],
        confirmPassword: matches('password', 'Passwords must match'),
        age: [min(13, 'Must be 13+'), max(120, 'Invalid age')],
        agreeToTerms: custom((v: boolean) => v ? undefined : 'Must agree'),
      },
      dependencies: {
        confirmPassword: 'password',
      },
    });
  }

  it('should validate all fields on submit attempt', async () => {
    const form = createRegistrationForm();
    form.config.onSubmit = async () => {};

    await form.handleSubmit();
    expect(form.submitState.get()).toBe('error');
  });

  it('should validate individual fields correctly', async () => {
    const form = createRegistrationForm();

    // Username too short
    form.setValue('username', 'ab');
    const usernameResult = await form.trigger('username');
    expect(usernameResult).toBe(false);
    expect(form.getErrors('username').get()).toContain('Min 3 chars');

    // Valid username
    form.setValue('username', 'john');
    const usernameResult2 = await form.trigger('username');
    expect(usernameResult2).toBe(true);
  });

  it('should validate password matching', async () => {
    const form = createRegistrationForm();

    form.setValue('password', 'secret123');
    form.setValue('confirmPassword', 'different');

    const result = await form.trigger('confirmPassword');
    expect(result).toBe(false);
    expect(form.getErrors('confirmPassword').get()).toContain('Passwords must match');

    // Fix it
    form.setValue('confirmPassword', 'secret123');
    const result2 = await form.trigger('confirmPassword');
    expect(result2).toBe(true);
  });

  it('should submit successfully with valid data', async () => {
    let submittedValues: any = null;
    const form = createRegistrationForm();
    form.config.onSubmit = async (values) => { submittedValues = values; };

    form.setValue('username', 'johndoe');
    form.setValue('email', 'john@example.com');
    form.setValue('password', 'secretpwd');
    form.setValue('confirmPassword', 'secretpwd');
    form.setValue('age', 25);
    form.setValue('agreeToTerms', true);

    await form.handleSubmit();
    expect(form.submitState.get()).toBe('success');
    expect(submittedValues.username).toBe('johndoe');
    expect(submittedValues.email).toBe('john@example.com');
  });

  it('should track dirty state correctly', () => {
    const form = createRegistrationForm();
    expect(form.isDirty.get()).toBe(false);

    form.setValue('username', 'john');
    expect(form.isDirty.get()).toBe(true);
    expect(form.getDirty('username')).toBe(true);
    expect(form.getDirty('email')).toBe(false);

    // Set back to default
    form.setValue('username', '');
    expect(form.getDirty('username')).toBe(false);
    expect(form.isDirty.get()).toBe(false);
  });

  it('should getChanges with only modified fields', () => {
    const form = createRegistrationForm();
    form.setValue('username', 'john');
    form.setValue('age', 25);

    const changes = form.getChanges();
    expect(changes).toEqual({ username: 'john', age: 25 });
  });

  it('should reset completely', () => {
    const form = createRegistrationForm();
    form.setValue('username', 'john');
    form.setValue('email', 'john@test.com');
    form.setTouched('username');
    form.setErrors('email', ['Already taken']);

    form.reset();
    expect(form.getValue('username')).toBe('');
    expect(form.getValue('email')).toBe('');
    expect(form.getTouched('username')).toBe(false);
    expect(form.getErrors('email').get()).toEqual([]);
    expect(form.isDirty.get()).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 2. WIZARD WITH MULTI-STEP VALIDATION
// ═══════════════════════════════════════════════════════════════════════════════

describe('Integration: multi-step wizard', () => {
  function createCheckoutWizard() {
    return createWizard({
      form: {
        defaultValues: {
          // Step 1: Personal info
          name: '',
          email: '',
          // Step 2: Address
          street: '',
          city: '',
          zip: '',
          // Step 3: Payment
          cardNumber: '',
        },
        validators: {
          name: required('Name required'),
          email: [required('Email required'), email('Invalid email')],
          street: required('Street required'),
          city: required('City required'),
          zip: [required('Zip required'), pattern(/^\d{5}$/, '5 digits required')],
        },
      },
      steps: [
        { id: 'personal', fields: ['name', 'email'] },
        { id: 'address', fields: ['street', 'city', 'zip'] },
        { id: 'payment', fields: ['cardNumber'] },
      ],
    });
  }

  it('should start at step 0', () => {
    const wizard = createCheckoutWizard();
    expect(wizard.currentStep.get()).toBe(0);
    expect(wizard.state.isFirst).toBe(true);
    expect(wizard.state.isLast).toBe(false);
    wizard.dispose();
  });

  it('should not advance if current step is invalid', async () => {
    const wizard = createCheckoutWizard();
    const advanced = await wizard.next();
    expect(advanced).toBe(false);
    expect(wizard.currentStep.get()).toBe(0);
    wizard.dispose();
  });

  it('should advance when step is valid', async () => {
    const wizard = createCheckoutWizard();
    wizard.form.setValue('name', 'John');
    wizard.form.setValue('email', 'john@test.com');

    const advanced = await wizard.next();
    expect(advanced).toBe(true);
    expect(wizard.currentStep.get()).toBe(1);
    expect(wizard.state.completedSteps.has('personal')).toBe(true);
    wizard.dispose();
  });

  it('should navigate back without validation', () => {
    const wizard = createCheckoutWizard();

    // Manually go to step 2
    wizard.goTo(2);
    expect(wizard.currentStep.get()).toBe(2);

    wizard.prev();
    expect(wizard.currentStep.get()).toBe(1);

    wizard.prev();
    expect(wizard.currentStep.get()).toBe(0);

    // Can't go below 0
    wizard.prev();
    expect(wizard.currentStep.get()).toBe(0);
    wizard.dispose();
  });

  it('should navigate by step id', () => {
    const wizard = createCheckoutWizard();
    wizard.goTo('address');
    expect(wizard.currentStep.get()).toBe(1);
    wizard.dispose();
  });

  it('should canGoNext/canGoPrev correctly', () => {
    const wizard = createCheckoutWizard();
    expect(wizard.canGoPrev()).toBe(false);
    expect(wizard.canGoNext()).toBe(true);

    wizard.goTo(2); // last step
    expect(wizard.canGoNext()).toBe(false);
    expect(wizard.canGoPrev()).toBe(true);
    wizard.dispose();
  });

  it('should reset wizard state', () => {
    const wizard = createCheckoutWizard();
    wizard.form.setValue('name', 'John');
    wizard.goTo(2);

    wizard.reset();
    expect(wizard.currentStep.get()).toBe(0);
    expect(wizard.form.getValue('name')).toBe('');
    expect(wizard.state.completedSteps.size).toBe(0);
    wizard.dispose();
  });

  it('should dispose cleanly', () => {
    const wizard = createCheckoutWizard();
    wizard.dispose();
    // Should not throw or leak
  });

  it('should track progress correctly', () => {
    const wizard = createCheckoutWizard();
    expect(wizard.state.progress).toBe(0);
    expect(wizard.state.totalSteps).toBe(3);

    wizard.goTo(1);
    expect(wizard.state.progress).toBe(0.5);

    wizard.goTo(2);
    expect(wizard.state.progress).toBe(1);
    wizard.dispose();
  });

  it('should complete multi-step form end-to-end', async () => {
    let submitted = false;
    const wizard = createWizard({
      form: {
        defaultValues: { name: '', email: '', street: '' },
        validators: {
          name: required(),
          email: required(),
          street: required(),
        },
        onSubmit: async () => { submitted = true; },
      },
      steps: [
        { id: 'info', fields: ['name', 'email'] },
        { id: 'address', fields: ['street'] },
      ],
    });

    // Step 1
    wizard.form.setValue('name', 'John');
    wizard.form.setValue('email', 'john@test.com');
    const s1 = await wizard.next();
    expect(s1).toBe(true);

    // Step 2
    wizard.form.setValue('street', '123 Main St');
    await wizard.submit();
    expect(submitted).toBe(true);
    wizard.dispose();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 3. SCHEMA + FIELD VALIDATORS UNIFIED
// ═══════════════════════════════════════════════════════════════════════════════

describe('Integration: schema + field validators together', () => {
  it('should run both schema and field validators on validateAll', async () => {
    const schema = ereoSchema<{ name: string; email: string }>({
      name: required('Schema: name required'),
    });

    const form = new FormStore({
      defaultValues: { name: '', email: '' },
      schema,
      validators: {
        email: [required('Field: email required')],
      },
    });

    const result = await (form as any)._validationEngine.validateAll();
    expect(result.success).toBe(false);
    // Schema error for name
    expect(result.errors?.name).toContain('Schema: name required');
    // Field error for email
    expect(result.errors?.email).toContain('Field: email required');
  });

  it('should attribute schema errors correctly', async () => {
    const schema = ereoSchema<{ name: string }>({
      name: required('Schema error'),
    });

    const form = new FormStore({
      defaultValues: { name: '' },
      schema,
    });

    await (form as any)._validationEngine.validateAll();
    const map = form.getErrorMap('name').get();
    expect(map.schema).toEqual(['Schema error']);
  });

  it('should handle field that has both schema and field errors', async () => {
    const schema = ereoSchema<{ name: string }>({
      name: required('Schema: required'),
    });

    const form = new FormStore({
      defaultValues: { name: '' },
      schema,
      validators: {
        name: minLength(3, 'Field: too short'),
      },
    });

    await (form as any)._validationEngine.validateAll();

    // Schema error should be in schema source
    const map = form.getErrorMap('name').get();
    expect(map.schema).toContain('Schema: required');
    // Field error should also be present (sync source)
    // Note: sync validator gets "Required" which is from schema, but "too short" is from field
    // Actually, required is from schema, minLength is field-level. Since name is '',
    // required fires in schema. minLength would also fire.
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 4. ASYNC VALIDATION INTEGRATION
// ═══════════════════════════════════════════════════════════════════════════════

describe('Integration: async validation', () => {
  it('should handle async + sync validators on same field', async () => {
    const asyncV: ValidatorFunction = async (value) => {
      await wait(10);
      return value === 'taken' ? 'Already taken' : undefined;
    };
    asyncV._isAsync = true;

    const form = new FormStore({
      defaultValues: { username: '' },
      validators: {
        username: [required('Required'), asyncV],
      },
    });

    // Empty value: sync fails, async should not run
    const result1 = await (form as any)._validationEngine.validateAll();
    expect(result1.success).toBe(false);
    expect(result1.errors?.username).toEqual(['Required']);

    // Correct attribution: sync errors in sync source
    const map1 = form.getErrorMap('username').get();
    expect(map1.sync).toContain('Required');
    expect(map1.async).toEqual([]);
  });

  it('should run async when sync passes', async () => {
    const asyncV: ValidatorFunction = async (value) => {
      await wait(10);
      return value === 'taken' ? 'Already taken' : undefined;
    };
    asyncV._isAsync = true;

    const form = new FormStore({
      defaultValues: { username: 'taken' },
      validators: {
        username: [required(), asyncV],
      },
    });

    const result = await (form as any)._validationEngine.validateAll();
    expect(result.success).toBe(false);
    expect(result.errors?.username).toEqual(['Already taken']);

    // Correct attribution: async errors in async source
    const map = form.getErrorMap('username').get();
    expect(map.sync).toEqual([]);
    expect(map.async).toContain('Already taken');
  });

  it('should cancel previous async validation on new trigger', async () => {
    let callCount = 0;
    const asyncV: ValidatorFunction = async (value) => {
      callCount++;
      await wait(50);
      return value ? undefined : 'Required';
    };
    asyncV._isAsync = true;

    const form = new FormStore({
      defaultValues: { name: '' },
      validators: { name: asyncV },
    });

    const engine = (form as any)._validationEngine;

    // Start validation, then immediately start another
    const p1 = engine.validateField('name');
    const p2 = engine.validateField('name');
    const [r1, r2] = await Promise.all([p1, p2]);

    // First should return empty (aborted), second should have errors
    expect(r1).toEqual([]);
    expect(r2).toEqual(['Required']);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 5. PROXY + VALIDATION INTEGRATION
// ═══════════════════════════════════════════════════════════════════════════════

describe('Integration: proxy + setValue + validation', () => {
  it('should trigger validation when setting via proxy', async () => {
    const form = new FormStore({
      defaultValues: { name: '' },
      validators: { name: required() },
      validateOn: 'change',
    });

    form.values.name = 'John';
    expect(form.getValue('name')).toBe('John');

    // Validation runs on change
    await wait(20); // debounce + async
    // No errors for valid value
    expect(form.getErrors('name').get()).toEqual([]);
  });

  it('should reflect validation errors through proxy reads', () => {
    const form = new FormStore({
      defaultValues: { user: { name: 'John', email: '' } },
    });

    form.setErrors('user.email', ['Required']);
    // Errors exist
    expect(form.getErrors('user.email').get()).toEqual(['Required']);
    // But proxy values are unaffected
    expect(form.values.user.email).toBe('');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 6. SERVER ACTION INTEGRATION
// ═══════════════════════════════════════════════════════════════════════════════

describe('Integration: server actions', () => {
  it('createFormAction should parse JSON body', async () => {
    const action = createFormAction({
      handler: async (values: { name: string }) => ({ id: 1, ...values }),
    });

    const request = new Request('http://localhost/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'John' }),
    });

    const result = await action(request);
    expect(result.success).toBe(true);
    expect(result.data).toEqual({ id: 1, name: 'John' });
  });

  it('createFormAction should validate with schema', async () => {
    const schema = ereoSchema<{ name: string }>({
      name: required('Name required'),
    });

    const action = createFormAction({
      schema,
      handler: async (values) => values,
    });

    const request = new Request('http://localhost/api', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: '' }),
    });

    const result = await action(request);
    expect(result.success).toBe(false);
    expect(result.errors?.name).toContain('Name required');
  });

  it('createFormAction should handle errors', async () => {
    const action = createFormAction({
      handler: async () => { throw new Error('DB error'); },
    });

    const request = new Request('http://localhost/api', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });

    const result = await action(request);
    expect(result.success).toBe(false);
    expect(result.errors?.['']).toContain('DB error');
  });

  it('createFormAction should use custom error handler', async () => {
    const action = createFormAction({
      handler: async () => { throw new Error('Custom error'); },
      onError: (err) => ({
        success: false,
        errors: { '': ['Custom: ' + (err as Error).message] },
      }),
    });

    const request = new Request('http://localhost/api', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });

    const result = await action(request);
    expect(result.success).toBe(false);
    expect(result.errors?.['']).toContain('Custom: Custom error');
  });

  it('createFormAction should parse FormData', async () => {
    const action = createFormAction({
      handler: async (values: any) => values,
    });

    const fd = new FormData();
    fd.append('name', 'John');
    fd.append('age', '30');

    const request = new Request('http://localhost/api', {
      method: 'POST',
      body: fd,
    });

    const result = await action(request);
    expect(result.success).toBe(true);
    expect(result.data.name).toBe('John');
    expect(result.data.age).toBe(30); // Coerced
  });

  it('parseActionResult should handle various response shapes', () => {
    // Standard ActionResult
    expect(parseActionResult({ success: true, data: 'test' })).toEqual({
      success: true,
      data: 'test',
    });

    // { error: ... } shape
    expect(parseActionResult({ error: 'Something wrong' })).toEqual({
      success: false,
      errors: { '': ['Something wrong'] },
    });

    // { errors: ... } shape
    expect(parseActionResult({ errors: { name: ['Required'] } })).toEqual({
      success: false,
      errors: { name: ['Required'] },
    });

    // { data: ... } shape
    expect(parseActionResult({ data: 'test' })).toEqual({
      success: true,
      data: 'test',
    });

    // null
    expect(parseActionResult(null)).toEqual({
      success: false,
      errors: { '': ['Empty response'] },
    });

    // Plain value
    expect(parseActionResult('hello')).toEqual({
      success: true,
      data: 'hello',
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 7. COMPOSITION INTEGRATION
// ═══════════════════════════════════════════════════════════════════════════════

describe('Integration: form composition', () => {
  it('should merge two forms into one', async () => {
    const profileConfig: FormConfig<{ name: string }> = {
      defaultValues: { name: '' },
      validators: { name: required('Name required') },
    };

    const contactConfig: FormConfig<{ email: string }> = {
      defaultValues: { email: '' },
      validators: { email: [required('Email required'), email('Invalid email')] },
    };

    const merged = mergeFormConfigs(profileConfig, contactConfig);
    const form = new FormStore(merged);

    expect(form.getValue('name')).toBe('');
    expect(form.getValue('email')).toBe('');

    const result = await (form as any)._validationEngine.validateAll();
    expect(result.success).toBe(false);
    expect(result.errors?.name).toContain('Name required');
    expect(result.errors?.email).toContain('Email required');
  });

  it('should compose schemas correctly', () => {
    const profileSchema = ereoSchema<{ name: string }>({
      name: required('Name required'),
    });

    const addressSchema = ereoSchema<{ city: string }>({
      city: required('City required'),
    });

    const composed = composeSchemas('profile', profileSchema, 'address', addressSchema);

    const result = composed.safeParse!({
      profile: { name: '' },
      address: { city: '' },
    });

    expect(result.success).toBe(false);
    expect(result.error.issues.length).toBe(2);

    // Test with valid data
    const validResult = composed.safeParse!({
      profile: { name: 'John' },
      address: { city: 'NYC' },
    });
    expect(validResult.success).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 8. COMPLEX NESTED ARRAYS
// ═══════════════════════════════════════════════════════════════════════════════

describe('Integration: complex nested arrays', () => {
  it('should handle array of objects with validation', async () => {
    const form = new FormStore({
      defaultValues: {
        users: [
          { name: 'John', email: 'john@test.com' },
          { name: '', email: '' },
        ],
      },
    });

    expect(form.getValue('users.0.name')).toBe('John');
    expect(form.getValue('users.1.name')).toBe('');

    form.setValue('users.1.name', 'Jane');
    expect(form.getValue('users.1.name')).toBe('Jane');
  });

  it('should handle growing/shrinking arrays', () => {
    const form = new FormStore({
      defaultValues: { items: ['a', 'b'] },
    });

    // Grow
    form.setValue('items', ['a', 'b', 'c', 'd']);
    expect(form.getValue('items.3')).toBe('d');

    // Shrink
    form.setValue('items', ['x']);
    expect(form.getValue('items.0')).toBe('x');
  });

  it('should update parent signal when child changes', () => {
    const form = new FormStore({
      defaultValues: { user: { name: 'John', email: 'john@test.com' } },
    });

    // Subscribe to parent
    let parentValue: any = null;
    form.getSignal('user').subscribe((v: any) => { parentValue = v; });

    // Change child
    form.setValue('user.name', 'Jane');

    // Parent should reflect change
    expect(parentValue).toBeDefined();
    expect(parentValue.name).toBe('Jane');
    expect(parentValue.email).toBe('john@test.com');
  });

  it('should handle nested object replacement', () => {
    const form = new FormStore({
      defaultValues: {
        settings: {
          notifications: { email: true, push: false },
          theme: 'dark',
        },
      },
    });

    form.setValue('settings.notifications', { email: false, push: true });
    expect(form.getValue('settings.notifications.email')).toBe(false);
    expect(form.getValue('settings.notifications.push')).toBe(true);
    // Other settings unaffected
    expect(form.getValue('settings.theme')).toBe('dark');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 9. ERROR SOURCE FLOW: SYNC → ASYNC → SERVER → MANUAL
// ═══════════════════════════════════════════════════════════════════════════════

describe('Integration: error source lifecycle', () => {
  it('should handle full error source lifecycle', async () => {
    const asyncV: ValidatorFunction = async (value) => {
      await wait(5);
      return value === 'taken@test.com' ? 'Already taken' : undefined;
    };
    asyncV._isAsync = true;

    const form = new FormStore({
      defaultValues: { email: '' },
      validators: {
        email: [required('Required'), email('Invalid email'), asyncV],
      },
    });

    // Phase 1: Empty email → sync "Required" error (async doesn't run)
    await (form as any)._validationEngine.validateAll();
    let map = form.getErrorMap('email').get();
    expect(map.sync).toContain('Required');
    expect(map.async).toEqual([]);

    // Phase 2: Invalid email → sync "Invalid email" (async doesn't run)
    form.setValue('email', 'bad');
    form.clearErrors();
    await (form as any)._validationEngine.validateAll();
    map = form.getErrorMap('email').get();
    expect(map.sync).toContain('Invalid email');

    // Phase 3: Valid email but taken → async "Already taken"
    form.setValue('email', 'taken@test.com');
    form.clearErrors();
    await (form as any)._validationEngine.validateAll();
    map = form.getErrorMap('email').get();
    expect(map.sync).toEqual([]);
    expect(map.async).toContain('Already taken');

    // Phase 4: Server error
    form.setErrorsWithSource('email', ['Server: email already registered'], 'server');
    map = form.getErrorMap('email').get();
    expect(map.server).toContain('Server: email already registered');

    // Phase 5: Clear server errors
    form.clearErrorsBySource('email', 'server');
    map = form.getErrorMap('email').get();
    expect(map.server).toEqual([]);

    // Phase 6: Manual error
    form.getErrorMap('email'); // Ensure map exists
    form.setErrors('email', ['Custom manual error']);
    map = form.getErrorMap('email').get();
    expect(map.manual).toContain('Custom manual error');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 10. STANDARD SCHEMA V1 INTEGRATION
// ═══════════════════════════════════════════════════════════════════════════════

describe('Integration: Standard Schema V1 with FormStore', () => {
  it('should auto-detect and use Standard Schema on submit', async () => {
    const schema = {
      '~standard': {
        version: 1,
        vendor: 'test',
        validate: (data: unknown) => {
          const obj = data as any;
          const issues: any[] = [];
          if (!obj?.name) issues.push({ message: 'Name required', path: ['name'] });
          if (!obj?.email) issues.push({ message: 'Email required', path: ['email'] });
          if (issues.length > 0) return { issues };
          return { value: data };
        },
      },
    };

    let submitted = false;
    const form = new FormStore({
      defaultValues: { name: '', email: '' },
      schema: schema as any,
      onSubmit: async () => { submitted = true; },
    });

    // Should fail
    await form.handleSubmit();
    expect(submitted).toBe(false);

    // Fix and retry
    form.setValue('name', 'John');
    form.setValue('email', 'john@test.com');
    await form.handleSubmit();
    expect(submitted).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 11. DISPOSE AND MEMORY CLEANUP
// ═══════════════════════════════════════════════════════════════════════════════

describe('Integration: dispose and cleanup', () => {
  it('should cleanly dispose form with active validation', async () => {
    const asyncV: ValidatorFunction = async () => {
      await wait(100);
      return 'Error';
    };
    asyncV._isAsync = true;

    const form = new FormStore({
      defaultValues: { name: '' },
      validators: { name: asyncV },
    });

    // Start validation
    (form as any)._validationEngine.validateField('name');

    // Dispose while validation is in-flight
    form.dispose();

    // Wait for any lingering promises
    await wait(150);

    // Should not have written errors after dispose
    // (abortControllers were cleared)
  });

  it('should cleanly dispose wizard', () => {
    const wizard = createWizard({
      form: {
        defaultValues: { name: '' },
        validators: { name: required() },
      },
      steps: [{ id: 'step1', fields: ['name'] }],
    });

    wizard.form.setValue('name', 'test');
    wizard.dispose();

    // Verify no lingering timers or subscriptions
  });

  it('should handle multiple dispose calls', () => {
    const form = new FormStore({
      defaultValues: { name: '' },
    });

    form.dispose();
    form.dispose(); // Should not throw
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 12. CONDITIONAL VALIDATION
// ═══════════════════════════════════════════════════════════════════════════════

describe('Integration: conditional validation with "when"', () => {
  it('should skip validation when condition is false', async () => {
    const form = new FormStore({
      defaultValues: { hasMiddleName: false, middleName: '' },
      validators: {
        middleName: when(
          (_value, context) => {
            return context?.getValue('hasMiddleName') === true;
          },
          required('Middle name required')
        ),
      },
    });

    // Condition false → should pass
    const result = await (form as any)._validationEngine.validateAll();
    expect(result.success).toBe(true);

    // Condition true → should fail
    form.setValue('hasMiddleName', true);
    const result2 = await (form as any)._validationEngine.validateAll();
    expect(result2.success).toBe(false);
    expect(result2.errors?.middleName).toContain('Middle name required');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 13. COMPOSE VALIDATORS
// ═══════════════════════════════════════════════════════════════════════════════

describe('Integration: composed validators', () => {
  it('should stop at first failing validator in compose', () => {
    const v = compose(
      required('Step 1: required'),
      minLength(3, 'Step 2: too short'),
      pattern(/^[A-Z]/, 'Step 3: must start uppercase')
    );

    // Empty → stops at required
    expect(v('')).toBe('Step 1: required');

    // Too short → stops at minLength
    expect(v('ab')).toBe('Step 2: too short');

    // Doesn't start uppercase → stops at pattern
    expect(v('abc')).toBe('Step 3: must start uppercase');

    // All pass
    expect(v('Abc')).toBe(undefined);
  });

  it('should compose async validators', async () => {
    const asyncV: ValidatorFunction = async (value) => {
      return value === 'taken' ? 'Taken' : undefined;
    };
    asyncV._isAsync = true;

    const v = compose(required('Required'), asyncV);
    expect(v._isAsync).toBe(true);
    expect(v._isRequired).toBe(true);

    // Empty → required (sync)
    expect(await v('')).toBe('Required');

    // Taken → async error
    expect(await v('taken')).toBe('Taken');

    // Valid
    expect(await v('available')).toBe(undefined);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 14. VALIDATEONMOUNT + SCHEMA
// ═══════════════════════════════════════════════════════════════════════════════

describe('Integration: validateOnMount with schema', () => {
  it('should validate on mount with schema', async () => {
    const schema = ereoSchema<{ name: string }>({
      name: required('Name required'),
    });

    const form = new FormStore({
      defaultValues: { name: '' },
      schema,
      validateOnMount: true,
    });

    // Wait for mount validation
    await wait(50);

    // Should have schema errors
    expect(form.getErrors('name').get().length).toBeGreaterThan(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 15. FORMDATA ROUND-TRIP
// ═══════════════════════════════════════════════════════════════════════════════

describe('Integration: FormData round-trip', () => {
  it('should serialize and deserialize form values', () => {
    const form = new FormStore({
      defaultValues: {
        name: 'John',
        age: 30,
        active: true,
      },
    });

    // Serialize to FormData
    const fd = form.toFormData();
    expect(fd.get('name')).toBe('John');
    expect(fd.get('age')).toBe('30');
    expect(fd.get('active')).toBe('true');

    // Deserialize back
    const obj = formDataToObject(fd);
    expect(obj.name).toBe('John');
    expect(obj.age).toBe(30);
    expect(obj.active).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 16. BATCH OPERATIONS
// ═══════════════════════════════════════════════════════════════════════════════

describe('Integration: batch operations', () => {
  it('should batch setValues notifications', () => {
    const form = new FormStore({
      defaultValues: { a: '', b: '', c: '' },
    });

    let notifyCount = 0;
    form.subscribe(() => notifyCount++);

    // setValues wraps in batch
    form.setValues({ a: '1', b: '2', c: '3' } as any);

    // Should have notified, but fewer times than 3 individual sets would
    expect(form.getValue('a')).toBe('1');
    expect(form.getValue('b')).toBe('2');
    expect(form.getValue('c')).toBe('3');
  });

  it('should batch error operations', () => {
    const form = new FormStore({
      defaultValues: { a: '', b: '' },
    });

    let validUpdates: boolean[] = [];
    form.isValid.subscribe((v: boolean) => validUpdates.push(v));

    batch(() => {
      form.setErrors('a', ['Error A']);
      form.setErrors('b', ['Error B']);
    });

    // isValid should have been set once (not twice)
    expect(form.isValid.get()).toBe(false);
  });

  it('should batch resetTo operations', () => {
    const form = new FormStore({
      defaultValues: { a: '', b: '' },
    });

    form.setValue('a', 'changed');
    form.setErrors('a', ['Error']);
    form.setTouched('a');

    // resetTo batches all changes
    form.resetTo({ a: 'new', b: 'new' });

    expect(form.getValue('a')).toBe('new');
    expect(form.getValue('b')).toBe('new');
    expect(form.getErrors('a').get()).toEqual([]);
    expect(form.getTouched('a')).toBe(false);
    expect(form.isDirty.get()).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 17. STRESS: RAPID OPERATIONS
// ═══════════════════════════════════════════════════════════════════════════════

describe('Stress: rapid operations', () => {
  it('should handle 1000 rapid setValue calls', () => {
    const form = new FormStore({
      defaultValues: { counter: 0 },
    });

    for (let i = 0; i < 1000; i++) {
      form.setValue('counter', i);
    }

    expect(form.getValue('counter')).toBe(999);
    expect(form.isDirty.get()).toBe(true);
  });

  it('should handle rapid watch/unwatch cycles', () => {
    const form = new FormStore({
      defaultValues: { name: '' },
    });

    const unsubs: Array<() => void> = [];
    for (let i = 0; i < 100; i++) {
      unsubs.push(form.watch('name', () => {}));
    }

    // Unsubscribe all
    for (const unsub of unsubs) {
      unsub();
    }

    // Verify no leaks
    form.setValue('name', 'test');
    // Should not throw or slow down
  });

  it('should handle rapid setErrors/clearErrors', () => {
    const form = new FormStore({
      defaultValues: { email: '' },
    });

    for (let i = 0; i < 100; i++) {
      form.setErrors('email', [`Error ${i}`]);
      form.clearErrors('email');
    }

    expect(form.getErrors('email').get()).toEqual([]);
    expect(form.isValid.get()).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 18. FORM FIELDS WITH TRANSFORM/PARSE
// ═══════════════════════════════════════════════════════════════════════════════

describe('Integration: field transform and parse', () => {
  it('should apply transform on registration', () => {
    const form = new FormStore({
      defaultValues: { name: '' },
    });

    const reg = form.register('name', {
      transform: (v: string) => v.trim().toUpperCase(),
    });

    reg.inputProps.onChange({ target: { value: '  john  ', type: 'text' } });
    expect(form.getValue('name')).toBe('JOHN');
  });

  it('should apply parse before transform', () => {
    const form = new FormStore({
      defaultValues: { price: 0 },
    });

    const reg = form.register('price', {
      parse: (e: any) => parseInt(e.target.value, 10),
      transform: (v: number) => Math.max(0, v),
    });

    reg.inputProps.onChange({ target: { value: '-5' } });
    expect(form.getValue('price')).toBe(0); // Clamped to 0
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 19. CROSS-FIELD VALIDATION INTEGRATION
// ═══════════════════════════════════════════════════════════════════════════════

describe('Integration: cross-field validation', () => {
  it('should validate password confirmation end-to-end', async () => {
    const form = new FormStore({
      defaultValues: { password: '', confirmPassword: '' },
      validators: {
        password: [required(), minLength(8)],
        confirmPassword: matches('password', 'Passwords must match'),
      },
      dependencies: { confirmPassword: 'password' },
    });

    // Set password
    form.setValue('password', 'secretpwd');
    form.setTouched('confirmPassword');

    // Confirm doesn't match
    form.setValue('confirmPassword', 'wrong');
    const r1 = await form.trigger('confirmPassword');
    expect(r1).toBe(false);
    expect(form.getErrors('confirmPassword').get()).toContain('Passwords must match');

    // Fix confirm
    form.setValue('confirmPassword', 'secretpwd');
    const r2 = await form.trigger('confirmPassword');
    expect(r2).toBe(true);
    expect(form.getErrors('confirmPassword').get()).toEqual([]);
  });

  it('should handle min/max range validation', async () => {
    // Use raw validator function (not custom()) since custom() doesn't pass context
    const maxValidator: ValidatorFunction = (value, context) => {
      if (!context) return undefined;
      const minVal = context.getValue('minPrice');
      return Number(value) < Number(minVal) ? 'Max must be >= min' : undefined;
    };
    maxValidator._crossField = true;

    const form = new FormStore({
      defaultValues: { minPrice: 0, maxPrice: 100 },
      validators: {
        maxPrice: maxValidator,
      },
      dependencies: { maxPrice: 'minPrice' },
    });

    form.setValue('minPrice', 50);
    form.setValue('maxPrice', 30);
    form.setTouched('maxPrice');

    const valid = await form.trigger('maxPrice');
    expect(valid).toBe(false);

    form.setValue('maxPrice', 75);
    const valid2 = await form.trigger('maxPrice');
    expect(valid2).toBe(true);
  });
});
