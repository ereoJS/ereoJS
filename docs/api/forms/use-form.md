# useForm

Creates and manages a `FormStore` instance scoped to a React component's lifetime.

## Import

```ts
import { useForm } from '@ereo/forms'
```

## Signature

```ts
export function useForm<T extends Record<string, any>>(
  config: FormConfig<T>
): FormStore<T>
```

## Parameters

### FormConfig

```ts
interface FormConfig<T> {
  defaultValues: T;
  onSubmit?: SubmitHandler<T>;
  schema?: ValidationSchema;
  validators?: Partial<Record<string, ValidatorFunction | ValidatorFunction[]>>;
  validateOn?: 'change' | 'blur' | 'submit';
  validateOnMount?: boolean;
  resetOnSubmit?: boolean;
  focusOnError?: boolean;
  dependencies?: Record<string, string | string[]>;
}
```

| Name | Type | Description |
|------|------|-------------|
| `defaultValues` | `T` | Initial values for every field (required) |
| `onSubmit` | `SubmitHandler<T>` | Called with validated values on submit |
| `schema` | `ValidationSchema` | Zod/Valibot/ereoSchema for full-form validation. Any object with a `~standard` property (Standard Schema V1) is auto-detected. |
| `validators` | `Partial<Record<string, ValidatorFunction \| ValidatorFunction[]>>` | Per-field validators keyed by dot-path |
| `validateOn` | `'change' \| 'blur' \| 'submit'` | Override derived validation timing for all fields |
| `validateOnMount` | `boolean` | Run validation immediately on mount |
| `resetOnSubmit` | `boolean` | Reset form to `defaultValues` after successful submit |
| `focusOnError` | `boolean` | Auto-focus the first invalid field on submit failure (default `true`). The field is scrolled into view with smooth scrolling (respects `prefers-reduced-motion`). |
| `dependencies` | `Record<string, string \| string[]>` | Declare cross-field dependencies at the config level. When a dependency changes, the dependent field re-validates (only if it has been touched). Example: `{ endDate: 'startDate' }` re-validates `endDate` when `startDate` changes. |

## Returns

A `FormStore<T>` instance. The same instance is returned on every render (stored in a `useRef`). The store is disposed automatically when the component unmounts.

### Methods

#### Value Access

| Method | Signature | Description |
|--------|-----------|-------------|
| `values` | `T` (ES Proxy) | Natural property access (e.g., `form.values.user.email`) backed by signals |
| `getValues` | `() => T` | Returns current form values as a plain object |
| `getValue` | `(path: string) => unknown` | Get a specific field value by dot-notation path |
| `setValue` | `(path: string, value: unknown) => void` | Set a specific field value, update dirty tracking, trigger validation |
| `setValues` | `(partial: DeepPartial<T>) => void` | Set multiple values at once (merges leaf paths) |
| `getSignal` | `(path: string) => Signal<unknown>` | Get the underlying Signal for a field (lazy-created) |

#### Submit

| Method | Signature | Description |
|--------|-----------|-------------|
| `handleSubmit` | `(e?: Event) => Promise<void>` | Validate and submit the form |
| `submitWith` | `(handler: SubmitHandler<T>) => Promise<void>` | Submit with a custom handler |
| `validate` | `() => Promise<boolean>` | Run all validation without submitting |

#### Validation

| Method | Signature | Description |
|--------|-----------|-------------|
| `trigger` | `(path?: string) => Promise<boolean>` | Manually trigger validation without submitting. Pass a path to validate a single field, or omit to validate all fields. |

#### Error Management

| Method | Signature | Description |
|--------|-----------|-------------|
| `getErrors` | `(path: string) => Signal<string[]>` | Get error signal for a field |
| `setErrors` | `(path: string, errors: string[]) => void` | Set field errors |
| `clearErrors` | `(path?: string) => void` | Clear errors for a field, or all if no path |
| `setFormErrors` | `(errors: string[]) => void` | Set form-level errors |
| `getFormErrors` | `() => Signal<string[]>` | Get form-level error signal |
| `setErrorsWithSource` | `(path: string, errors: string[], source: ErrorSource) => void` | Set errors with source tracking (`'sync'`, `'async'`, `'schema'`, `'server'`, `'manual'`) |
| `clearErrorsBySource` | `(path: string, source: ErrorSource) => void` | Clear only errors from a specific source (e.g. clear server errors while keeping client-side errors) |
| `getErrorMap` | `(path: string) => Signal<Record<ErrorSource, string[]>>` | Get errors grouped by source for a field |

#### Reset

