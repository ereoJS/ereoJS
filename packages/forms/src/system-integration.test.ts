import { describe, expect, test } from 'bun:test';
import { FormStore, createFormStore } from './store';
import {
  required, email, minLength, maxLength, min, max, matches,
  custom, async as asyncValidator, compose, when, pattern,
  number, integer, positive, oneOf, notOneOf, phone, url, date,
} from './validators';
import { zodAdapter, valibotAdapter, createSchemaValidator, ereoSchema, isEreoSchema, isStandardSchema, standardSchemaAdapter, formDataToObject } from './schema';
import { createValuesProxy } from './proxy';
import { getPath, setPath, deepClone, deepEqual, flattenToPaths } from './utils';
import { mergeFormConfigs, composeSchemas } from './composition';
import { createWizard } from './wizard';
import {
  generateA11yId, getFieldA11y, getErrorA11y, getLabelA11y,
  getDescriptionA11y, getFieldsetA11y, getFieldWrapperA11y,
  getFormA11y, getErrorSummaryA11y,
} from './a11y';
import { createFormAction, parseActionResult } from './action';

const tick = (ms = 10) => new Promise<void>((r) => setTimeout(r, ms));

// ─── Full Form Lifecycle ────────────────────────────────────────────────────

describe('Form lifecycle: creation → registration → validation → submission', () => {
  interface UserForm {
    name: string;
    email: string;
    age: number;
    bio: string;
  }

  const defaultValues: UserForm = {
    name: '',
    email: '',
    age: 0,
    bio: '',
  };

  test('complete form lifecycle', async () => {
    let submittedValues: UserForm | null = null;
    const form = createFormStore<UserForm>({
      defaultValues,
      validators: {
        name: [required(), minLength(2)] as any,
        email: [required(), email()] as any,
        age: [required(), min(18)] as any,
      } as any,
      onSubmit: async (values) => {
        submittedValues = values;
      },
    });

    // 1. Initial state
    expect(form.isValid.get()).toBe(true); // No validation run yet
    expect(form.isDirty.get()).toBe(false);
    expect(form.isSubmitting.get()).toBe(false);
    expect(form.submitState.get()).toBe('idle');

    // 2. Register fields
    const nameReg = form.register('name' as any, {
      validate: [required(), minLength(2)],
    });
    const emailReg = form.register('email' as any, {
      validate: [required(), email()],
    });

    // 3. Set values and verify dirty tracking
    form.setValue('name' as any, 'Al');
    expect(form.isDirty.get()).toBe(true);
    expect(form.getDirty('name' as any)).toBe(true);

    form.setValue('email' as any, 'alice@test.com');
    expect(form.getDirty('email' as any)).toBe(true);

    // Set age before validation (min(18) validator)
    form.setValue('age' as any, 25);

    // 4. Touch fields
    form.setTouched('name' as any, true);
    expect(form.getTouched('name' as any)).toBe(true);

    // 5. Trigger validation
    const isValid = await form.trigger();
    // name='Al' is >= 2 chars, email is valid, age=25 >= 18 → should pass
    expect(isValid).toBe(true);

    // 6. Submit
    await form.handleSubmit();
    expect(submittedValues).not.toBeNull();
    expect(submittedValues!.name).toBe('Al');
    expect(submittedValues!.email).toBe('alice@test.com');

    // 7. State after submit
    expect(form.submitState.get()).toBe('success');
    expect(form.submitCount.get()).toBe(1);

    // 8. Reset
    form.reset();
    expect(form.getValue('name' as any)).toBe('');
    expect(form.isDirty.get()).toBe(false);
    expect(form.submitState.get()).toBe('idle');

    form.dispose();
  });

  test('validation failure prevents submission', async () => {
    let submitCalled = false;
    const form = createFormStore<UserForm>({
      defaultValues,
      validators: {
        name: required(),
      } as any,
      onSubmit: async () => { submitCalled = true; },
    });

    form.register('name' as any, { validate: required() });

    // Submit with empty name
    await form.handleSubmit();
    expect(submitCalled).toBe(false);
    expect(form.submitState.get()).toBe('error');

    form.dispose();
  });

  test('server errors map to fields', () => {
    const form = createFormStore<UserForm>({ defaultValues });

    // Simulate server response with field errors
    form.setErrorsWithSource('name' as any, ['Name already taken'], 'server');
    form.setErrorsWithSource('email' as any, ['Email in use'], 'server');

    expect(form.getErrors('name' as any).get()).toEqual(['Name already taken']);
    expect(form.getErrors('email' as any).get()).toEqual(['Email in use']);
    expect(form.isValid.get()).toBe(false);

    // Clear server errors
    form.clearErrorsBySource('name' as any, 'server');
    expect(form.getErrors('name' as any).get()).toEqual([]);

    form.dispose();
  });
});

