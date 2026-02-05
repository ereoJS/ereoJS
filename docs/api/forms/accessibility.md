# Accessibility

ARIA attribute helpers, focus management, and live announcements for screen readers.

## Import

```ts
import {
  generateA11yId,
  getFieldA11y,
  getErrorA11y,
  getLabelA11y,
  getDescriptionA11y,
  getFieldsetA11y,
  getFieldWrapperA11y,
  getFormA11y,
  getErrorSummaryA11y,
  focusFirstError,
  focusField,
  trapFocus,
  announce,
  announceErrors,
  announceSubmitStatus,
  prefersReducedMotion,
  isScreenReaderActive,
  cleanupLiveRegion,
} from '@ereo/forms'
```

## ARIA Helpers

### generateA11yId

```ts
function generateA11yId(prefix?: string): string
```

Generates a unique ID for ARIA attributes. Default prefix is `'ereo'`.

### getFieldA11y

```ts
function getFieldA11y(
  name: string,
  state: { errors: string[]; touched: boolean }
): Record<string, string | boolean | undefined>
```

Returns `aria-invalid` and `aria-describedby` when the field has errors and is touched.

```ts
getFieldA11y('email', { errors: ['Required'], touched: true })
// { 'aria-invalid': true, 'aria-describedby': 'email-error' }
```

### getErrorA11y

```ts
function getErrorA11y(name: string): {
  id: string
  role: string
  'aria-live': string
}
```

Returns attributes for an error message container.

```ts
getErrorA11y('email')
// { id: 'email-error', role: 'alert', 'aria-live': 'polite' }
```

### getLabelA11y

```ts
function getLabelA11y(name: string, opts?: { id?: string }): {
  htmlFor: string
  id: string
}
```

Returns `htmlFor` and `id` for a label element.

```ts
getLabelA11y('email')
// { htmlFor: 'email', id: 'email-label' }
```

### getDescriptionA11y

```ts
function getDescriptionA11y(name: string): { id: string }
```

Returns an `id` for a field description element.

### getFieldsetA11y

```ts
function getFieldsetA11y(name: string): {
  role: string
  'aria-labelledby': string
}
```

Returns attributes for a fieldset/group wrapper.

### getFieldWrapperA11y

```ts
function getFieldWrapperA11y(
  name: string,
  state: { errors: string[]; touched: boolean }
): Record<string, string | boolean | undefined>
```

Returns `data-field` and `data-invalid` attributes for field wrapper divs.

### getFormA11y

```ts
function getFormA11y(
  id: string,
  opts?: { isSubmitting?: boolean }
): Record<string, string | boolean>
```

Returns `id`, `role="form"`, and `aria-busy` when submitting.

### getErrorSummaryA11y

```ts
function getErrorSummaryA11y(formId: string): {
  role: string
  'aria-labelledby': string
}
```

Returns attributes for an error summary section.

## Focus Management

### focusFirstError

```ts
function focusFirstError(form: FormStoreInterface<any>): void
```

Focuses the first field with errors. Uses the form's field refs for scoped focusing, with a fallback to `[aria-invalid="true"]` query. Respects `prefers-reduced-motion` for scroll behavior.

### focusField

```ts
function focusField(name: string): void
```

Focuses a field by its `name` attribute and scrolls it into view.

### trapFocus

```ts
function trapFocus(container: HTMLElement): () => void
```

Traps Tab/Shift+Tab focus within a container element (useful for modal wizards). Returns an unsubscribe function.

```tsx
useEffect(() => {
  const ref = containerRef.current
  if (!ref) return
  return trapFocus(ref)
}, [])
```

## Live Announcements

### announce

```ts
function announce(
  message: string,
  priority?: 'polite' | 'assertive'
): void
```

Announces a message to screen readers via a visually hidden live region. The live region is created on first use and reused.

### announceErrors

```ts
function announceErrors(
  errors: Record<string, string[]>,
  opts?: { prefix?: string }
): void
```

Announces form errors to screen readers. Default prefix: `"Form has errors:"`.

### announceSubmitStatus

```ts
function announceSubmitStatus(
  status: FormSubmitState,
  opts?: {
    successMessage?: string
    errorMessage?: string
    submittingMessage?: string
  }
): void
```

Announces submit status with customizable messages:

| Status | Default message |
|--------|----------------|
| `submitting` | `"Submitting form..."` |
| `success` | `"Form submitted successfully."` |
| `error` | `"Form submission failed. Please check for errors."` |

### cleanupLiveRegion

```ts
function cleanupLiveRegion(): void
```

Removes the live region from the DOM. Call during cleanup if needed.

## Utilities

### prefersReducedMotion

```ts
function prefersReducedMotion(): boolean
```

Returns `true` if the user prefers reduced motion. SSR-safe (returns `false` on server).

### isScreenReaderActive

```ts
function isScreenReaderActive(): boolean
```

Heuristic detection — checks for NVDA/JAWS in user agent and `[role="application"]`. Not reliable for all screen readers (VoiceOver, TalkBack, Orca are undetectable from JS). Prefer designing for accessibility by default.

## What Components Provide Automatically

The built-in `Field`, `TextareaField`, and `SelectField` components automatically:

- Add `aria-invalid` and `aria-describedby` when errors exist
- Add `aria-required` for required fields
- Render error containers with `role="alert"` and `aria-live="polite"`
- Connect labels via `htmlFor`/`id`

The `ActionForm` component automatically:

- Calls `focusFirstError()` on validation failure
- Calls `announceErrors()` on validation failure
- Calls `announceSubmitStatus()` for all status transitions

## Related

- [Components](/api/forms/components) — pre-built accessible components
- [Server Actions — ActionForm](/api/forms/server-actions) — auto-announces
- [Wizard](/api/forms/wizard) — ARIA roles on wizard components
