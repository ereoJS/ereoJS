# Forms FAQ

Frequently asked questions about forms in EreoJS.

## When should I use @ereo/forms vs the basic Form component?

**Use `<Form>` from `@ereo/client`** for simple forms that submit to a server action and do not need client-side validation, field arrays, or fine-grained control:

```tsx
import { Form } from '@ereo/client'

export default function ContactForm() {
  return (
    <Form method="post">
      <input name="email" type="email" required />
      <button type="submit">Subscribe</button>
    </Form>
  )
}
```

**Use `@ereo/forms`** when you need:

- Client-side validation with 20+ built-in validators
- Per-field reactivity (only changed fields re-render)
- Dynamic field arrays (add, remove, reorder)
- Multi-step wizards with per-step validation
- Schema validation (Zod, Valibot, Standard Schema)
- Error source tracking (sync, async, server, manual)

See the [Forms guide](/guides/forms) for a complete comparison.

## How do I handle file uploads?

For file uploads, use a standard `<form>` with `enctype="multipart/form-data"` and handle the `File` object in your action:

```tsx
// routes/upload.tsx
export const action = createAction(async ({ request }) => {
  const formData = await request.formData()
  const file = formData.get('avatar') as File

  if (!file || file.size === 0) {
    return { error: 'No file selected' }
  }

  const buffer = await file.arrayBuffer()
  await Bun.write(`./uploads/${file.name}`, buffer)

  return { success: true }
})

export default function Upload() {
  return (
    <form method="post" encType="multipart/form-data">
      <input type="file" name="avatar" accept="image/*" />
      <button type="submit">Upload</button>
    </form>
  )
}
```

With `@ereo/forms`, file inputs are not managed by the form state. Use a ref to access the file input value:

```tsx
import { useRef } from 'react'
import { useForm, ActionForm } from '@ereo/forms'

function UploadForm() {
  const fileRef = useRef<HTMLInputElement>(null)
  const form = useForm({ defaultValues: { caption: '' } })

  return (
    <ActionForm form={form} action="/api/upload" encType="multipart/form-data">
      <input type="file" name="avatar" ref={fileRef} />
      <button type="submit">Upload</button>
    </ActionForm>
  )
}
```

## How does server-side validation work with @ereo/forms?

When using `ActionForm`, server validation errors in the `{ success: false, errors: { field: ['message'] } }` format are automatically mapped back to form fields:

```ts
// Server action
export const POST = createFormAction({
  handler: async (values) => {
    const existing = await db.users.findByEmail(values.email)
    if (existing) {
      return {
        success: false,
        errors: { email: ['This email is already registered'] },
      }
    }
    await db.users.create(values)
    return { success: true }
  },
})
```

The error appears on the `email` field in the client form automatically, tagged with the `'server'` error source. You can distinguish server errors from client-side validation errors using `field.errorMap.server`.

## How do field arrays work?

Use `useFieldArray` to manage dynamic lists of fields:

```tsx
import { useForm, useFieldArray, useField } from '@ereo/forms'

function InviteForm() {
  const form = useForm({
    defaultValues: { emails: [''] },
  })
  const { fields, append, remove } = useFieldArray(form, 'emails')

  return (
    <div>
      {fields.map((item) => (
        <div key={item.id}>
          <EmailInput form={form} index={item.index} />
          <button type="button" onClick={() => remove(item.index)}>Remove</button>
        </div>
      ))}
      <button type="button" onClick={() => append('')}>Add Email</button>
    </div>
  )
}

function EmailInput({ form, index }) {
  const field = useField(form, `emails.${index}`)
  return <input {...field.inputProps} placeholder="Email address" />
}
```

Always use `item.id` as the React `key`, not the array index. The `id` is a stable identifier that persists across reorders. `useFieldArray` also provides `prepend`, `insert`, `swap`, `move`, and `replace` methods.

## How do I build multi-step forms?

Use `useWizard` for multi-step form wizards with per-step validation and optional persistence:

```tsx
import { useWizard, WizardProvider, WizardStep, WizardNavigation } from '@ereo/forms'

function SignupWizard() {
  const wizard = useWizard({
    steps: [
      { id: 'account', fields: ['email', 'password'] },
      { id: 'profile', fields: ['name', 'bio'] },
    ],
    form: {
      defaultValues: { email: '', password: '', name: '', bio: '' },
    },
    persist: 'localStorage',
    onComplete: async (values) => {
      await createAccount(values)
    },
  })

  return (
    <WizardProvider wizard={wizard}>
      <WizardStep id="account">{/* Account fields */}</WizardStep>
      <WizardStep id="profile">{/* Profile fields */}</WizardStep>
      <WizardNavigation />
    </WizardProvider>
  )
}
```

The wizard validates only the current step's fields before advancing. Set `persist: 'localStorage'` to save progress across page refreshes.

## How do I reset form state?

Reset the entire form or individual fields:

```tsx
// Reset all fields to their default values
form.reset()

// Reset with new default values
form.reset({ email: 'new@example.com', name: 'New Name' })

// Reset a single field
form.resetField('email')
```

`reset()` clears all errors, touched/dirty flags, and restores default values. `resetField(path)` does the same for a single field.

## How do I validate on submit only?

By default, the validation engine derives when to run validators (blur for `required`, change with debounce for async). To run validation only on submit:

```tsx
const form = useForm({
  defaultValues: { email: '' },
  validators: {
    email: [required(), email()],
  },
  validateOn: 'submit',
})
```

With `validateOn: 'submit'`, no validation runs until `handleSubmit()` is called.

See the full [@ereo/forms API reference](/api/forms/) for all form options.