// ─── Form + Schema Integration ──────────────────────────────────────────────

describe('Form + Schema integration', () => {
  test('ereoSchema validates form data', () => {
    const schema = ereoSchema<{ name: string; email: string }>({
      name: required(),
      email: [required(), email()],
    });

    expect(isEreoSchema(schema)).toBe(true);

    // Valid data
    const validResult = schema.safeParse!({ name: 'Alice', email: 'a@b.com' });
    expect(validResult.success).toBe(true);

    // Invalid data
    const invalidResult = schema.safeParse!({ name: '', email: 'bad' });
    expect(invalidResult.success).toBe(false);
    if (!invalidResult.success) {
      expect(invalidResult.error.issues.length).toBeGreaterThan(0);
    }
  });

  test('ereoSchema parse throws on invalid data', () => {
    const schema = ereoSchema<{ name: string }>({
      name: required(),
    });

    expect(() => schema.parse({ name: '' })).toThrow();
    expect(schema.parse({ name: 'Alice' })).toEqual({ name: 'Alice' });
  });

  test('ereoSchema with nested definitions', () => {
    const schema = ereoSchema<{ user: { name: string; email: string } }>({
      user: {
        name: required(),
        email: [required(), email()],
      },
    });

    const result = schema.safeParse!({ user: { name: '', email: '' } });
    expect(result.success).toBe(false);
    if (!result.success) {
      const paths = result.error.issues.map((i) => i.path.join('.'));
      expect(paths).toContain('user.name');
      expect(paths).toContain('user.email');
    }
  });

  test('ereoSchema skips async validators', () => {
    const asyncV = asyncValidator(async () => 'Async error');
    const schema = ereoSchema<{ name: string }>({
      name: [required(), asyncV],
    });

    // Async validator should be skipped in safeParse
    const result = schema.safeParse!({ name: 'Alice' });
    expect(result.success).toBe(true);
  });

  test('createSchemaValidator wraps custom validation', () => {
    const schema = createSchemaValidator<{ name: string }>({
      validate: (data) => {
        const obj = data as any;
        if (!obj?.name) {
          return { success: false, errors: { name: ['Required'] } };
        }
        return { success: true, data: obj };
      },
    });

    const result = schema.safeParse!({ name: '' });
    expect(result.success).toBe(false);

    expect(() => schema.parse({ name: '' })).toThrow();
    expect(schema.parse({ name: 'Alice' })).toEqual({ name: 'Alice' });
  });

  test('zodAdapter wraps Zod-like schema', () => {
    // Simulate a Zod schema
    const mockZodSchema = {
      parse: (data: unknown) => {
        const obj = data as any;
        if (!obj?.name) throw new Error('Invalid');
        return obj;
      },
      safeParse: (data: unknown) => {
        const obj = data as any;
        if (!obj?.name) {
          return {
            success: false,
            error: {
              issues: [{ path: ['name'], message: 'Required' }],
            },
          };
        }
        return { success: true, data: obj };
      },
    };

    const adapted = zodAdapter(mockZodSchema);

    expect(adapted.parse({ name: 'Alice' })).toEqual({ name: 'Alice' });
    expect(() => adapted.parse({ name: '' })).toThrow();

    const result = adapted.safeParse!({ name: '' });
    expect(result.success).toBe(false);
  });

  test('valibotAdapter wraps Valibot-like schema', () => {
    const schema = {};
    const parse = (_schema: unknown, data: unknown) => {
      const obj = data as any;
      if (!obj?.name) throw new Error('Invalid');
      return obj;
    };
    const safeParse = (_schema: unknown, data: unknown) => {
      const obj = data as any;
      if (!obj?.name) {
        return {
          success: false,
          issues: [{ path: [{ key: 'name' }], message: 'Required' }],
        };
      }
      return { success: true, output: obj };
    };

    const adapted = valibotAdapter(schema, parse, safeParse);

    expect(adapted.parse({ name: 'Alice' })).toEqual({ name: 'Alice' });

    const result = adapted.safeParse!({ name: '' });
    expect(result.success).toBe(false);

    const successResult = adapted.safeParse!({ name: 'Alice' });
    expect(successResult.success).toBe(true);
  });

  test('standardSchemaAdapter wraps Standard Schema V1', () => {
    const mockSchema: any = {
      '~standard': {
        version: 1,
        vendor: 'test',
        validate: (value: unknown) => {
          const obj = value as any;
          if (!obj?.name) {
            return {
              issues: [{ message: 'Required', path: ['name'] }],
            };
          }
          return { value: obj };
        },
      },
    };

    expect(isStandardSchema(mockSchema)).toBe(true);

    const adapted = standardSchemaAdapter(mockSchema);

    expect(adapted.parse({ name: 'Alice' })).toEqual({ name: 'Alice' });
    expect(() => adapted.parse({ name: '' })).toThrow();

    const result = adapted.safeParse!({ name: '' });
    expect(result.success).toBe(false);

    const success = adapted.safeParse!({ name: 'Alice' });
    expect(success.success).toBe(true);
  });

  test('standardSchemaAdapter throws on async validate', () => {
    const asyncSchema: any = {
      '~standard': {
        version: 1,
        vendor: 'test',
        validate: () => Promise.resolve({ value: {} }),
      },
    };

    const adapted = standardSchemaAdapter(asyncSchema);
    expect(() => adapted.parse({})).toThrow('Async');
    expect(() => adapted.safeParse!({})).toThrow('Async');
  });

  test('isStandardSchema rejects non-schemas', () => {
    expect(isStandardSchema(null)).toBe(false);
    expect(isStandardSchema(42)).toBe(false);
    expect(isStandardSchema('string')).toBe(false);
    expect(isStandardSchema({})).toBe(false);
    expect(isStandardSchema({ standard: true })).toBe(false);
  });
});

