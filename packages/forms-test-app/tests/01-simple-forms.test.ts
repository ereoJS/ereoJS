/**
 * Simple Form Scenarios — simulating a developer's first experience with @ereo/forms
 *
 * Tests cover:
 * 1. Basic login form (useForm + useField)
 * 2. Contact form with built-in validators
 * 3. Registration form with password confirmation (cross-field)
 * 4. Form submission lifecycle
 * 5. Form reset behavior
 */
import { describe, expect, test, beforeEach, mock } from 'bun:test';
import { FormStore } from '@ereo/forms';
import {
  required,
  email,
  minLength,
  maxLength,
  matches,
  compose,
  v,
} from '@ereo/forms';

// ─── Scenario 1: Basic Login Form ────────────────────────────────────────────

describe('Scenario 1: Basic Login Form', () => {
  interface LoginForm {
    email: string;
    password: string;
    rememberMe: boolean;
  }

  const defaults: LoginForm = {
    email: '',
    password: '',
    rememberMe: false,
  };

  let form: FormStore<LoginForm>;

  beforeEach(() => {
    form = new FormStore<LoginForm>({ defaultValues: defaults });
  });

  test('initializes with default values', () => {
    expect(form.getValue('email')).toBe('');
    expect(form.getValue('password')).toBe('');
    expect(form.getValue('rememberMe')).toBe(false);
  });

  test('sets individual field values', () => {
    form.setValue('email', 'user@example.com');
    form.setValue('password', 'secret123');
    form.setValue('rememberMe', true);

    expect(form.getValue('email')).toBe('user@example.com');
    expect(form.getValue('password')).toBe('secret123');
    expect(form.getValue('rememberMe')).toBe(true);
  });

  test('tracks dirty state correctly', () => {
    expect(form.isDirty.get()).toBe(false);
    expect(form.getDirty('email')).toBe(false);

    form.setValue('email', 'changed@example.com');
    expect(form.isDirty.get()).toBe(true);
    expect(form.getDirty('email')).toBe(true);
    expect(form.getDirty('password')).toBe(false);
  });

  test('resetting to default clears dirty state', () => {
    form.setValue('email', 'changed@example.com');
    expect(form.isDirty.get()).toBe(true);

    form.setValue('email', '');
    expect(form.getDirty('email')).toBe(false);
    expect(form.isDirty.get()).toBe(false);
  });

  test('tracks touched state on setTouched', () => {
    expect(form.getTouched('email')).toBe(false);

    form.setTouched('email', true);
    expect(form.getTouched('email')).toBe(true);
    expect(form.getTouched('password')).toBe(false);
  });

  test('getValues returns the full form object', () => {
    form.setValue('email', 'test@test.com');
    form.setValue('password', 'pass');
    form.setValue('rememberMe', true);

    const values = form.getValues();
    expect(values).toEqual({
      email: 'test@test.com',
      password: 'pass',
      rememberMe: true,
    });
  });

  test('submits with onSubmit handler', async () => {
    const submitFn = mock(async (values: LoginForm) => {});
    const form = new FormStore<LoginForm>({
      defaultValues: defaults,
      onSubmit: submitFn,
    });

    form.setValue('email', 'user@test.com');
    form.setValue('password', 'pass123');

    await form.handleSubmit();

    expect(submitFn).toHaveBeenCalledTimes(1);
    const calledWith = submitFn.mock.calls[0][0];
    expect(calledWith.email).toBe('user@test.com');
    expect(calledWith.password).toBe('pass123');
  });

  test('submit state transitions correctly', async () => {
    const states: string[] = [];
    const submitFn = mock(async () => {
      states.push(form.submitState.get());
    });
    const form = new FormStore<LoginForm>({
      defaultValues: defaults,
      onSubmit: submitFn,
    });

    expect(form.submitState.get()).toBe('idle');

    await form.handleSubmit();

    expect(states).toContain('submitting');
    expect(form.submitState.get()).toBe('success');
    expect(form.submitCount.get()).toBe(1);
  });

  test('reset restores all values and state', async () => {
    form.setValue('email', 'changed@test.com');
    form.setTouched('email', true);
    form.setErrors('email', ['Some error']);

    form.reset();

    expect(form.getValue('email')).toBe('');
    expect(form.getTouched('email')).toBe(false);
    expect(form.getErrors('email').get()).toEqual([]);
    expect(form.isDirty.get()).toBe(false);
  });
});

