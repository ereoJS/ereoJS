/**
 * shadcn/ui Integration Tests
 *
 * These tests simulate how a developer would integrate @ereo/forms with
 * shadcn/ui components (Input, Select, Checkbox, Textarea, Switch, RadioGroup).
 *
 * Since shadcn components are thin wrappers over Radix UI primitives,
 * the key integration points are:
 *   1. Controlled value binding (value + onChange)
 *   2. Custom parse functions for non-standard onChange signatures
 *   3. Error state display (aria-invalid, error messages)
 *   4. Ref forwarding for focus management
 *
 * We mock the component interfaces to match shadcn's actual API contracts.
 */
import { describe, expect, test, beforeEach, mock } from 'bun:test';
import { FormStore } from '@ereo/forms';
import {
  required,
  email,
  minLength,
  compose,
  custom,
  v,
} from '@ereo/forms';

// ─── Mock shadcn-like Component Interfaces ───────────────────────────────────

/**
 * shadcn Input: standard HTML input (value: string, onChange: ChangeEvent)
 * This is the simplest case — works out of the box with useField.
 */
function simulateShadcnInput(
  props: { value: string; onChange: (e: any) => void; onBlur: () => void }
) {
  return {
    type: (text: string) => {
      props.onChange({ target: { value: text, type: 'text' } });
    },
    blur: () => props.onBlur(),
    getValue: () => props.value,
  };
}

/**
 * shadcn Select: Radix-based select (onValueChange: (value: string) => void)
 * NOT standard onChange — needs parse function.
 */
function simulateShadcnSelect(
  props: { value: string; onValueChange: (value: string) => void; onBlur: () => void }
) {
  return {
    select: (value: string) => {
      props.onValueChange(value);
    },
    blur: () => props.onBlur(),
    getValue: () => props.value,
  };
}

/**
 * shadcn Checkbox: Radix checkbox (onCheckedChange: (checked: boolean) => void)
 * Passes boolean directly, not an event.
 */
function simulateShadcnCheckbox(
  props: { checked: boolean; onCheckedChange: (checked: boolean) => void }
) {
  return {
    toggle: () => props.onCheckedChange(!props.checked),
    check: () => props.onCheckedChange(true),
    uncheck: () => props.onCheckedChange(false),
    isChecked: () => props.checked,
  };
}

/**
 * shadcn Switch: Radix switch (onCheckedChange: (checked: boolean) => void)
 * Same interface as checkbox.
 */
function simulateShadcnSwitch(
  props: { checked: boolean; onCheckedChange: (checked: boolean) => void }
) {
  return {
    toggle: () => props.onCheckedChange(!props.checked),
    isChecked: () => props.checked,
  };
}

/**
 * shadcn Textarea: standard HTML textarea (value + onChange with event)
 */
function simulateShadcnTextarea(
  props: { value: string; onChange: (e: any) => void; onBlur: () => void }
) {
  return {
    type: (text: string) => {
      props.onChange({ target: { value: text, type: 'textarea' } });
    },
    blur: () => props.onBlur(),
    getValue: () => props.value,
  };
}

/**
 * shadcn RadioGroup: Radix radio (onValueChange: (value: string) => void)
 */
function simulateShadcnRadioGroup(
  props: { value: string; onValueChange: (value: string) => void }
) {
  return {
    select: (value: string) => props.onValueChange(value),
    getValue: () => props.value,
  };
}

// ─── Scenario 1: shadcn Input Integration ────────────────────────────────────