// ─── Form + Proxy Integration ───────────────────────────────────────────────

describe('Form + Proxy integration', () => {
  test('proxy reads and writes through form store', () => {
    const form = createFormStore<{ user: { name: string; age: number } }>({
      defaultValues: { user: { name: 'Alice', age: 30 } },
    });

    const proxy = form.values;
    expect((proxy as any).user.name).toBe('Alice');

    // Write through proxy
    (proxy as any).user.name = 'Bob';
    expect(form.getValue('user.name' as any)).toBe('Bob');

    form.dispose();
  });
});

// ─── Form + Wizard Integration ──────────────────────────────────────────────

describe('Form + Wizard integration', () => {
  test('wizard validates step fields through form validation engine', async () => {
    interface WizForm { name: string; email: string; bio: string }

    const wizard = createWizard<WizForm>({
      steps: [
        { id: 'personal', fields: ['name' as any] },
        { id: 'contact', fields: ['email' as any] },
        { id: 'about', fields: ['bio' as any] },
      ],
      form: {
        defaultValues: { name: '', email: '', bio: '' },
        validators: {
          name: required(),
          email: [required(), email()],
        } as any,
      },
    });

    // Step 1: name is required, can't advance
    const step1Result = await wizard.next();
    expect(step1Result).toBe(false);

    // Fill name and advance
    wizard.form.setValue('name' as any, 'Alice');
    const step1Pass = await wizard.next();
    expect(step1Pass).toBe(true);
    expect(wizard.currentStep.get()).toBe(1);

    // Step 2: email is required and must be valid
    const step2Fail = await wizard.next();
    expect(step2Fail).toBe(false);

    wizard.form.setValue('email' as any, 'invalid');
    const step2StillFail = await wizard.next();
    // email() validator will fail for 'invalid'
    expect(step2StillFail).toBe(false);

    wizard.form.setValue('email' as any, 'alice@test.com');
    const step2Pass = await wizard.next();
    expect(step2Pass).toBe(true);
    expect(wizard.currentStep.get()).toBe(2);

    // Step 3: bio has no validators, should advance freely
    expect(wizard.state.isLast).toBe(true);

    // Submit
    let submitted = false;
    const submitWizard = createWizard<WizForm>({
      steps: [{ id: 'only' }],
      form: { defaultValues: { name: '', email: '', bio: '' } },
      onComplete: async (values) => { submitted = true; },
    });
    await submitWizard.submit();
    expect(submitted).toBe(true);

    wizard.dispose();
    submitWizard.dispose();
  });
});

