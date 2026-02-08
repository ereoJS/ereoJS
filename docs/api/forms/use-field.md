# useField

Binds a single field from a `FormStore` to a React component, subscribing to that field's signals for minimal re-renders. Only the component using a given field re-renders when that field's value, errors, or state changes.

## Import

```ts
import { useField } from '@ereo/forms'
```

## Signature

```ts
function useField<T extends Record<string, any>, V = unknown>(
  form: FormStoreInterface<T>,
  name: string,
  opts?: FieldOptions<V>
): FieldHandle<V>
```

## Parameters

| Name | Type | Description |
|------|------|-------------|
| `form` | `FormStoreInterface<T>` | The form store (from `useForm` or `createFormStore`) |
| `name` | `string` | Dot-path to the field (e.g. `'user.email'`) |
| `opts` | `FieldOptions<V>` | Optional field-level configuration |

### FieldOptions

```ts
interface FieldOptions<V> {
  validate?: ValidatorFunction<V> | ValidatorFunction<V>[];
  validateOn?: 'change' | 'blur' | 'submit';
  defaultValue?: V;
  parse?: (event: any) => V;
  transform?: (value: V) => V;
  dependsOn?: string | string[];
}
```

| Name | Type | Description |
|------|------|-------------|
| `validate` | `ValidatorFunction<V> \| ValidatorFunction<V>[]` | Field-level validators. Pass an array or use `compose()` for multiple validators. These run in addition to any form-level validators. |
| `validateOn` | `'change' \| 'blur' \| 'submit'` | Override validation timing for this field. By default, timing is derived from the validator types (see [Validation](/api/forms/validation)). |
| `defaultValue` | `V` | Override the default value for this field. Takes precedence over the form's `defaultValues` for this path. Useful when a field is added dynamically after form creation. |
| `parse` | `(event: any) => V` | Custom value extraction from events. Replaces the default `e.target.value` / `e.target.checked` logic. Useful for custom components that pass values directly instead of DOM events. |
| `transform` | `(value: V) => V` | Transform the value after parsing but before storing. Runs on every change. Useful for coercing types or normalizing input (e.g. trimming whitespace, converting to number). |
| `dependsOn` | `string \| string[]` | Re-validate this field when the specified field(s) change. Useful for cross-field validation (e.g. "end date must be after start date"). The `matches()` validator auto-detects its dependency, so `dependsOn` is not needed when using `matches()`. |

## Returns

### FieldHandle

```ts
interface FieldHandle<V> {
  inputProps: {
    name: string;
    value: V;
    onChange: (e: any) => void;
    onBlur: () => void;
    ref: (el: HTMLElement | null) => void;
    'aria-invalid'?: true;
    'aria-describedby'?: string;
  };
  value: V;
  errors: string[];
  touched: boolean;
  dirty: boolean;
  validating: boolean;
  errorMap: Record<ErrorSource, string[]>;
  setValue: (v: V) => void;
  setError: (errs: string[]) => void;
  clearErrors: () => void;
  setTouched: (t: boolean) => void;
  reset: () => void;
}
```

