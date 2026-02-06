# Forms (Advanced)

For forms that need client-side validation, dynamic field arrays, multi-step wizards, or per-field reactivity, use `@ereo/forms`. It builds on `@ereo/state` signals so only the fields that change re-render.

::: tip When to use this
This guide covers advanced forms with `@ereo/forms`. For simple server-submitted forms without client-side validation, see [Forms (Basic)](/guides/forms-basic).
:::

## Installation

```bash
bun add @ereo/forms @ereo/state react
```

## Basic Setup

Create a form with `useForm` and bind fields with `useField`:

```tsx
import { useForm, useField, required, email } from '@ereo/forms'

function LoginForm() {
  const form = useForm({
    defaultValues: {
      email: '',
      password: '',
    },
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
      <div>
        <label htmlFor="email">Email</label>
        <input id="email" {...emailField.inputProps} />
        {emailField.touched && emailField.errors[0] && (
          <span className="error">{emailField.errors[0]}</span>
        )}
      </div>

      <div>
        <label htmlFor="password">Password</label>
        <input id="password" type="password" {...passwordField.inputProps} />
        {passwordField.touched && passwordField.errors[0] && (
          <span className="error">{passwordField.errors[0]}</span>
        )}
      </div>

      <button type="submit">Sign In</button>
    </form>
  )
}
```

`useField` returns `inputProps` that includes `name`, `value`, `onChange`, `onBlur`, `ref`, and ARIA attributes. Spread it onto any `<input>`, `<select>`, or `<textarea>`.

## Validation

### Sync Validators

Built-in validators run synchronously on blur or change:

```tsx
import { useForm, required, email, minLength, maxLength, pattern } from '@ereo/forms'

const form = useForm({
  defaultValues: { username: '', email: '', password: '' },
  validators: {
    username: [required(), minLength(3), maxLength(20)],
    email: [required(), email()],
    password: [required(), minLength(8), pattern(/[A-Z]/, 'Must contain an uppercase letter')],
  },
  onSubmit: async (values) => { /* ... */ },
})
```

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

### Async Validators

Async validators run on change with automatic debouncing. They only fire when all sync validators pass:

```tsx
const form = useForm({
  defaultValues: { username: '' },
  validators: {
    username: [
      required(),
      async (value) => {
        const taken = await checkUsername(value)
        if (taken) return 'Username is already taken'
      },
    ],
  },
})
```

### Schema Validation with Zod

Pass a Zod schema (or any Standard Schema-compliant validator) to the `schema` option:

```tsx
import { useForm } from '@ereo/forms'
import { z } from 'zod'

const form = useForm({
  defaultValues: { name: '', email: '', age: '' },
  schema: z.object({
    name: z.string().min(1, 'Name is required'),
    email: z.string().email('Invalid email'),
    age: z.coerce.number().min(18, 'Must be 18 or older'),
  }),
  onSubmit: async (values) => { /* ... */ },
})
```

Any object with a `~standard` property is auto-detected -- no adapter needed. For older versions of Zod or Valibot, use the legacy adapters `zodAdapter` or `valibotAdapter`.

### Per-Field Validators with compose

Declare validators directly in `useField` using `compose`:

```tsx
import { useForm, useField, compose, required, email } from '@ereo/forms'

const form = useForm({
  defaultValues: { email: '' },
  onSubmit: async (values) => { /* ... */ },
})

const emailField = useField(form, 'email', {
  validate: compose(required('Email is required'), email()),
})
```

## Cross-Field Validation

Use `matches` to validate one field against another:

```tsx
import { useField, compose, required, minLength, matches } from '@ereo/forms'

const password = useField(form, 'password', {
  validate: compose(required(), minLength(8)),
})

const confirmPassword = useField(form, 'confirmPassword', {
  validate: compose(required(), matches('password', 'Passwords do not match')),
  // No dependsOn needed -- matches() registers it automatically
})
```

For arbitrary cross-field logic, use `custom`:

```tsx
import { custom } from '@ereo/forms'

const endDate = useField(form, 'endDate', {
  validate: custom((value, context) => {
    const start = context?.getValue('startDate')
    if (start && value && value < start) return 'End date must be after start date'
  }),
  dependsOn: 'startDate',
})
```

## Field Arrays

Use `useFieldArray` for dynamic lists of fields:

```tsx
import { useForm, useFieldArray, useField, required } from '@ereo/forms'

function TeamForm() {
  const form = useForm({
    defaultValues: {
      teamName: '',
      members: [{ name: '', email: '' }],
    },
    onSubmit: async (values) => { /* ... */ },
  })

  const { fields, append, remove } = useFieldArray(form, 'members')

  return (
    <form onSubmit={(e) => { e.preventDefault(); form.handleSubmit() }}>
      {fields.map((item) => (
        <div key={item.id}>
          <MemberFields form={form} index={item.index} />
          <button type="button" onClick={() => remove(item.index)}>
            Remove
          </button>
        </div>
      ))}

      <button type="button" onClick={() => append({ name: '', email: '' })}>
        Add Member
      </button>

      <button type="submit">Submit</button>
    </form>
  )
}

function MemberFields({ form, index }) {
  const nameField = useField(form, `members.${index}.name`)
  const emailField = useField(form, `members.${index}.email`)

  return (
    <div>
      <input {...nameField.inputProps} placeholder="Name" />
      <input {...emailField.inputProps} placeholder="Email" />
    </div>
  )
}
```