describe('shadcn Input Integration', () => {
  interface LoginForm {
    email: string;
    password: string;
  }

  test('standard Input works directly with form register', () => {
    const form = new FormStore<LoginForm>({
      defaultValues: { email: '', password: '' },
    });

    // Register field — this is what useField does internally
    const reg = form.register<string>('email', {
      validate: compose(required(), email()),
    });

    // Simulate shadcn Input receiving the props
    const input = simulateShadcnInput({
      value: reg.inputProps.value as string,
      onChange: reg.inputProps.onChange,
      onBlur: reg.inputProps.onBlur,
    });

    input.type('user@example.com');
    expect(form.getValue('email')).toBe('user@example.com');
  });

  test('Input with transform lowercases email', () => {
    const form = new FormStore<LoginForm>({
      defaultValues: { email: '', password: '' },
    });

    const reg = form.register<string>('email', {
      transform: (val) => String(val).toLowerCase().trim(),
    });

    const input = simulateShadcnInput({
      value: reg.inputProps.value as string,
      onChange: reg.inputProps.onChange,
      onBlur: reg.inputProps.onBlur,
    });

    input.type('  User@EXAMPLE.COM  ');
    expect(form.getValue('email')).toBe('user@example.com');
  });

  test('Input shows aria-invalid when errors exist', async () => {
    const form = new FormStore<LoginForm>({
      defaultValues: { email: '', password: '' },
    });

    form.register('email', { validate: required('Email required') });

    // Trigger validation
    await form.validate();

    // Re-register to get updated inputProps
    const reg = form.register('email', { validate: required('Email required') });
    expect(reg.inputProps['aria-invalid']).toBe(true);
    expect(reg.inputProps['aria-describedby']).toBe('email-error');
  });

  test('multiple Inputs in a login form', async () => {
    const submitFn = mock(async () => {});
    const form = new FormStore<LoginForm>({
      defaultValues: { email: '', password: '' },
      onSubmit: submitFn,
    });

    const emailReg = form.register<string>('email', {
      validate: compose(required(), email()),
    });
    const passwordReg = form.register<string>('password', {
      validate: compose(required(), minLength(8)),
    });

    const emailInput = simulateShadcnInput({
      value: emailReg.inputProps.value as string,
      onChange: emailReg.inputProps.onChange,
      onBlur: emailReg.inputProps.onBlur,
    });

    const passwordInput = simulateShadcnInput({
      value: passwordReg.inputProps.value as string,
      onChange: passwordReg.inputProps.onChange,
      onBlur: passwordReg.inputProps.onBlur,
    });

    emailInput.type('alice@test.com');
    passwordInput.type('securepass123');

    await form.handleSubmit();

    expect(submitFn).toHaveBeenCalledTimes(1);
    const values = submitFn.mock.calls[0][0] as LoginForm;
    expect(values.email).toBe('alice@test.com');
    expect(values.password).toBe('securepass123');
  });
});

// ─── Scenario 2: shadcn Select Integration ───────────────────────────────────

describe('shadcn Select Integration', () => {
  interface SettingsForm {
    theme: string;
    language: string;
    timezone: string;
  }

  test('Select needs parse function for onValueChange', () => {
    const form = new FormStore<SettingsForm>({
      defaultValues: { theme: 'light', language: 'en', timezone: 'UTC' },
    });

    // The key DX pattern: shadcn Select uses onValueChange(value: string)
    // not onChange(event). So we need a parse function.
    const reg = form.register<string>('theme', {
      parse: (value: string) => value, // Value comes directly, not in an event
    });

    const select = simulateShadcnSelect({
      value: reg.inputProps.value as string,
      onValueChange: (value) => reg.inputProps.onChange(value),
      onBlur: reg.inputProps.onBlur,
    });

    select.select('dark');
    expect(form.getValue('theme')).toBe('dark');
  });

  test('Select with validation', async () => {
    const form = new FormStore<SettingsForm>({
      defaultValues: { theme: '', language: '', timezone: '' },
    });

    form.register<string>('theme', {
      parse: (v: string) => v,
      validate: required('Please select a theme'),
    });

    const isValid = await form.validate();
    expect(isValid).toBe(false);
    expect(form.getErrors('theme').get()).toContain('Please select a theme');

    // Fix it
    form.setValue('theme', 'dark');
    const isValid2 = await form.validate();
    // May still fail due to other fields, but theme should be fine
    expect(form.getErrors('theme').get()).toEqual([]);
  });

  test('multiple Selects in a settings form', () => {
    const form = new FormStore<SettingsForm>({
      defaultValues: { theme: 'light', language: 'en', timezone: 'UTC' },
    });

    // Register all fields with parse for Radix Select
    const themeReg = form.register<string>('theme', { parse: (v: string) => v });
    const langReg = form.register<string>('language', { parse: (v: string) => v });
    const tzReg = form.register<string>('timezone', { parse: (v: string) => v });

    // Simulate user interactions
    themeReg.inputProps.onChange('dark');
    langReg.inputProps.onChange('fr');
    tzReg.inputProps.onChange('US/Eastern');

    expect(form.getValues()).toEqual({
      theme: 'dark',
      language: 'fr',
      timezone: 'US/Eastern',
    });
  });
});

