# Forms

Ereo provides two approaches to forms, depending on your needs.

## Two Approaches

### @ereo/client Form — Simple Forms

For basic forms that submit to a server action and don't need client-side validation, field arrays, or fine-grained re-render control, use the `Form` component from `@ereo/client`:

```tsx
import { Form } from '@ereo/client'

export default function ContactForm() {
  return (
    <Form method="post">
      <input name="name" required />
      <input name="email" type="email" required />
      <button type="submit">Send</button>
    </Form>
  )
}
```

See the [@ereo/client Form API](/api/client/form) for details.

### @ereo/forms — Full-Featured Forms

For complex forms with client-side validation, dynamic field arrays, multi-step wizards, or performance-sensitive UIs, use `@ereo/forms`:

```bash
bun add @ereo/forms @ereo/state react
```

```tsx
import { useForm, useField, required, email } from '@ereo/forms'

function LoginForm() {
  const form = useForm({
    defaultValues: { email: '', password: '' },
    validators: {
      email: [required(), email()],
      password: [required()],
    },
    onSubmit: async (values) => {
      await login(values)
    },
  })

  const emailField = useField(form, 'email')
  const passwordField = useField(form, 'password')

  return (
    <form onSubmit={(e) => { e.preventDefault(); form.handleSubmit() }}>
      <input {...emailField.inputProps} placeholder="Email" />
      {emailField.touched && emailField.errors[0] && (
        <span>{emailField.errors[0]}</span>
      )}

      <input {...passwordField.inputProps} type="password" placeholder="Password" />
      {passwordField.touched && passwordField.errors[0] && (
        <span>{passwordField.errors[0]}</span>
      )}

      <button type="submit">Sign In</button>
    </form>
  )
}
```

## When to Use @ereo/forms

Use `@ereo/forms` when you need:

- **Client-side validation** — 20+ built-in validators with async support
- **Per-field reactivity** — only changed fields re-render
- **Dynamic arrays** — add, remove, reorder fields
- **Multi-step wizards** — with per-step validation and persistence
- **Schema validation** — Zod, Valibot, or native `ereoSchema`
- **Server action integration** — automatic error mapping
- **Accessibility** — ARIA helpers, focus management, screen reader announcements

## Getting Started

### 1. Create a Form

```tsx
import { useForm } from '@ereo/forms'

const form = useForm({
  defaultValues: {
    name: '',
    email: '',
    role: 'user',
  },
  onSubmit: async (values) => {
    const response = await fetch('/api/users', {
      method: 'POST',
      body: JSON.stringify(values),
    })
    if (!response.ok) throw new Error('Failed')
  },
})
```

### 2. Bind Fields

```tsx
import { useField } from '@ereo/forms'

function NameField({ form }) {
  const field = useField(form, 'name')
  return <input {...field.inputProps} />
}
```

`inputProps` includes `name`, `value`, `onChange`, `onBlur`, `ref`, and ARIA attributes — spread it onto any input.

### 3. Add Validation

There are two ways to add validation:

**Form-level validators** — declare all rules in `useForm`:

```tsx
import { useForm, required, email, minLength } from '@ereo/forms'

const form = useForm({
  defaultValues: { email: '', password: '' },
  validators: {
    email: [required(), email()],
    password: [required(), minLength(8)],
  },
  onSubmit: async (values) => { /* ... */ },
})

const emailField = useField(form, 'email')
const passwordField = useField(form, 'password')
```

**Per-field validators** — declare rules in `useField` with `compose`:

```tsx
import { useForm, useField, compose, required, email, minLength } from '@ereo/forms'

const form = useForm({
  defaultValues: { email: '', password: '' },
  onSubmit: async (values) => { /* ... */ },
})

const emailField = useField(form, 'email', {
  validate: compose(required('Email is required'), email()),
})

const passwordField = useField(form, 'password', {
  validate: compose(required('Password is required'), minLength(8)),
})
```

Both approaches work and can be combined. `compose` runs validators in sequence and stops at the first error.

You can also use the `v` shorthand for concise declarations:

```tsx
import { useForm, v } from '@ereo/forms'

const form = useForm({
  defaultValues: { email: '', password: '' },
  validators: {
    email: [v.required(), v.email()],
    password: [v.required(), v.minLength(8)],
  },
})
```

The validation engine automatically derives when to validate. Async validators run on change with debounce; `required` validators run on blur.

### 4. Display Errors

```tsx
function EmailField({ form }) {
  const field = useField(form, 'email')

  return (
    <div>
      <label htmlFor="email">Email</label>
      <input id="email" {...field.inputProps} />
      {field.touched && field.errors.length > 0 && (
        <div className="error">{field.errors[0]}</div>
      )}
    </div>
  )
}
```

### 5. Handle Submit

```tsx
<form onSubmit={(e) => { e.preventDefault(); form.handleSubmit() }}>
  {/* fields */}
  <button type="submit">Save</button>
</form>
```

`handleSubmit` validates all fields, touches them (so errors appear), and calls `onSubmit` if valid.

### 6. Track Form Status

Use `useFormStatus` to reactively track submission state:

```tsx
import { useFormStatus } from '@ereo/forms'

function MyForm({ form }) {
  const { isSubmitting, submitState, isDirty, isValid } = useFormStatus(form)

  return (
    <form onSubmit={(e) => { e.preventDefault(); form.handleSubmit() }}>
      {submitState === 'success' && <div>Saved!</div>}
      {submitState === 'error' && <div>Something went wrong</div>}

      {/* fields */}

      <button type="submit" disabled={isSubmitting}>
        {isSubmitting ? 'Saving...' : 'Save'}
      </button>
    </form>
  )
}
```

`submitState` transitions through: `'idle'` &rarr; `'submitting'` &rarr; `'success'` or `'error'`.

## Working with Field Arrays

```tsx
import { useForm, useFieldArray, useField } from '@ereo/forms'

function TagsForm() {
  const form = useForm({
    defaultValues: { tags: [''] },
  })
  const { fields, append, remove } = useFieldArray(form, 'tags')

  return (
    <div>
      {fields.map((item) => (
        <div key={item.id}>
          <TagInput form={form} index={item.index} />
          <button type="button" onClick={() => remove(item.index)}>Remove</button>
        </div>
      ))}
      <button type="button" onClick={() => append('')}>Add Tag</button>
    </div>
  )
}

function TagInput({ form, index }) {
  const field = useField(form, `tags.${index}`)
  return <input {...field.inputProps} placeholder={`Tag ${index + 1}`} />
}
```

Always use `item.id` as the React `key` — it's a stable identifier that persists across reorders.

`useFieldArray` also provides `prepend`, `insert`, `swap`, `move`, `replace`, `replaceAll`, and `clone` for full array manipulation.

## Cross-Field Validation

Use `matches` to validate a field against another field's value:

```tsx
import { useField, compose, required, matches } from '@ereo/forms'

const password = useField(form, 'password', {
  validate: compose(required(), minLength(8)),
})

const confirm = useField(form, 'confirmPassword', {
  validate: compose(required(), matches('password', 'Passwords do not match')),
})
```

For arbitrary cross-field logic, use `custom` with the validation context:

```tsx
import { custom } from '@ereo/forms'

const endDate = useField(form, 'endDate', {
  validate: custom((value, context) => {
    const start = context?.getValue('startDate')
    if (start && value && value < start) return 'End date must be after start date'
    return undefined
  }),
})
```

## Multi-Step Wizards

```tsx
import { useWizard, useField, WizardProvider, WizardStep, WizardNavigation, required } from '@ereo/forms'

function SignupWizard() {
  const wizard = useWizard({
    steps: [
      { id: 'account', fields: ['email', 'password'] },
      { id: 'profile', fields: ['name'] },
    ],
    form: {
      defaultValues: { email: '', password: '', name: '' },
      validators: {
        email: required(),
        password: required(),
        name: required(),
      },
    },
    persist: 'localStorage',
    onComplete: async (values) => {
      await register(values)
    },
  })

  return (
    <WizardProvider wizard={wizard}>
      <WizardStep id="account">
        <AccountFields form={wizard.form} />
      </WizardStep>
      <WizardStep id="profile">
        <ProfileFields form={wizard.form} />
      </WizardStep>
      <WizardNavigation />
    </WizardProvider>
  )
}
```

The wizard validates only the current step's fields before advancing. Set `persist` to save progress to storage.

## Server Integration

Use `ActionForm` for automatic client-server roundtrips with error mapping:

```tsx
import { useForm, useField, ActionForm, required } from '@ereo/forms'

function ContactForm() {
  const form = useForm({
    defaultValues: { message: '' },
    validators: { message: required() },
  })
  const message = useField(form, 'message')

  return (
    <ActionForm
      form={form}
      action="/api/contact"
      onSuccess={() => alert('Sent!')}
    >
      <textarea {...message.inputProps} />
      <button type="submit">Send</button>
    </ActionForm>
  )
}
```

On the server:

```ts
import { createFormAction } from '@ereo/forms'

export const POST = createFormAction({
  handler: async (values) => {
    await sendEmail(values.message)
    return { sent: true }
  },
})
```

Server errors in `{ success: false, errors: { field: ['msg'] } }` format are automatically mapped back to form fields.

## Accessibility

The built-in components (`Field`, `TextareaField`, `SelectField`) handle ARIA attributes automatically. When using `useField` directly, `inputProps` includes `aria-invalid` and `aria-describedby` when errors exist.

For focus management and screen reader announcements:

```ts
import { focusFirstError, announce, announceErrors } from '@ereo/forms'

// Focus first field with errors
focusFirstError(form)

// Announce to screen readers
announce('Form saved successfully')
```

`ActionForm` calls these automatically on validation failure and submit status changes.

## Type-Safe Field Paths

All form methods, hooks, and components enforce valid field paths at compile time.
TypeScript will show an error if you use a path that doesn't exist in your form's type:

```tsx
const form = useForm({
  defaultValues: { user: { email: '', name: '' } }
})

// Autocomplete shows: 'user' | 'user.email' | 'user.name'
const field = useField(form, 'user.email')    // OK
const field = useField(form, 'usr.emial')     // TS Error!
```