Always use `item.id` as the React `key` -- it is a stable identifier that persists across reorders. `useFieldArray` also provides `prepend`, `insert`, `swap`, `move`, and `replace`.

## Multi-Step Wizards

Use `useWizard` for multi-step forms with per-step validation:

```tsx
import {
  useWizard,
  useField,
  WizardProvider,
  WizardStep,
  WizardNavigation,
  required,
  email,
} from '@ereo/forms'

function SignupWizard() {
  const wizard = useWizard({
    steps: [
      { id: 'account', fields: ['email', 'password'] },
      { id: 'profile', fields: ['name', 'bio'] },
    ],
    form: {
      defaultValues: { email: '', password: '', name: '', bio: '' },
      validators: {
        email: [required(), email()],
        password: [required()],
        name: [required()],
      },
    },
    persist: 'localStorage',
    onComplete: async (values) => {
      await registerUser(values)
    },
  })

  return (
    <WizardProvider wizard={wizard}>
      <WizardStep id="account">
        <AccountStep form={wizard.form} />
      </WizardStep>
      <WizardStep id="profile">
        <ProfileStep form={wizard.form} />
      </WizardStep>
      <WizardNavigation />
    </WizardProvider>
  )
}

function AccountStep({ form }) {
  const emailField = useField(form, 'email')
  const passwordField = useField(form, 'password')

  return (
    <div>
      <input {...emailField.inputProps} placeholder="Email" />
      <input {...passwordField.inputProps} type="password" placeholder="Password" />
    </div>
  )
}

function ProfileStep({ form }) {
  const nameField = useField(form, 'name')
  const bioField = useField(form, 'bio')

  return (
    <div>
      <input {...nameField.inputProps} placeholder="Full Name" />
      <textarea {...bioField.inputProps} placeholder="Tell us about yourself" />
    </div>
  )
}
```

The wizard validates only the current step's fields before advancing. Set `persist` to `'localStorage'` to save progress across page reloads.

## Server-Side Error Integration

Use `ActionForm` to submit to a server action and automatically map server errors back to form fields:

```tsx
import { useForm, useField, ActionForm, required } from '@ereo/forms'

function ContactForm() {
  const form = useForm({
    defaultValues: { email: '', message: '' },
    validators: { email: [required()], message: [required()] },
  })

  const emailField = useField(form, 'email')
  const messageField = useField(form, 'message')

  return (
    <ActionForm form={form} action="/api/contact" onSuccess={() => alert('Sent!')}>
      <input {...emailField.inputProps} placeholder="Email" />
      <textarea {...messageField.inputProps} placeholder="Message" />
      <button type="submit">Send</button>
    </ActionForm>
  )
}
```

On the server, return errors in the `{ success: false, errors: { field: ['message'] } }` format and they are automatically mapped to the corresponding fields:

```ts
// routes/api/contact.ts
import { createFormAction } from '@ereo/forms'

export const POST = createFormAction({
  handler: async (values) => {
    const existing = await db.contacts.findByEmail(values.email)
    if (existing) {
      return {
        success: false,
        errors: { email: ['This email has already been used'] },
      }
    }
    await sendEmail(values)
    return { success: true }
  },
})
```

## Watching Field Values

Use `useWatch` to observe field values without registering the field:

```tsx
import { useWatch } from '@ereo/forms'

function OrderSummary({ form }) {
  const [quantity, price] = useWatch(form, ['quantity', 'price'])
  const total = (Number(quantity) || 0) * (Number(price) || 0)

  return <p>Total: ${total.toFixed(2)}</p>
}
```

Unlike `useField`, `useWatch` does not register validators or track touched/dirty state. Use it for conditional rendering or computed display values.

## Form Status

Track overall form state with `useFormStatus`:

```tsx
import { useFormStatus } from '@ereo/forms'

function SubmitButton({ form }) {
  const { isSubmitting, isDirty, isValid } = useFormStatus(form)

  return (
    <button type="submit" disabled={isSubmitting || !isDirty}>
      {isSubmitting ? 'Saving...' : 'Save'}
    </button>
  )
}
```

## Related

- [@ereo/forms API Reference](/api/forms/) -- Full documentation for every hook, component, and type
- [Forms (Basic)](/guides/forms-basic) -- Simple forms with `@ereo/client`
- [useForm](/api/forms/use-form) -- Form creation API
- [useField](/api/forms/use-field) -- Field binding API
- [useFieldArray](/api/forms/use-field-array) -- Dynamic field arrays
- [Validation](/api/forms/validation) -- All built-in validators
