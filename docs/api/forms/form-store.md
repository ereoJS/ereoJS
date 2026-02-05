# FormStore

The core class that manages all form state -- values, errors, touched, dirty, and validation. Can be used with or without React.

## Import

```ts
import { FormStore, createFormStore } from '@ereo/forms'
```

## Factory

```ts
function createFormStore<T extends Record<string, any>>(
  config: FormConfig<T>
): FormStore<T>
```

This is equivalent to `new FormStore(config)`.

## Constructor

```ts
new FormStore<T>(config: FormConfig<T>)
```

Creates a new form store. On construction:

1. Default values are deep-cloned into the baseline
2. Per-field signals are created for all leaf paths
3. Status signals (`isValid`, `isDirty`, etc.) are initialized
4. A `ValidationEngine` is created and config validators are registered
5. If `validateOnMount` is `true`, validation runs asynchronously after construction

## Values Proxy

```ts
readonly values: T
```

An ES `Proxy` that provides natural property access to form values:

```ts
const form = createFormStore({
  defaultValues: { user: { name: 'Alice', email: 'alice@example.com' } },
})

// Read
console.log(form.values.user.name) // 'Alice'

// Write
form.values.user.name = 'Bob'
console.log(form.values.user.name) // 'Bob'
```

The proxy reads from and writes to the underlying signals, so changes are reactive.

## Value Access

| Method | Signature | Description |
|--------|-----------|-------------|
| `getValue` | `(path: string) => unknown` | Get value at dot-path |
| `setValue` | `(path: string, value: unknown) => void` | Set value, update dirty tracking, sync child/parent signals, trigger validation |
| `setValues` | `(partial: DeepPartial<T>) => void` | Merge partial values (sets all leaf paths) |
| `getValues` | `() => T` | Reconstruct full values object from signals |
| `getSignal` | `(path: string) => Signal<unknown>` | Get the underlying signal for a path (lazy-created) |

## Error Management

| Method | Signature | Description |
|--------|-----------|-------------|
| `getErrors` | `(path: string) => Signal<string[]>` | Get error signal for a field |
| `setErrors` | `(path: string, errors: string[]) => void` | Set field errors, updates `isValid` |
| `clearErrors` | `(path?: string) => void` | Clear errors for a field, or all if no path |
| `getFormErrors` | `() => Signal<string[]>` | Get form-level error signal |
| `setFormErrors` | `(errors: string[]) => void` | Set form-level errors |

## Touched / Dirty

| Method | Signature | Description |
|--------|-----------|-------------|
| `getTouched` | `(path: string) => boolean` | Whether field has been blurred |
| `setTouched` | `(path: string, touched?: boolean) => void` | Mark field as touched (default `true`) |
| `getDirty` | `(path: string) => boolean` | Whether field differs from baseline |
| `triggerBlurValidation` | `(path: string) => void` | Manually trigger blur validation |
| `getFieldValidating` | `(path: string) => Signal<boolean>` | Whether async validation is running for field |

## Status Signals

These are `Signal` instances from `@ereo/state`. Use `useSignal()` to subscribe in React, or call `.get()` / `.subscribe()` outside React.

| Signal | Type | Description |
|--------|------|-------------|
| `isValid` | `Signal<boolean>` | `true` when no errors exist anywhere |
| `isDirty` | `Signal<boolean>` | `true` when any field is dirty |
| `isSubmitting` | `Signal<boolean>` | `true` during submit |
| `submitState` | `Signal<FormSubmitState>` | `'idle' \| 'submitting' \| 'success' \| 'error'` |
| `submitCount` | `Signal<number>` | Count of successful submits |

## Field Registration

| Method | Signature | Description |
|--------|-----------|-------------|
| `register` | `(path: string, options?: FieldOptions) => FieldRegistration` | Register a field with options and validators |
| `unregister` | `(path: string) => void` | Unregister a field and its validators |

## Submit

| Method | Signature | Description |
|--------|-----------|-------------|
| `handleSubmit` | `(e?: Event) => Promise<void>` | Validate and call `config.onSubmit` |
| `submitWith` | `(handler: SubmitHandler<T>, submitId?: string) => Promise<void>` | Validate and call a custom handler |
| `validate` | `() => Promise<boolean>` | Run all validation without submitting |

`handleSubmit` and `submitWith`:
- Abort any in-flight submit
- Touch all registered fields (so errors become visible)
- Run schema + per-field validation
- If valid, call the handler with `{ values, formData, signal }`
- Set `submitState` to `'success'` or `'error'`
- Increment `submitCount` on success
- Reset if `resetOnSubmit` is configured

## Reset

| Method | Signature | Description |
|--------|-----------|-------------|
| `reset` | `() => void` | Reset to original `defaultValues` |
| `resetTo` | `(values: T) => void` | Reset to arbitrary values, clears all tracking state |
| `setBaseline` | `(values: T) => void` | Update baseline without changing current values (recalculates dirty) |
| `getChanges` | `() => DeepPartial<T>` | Get only the dirty field paths and their values |

## Watch

| Method | Signature | Description |
|--------|-----------|-------------|
| `watch` | `(path: string, callback: WatchCallback) => () => void` | Watch a single path; returns unsubscribe |
| `watchFields` | `(paths: string[], callback: WatchCallback) => () => void` | Watch multiple paths |
| `subscribe` | `(callback: () => void) => () => void` | Subscribe to any form state change |

## Serialization

| Method | Signature | Description |
|--------|-----------|-------------|
| `toJSON` | `() => T` | Get current values (same as `getValues`) |
| `toFormData` | `() => FormData` | Convert to `FormData` (leaf values + Files). Throws if `FormData` is unavailable (SSR). |

## Field Refs

| Method | Signature | Description |
|--------|-----------|-------------|
| `getFieldRef` | `(path: string) => HTMLElement \| null` | Get the DOM element for a field |
| `setFieldRef` | `(path: string, el: HTMLElement \| null) => void` | Set the DOM element reference |
| `getFieldOptions` | `(path: string) => FieldOptions \| undefined` | Get registered options |
| `getBaseline` | `() => T` | Get deep-cloned baseline values |

## Cleanup

```ts
dispose(): void
```

Disposes the validation engine, clears all subscribers, watchers, field refs, and aborts any in-flight submit. Called automatically by `useForm` on unmount.

## Usage Outside React

```ts
import { createFormStore, required, email } from '@ereo/forms'

const form = createFormStore({
  defaultValues: { email: '', password: '' },
  validators: {
    email: [required(), email()],
    password: [required()],
  },
})

// Set values
form.setValue('email', 'user@example.com')
form.setValue('password', 'secret123')

// Validate
const valid = await form.validate()

// Read values
console.log(form.getValues()) // { email: 'user@example.com', password: 'secret123' }

// Dirty tracking with baseline
form.setBaseline(form.getValues())
console.log(form.isDirty.get()) // false

// Watch changes
const unsub = form.watch('email', (value, path) => {
  console.log(`${path} changed to ${value}`)
})

// Clean up
unsub()
form.dispose()
```

## Related

- [useForm](/api/forms/use-form) -- React hook wrapper
- [useFormStatus](/api/forms/use-form-status) -- subscribe to reactive status signals
- [Types -- FormStoreInterface](/api/forms/types)
- [Utilities](/api/forms/utilities) -- getPath, setPath used internally