// ─── Scenario 3: shadcn Checkbox Integration ─────────────────────────────────

describe('shadcn Checkbox Integration', () => {
  interface PreferencesForm {
    notifications: boolean;
    marketing: boolean;
    terms: boolean;
  }

  test('Checkbox with parse for boolean values', () => {
    const form = new FormStore<PreferencesForm>({
      defaultValues: { notifications: true, marketing: false, terms: false },
    });

    // shadcn Checkbox passes boolean directly via onCheckedChange
    const reg = form.register<boolean>('terms', {
      parse: (checked: boolean) => checked,
      validate: custom<boolean>((v) => v ? undefined : 'You must accept terms'),
    });

    const checkbox = simulateShadcnCheckbox({
      checked: reg.inputProps.value as boolean,
      onCheckedChange: (checked) => reg.inputProps.onChange(checked),
    });

    expect(form.getValue('terms')).toBe(false);

    checkbox.check();
    expect(form.getValue('terms')).toBe(true);

    checkbox.uncheck();
    expect(form.getValue('terms')).toBe(false);
  });

  test('Checkbox validation on terms acceptance', async () => {
    const form = new FormStore<PreferencesForm>({
      defaultValues: { notifications: true, marketing: false, terms: false },
    });

    form.register<boolean>('terms', {
      parse: (checked: boolean) => checked,
      validate: custom<boolean>((v) => v ? undefined : 'Must accept terms'),
    });

    const isValid = await form.validate();
    expect(isValid).toBe(false);
    expect(form.getErrors('terms').get()).toContain('Must accept terms');

    form.setValue('terms', true);
    const isValid2 = await form.validate();
    expect(form.getErrors('terms').get()).toEqual([]);
  });

  test('multiple checkboxes track independently', () => {
    const form = new FormStore<PreferencesForm>({
      defaultValues: { notifications: false, marketing: false, terms: false },
    });

    form.register<boolean>('notifications', { parse: (v: boolean) => v });
    form.register<boolean>('marketing', { parse: (v: boolean) => v });
    form.register<boolean>('terms', { parse: (v: boolean) => v });

    form.setValue('notifications', true);
    form.setValue('terms', true);

    expect(form.getValue('notifications')).toBe(true);
    expect(form.getValue('marketing')).toBe(false);
    expect(form.getValue('terms')).toBe(true);
  });
});

// ─── Scenario 4: shadcn Switch Integration ───────────────────────────────────

describe('shadcn Switch Integration', () => {
  interface ToggleForm {
    darkMode: boolean;
    compactView: boolean;
    autoSave: boolean;
  }

  test('Switch works identically to Checkbox', () => {
    const form = new FormStore<ToggleForm>({
      defaultValues: { darkMode: false, compactView: false, autoSave: true },
    });

    const reg = form.register<boolean>('darkMode', {
      parse: (checked: boolean) => checked,
    });

    // For Switch, we wire onCheckedChange directly to onChange.
    // The toggle reads the CURRENT form value (not a stale closure).
    expect(form.getValue('darkMode')).toBe(false);

    // Toggle on
    reg.inputProps.onChange(true);
    expect(form.getValue('darkMode')).toBe(true);

    // Toggle off
    reg.inputProps.onChange(false);
    expect(form.getValue('darkMode')).toBe(false);
  });
});

// ─── Scenario 5: shadcn Textarea Integration ────────────────────────────────