| Method | Signature | Description |
|--------|-----------|-------------|
| `reset` | `() => void` | Reset to original `defaultValues` |
| `resetTo` | `(values: T) => void` | Reset to specific values |
| `resetField` | `(path: string) => void` | Reset a single field to its default value, clear errors, and unmark touched/dirty |
| `setBaseline` | `(values: T) => void` | Set the baseline for dirty tracking without changing current values |
| `getChanges` | `() => DeepPartial<T>` | Get only changed values (dirty field paths and their values) |

#### Watch / Subscribe

| Method | Signature | Description |
|--------|-----------|-------------|
| `watch` | `(path: string, callback: WatchCallback) => () => void` | Watch a field for changes; returns unsubscribe |
| `watchFields` | `(paths: string[], callback: WatchCallback) => () => void` | Watch multiple fields |
| `subscribe` | `(callback: () => void) => () => void` | Subscribe to any form change |

#### Serialization

| Method | Signature | Description |
|--------|-----------|-------------|
| `toJSON` | `() => T` | Serialize form values (same as `getValues`) |
| `toFormData` | `() => FormData` | Convert to `FormData` (leaf values + Files) |

#### Cleanup

| Method | Signature | Description |
|--------|-----------|-------------|
| `dispose` | `() => void` | Clean up all subscriptions, watchers, field refs, and abort in-flight submits |

### Reactive Signals

These are `Signal` instances from `@ereo/state`. Use `useSignal()` to subscribe in React.

| Signal | Type | Description |
|--------|------|-------------|
| `isSubmitting` | `Signal<boolean>` | `true` during submit |
| `submitState` | `Signal<'idle' \| 'submitting' \| 'success' \| 'error'>` | Current submit lifecycle state |
| `submitCount` | `Signal<number>` | Count of successful submits |
| `isDirty` | `Signal<boolean>` | `true` when any field differs from baseline |
| `isValid` | `Signal<boolean>` | `true` when no errors exist anywhere |

## Examples

### Basic Usage

```tsx
import { useForm, useField } from '@ereo/forms'

function ContactForm() {
  const form = useForm({
    defaultValues: { name: '', email: '' },
    onSubmit: async (values) => {
      await saveContact(values)
    },
  })

  const name = useField(form, 'name')
  const email = useField(form, 'email')

  return (
    <form onSubmit={(e) => { e.preventDefault(); form.handleSubmit() }}>
      <input {...name.inputProps} placeholder="Name" />
      <input {...email.inputProps} placeholder="Email" />
      <button type="submit">Save</button>
    </form>
  )
}
```

### With Per-Field Validators

```tsx
import { useForm, useField, required, email, minLength } from '@ereo/forms'

const form = useForm({
  defaultValues: { email: '', password: '' },
  validators: {
    email: [required(), email()],
    password: [required(), minLength(8)],
  },
  onSubmit: async (values) => {
    await login(values)
  },
})
```

### With Zod Schema

```tsx
import { useForm, zodAdapter } from '@ereo/forms'
import { z } from 'zod'

const schema = z.object({
  name: z.string().min(1),
  age: z.number().min(18),
})

const form = useForm({
  defaultValues: { name: '', age: 0 },
  schema: zodAdapter(schema),
  onSubmit: async (values) => {
    // values is fully typed as { name: string; age: number }
  },
})
```

### With Cross-Field Dependencies

Use `dependencies` at the config level to re-validate fields when their dependencies change:

```tsx
const form = useForm({
  defaultValues: { startDate: '', endDate: '' },
  validators: {
    endDate: [custom((value, context) => {
      const start = context?.getValue('startDate')
      if (start && value && value < start) return 'End date must be after start date'
    })],
  },
  dependencies: {
    endDate: 'startDate', // re-validate endDate when startDate changes
  },
})
```

### With Async Submit Handler

```tsx
const form = useForm({
  defaultValues: { title: '', body: '' },
  onSubmit: async (values, context) => {
    const response = await fetch('/api/posts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(values),
      signal: context.signal, // auto-aborted if re-submitted
    })
    if (!response.ok) throw new Error('Failed to create post')
  },
  resetOnSubmit: true,
})
```

## Lifecycle

- The `FormStore` is created once via `useRef` on the first render
- The config object is read only during construction -- changing it after mount has no effect
- `dispose()` is called automatically in a cleanup effect when the component unmounts
- The store instance is stable across re-renders, so it can be passed to child components without causing re-renders

## Related

- [FormStore](/api/forms/form-store) -- full class API with error management, touched/dirty, and field registration
- [useField](/api/forms/use-field) -- bind individual fields
- [useFormStatus](/api/forms/use-form-status) -- subscribe to reactive status signals
- [Validation](/api/forms/validation) -- validator functions
- [Schema Adapters](/api/forms/schema-adapters) -- Zod, Valibot, ereoSchema