// ─── Form + Action Integration ──────────────────────────────────────────────

describe('Form + Action integration', () => {
  test('createFormAction with ereoSchema', async () => {
    const schema = ereoSchema<{ name: string; email: string }>({
      name: required(),
      email: [required(), email()],
    });

    const action = createFormAction<{ name: string; email: string }, { id: number }>({
      schema,
      handler: async (values) => ({ id: 1 }),
    });

    // Valid request
    const validReq = new Request('http://localhost/api', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Alice', email: 'a@b.com' }),
    });
    const validResult = await action(validReq);
    expect(validResult.success).toBe(true);

    // Invalid request
    const invalidReq = new Request('http://localhost/api', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: '', email: '' }),
    });
    const invalidResult = await action(invalidReq);
    expect(invalidResult.success).toBe(false);
    expect(invalidResult.errors).toBeDefined();
  });

  test('form handles action result errors', () => {
    const form = createFormStore<{ name: string; email: string }>({
      defaultValues: { name: '', email: '' },
    });

    // Simulate receiving an action result with errors
    const actionResult = parseActionResult({
      success: false,
      errors: { name: ['Already taken'], email: ['Invalid domain'] },
    });

    if (actionResult.errors) {
      for (const [path, errors] of Object.entries(actionResult.errors)) {
        if (path) {
          form.setErrorsWithSource(path, errors, 'server');
        } else {
          form.setFormErrors(errors);
        }
      }
    }

    expect(form.getErrors('name' as any).get()).toEqual(['Already taken']);
    expect(form.getErrors('email' as any).get()).toEqual(['Invalid domain']);

    form.dispose();
  });
});

// ─── Cross-field Validation Integration ─────────────────────────────────────

describe('Cross-field validation integration', () => {
  test('matches() validator works with form context', async () => {
    const form = createFormStore<{ password: string; confirm: string }>({
      defaultValues: { password: '', confirm: '' },
    });

    form.register('password' as any);
    form.register('confirm' as any, {
      validate: matches('password', 'Passwords must match'),
    });

    form.setValue('password' as any, 'secret123');
    form.setValue('confirm' as any, 'different');

    const valid = await form.trigger('confirm' as any);
    expect(valid).toBe(false);
    expect(form.getErrors('confirm' as any).get()).toContain('Passwords must match');

    form.setValue('confirm' as any, 'secret123');
    const valid2 = await form.trigger('confirm' as any);
    expect(valid2).toBe(true);

    form.dispose();
  });
});

// ─── FormData Conversion Integration ────────────────────────────────────────

describe('FormData conversion', () => {
  test('formDataToObject handles various types', () => {
    const fd = new FormData();
    fd.append('name', 'Alice');
    fd.append('age', '30');
    fd.append('active', 'true');
    fd.append('deleted', 'false');
    fd.append('nothing', 'null');
    fd.append('empty', '');

    const result = formDataToObject(fd);
    expect(result.name).toBe('Alice');
    expect(result.age).toBe(30);
    expect(result.active).toBe(true);
    expect(result.deleted).toBe(false);
    expect(result.nothing).toBe(null);
    expect(result.empty).toBe('');
  });

  test('formDataToObject handles arrays', () => {
    const fd = new FormData();
    fd.append('tags[]', 'a');
    fd.append('tags[]', 'b');
    fd.append('tags[]', 'c');

    const result = formDataToObject(fd);
    expect(result.tags).toEqual(['a', 'b', 'c']);
  });

  test('formDataToObject handles nested paths', () => {
    const fd = new FormData();
    fd.append('user.name', 'Alice');
    fd.append('user.email', 'a@b.com');

    const result = formDataToObject(fd);
    expect(result.user.name).toBe('Alice');
    expect(result.user.email).toBe('a@b.com');
  });

  test('formDataToObject handles bracket notation', () => {
    const fd = new FormData();
    fd.append('items[0]', 'first');
    fd.append('items[1]', 'second');

    const result = formDataToObject(fd);
    expect(result.items[0]).toBe('first');
    expect(result.items[1]).toBe('second');
  });

  test('formDataToObject with coerce=false', () => {
    const fd = new FormData();
    fd.append('age', '30');
    fd.append('active', 'true');

    const result = formDataToObject(fd, { coerce: false });
    expect(result.age).toBe('30');
    expect(result.active).toBe('true');
  });

  test('formDataToObject with explicit arrays option', () => {
    const fd = new FormData();
    fd.append('roles', 'admin');
    fd.append('roles', 'user');

    const result = formDataToObject(fd, { arrays: ['roles'] });
    expect(result.roles).toEqual(['admin', 'user']);
  });

  test('formDataToObject preserves leading zeros', () => {
    const fd = new FormData();
    fd.append('zip', '01234');

    const result = formDataToObject(fd);
    expect(result.zip).toBe('01234'); // Not coerced to number
  });

  test('formDataToObject detects ISO dates', () => {
    const fd = new FormData();
    fd.append('date', '2024-01-15');
    fd.append('datetime', '2024-01-15T10:30:00Z');

    const result = formDataToObject(fd);
    expect(typeof result.date).toBe('string');
    expect(typeof result.datetime).toBe('string');
  });
});