describe('shadcn Textarea Integration', () => {
  interface FeedbackForm {
    subject: string;
    message: string;
    rating: number;
  }

  test('Textarea works like standard Input (event-based)', () => {
    const form = new FormStore<FeedbackForm>({
      defaultValues: { subject: '', message: '', rating: 0 },
    });

    const reg = form.register<string>('message', {
      validate: compose(required('Message required'), minLength(10, 'Too short')),
    });

    const textarea = simulateShadcnTextarea({
      value: reg.inputProps.value as string,
      onChange: reg.inputProps.onChange,
      onBlur: reg.inputProps.onBlur,
    });

    textarea.type('This is a detailed feedback message.');
    expect(form.getValue('message')).toBe('This is a detailed feedback message.');
  });

  test('Textarea with maxLength validation', () => {
    const form = new FormStore<FeedbackForm>({
      defaultValues: { subject: '', message: '', rating: 0 },
    });

    form.register<string>('message', {
      validate: v.maxLength(500, 'Message too long'),
    });

    form.setValue('message', 'x'.repeat(501));
    // Validate manually
    const validator = v.maxLength(500, 'Message too long');
    expect(validator('x'.repeat(501))).toBe('Message too long');
    expect(validator('x'.repeat(500))).toBeUndefined();
  });
});

// ─── Scenario 6: shadcn RadioGroup Integration ──────────────────────────────

describe('shadcn RadioGroup Integration', () => {
  interface SurveyForm {
    satisfaction: string;
    recommendation: string;
  }

  test('RadioGroup uses onValueChange like Select', () => {
    const form = new FormStore<SurveyForm>({
      defaultValues: { satisfaction: '', recommendation: '' },
    });

    // RadioGroup also uses onValueChange(value: string) pattern
    const reg = form.register<string>('satisfaction', {
      parse: (value: string) => value,
      validate: required('Please rate your satisfaction'),
    });

    const radioGroup = simulateShadcnRadioGroup({
      value: reg.inputProps.value as string,
      onValueChange: (value) => reg.inputProps.onChange(value),
    });

    radioGroup.select('satisfied');
    expect(form.getValue('satisfaction')).toBe('satisfied');

    radioGroup.select('neutral');
    expect(form.getValue('satisfaction')).toBe('neutral');
  });
});

// ─── Scenario 7: Complete shadcn Form (all components together) ──────────────

describe('shadcn Complete Form Integration', () => {
  interface CompleteForm {
    name: string;
    email: string;
    role: string;
    bio: string;
    newsletter: boolean;
    darkMode: boolean;
    experience: string;
  }

  test('complete form with mixed shadcn components submits correctly', async () => {
    const submitFn = mock(async () => {});
    const form = new FormStore<CompleteForm>({
      defaultValues: {
        name: '',
        email: '',
        role: '',
        bio: '',
        newsletter: false,
        darkMode: false,
        experience: '',
      },
      onSubmit: submitFn,
    });

    // Register fields with appropriate parse functions
    form.register<string>('name', { validate: required() });
    form.register<string>('email', { validate: compose(required(), email()) });
    form.register<string>('role', { parse: (v: string) => v, validate: required() }); // Select
    form.register<string>('bio'); // Textarea, no validation
    form.register<boolean>('newsletter', { parse: (v: boolean) => v }); // Checkbox
    form.register<boolean>('darkMode', { parse: (v: boolean) => v }); // Switch
    form.register<string>('experience', { parse: (v: string) => v, validate: required() }); // RadioGroup

    // Simulate user filling the form
    form.setValue('name', 'Jane Doe');
    form.setValue('email', 'jane@company.com');
    form.setValue('role', 'developer'); // Select
    form.setValue('bio', 'Full-stack developer with 5 years of experience.');
    form.setValue('newsletter', true); // Checkbox
    form.setValue('darkMode', true); // Switch
    form.setValue('experience', 'senior'); // RadioGroup

    await form.handleSubmit();

    expect(submitFn).toHaveBeenCalledTimes(1);

    const values = submitFn.mock.calls[0][0] as CompleteForm;
    expect(values.name).toBe('Jane Doe');
    expect(values.email).toBe('jane@company.com');
    expect(values.role).toBe('developer');
    expect(values.bio).toBe('Full-stack developer with 5 years of experience.');
    expect(values.newsletter).toBe(true);
    expect(values.darkMode).toBe(true);
    expect(values.experience).toBe('senior');
  });

  test('complete form validation rejects incomplete data', async () => {
    const submitFn = mock(async () => {});
    const form = new FormStore<CompleteForm>({
      defaultValues: {
        name: '',
        email: '',
        role: '',
        bio: '',
        newsletter: false,
        darkMode: false,
        experience: '',
      },
      onSubmit: submitFn,
    });

    form.register<string>('name', { validate: required('Name required') });
    form.register<string>('email', { validate: compose(required('Email required'), email()) });
    form.register<string>('role', { parse: (v: string) => v, validate: required('Role required') });
    form.register<string>('experience', { parse: (v: string) => v, validate: required('Experience required') });

    await form.handleSubmit();

    expect(submitFn).not.toHaveBeenCalled();
    expect(form.getErrors('name').get()).toContain('Name required');
    expect(form.getErrors('email').get()).toContain('Email required');
    expect(form.getErrors('role').get()).toContain('Role required');
    expect(form.getErrors('experience').get()).toContain('Experience required');
  });

  test('dirty tracking works across mixed component types', () => {
    const form = new FormStore<CompleteForm>({
      defaultValues: {
        name: '',
        email: '',
        role: '',
        bio: '',
        newsletter: false,
        darkMode: false,
        experience: '',
      },
    });

    expect(form.isDirty.get()).toBe(false);

    form.setValue('name', 'Test');
    expect(form.getDirty('name')).toBe(true);
    expect(form.getDirty('email')).toBe(false);

    form.setValue('newsletter', true);
    expect(form.getDirty('newsletter')).toBe(true);

    form.setValue('darkMode', true);
    expect(form.getDirty('darkMode')).toBe(true);

    // Reset one field
    form.setValue('name', '');
    expect(form.getDirty('name')).toBe(false);
    expect(form.isDirty.get()).toBe(true); // still dirty from other fields
  });
});