Array indices work with template literals:

```tsx
const form = useForm({ defaultValues: { tags: [''] } })
const { fields } = useFieldArray(form, 'tags')

fields.map((item) => {
  const field = useField(form, `tags.${item.index}`)  // OK
})
```

## Reset Individual Fields

Use `resetField` to reset a single field to its default value:

```tsx
form.resetField('user.email')  // resets value, clears errors, unmarks touched/dirty
```

## Manual Validation

Trigger validation programmatically without submitting:

```tsx
// Validate a single field
const isValid = await form.trigger('email')

// Validate all fields
const allValid = await form.trigger()
```

Useful for "check availability" buttons or validating a field when a related field changes.

## Focus on Error

When form submission fails validation, the first invalid field is automatically focused
and scrolled into view. This is enabled by default.

To disable:

```tsx
const form = useForm({
  defaultValues: { ... },
  focusOnError: false,
})
```

## Validation Gating

Sync validators automatically gate async validators. If a sync validator fails (like `required()`),
async validators (like checking username availability) won't run — avoiding unnecessary
network calls and confusing error messages.

```tsx
const form = useForm({
  defaultValues: { username: '' },
  validators: {
    username: [required(), async(checkAvailability)],
    // If required() fails, checkAvailability won't fire
  },
})
```

## Linked Field Validation

When one field depends on another (like "confirm password" depends on "password"),
use `dependsOn` to automatically re-validate when the dependency changes:

```tsx
const endDate = useField(form, 'endDate', {
  validate: custom((value, context) => {
    const start = context?.getValue('startDate')
    if (start && value && value < start) return 'End date must be after start date'
  }),
  dependsOn: 'startDate',
})
```

The `matches()` validator auto-detects its dependency — no `dependsOn` needed:

```tsx
const confirm = useField(form, 'confirmPassword', {
  validate: compose(required(), matches('password')),
  // No dependsOn needed — matches() registers the dependency automatically
})
```

For config-level dependencies:

```tsx
const form = useForm({
  defaultValues: { startDate: '', endDate: '' },
  dependencies: {
    endDate: 'startDate',  // re-validate endDate when startDate changes
  },
})
```

Dependents only re-validate if they have been touched — untouched fields won't show premature errors.

## Watching Field Values

Use `useWatch` to observe field values reactively without registering the field:

```tsx
import { useWatch } from '@ereo/forms'

// Single field — returns the value
const email = useWatch(form, 'email')

// Multiple fields — returns a tuple
const [start, end] = useWatch(form, ['startDate', 'endDate'])
```

Unlike `useField`, `useWatch` does not register validators or track touched/dirty state.
Use it for conditional rendering, computed display values, or side effects.

## Schema Validation

### Standard Schema (Recommended)

Pass any [Standard Schema](https://standardschema.dev)-compliant validator directly — Zod v4+, Valibot v1+, ArkType, etc.:

```tsx
import { z } from 'zod'

const form = useForm({
  defaultValues: { name: '', email: '' },
  schema: z.object({
    name: z.string().min(1),
    email: z.string().email(),
  }),
})
```

Any object with a `~standard` property is auto-detected and adapted — no wrapper needed.

### Legacy Adapters

For older versions of Zod/Valibot that don't support Standard Schema:

```tsx
import { zodAdapter, valibotAdapter } from '@ereo/forms'

// Zod v3
const form = useForm({
  schema: zodAdapter(myZodSchema),
})

// Valibot v0.x
const form = useForm({
  schema: valibotAdapter(mySchema, parse, safeParse),
})
```

## Error Sources

Track where errors originate to build smarter UX:

```tsx
const field = useField(form, 'username')

// field.errorMap groups errors by source:
// { sync: [], async: [], schema: [], server: [], manual: [] }

// Show server errors differently
{field.errorMap.server.length > 0 && (
  <div className="server-error">{field.errorMap.server[0]}</div>
)}
```

Programmatically manage errors by source:

```tsx
// Set errors with a specific source
form.setErrorsWithSource('email', ['Already taken'], 'server')

// Clear only server errors (keep client-side errors)
form.clearErrorsBySource('email', 'server')
```

Error sources are automatically tagged: `'sync'` and `'async'` from validators, `'schema'` from schema validation, `'server'` from `ActionForm` error mapping, and `'manual'` from `setErrors()`.

## Best Practices

1. **Use `defaultValues` for all fields** — the form needs a complete initial shape
2. **Prefer `useField` over `form.getValue`** — `useField` subscribes to signals for reactive updates
3. **Always use `item.id` as keys** in field arrays, never the index
4. **Let validation timing be derived** — only override `validateOn` when the defaults don't fit
5. **Clean up with `dispose`** — `useForm` and `useWizard` do this automatically, but call `dispose()` if using `createFormStore` or `createWizard` directly
6. **Use the `v` shorthand** for concise validator declarations

## API Reference

See the full [@ereo/forms API reference](/api/forms/) for detailed documentation of every function, component, and type.