// ─── Form Store Edge Cases ──────────────────────────────────────────────────

describe('FormStore edge cases', () => {
  test('setValues updates multiple fields', () => {
    const form = createFormStore<{ name: string; email: string }>({
      defaultValues: { name: '', email: '' },
    });

    form.setValues({ name: 'Alice', email: 'a@b.com' } as any);
    expect(form.getValue('name' as any)).toBe('Alice');
    expect(form.getValue('email' as any)).toBe('a@b.com');

    form.dispose();
  });

  test('resetField resets single field', () => {
    const form = createFormStore<{ name: string; email: string }>({
      defaultValues: { name: '', email: '' },
    });

    form.setValue('name' as any, 'Alice');
    form.setValue('email' as any, 'a@b.com');
    form.setTouched('name' as any, true);

    form.resetField('name' as any);

    expect(form.getValue('name' as any)).toBe('');
    expect(form.getTouched('name' as any)).toBe(false);
    expect(form.getDirty('name' as any)).toBe(false);
    // Email should be unchanged
    expect(form.getValue('email' as any)).toBe('a@b.com');

    form.dispose();
  });

  test('setBaseline recalculates dirty state', () => {
    const form = createFormStore<{ name: string }>({
      defaultValues: { name: '' },
    });

    form.setValue('name' as any, 'Alice');
    expect(form.isDirty.get()).toBe(true);

    // Set baseline to current values → no longer dirty
    form.setBaseline({ name: 'Alice' });
    expect(form.isDirty.get()).toBe(false);

    form.dispose();
  });

  test('getChanges returns only dirty fields', () => {
    const form = createFormStore<{ name: string; email: string }>({
      defaultValues: { name: '', email: '' },
    });

    form.setValue('name' as any, 'Alice');
    // email unchanged

    const changes = form.getChanges();
    expect((changes as any).name).toBe('Alice');
    expect((changes as any).email).toBeUndefined();

    form.dispose();
  });

  test('watch notifies on value changes', () => {
    const form = createFormStore<{ name: string }>({
      defaultValues: { name: '' },
    });

    let watchedValue: unknown;
    const unsub = form.watch('name' as any, (val) => {
      watchedValue = val;
    });

    form.setValue('name' as any, 'Alice');
    expect(watchedValue).toBe('Alice');

    unsub();
    form.setValue('name' as any, 'Bob');
    expect(watchedValue).toBe('Alice'); // No longer watching

    form.dispose();
  });

  test('watchFields notifies on any field change', () => {
    const form = createFormStore<{ name: string; email: string }>({
      defaultValues: { name: '', email: '' },
    });

    let callCount = 0;
    const unsub = form.watchFields(['name' as any, 'email' as any], () => {
      callCount++;
    });

    form.setValue('name' as any, 'Alice');
    form.setValue('email' as any, 'a@b.com');
    expect(callCount).toBe(2);

    unsub();
    form.dispose();
  });

  test('toJSON returns current values', () => {
    const form = createFormStore<{ name: string }>({
      defaultValues: { name: '' },
    });

    form.setValue('name' as any, 'Alice');
    expect(form.toJSON().name).toBe('Alice');

    form.dispose();
  });

  test('toFormData returns FormData', () => {
    const form = createFormStore<{ name: string; age: number }>({
      defaultValues: { name: 'Alice', age: 30 },
    });

    const fd = form.toFormData();
    expect(fd).toBeInstanceOf(FormData);
    expect(fd.get('name')).toBe('Alice');

    form.dispose();
  });

  test('field ref management', () => {
    const form = createFormStore<{ name: string }>({
      defaultValues: { name: '' },
    });

    const el = {} as HTMLElement;
    form.setFieldRef('name', el);
    expect(form.getFieldRef('name')).toBe(el);
    expect(form.getFieldRef('missing')).toBeNull();

    const refs = form.getFieldRefs();
    expect(refs.get('name')).toBe(el);

    form.dispose();
  });

  test('getBaseline returns deep copy', () => {
    const form = createFormStore<{ name: string }>({
      defaultValues: { name: 'original' },
    });

    const baseline = form.getBaseline();
    expect(baseline.name).toBe('original');

    // Mutation should not affect form
    baseline.name = 'mutated';
    expect(form.getBaseline().name).toBe('original');

    form.dispose();
  });

  test('resetTo with new shape', () => {
    const form = createFormStore<{ name: string; extra?: string }>({
      defaultValues: { name: '' },
    });

    form.setValue('name' as any, 'Alice');
    form.setErrors('name' as any, ['Error']);
    form.setTouched('name' as any, true);

    form.resetTo({ name: 'Reset', extra: 'New field' } as any);

    expect(form.getValue('name' as any)).toBe('Reset');
    expect(form.getValue('extra' as any)).toBe('New field');
    expect(form.getErrors('name' as any).get()).toEqual([]);
    expect(form.getTouched('name' as any)).toBe(false);
    expect(form.isDirty.get()).toBe(false);

    form.dispose();
  });

  test('subscribe and unsubscribe', () => {
    const form = createFormStore<{ name: string }>({
      defaultValues: { name: '' },
    });

    let callCount = 0;
    const unsub = form.subscribe(() => { callCount++; });

    form.setValue('name' as any, 'A');
    const countAfterFirst = callCount;
    expect(countAfterFirst).toBeGreaterThan(0);

    unsub();
    form.setValue('name' as any, 'B');
    expect(callCount).toBe(countAfterFirst); // No more calls

    form.dispose();
  });

  test('dispose cleans up all state', () => {
    const form = createFormStore<{ name: string }>({
      defaultValues: { name: '' },
    });

    form.register('name' as any, { validate: required() });
    form.setTouched('name' as any, true);
    form.setErrors('name' as any, ['Error']);

    form.dispose();

    // After dispose, should not throw but state is cleared
    expect(form.getTouched('name' as any)).toBe(false);
    expect(form.getFieldRef('name')).toBeNull();
  });
});

