# Forms

EreoJS provides two approaches to forms: the `<Form>` component from `@ereo/client` for server-centric submissions, and `@ereo/forms` for client-side state management with rich validation. Choosing the right one depends on your form's complexity.

## Two Mental Models

### `@ereo/client` Form -- Server-Centric

A progressively enhanced HTML `<form>`. It submits to your route's `action`, works without JavaScript, and adds pending states when JS is available.

```tsx
import { Form, useActionData, useNavigation } from '@ereo/client'

export default function ContactPage() {
  const actionData = useActionData()
  const navigation = useNavigation()

  return (
    <Form method="post">
      <input name="email" type="email" required />
      {actionData?.errors?.email && <p>{actionData.errors.email}</p>}
      <textarea name="message" required />
      <button disabled={navigation.state === 'submitting'}>Send</button>
    </Form>
  )
}
```

**The server is the source of truth.** The form collects data, ships it to an action, and the server responds with errors or a redirect.

### `@ereo/forms` -- Client-Centric

A `FormStore` tracks every field as an individual signal. You get real-time validation, field arrays, wizards, and dirty/touched tracking before the form ever hits the server.

```tsx
import { useForm, useField } from '@ereo/forms'

function RegistrationForm() {
  const form = useForm({
    defaultValues: { name: '', email: '' },
    onSubmit: async (values) => {
      await fetch('/api/register', { method: 'POST', body: JSON.stringify(values) })
    },
  })
  const name = useField(form, 'name', { required: true })
  const email = useField(form, 'email', { required: true })

  return (
    <form onSubmit={form.handleSubmit}>
      <input {...name.getInputProps()} />
      {name.error && <p>{name.error}</p>}
      <input {...email.getInputProps()} type="email" />
      <button disabled={form.isSubmitting}>Register</button>
    </form>
  )
}
```

**The client is the source of truth.** Each field is a signal validated independently. The server is called only when the form is valid.

## Comparison

| Feature | `@ereo/client` Form | `@ereo/forms` |
|---------|---------------------|---------------|
| Works without JS | Yes | No |
| Server action integration | Built-in | Manual (`onSubmit`) |
| Client-side validation | HTML5 attributes only | Sync, async, schema, per-field |
| Field-level errors | Via `actionData` after submit | Real-time signals |
| Dirty/touched tracking | No | Yes |
| Field arrays | No | `useFieldArray` |
| Multi-step wizards | No | `Wizard` |
| Bundle cost | Minimal | ~97KB |

## Decision Flowchart

```
Does the form need client-side validation beyond HTML5?
├── No  → @ereo/client <Form>
└── Yes
    └── Does it have field arrays, wizards, or dynamic fields?
        ├── Yes → @ereo/forms
        └── No
            └── Is no-JS support critical?
                ├── Yes → @ereo/client <Form>
                └── No  → @ereo/forms
```

**Short version:** Simple submissions and CRUD --> `<Form>`. Complex validation, field arrays, wizards --> `@ereo/forms`.

## Using Both Together

For forms needing rich client validation and server action integration, combine them using the `@ereo/forms` server actions pattern:

```tsx
import { useForm, useField } from '@ereo/forms'
import { useActionData } from '@ereo/client'

export default function CheckoutForm() {
  const actionData = useActionData()
  const form = useForm({
    defaultValues: { card: '', expiry: '' },
    serverErrors: actionData?.errors,
    action: '/checkout',
    method: 'post',
  })
  const card = useField(form, 'card', {
    required: true,
    validate: (v) => v.length === 16 ? undefined : 'Must be 16 digits',
  })

  return (
    <form onSubmit={form.handleSubmit}>
      <input {...card.getInputProps()} />
      {card.error && <p>{card.error}</p>}
      <button type="submit">Pay</button>
    </form>
  )
}
```

## Anti-Patterns

### 1. Using `@ereo/forms` for Simple Contact Forms

Three fields with no dynamic behavior? `@ereo/forms` adds unnecessary bundle weight. Use `<Form>` with HTML5 validation.

```tsx
// OVERKILL                               // BETTER
const form = useForm({...})               <Form method="post">
const name = useField(form, 'name')         <input name="name" required />
const email = useField(form, 'email')       <input name="email" type="email" required />
// ...                                      <button>Send</button>
                                          </Form>
```

### 2. Not Using Progressive Enhancement

If you use `<Form>` but skip HTML5 attributes (`required`, `type`, `pattern`), the form breaks without JS.

```tsx
// BAD: no validation without JS          // GOOD: HTML5 validation works without JS
<Form method="post">                      <Form method="post">
  <input name="email" />                    <input name="email" type="email" required />
</Form>                                   </Form>
```

### 3. Mixing Approaches in the Same Form

Wrapping `@ereo/forms` fields in `@ereo/client` `<Form>` creates two competing sources of truth. Pick one per form, or use the server actions integration pattern above.

### 4. Forgetting Server-Side Validation

Client-side checks can be bypassed. Always validate in your route action too.

```tsx
export const action = createAction(async ({ request }) => {
  const formData = await request.formData()
  const email = formData.get('email') as string
  if (!email || !isValidEmail(email)) {
    return { success: false, errors: { email: ['Invalid email'] } }
  }
  // proceed...
})
```

## Next Steps

- [Forms (Basic) Guide](/guides/forms-basic) -- Walkthrough with `<Form>`
- [Forms (Advanced) Guide](/guides/forms-advanced) -- Field arrays, wizards, schemas
- [useForm API](/api/forms/use-form) -- Full options reference
- [Form Component API](/api/client/form) -- `<Form>` props and behavior
- [Server Actions](/api/forms/server-actions) -- Connecting `@ereo/forms` to route actions
- [State Management](/concepts/state-management) -- Signals that power `@ereo/forms`