// ─── Scenario 8: DX Patterns for shadcn Components ──────────────────────────

describe('shadcn DX Patterns', () => {
  test('pattern: spreading inputProps on standard elements', () => {
    const form = new FormStore({
      defaultValues: { name: '' },
    });

    const reg = form.register<string>('name');

    // In React, developer would do: <Input {...field.inputProps} />
    // This verifies all expected props are present
    const props = reg.inputProps;
    expect(props).toHaveProperty('name');
    expect(props).toHaveProperty('value');
    expect(props).toHaveProperty('onChange');
    expect(props).toHaveProperty('onBlur');
    expect(props).toHaveProperty('ref');
  });

  test('pattern: custom parse for Radix components', () => {
    const form = new FormStore({
      defaultValues: { color: '' },
    });

    // This is the recommended pattern for Radix Select/RadioGroup:
    // <Select onValueChange={field.inputProps.onChange}>
    // with parse: (v) => v to handle direct value instead of event
    const reg = form.register<string>('color', {
      parse: (value: string) => value,
    });

    // Simulate Radix onValueChange(value)
    reg.inputProps.onChange('blue');
    expect(form.getValue('color')).toBe('blue');
  });

  test('pattern: boolean parse for Checkbox/Switch', () => {
    const form = new FormStore({
      defaultValues: { enabled: false },
    });

    const reg = form.register<boolean>('enabled', {
      parse: (checked: boolean) => checked,
    });

    // Simulate Radix onCheckedChange(boolean)
    reg.inputProps.onChange(true);
    expect(form.getValue('enabled')).toBe(true);
  });

  test('pattern: error display with aria attributes', async () => {
    const form = new FormStore({
      defaultValues: { name: '' },
    });

    form.register('name', { validate: required('Required') });
    await form.validate();

    const reg = form.register('name', { validate: required('Required') });

    // Developer uses these for error display:
    // {field.errors.length > 0 && <p id={`${field.name}-error`}>{field.errors[0]}</p>}
    expect(reg.inputProps['aria-invalid']).toBe(true);
    expect(reg.inputProps['aria-describedby']).toBe('name-error');
    expect(reg.state.errors).toContain('Required');
  });

  test('pattern: form reset clears all shadcn component states', () => {
    const form = new FormStore({
      defaultValues: {
        input: '',
        select: 'default',
        checkbox: false,
        textarea: '',
      },
    });

    form.setValue('input', 'changed');
    form.setValue('select', 'option2');
    form.setValue('checkbox', true);
    form.setValue('textarea', 'some text');

    form.reset();

    expect(form.getValue('input')).toBe('');
    expect(form.getValue('select')).toBe('default');
    expect(form.getValue('checkbox')).toBe(false);
    expect(form.getValue('textarea')).toBe('');
    expect(form.isDirty.get()).toBe(false);
  });
});