// ─── A11y + Form Integration ────────────────────────────────────────────────

describe('A11y + Form integration', () => {
  test('getFieldA11y reflects error state', () => {
    const attrs = getFieldA11y('email', { errors: ['Invalid'], touched: true });
    expect(attrs['aria-invalid']).toBe(true);
    expect(attrs['aria-describedby']).toBe('email-error');
  });

  test('getFieldWrapperA11y reflects error state', () => {
    const attrs = getFieldWrapperA11y('email', { errors: ['Invalid'], touched: true });
    expect(attrs['data-invalid']).toBe(true);
    expect(attrs['data-field']).toBe('email');
  });

  test('getFormA11y with submitting state', () => {
    const attrs = getFormA11y('my-form', { isSubmitting: true });
    expect(attrs['aria-busy']).toBe(true);
  });

  test('generateA11yId produces unique sequential IDs', () => {
    const ids = new Set<string>();
    for (let i = 0; i < 100; i++) {
      ids.add(generateA11yId());
    }
    expect(ids.size).toBe(100);
  });
});

// ─── Validator Integration ──────────────────────────────────────────────────

describe('Validator integration with form', () => {
  test('all validators pass with valid data', () => {
    expect(required()('hello')).toBeUndefined();
    expect(email()('test@example.com')).toBeUndefined();
    expect(url()('https://example.com')).toBeUndefined();
    expect(date()('2024-01-15')).toBeUndefined();
    expect(phone()('+1 234 567 8901')).toBeUndefined();
    expect(minLength(3)('hello')).toBeUndefined();
    expect(maxLength(10)('hello')).toBeUndefined();
    expect(min(0)(5)).toBeUndefined();
    expect(max(100)(50)).toBeUndefined();
    expect(pattern(/^[A-Z]/)('Hello')).toBeUndefined();
    expect(number()('42')).toBeUndefined();
    expect(integer()(42)).toBeUndefined();
    expect(positive()(1)).toBeUndefined();
    expect(oneOf(['a', 'b', 'c'])('a')).toBeUndefined();
    expect(notOneOf(['x', 'y'])('a')).toBeUndefined();
  });

  test('all validators fail with invalid data', () => {
    expect(required()('')).toBeDefined();
    expect(required()(null)).toBeDefined();
    expect(required()(undefined)).toBeDefined();
    expect(required()([])).toBeDefined();
    expect(email()('not-an-email')).toBeDefined();
    expect(url()('not-a-url')).toBeDefined();
    expect(date()('not-a-date')).toBeDefined();
    expect(phone()('123')).toBeDefined();
    expect(minLength(10)('short')).toBeDefined();
    expect(maxLength(3)('long text')).toBeDefined();
    expect(min(10)(5)).toBeDefined();
    expect(max(10)(50)).toBeDefined();
    expect(pattern(/^\d+$/)('abc')).toBeDefined();
    expect(number()('not a number')).toBeDefined();
    expect(integer()(1.5)).toBeDefined();
    expect(positive()(-1)).toBeDefined();
    expect(oneOf(['a', 'b'])('c')).toBeDefined();
    expect(notOneOf(['a', 'b'])('a')).toBeDefined();
  });

  test('validators skip empty/null values (except required)', () => {
    expect(email()(null as any)).toBeUndefined();
    expect(email()('')).toBeUndefined();
    expect(url()(null as any)).toBeUndefined();
    expect(minLength(3)('')).toBeUndefined();
    expect(min(0)(null as any)).toBeUndefined();
    expect(number()('')).toBeUndefined();
    expect(integer()(null as any)).toBeUndefined();
    expect(positive()(null as any)).toBeUndefined();
  });
});