| Name | Type | Description |
|------|------|-------------|
| `inputProps` | `object` | Props object to spread onto `<input>` or any custom component. Includes `name`, `value`, `onChange`, `onBlur`, `ref`, and conditional ARIA attributes (`aria-invalid`, `aria-describedby`) when errors are present. |
| `value` | `V` | Current field value |
| `errors` | `string[]` | Current validation errors for this field (all sources combined) |
| `touched` | `boolean` | Whether the field has been blurred at least once |
| `dirty` | `boolean` | Whether the current value differs from the baseline (initial) value |
| `validating` | `boolean` | Whether async validation is currently in progress |
| `errorMap` | `Record<ErrorSource, string[]>` | Errors grouped by source: `{ sync: [], async: [], schema: [], server: [], manual: [] }`. Use this to display server errors differently from client-side errors (see [Error Sources](/guides/forms-basic#error-sources)). |
| `setValue` | `(v: V) => void` | Programmatically set the field value |
| `setError` | `(errs: string[]) => void` | Manually set validation errors |
| `clearErrors` | `() => void` | Clear all errors for this field |
| `setTouched` | `(t: boolean) => void` | Manually set the touched state |
| `reset` | `() => void` | Reset the field to its baseline value and clear errors and touched state |

## Examples

### Basic Text Input

Spread `inputProps` directly onto an `<input>` element. This wires up `name`, `value`, `onChange`, `onBlur`, `ref`, and ARIA attributes automatically.

```tsx
function NameField({ form }) {
  const field = useField(form, 'name')

  return (
    <div>
      <label htmlFor="name">Name</label>
      <input id="name" {...field.inputProps} />
      {field.touched && field.errors.length > 0 && (
        <span id="name-error" className="error">
          {field.errors[0]}
        </span>
      )}
    </div>
  )
}
```

### With Validation

Pass validators via the `validate` option. Use an array for multiple validators, or `compose()` to combine them into a single validator.

```tsx
import { useField, required, email, async } from '@ereo/forms'

function EmailField({ form }) {
  const field = useField(form, 'email', {
    validate: [
      required(),
      email(),
      async(async (value) => {
        const taken = await checkEmailExists(value)
        return taken ? 'Email already taken' : undefined
      }, { debounce: 500 }),
    ],
  })

  return (
    <div>
      <label htmlFor="email">Email</label>
      <input id="email" type="email" {...field.inputProps} />
      {field.validating && <span className="hint">Checking...</span>}
      {field.touched && field.errors.length > 0 && (
        <span id="email-error" className="error">
          {field.errors[0]}
        </span>
      )}
    </div>
  )
}
```

### Checkbox

For checkboxes, extract `name`, `onChange`, and `onBlur` from `inputProps` individually and use `field.value` for the `checked` prop. The default `onChange` handler automatically reads `e.target.checked` for checkbox inputs.

```tsx
function AgreeField({ form }) {
  const field = useField(form, 'agree')

  return (
    <label>
      <input
        type="checkbox"
        name={field.inputProps.name}
        checked={!!field.value}
        onChange={field.inputProps.onChange}
        onBlur={field.inputProps.onBlur}
      />
      I agree to the terms
    </label>
  )
}
```

### Select

Spread `inputProps` onto a `<select>` element the same way as a text input.

```tsx
function RoleField({ form }) {
  const field = useField(form, 'role')

  return (
    <div>
      <label htmlFor="role">Role</label>
      <select id="role" {...field.inputProps}>
        <option value="">Select a role...</option>
        <option value="admin">Admin</option>
        <option value="user">User</option>
        <option value="guest">Guest</option>
      </select>
      {field.touched && field.errors.length > 0 && (
        <span id="role-error" className="error">
          {field.errors[0]}
        </span>
      )}
    </div>
  )
}
```

### Custom Component (react-select)

Use the `parse` option to extract a value from a custom component that does not emit standard DOM events. The `parse` function receives whatever the component passes to its `onChange` handler.

```tsx
import Select from 'react-select'

function CountryField({ form }) {
  const countryOptions = [
    { value: 'us', label: 'United States' },
    { value: 'gb', label: 'United Kingdom' },
    { value: 'de', label: 'Germany' },
  ]

  const field = useField(form, 'country', {
    parse: (option) => option?.value ?? '',
  })

  return (
    <div>
      <label>Country</label>
      <Select
        value={countryOptions.find((o) => o.value === field.value)}
        onChange={field.inputProps.onChange}
        onBlur={field.inputProps.onBlur}
        options={countryOptions}
      />
      {field.touched && field.errors.length > 0 && (
        <span className="error">{field.errors[0]}</span>
      )}
    </div>
  )
}
```

### With Transform

Use `transform` to coerce or normalize values before they are stored in the form. The transform runs after `parse` on every change.

```tsx
// Convert string input to a number
const age = useField(form, 'age', {
  transform: (v) => Number(v) || 0,
})

// Trim whitespace on every keystroke
const username = useField(form, 'username', {
  transform: (v) => v.trim(),
})
```

### With dependsOn (Cross-Field Re-validation)

Use `dependsOn` to automatically re-validate this field when another field changes. This is useful for cross-field validation like date ranges.

```tsx
import { useField, custom } from '@ereo/forms'

const endDate = useField(form, 'endDate', {
  validate: custom((value, context) => {
    const start = context?.getValue('startDate')
    if (start && value && value < start) return 'End date must be after start date'
  }),
  dependsOn: 'startDate',
})
```

The `matches()` validator auto-detects its dependency, so `dependsOn` is not needed when using `matches()`:

```tsx
const confirm = useField(form, 'confirmPassword', {
  validate: compose(required(), matches('password', 'Passwords do not match')),
  // No dependsOn needed — matches() registers the dependency automatically
})
```

### Using errorMap

The `errorMap` property groups errors by their source, so you can display server errors differently from client-side validation errors:

```tsx
function EmailField({ form }) {
  const field = useField(form, 'email')

  return (
    <div>
      <input {...field.inputProps} />
      {field.errorMap.server.length > 0 && (
        <span className="server-error">{field.errorMap.server[0]}</span>
      )}
      {field.errorMap.sync.length > 0 && (
        <span className="validation-error">{field.errorMap.sync[0]}</span>
      )}
    </div>
  )
}
```

## Re-render Behavior

`useField` subscribes to per-field signals, so only the component bound to a given field re-renders when that field changes. Other fields remain unaffected.

Specifically, `useField` subscribes to:

- The field's **value signal** via `form.getSignal(name)`
- The field's **error signal** via `form.getErrors(name)`
- The field's **validating signal** via `form.getFieldValidating(name)`
- The form's **subscribe** callback for touched and dirty state

This per-field reactivity means a form with 50 fields does not re-render all 50 when one field changes.

## Lifecycle

- On mount, the field registers itself with the form store (including any `validate`, `parse`, or `transform` options).
- On unmount, the field calls `form.unregister(name)` to clean up its registration from the form store.
- The `ref` callback in `inputProps` registers the DOM element with the form, enabling focus-on-error and scroll-to-error behavior.

## Related

- [useForm](/api/forms/use-form) -- create the form store
- [useFieldArray](/api/forms/use-field-array) -- dynamic arrays
- [Validation](/api/forms/validation) -- validator functions and `compose()`
- [Components](/api/forms/components) -- pre-built `<Field>` component
- [Types](/api/forms/types) -- `FieldHandle`, `FieldOptions`, `ValidatorFunction`
