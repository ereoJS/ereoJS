# useFormStatus

Subscribes to a form's reactive status signals, returning plain values that trigger re-renders only when they change.

## Import

```ts
import { useFormStatus } from '@ereo/forms'
```

## Signature

```ts
function useFormStatus(form: FormStoreInterface<any>): {
  isSubmitting: boolean;
  submitState: FormSubmitState;
  isValid: boolean;
  isDirty: boolean;
  submitCount: number;
}
```

## Parameters

| Name | Type | Description |
|------|------|-------------|
| `form` | `FormStoreInterface<any>` | The form store (from `useForm` or `createFormStore`) |

## Returns

| Name | Type | Description |
|------|------|-------------|
| `isSubmitting` | `boolean` | `true` while the form is submitting |
| `submitState` | `FormSubmitState` | Current submit lifecycle state |
| `isValid` | `boolean` | `true` when no errors exist on any field or the form itself |
| `isDirty` | `boolean` | `true` when any field value differs from the baseline |
| `submitCount` | `number` | Number of successful submissions |

### FormSubmitState

```ts
type FormSubmitState = 'idle' | 'submitting' | 'success' | 'error'
```

| Value | Description |
|-------|-------------|
| `'idle'` | No submit has been attempted, or the form was reset |
| `'submitting'` | Submit is in progress |
| `'success'` | Last submit completed successfully |
| `'error'` | Last submit failed (validation or handler error) |

## Examples

### Submit Button State

```tsx
import { useFormStatus } from '@ereo/forms'

function SubmitButton({ form }) {
  const { isSubmitting, isValid } = useFormStatus(form)

  return (
    <button type="submit" disabled={isSubmitting || !isValid}>
      {isSubmitting ? 'Saving...' : 'Save'}
    </button>
  )
}
```

### Status Banner

```tsx
function FormStatusBanner({ form }) {
  const { submitState } = useFormStatus(form)

  if (submitState === 'success') {
    return <div className="success">Saved successfully.</div>
  }
  if (submitState === 'error') {
    return <div className="error">Something went wrong. Please try again.</div>
  }
  return null
}
```

### Unsaved Changes Warning

```tsx
import { useEffect } from 'react'

function UnsavedChangesGuard({ form }) {
  const { isDirty } = useFormStatus(form)

  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault()
        e.returnValue = ''
      }
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [isDirty])

  return null
}
```

## How It Works

Each status value comes from a `Signal` instance on the form store. `useFormStatus` reads them via `useSignal()` from `@ereo/state`, which uses `useSyncExternalStore` internally. This means the component re-renders only when the specific signal value changes -- not on every form change.

## Related

- [useForm](/api/forms/use-form) -- create the form store
- [FormStore](/api/forms/form-store) -- underlying signals and methods
- [Types -- FormSubmitState](/api/forms/types)