// ─── Scenario 2: Contact Form with Validators ───────────────────────────────

describe('Scenario 2: Contact Form with Validation', () => {
  interface ContactForm {
    name: string;
    email: string;
    phone: string;
    message: string;
  }

  const defaults: ContactForm = {
    name: '',
    email: '',
    phone: '',
    message: '',
  };

  test('required validator catches empty fields', () => {
    const validator = required();
    expect(validator('')).toBe('This field is required');
    expect(validator(null)).toBe('This field is required');
    expect(validator(undefined)).toBe('This field is required');
    expect(validator('hello')).toBeUndefined();
  });

  test('required validator with custom message', () => {
    const validator = required('Name is required');
    expect(validator('')).toBe('Name is required');
  });

  test('email validator works correctly', () => {
    const validator = email();
    expect(validator('')).toBeUndefined(); // empty is OK (use required for that)
    expect(validator('invalid')).toBe('Invalid email address');
    expect(validator('user@example.com')).toBeUndefined();
    expect(validator('user@sub.domain.com')).toBeUndefined();
  });

  test('minLength validator enforces minimum', () => {
    const validator = minLength(10);
    expect(validator('')).toBeUndefined(); // empty is OK
    expect(validator('short')).toBe('Must be at least 10 characters');
    expect(validator('long enough text')).toBeUndefined();
  });

  test('maxLength validator enforces maximum', () => {
    const validator = maxLength(5);
    expect(validator('hi')).toBeUndefined();
    expect(validator('too long')).toBe('Must be at most 5 characters');
  });

  test('compose chains validators and short-circuits on first error', () => {
    const validator = compose(required('Required'), email('Invalid email'));

    expect(validator('')).toBe('Required');
    expect(validator('not-email')).toBe('Invalid email');
    expect(validator('user@test.com')).toBeUndefined();
  });

  test('v shorthand alias works identically', () => {
    const validator = v.compose(v.required(), v.email());
    expect(validator('')).toBe('This field is required');
    expect(validator('bad')).toBe('Invalid email address');
    expect(validator('good@test.com')).toBeUndefined();
  });

  test('form-level validation on submit catches errors', async () => {
    const form = new FormStore<ContactForm>({
      defaultValues: defaults,
      onSubmit: async () => {},
    });

    // Register fields with validators
    form.register('name', { validate: required('Name required') });
    form.register('email', { validate: [required('Email required'), email()] });
    form.register('message', { validate: required('Message required') });

    const isValid = await form.validate();
    expect(isValid).toBe(false);

    expect(form.getErrors('name').get()).toContain('Name required');
    expect(form.getErrors('email').get()).toContain('Email required');
    expect(form.getErrors('message').get()).toContain('Message required');
  });

  test('valid form passes validation', async () => {
    const submitFn = mock(async () => {});
    const form = new FormStore<ContactForm>({
      defaultValues: defaults,
      onSubmit: submitFn,
    });

    form.register('name', { validate: required() });
    form.register('email', { validate: [required(), email()] });
    form.register('message', { validate: required() });

    form.setValue('name', 'Alice');
    form.setValue('email', 'alice@example.com');
    form.setValue('message', 'Hello!');

    await form.handleSubmit();

    expect(submitFn).toHaveBeenCalledTimes(1);
    expect(form.submitState.get()).toBe('success');
  });

  test('errors are cleared when fields become valid', async () => {
    const form = new FormStore<ContactForm>({
      defaultValues: defaults,
      onSubmit: async () => {},
    });

    form.register('email', { validate: [required(), email()] });

    // Trigger validation to create errors
    await form.validate();
    expect(form.getErrors('email').get().length).toBeGreaterThan(0);

    // Fix the value and re-validate
    form.setValue('email', 'valid@test.com');
    await form.validate();
    expect(form.getErrors('email').get()).toEqual([]);
  });

  test('setErrors and clearErrors work manually', () => {
    const form = new FormStore<ContactForm>({ defaultValues: defaults });

    form.setErrors('name', ['Too short', 'Invalid characters']);
    expect(form.getErrors('name').get()).toEqual(['Too short', 'Invalid characters']);
    expect(form.isValid.get()).toBe(false);

    form.clearErrors('name');
    expect(form.getErrors('name').get()).toEqual([]);
    expect(form.isValid.get()).toBe(true);
  });

  test('form-level errors (not field-specific)', () => {
    const form = new FormStore<ContactForm>({ defaultValues: defaults });

    form.setFormErrors(['Server error: too many requests']);
    expect(form.getFormErrors().get()).toEqual(['Server error: too many requests']);
    expect(form.isValid.get()).toBe(false);

    form.clearErrors();
    expect(form.getFormErrors().get()).toEqual([]);
    expect(form.isValid.get()).toBe(true);
  });
});

