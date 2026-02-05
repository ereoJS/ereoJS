# Server Actions

Server-side form processing with `createFormAction`, the `ActionForm` component for client-server roundtrips, and the `useFormAction` hook for programmatic submissions.

## Import

```ts
import {
  createFormAction,
  ActionForm,
  useFormAction,
  parseActionResult,
} from '@ereo/forms'
```

## createFormAction

Creates a server-side request handler that parses the request body, validates with an optional schema, and runs a handler.

### Signature

```ts
function createFormAction<T, TResult = unknown>(opts: {
  schema?: ValidationSchema<unknown, T>;
  handler: (values: T) => Promise<TResult>;
  onError?: (error: unknown) => ActionResult<TResult>;
}): (request: Request) => Promise<ActionResult<TResult>>
```

### Parameters

| Name | Type | Description |
|------|------|-------------|
| `schema` | `ValidationSchema` | Optional schema for server-side validation |
| `handler` | `(values: T) => Promise<TResult>` | Business logic -- called with validated values (required) |
| `onError` | `(error: unknown) => ActionResult<TResult>` | Custom error handler |

### Returns

An async function `(request: Request) => Promise<ActionResult<TResult>>` that:

1. Parses the request body (JSON, FormData, or URL-encoded)
2. Validates against the schema (if provided)
3. Calls the handler with validated values
4. Returns `{ success: true, data }` or `{ success: false, errors }`

### Example

```ts
// server: /api/register
import { createFormAction, zodAdapter } from '@ereo/forms'
import { z } from 'zod'

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
})

export const POST = createFormAction({
  schema: zodAdapter(schema),
  handler: async (values) => {
    const user = await db.users.create(values)
    return { id: user.id }
  },
  onError: (error) => ({
    success: false,
    errors: { '': [error instanceof Error ? error.message : 'Server error'] },
  }),
})
```

## ActionForm

A `<form>` component that handles client-side validation, submission to a URL or function, and automatic server error mapping.

### Signature

```ts
function ActionForm<T extends Record<string, any>>(
  props: ActionFormProps<T>
): ReactElement
```

### Props

| Name | Type | Description |
|------|------|-------------|
| `form` | `FormStoreInterface<T>` | The form store (required) |
| `action` | `string \| ((values: T) => Promise<ActionResult>)` | URL endpoint or async function (required) |
| `method` | `'post' \| 'put' \| 'patch' \| 'delete'` | HTTP method (default `'post'`) |
| `onSuccess` | `(result: any) => void` | Called with response data on success |
| `onError` | `(errors: Record<string, string[]>) => void` | Called with error map on failure |
| `children` | `ReactNode` | Form content |
| `className` | `string` | CSS class |
| `id` | `string` | Form element ID |
| `encType` | `'application/json' \| 'multipart/form-data'` | Request encoding (default `'application/json'`) |

### Behavior

1. Prevents default form submission
2. Runs client-side validation (`form.validate()`)
3. If invalid, focuses the first error and announces errors for screen readers
4. If valid, sends the request (JSON or multipart)
5. Parses the `ActionResult` response
6. Maps server errors back to form fields automatically
7. Calls `onSuccess` or `onError`
8. Announces submit status for accessibility

### Example

```tsx
import { useForm, useField, ActionForm, required, email } from '@ereo/forms'

function RegisterForm() {
  const form = useForm({
    defaultValues: { email: '', password: '' },
    validators: {
      email: [required(), email()],
      password: [required()],
    },
  })

  const emailField = useField(form, 'email')
  const passwordField = useField(form, 'password')

  return (
    <ActionForm
      form={form}
      action="/api/register"
      onSuccess={(data) => {
        window.location.href = `/welcome/${data.id}`
      }}
      onError={(errors) => {
        console.log('Server errors:', errors)
      }}
    >
      <input {...emailField.inputProps} placeholder="Email" />
      <input {...passwordField.inputProps} type="password" placeholder="Password" />
      <button type="submit">Register</button>
    </ActionForm>
  )
}
```

### With Function Action

```tsx
<ActionForm
  form={form}
  action={async (values) => {
    const result = await registerUser(values)
    return result // must return ActionResult
  }}
  onSuccess={(data) => router.push('/dashboard')}
>
  {/* fields */}
</ActionForm>
```

## useFormAction

Hook for programmatic form submissions without `ActionForm`.

### Signature

```ts
function useFormAction<T, TResult = unknown>(opts: {
  action: string | ((values: T) => Promise<ActionResult<TResult>>);
  method?: string;
  encType?: 'application/json' | 'multipart/form-data';
}): {
  submit: (values: T) => Promise<ActionResult<TResult>>;
  cancel: () => void;
  isSubmitting: boolean;
  result: ActionResult<TResult> | null;
}
```

### Returns

| Name | Type | Description |
|------|------|-------------|
| `submit` | `(values: T) => Promise<ActionResult<TResult>>` | Sends values to the action |
| `cancel` | `() => void` | Abort the in-flight request |
| `isSubmitting` | `boolean` | Whether a request is in progress |
| `result` | `ActionResult<TResult> \| null` | Last result |

### Example

```tsx
function MyForm() {
  const form = useForm({ defaultValues: { name: '' } })
  const { submit, isSubmitting, result } = useFormAction({
    action: '/api/update',
    method: 'PUT',
  })

  const handleSubmit = async () => {
    const valid = await form.validate()
    if (!valid) return

    const response = await submit(form.getValues())
    if (response.success) {
      // handle success
    }
  }

  return (
    <form onSubmit={(e) => { e.preventDefault(); handleSubmit() }}>
      {/* fields */}
      <button disabled={isSubmitting}>Save</button>
      {result?.success === false && <div>Error occurred</div>}
    </form>
  )
}
```

## parseActionResult

Normalizes various response shapes into a standard `ActionResult`.

### Signature

```ts
function parseActionResult<T>(response: unknown): ActionResult<T>
```

Handles these shapes:

| Input | Output |
|-------|--------|
| `{ success: true, data }` | Passed through |
| `{ success: false, errors }` | Passed through |
| `{ error: 'msg' }` | `{ success: false, errors: { '': ['msg'] } }` |
| `{ errors: { ... } }` | `{ success: false, errors }` |
| `{ data: ... }` | `{ success: true, data }` |
| `null` / `undefined` | `{ success: false, errors: { '': ['Empty response'] } }` |
| Other | `{ success: true, data: response }` |

## ActionResult

```ts
interface ActionResult<T = unknown> {
  success: boolean;
  data?: T;
  errors?: Record<string, string[]>;
}
```

When `errors` is present, keys are dot-notation field paths. An empty string key (`''`) represents form-level errors not tied to a specific field.

## Related

- [Schema Adapters](/api/forms/schema-adapters) -- validation schemas for server-side
- [useForm](/api/forms/use-form) -- client-side form creation
- [Accessibility](/api/forms/accessibility) -- auto-announced by ActionForm
- [Types -- ActionResult](/api/forms/types)