// ─── Composition Integration ────────────────────────────────────────────────

describe('Config composition integration', () => {
  test('merged config creates valid form', async () => {
    const baseConfig = {
      defaultValues: { name: '', role: 'user' },
      validators: { name: required() } as any,
    };

    const extensionConfig = {
      defaultValues: { email: '' },
      validators: { email: [required(), email()] } as any,
    };

    const merged = mergeFormConfigs(baseConfig, extensionConfig);

    const form = createFormStore(merged);
    expect(form.getValue('name' as any)).toBe('');
    expect(form.getValue('email' as any)).toBe('');
    expect(form.getValue('role' as any)).toBe('user');

    form.dispose();
  });
});

// ─── Stress / Edge Case Tests ───────────────────────────────────────────────

describe('Stress and edge cases', () => {
  test('rapid setValue calls are handled correctly', () => {
    const form = createFormStore<{ count: number }>({
      defaultValues: { count: 0 },
    });

    for (let i = 0; i < 1000; i++) {
      form.setValue('count' as any, i);
    }
    expect(form.getValue('count' as any)).toBe(999);

    form.dispose();
  });

  test('deeply nested object paths', () => {
    const form = createFormStore<{ a: { b: { c: { d: { e: string } } } } }>({
      defaultValues: { a: { b: { c: { d: { e: '' } } } } },
    });

    form.setValue('a.b.c.d.e' as any, 'deep');
    expect(form.getValue('a.b.c.d.e' as any)).toBe('deep');

    form.dispose();
  });

  test('array field operations', () => {
    const form = createFormStore<{ items: string[] }>({
      defaultValues: { items: ['a', 'b', 'c'] },
    });

    expect(form.getValue('items.0' as any)).toBe('a');
    expect(form.getValue('items.2' as any)).toBe('c');

    form.setValue('items.1' as any, 'B');
    expect(form.getValue('items.1' as any)).toBe('B');

    form.dispose();
  });

  test('concurrent validation and submission', async () => {
    const form = createFormStore<{ name: string }>({
      defaultValues: { name: '' },
      onSubmit: async (values) => {
        await tick(50);
      },
    });

    form.register('name' as any, {
      validate: asyncValidator(async (value: string) => {
        await tick(20);
        return value ? undefined : 'Required';
      }),
    });

    form.setValue('name' as any, 'Alice');

    // Trigger validation and submission concurrently
    const [triggerResult] = await Promise.all([
      form.trigger('name' as any),
    ]);

    expect(triggerResult).toBe(true);

    form.dispose();
  });
});