// ─── Scenario 3: Registration Form with Cross-field Validation ──────────────

describe('Scenario 3: Registration Form (cross-field)', () => {
  interface RegisterForm {
    username: string;
    email: string;
    password: string;
    confirmPassword: string;
    age: number;
    terms: boolean;
  }

  const defaults: RegisterForm = {
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
    age: 0,
    terms: false,
  };

  test('matches validator compares two fields', () => {
    const form = new FormStore<RegisterForm>({
      defaultValues: defaults,
    });

    const matchValidator = matches('password', 'Passwords must match');

    form.setValue('password', 'abc123');
    form.setValue('confirmPassword', 'abc456');

    const context = {
      getValue: (path: string) => form.getValue(path),
      getValues: () => form.getValues(),
    };

    expect(matchValidator('abc456', context)).toBe('Passwords must match');

    form.setValue('confirmPassword', 'abc123');
    expect(matchValidator('abc123', context)).toBeUndefined();
  });

  test('full registration validation flow', async () => {
    const submitFn = mock(async () => {});
    const form = new FormStore<RegisterForm>({
      defaultValues: defaults,
      onSubmit: submitFn,
    });

    form.register('username', {
      validate: compose(required(), minLength(3), maxLength(20)),
    });
    form.register('email', {
      validate: compose(required(), email()),
    });
    form.register('password', {
      validate: compose(required(), minLength(8)),
    });
    form.register('confirmPassword', {
      validate: compose(required(), matches('password', 'Passwords must match')),
    });

    // Fill in valid data
    form.setValue('username', 'alice');
    form.setValue('email', 'alice@example.com');
    form.setValue('password', 'securepass');
    form.setValue('confirmPassword', 'securepass');

    await form.handleSubmit();

    expect(submitFn).toHaveBeenCalledTimes(1);
    expect(form.submitState.get()).toBe('success');
  });

  test('registration fails with mismatched passwords', async () => {
    const submitFn = mock(async () => {});
    const form = new FormStore<RegisterForm>({
      defaultValues: defaults,
      onSubmit: submitFn,
    });

    form.register('password', { validate: required() });
    form.register('confirmPassword', {
      validate: compose(required(), matches('password', 'Passwords must match')),
    });

    form.setValue('password', 'securepass');
    form.setValue('confirmPassword', 'different');

    await form.handleSubmit();

    expect(submitFn).not.toHaveBeenCalled();
    expect(form.getErrors('confirmPassword').get()).toContain('Passwords must match');
  });

  test('resetOnSubmit clears the form after success', async () => {
    const form = new FormStore<RegisterForm>({
      defaultValues: defaults,
      onSubmit: async () => {},
      resetOnSubmit: true,
    });

    form.setValue('username', 'alice');
    form.setValue('email', 'alice@test.com');

    await form.handleSubmit();

    expect(form.getValue('username')).toBe('');
    expect(form.getValue('email')).toBe('');
    expect(form.isDirty.get()).toBe(false);
  });
});

// ─── Scenario 4: Signals & Reactivity ────────────────────────────────────────

