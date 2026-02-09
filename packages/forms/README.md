# @ereo/forms

Type-safe, signal-powered form management for React. Built on `@ereo/state` with per-field reactivity, schema validation, wizards, and accessibility out of the box.

## Installation

```bash
bun add @ereo/forms @ereo/state
```

## Quick Start

```tsx
import { useForm, useField } from '@ereo/forms';

interface LoginForm {
  email: string;
  password: string;
}

function LoginPage() {
  const form = useForm<LoginForm>({
    initialValues: { email: '', password: '' },
    onSubmit: async (values) => {
      await login(values);
    },
  });

  const email = useField(form, 'email', { validate: required('Email is required') });
  const password = useField(form, 'password', { validate: required('Password is required') });

  return (
    <form onSubmit={form.handleSubmit}>
      <input {...email.inputProps} type="email" />
      {email.error && <span>{email.error}</span>}

      <input {...password.inputProps} type="password" />
      {password.error && <span>{password.error}</span>}

      <button type="submit" disabled={form.isSubmitting}>Log In</button>
    </form>
  );
}
```

## Key Features

- **Per-Field Signals** - Each field gets its own reactive signal for fine-grained updates
- **Type-Safe Paths** - `FormPath<T>` constrains all field names at compile time
- **Proxy Access** - Read/write values via `form.values.user.email`
- **Validation Engine** - Sync, async, schema, and cross-field validation with smart triggers
- **Schema Support** - Zod, Valibot, Standard Schema V1, and built-in `ereoSchema`
- **Components** - Pre-built `Field`, `TextareaField`, `SelectField`, and `FieldArray`
- **Wizard** - Multi-step forms with `createWizard`, step validation, and progress tracking
- **Server Actions** - `createFormAction` + `ActionForm` for server-side form handling
- **Accessibility** - ARIA attributes, focus management, live region announcements

## Validation

```typescript
import { required, email, minLength, compose, matches, async as asyncValidator } from '@ereo/forms';

const form = useForm<SignUpForm>({
  initialValues: { email: '', password: '', confirmPassword: '' },
  onSubmit: handleSignUp,
});

// Compose multiple validators
const emailField = useField(form, 'email', {
  validate: compose(
    required('Email is required'),
    email('Invalid email address'),
    asyncValidator(checkEmailAvailable, 'Email already taken'),
  ),
});

// Cross-field validation with matches()
const confirmField = useField(form, 'confirmPassword', {
  validate: matches('password', 'Passwords must match'),
});
```

## Schema Validation

```typescript
import { useForm } from '@ereo/forms';
import { zodAdapter } from '@ereo/forms';
import { z } from 'zod';

const schema = z.object({
  name: z.string().min(1),
  age: z.number().min(18),
});

const form = useForm({
  initialValues: { name: '', age: 0 },
  schema: zodAdapter(schema),
  onSubmit: handleSubmit,
});
```

## Field Arrays

```tsx
import { useForm, useFieldArray } from '@ereo/forms';

interface TodoForm {
  todos: { text: string; done: boolean }[];
}

function TodoList() {
  const form = useForm<TodoForm>({
    initialValues: { todos: [{ text: '', done: false }] },
    onSubmit: handleSubmit,
  });

  const { items, append, remove, swap, move } = useFieldArray(form, 'todos');

  return (
    <div>
      {items.map((item, i) => (
        <div key={item.id}>
          <input {...useField(form, `todos.${i}.text`).inputProps} />
          <button onClick={() => remove(i)}>Remove</button>
        </div>
      ))}
      <button onClick={() => append({ text: '', done: false })}>Add</button>
    </div>
  );
}
```

## Wizard (Multi-Step Forms)

```tsx
import { createWizard, useWizard, WizardProvider, WizardStep, WizardNavigation, WizardProgress } from '@ereo/forms';

const wizard = createWizard({
  steps: [
    { id: 'info', label: 'Info' },
    { id: 'address', label: 'Address' },
    { id: 'confirm', label: 'Confirm' },
  ],
  onComplete: async (data) => {
    await submitRegistration(data);
  },
});

function RegistrationWizard() {
  return (
    <WizardProvider wizard={wizard}>
      <WizardProgress />
      <WizardStep step="info"><InfoFields /></WizardStep>
      <WizardStep step="address"><AddressFields /></WizardStep>
      <WizardStep step="confirm"><ConfirmFields /></WizardStep>
      <WizardNavigation />
    </WizardProvider>
  );
}
```

## Built-in Validators

| Validator | Description |
|-----------|-------------|
| `required(msg)` | Field must have a value |
| `email(msg)` | Valid email format |
| `url(msg)` | Valid URL format |
| `minLength(n, msg)` | Minimum string length |
| `maxLength(n, msg)` | Maximum string length |
| `min(n, msg)` | Minimum numeric value |
| `max(n, msg)` | Maximum numeric value |
| `pattern(regex, msg)` | Matches a regex pattern |
| `number(msg)` | Must be a valid number |
| `integer(msg)` | Must be an integer |
| `positive(msg)` | Must be positive |
| `matches(field, msg)` | Must match another field's value |
| `oneOf(values, msg)` | Must be one of the listed values |
| `fileSize(max, msg)` | File size limit |
| `fileType(types, msg)` | Allowed file MIME types |
| `compose(...fns)` | Compose multiple validators |
| `when(cond, validator)` | Conditional validation |
| `async(fn, msg)` | Async validation with debounce |
| `custom(fn)` | Custom validation function |

## API Reference

### Hooks
- `useForm(config)` - Create a form store (React hook)
- `useField(form, name, opts?)` - Register and subscribe to a field
- `useFieldArray(form, name)` - Manage dynamic array fields
- `useWatch(form, name)` - Observe a field value without registering
- `useFormStatus(form)` - Get form-level status (dirty, valid, submitting)

### Core
- `createFormStore(config)` - Create a form store (non-hook)
- `FormStore` - The form store class
- `createValuesProxy(form)` - Create a proxy for `form.values.x.y` access
- `getPath(obj, path)` / `setPath(obj, path, val)` - Deep path get/set

### Components
- `Field` - Renders an input field with label, error, and ARIA props
- `TextareaField` - Textarea variant
- `SelectField` - Select dropdown variant
- `FieldArray` - Render prop for array fields

### Context
- `FormProvider` / `useFormContext` - React context for form store

### Schema Adapters
- `zodAdapter(schema)` - Zod schema adapter
- `valibotAdapter(schema)` - Valibot schema adapter
- `standardSchemaAdapter(schema)` - Standard Schema V1 adapter
- `ereoSchema(definition)` - Built-in lightweight schema
- `createSchemaValidator(schema)` - Generic schema validator factory

### Server Actions
- `createFormAction(config)` - Create a server action handler
- `ActionForm` - Form component wired to server actions
- `useFormAction(form, action)` - Hook for action-based submission
- `parseActionResult(response)` - Parse server action response

## Documentation

For full documentation, visit [https://ereojs.dev/docs/forms](https://ereojs.dev/docs/forms)

## Part of EreoJS

This package is part of the [EreoJS](https://github.com/ereoJS/ereoJS) monorepo - a modern full-stack framework built for Bun.

## License

MIT
