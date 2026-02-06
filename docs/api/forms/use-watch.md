# useWatch

Observe field values reactively without registering the field. Unlike `useField`, `useWatch` does not register validators, track touched/dirty state, or provide `inputProps`. Use it for conditional rendering, computed display values, or side effects based on field values.

## Import

```ts
import { useWatch } from '@ereo/forms'
```

## Signature

```ts
// Watch a single field — returns the value
function useWatch<T extends Record<string, any>, P extends FormPath<T>>(
  form: FormStoreInterface<T>,
  path: P
): PathValue<T, P>

// Watch multiple fields — returns a tuple of values
function useWatch<T extends Record<string, any>, P extends FormPath<T>>(
  form: FormStoreInterface<T>,
  paths: P[]
): unknown[]
```

## Parameters

| Name | Type | Description |
|------|------|-------------|
| `form` | `FormStoreInterface<T>` | The form store (from `useForm` or `createFormStore`) |
| `path` | `string` | A single dot-path to watch (e.g. `'user.email'`) |
| `paths` | `string[]` | An array of dot-paths to watch |

## Returns

- **Single path:** Returns the current value of the field. Re-renders the component when the value changes.
- **Multiple paths:** Returns an array of values in the same order as the input paths. Re-renders when any of the watched values change.

## Examples

### Single Field

```tsx
import { useWatch } from '@ereo/forms'

function PricePreview({ form }) {
  const price = useWatch(form, 'price')

  return <div className="preview">Price: ${price}</div>
}
```

### Multiple Fields

```tsx
function DateRangeDisplay({ form }) {
  const [start, end] = useWatch(form, ['startDate', 'endDate'])

  return (
    <div>
      {start && end
        ? `${start} to ${end}`
        : 'Select a date range'}
    </div>
  )
}
```

### Conditional Rendering

Show or hide fields based on another field's value:

```tsx
function ShippingForm({ form }) {
  const shippingMethod = useWatch(form, 'shippingMethod')

  return (
    <div>
      <SelectField form={form} name="shippingMethod" options={[
        { value: 'standard', label: 'Standard' },
        { value: 'express', label: 'Express' },
        { value: 'pickup', label: 'Pickup' },
      ]} />

      {shippingMethod !== 'pickup' && (
        <>
          <Field form={form} name="address" label="Shipping Address" />
          <Field form={form} name="city" label="City" />
        </>
      )}
    </div>
  )
}
```

### Computed Values

Derive a display value from multiple fields without registering them:

```tsx
function OrderSummary({ form }) {
  const [quantity, unitPrice] = useWatch(form, ['quantity', 'unitPrice'])
  const total = (Number(quantity) || 0) * (Number(unitPrice) || 0)

  return <div>Total: ${total.toFixed(2)}</div>
}
```

## When to Use useWatch vs useField

| | `useWatch` | `useField` |
|---|-----------|-----------|
| **Reactive value** | Yes | Yes |
| **Registers validators** | No | Yes |
| **Tracks touched/dirty** | No | Yes |
| **Provides inputProps** | No | Yes |
| **Use case** | Display, conditional rendering, side effects | Form inputs that need validation and state |

Use `useWatch` when you need to read a field's value but don't need to render an input for it. Use `useField` when you need to bind an input element.

## Related

- [useField](/api/forms/use-field) -- bind fields with validation and state
- [FormStore -- watch](/api/forms/form-store#watch) -- imperative watch API (outside React)
- [useFormStatus](/api/forms/use-form-status) -- observe form-level status