describe('Scenario 4: Signal Reactivity', () => {
  interface SimpleForm {
    name: string;
    count: number;
  }

  test('signal updates reactively when value changes', () => {
    const form = new FormStore<SimpleForm>({
      defaultValues: { name: '', count: 0 },
    });

    const sig = form.getSignal('name');
    expect(sig.get()).toBe('');

    form.setValue('name', 'test');
    expect(sig.get()).toBe('test');
  });

  test('error signal updates reactively', () => {
    const form = new FormStore<SimpleForm>({
      defaultValues: { name: '', count: 0 },
    });

    const errorSig = form.getErrors('name');
    expect(errorSig.get()).toEqual([]);

    form.setErrors('name', ['Error!']);
    expect(errorSig.get()).toEqual(['Error!']);
  });

  test('subscribe fires on any change', () => {
    const form = new FormStore<SimpleForm>({
      defaultValues: { name: '', count: 0 },
    });

    let callCount = 0;
    const unsub = form.subscribe(() => callCount++);

    form.setValue('name', 'a');
    form.setValue('count', 1);
    form.setTouched('name');

    expect(callCount).toBeGreaterThanOrEqual(3);

    unsub();
    form.setValue('name', 'b');
    // callCount should not increase after unsub
    expect(callCount).toBeGreaterThanOrEqual(3);
  });

  test('watch fires only for specified path', () => {
    const form = new FormStore<SimpleForm>({
      defaultValues: { name: '', count: 0 },
    });

    const nameChanges: unknown[] = [];
    const unsub = form.watch('name', (value) => nameChanges.push(value));

    form.setValue('name', 'Alice');
    form.setValue('count', 42); // should not trigger name watcher
    form.setValue('name', 'Bob');

    expect(nameChanges).toEqual(['Alice', 'Bob']);

    unsub();
    form.setValue('name', 'Charlie');
    expect(nameChanges.length).toBe(2);
  });

  test('watchFields fires for any of the listed paths', () => {
    const form = new FormStore<SimpleForm>({
      defaultValues: { name: '', count: 0 },
    });

    const changes: unknown[] = [];
    const unsub = form.watchFields(['name', 'count'], (value, path) => {
      changes.push({ path, value });
    });

    form.setValue('name', 'A');
    form.setValue('count', 1);

    expect(changes).toEqual([
      { path: 'name', value: 'A' },
      { path: 'count', value: 1 },
    ]);

    unsub();
  });
});

// ─── Scenario 5: Proxy Values Access ─────────────────────────────────────────

describe('Scenario 5: Proxy Values Access', () => {
  interface UserForm {
    user: {
      name: string;
      email: string;
      address: {
        city: string;
        zip: string;
      };
    };
  }

  test('proxy access reads current values', () => {
    const form = new FormStore<UserForm>({
      defaultValues: {
        user: {
          name: 'Alice',
          email: 'alice@test.com',
          address: { city: 'NYC', zip: '10001' },
        },
      },
    });

    expect(form.values.user.name).toBe('Alice');
    expect(form.values.user.address.city).toBe('NYC');
  });

  test('proxy reflects changes after setValue', () => {
    const form = new FormStore<UserForm>({
      defaultValues: {
        user: {
          name: '',
          email: '',
          address: { city: '', zip: '' },
        },
      },
    });

    form.setValue('user.name', 'Bob');
    expect(form.values.user.name).toBe('Bob');

    form.setValue('user.address.zip', '90210');
    expect(form.values.user.address.zip).toBe('90210');
  });
});

// ─── Scenario 6: Serialization ───────────────────────────────────────────────

describe('Scenario 6: Serialization', () => {
  interface OrderForm {
    product: string;
    quantity: number;
    notes: string;
  }

  test('toJSON returns the current values', () => {
    const form = new FormStore<OrderForm>({
      defaultValues: { product: '', quantity: 1, notes: '' },
    });

    form.setValue('product', 'Widget');
    form.setValue('quantity', 5);

    expect(form.toJSON()).toEqual({
      product: 'Widget',
      quantity: 5,
      notes: '',
    });
  });

  test('toFormData creates FormData with flattened values', () => {
    const form = new FormStore<OrderForm>({
      defaultValues: { product: '', quantity: 1, notes: '' },
    });

    form.setValue('product', 'Widget');
    form.setValue('quantity', 5);
    form.setValue('notes', 'Rush order');

    const fd = form.toFormData();
    expect(fd.get('product')).toBe('Widget');
    expect(fd.get('quantity')).toBe('5');
    expect(fd.get('notes')).toBe('Rush order');
  });

  test('getChanges returns only dirty fields', () => {
    const form = new FormStore<OrderForm>({
      defaultValues: { product: '', quantity: 1, notes: '' },
    });

    form.setValue('product', 'New Product');
    // quantity and notes unchanged

    const changes = form.getChanges();
    expect(changes).toEqual({ product: 'New Product' });
  });
});
