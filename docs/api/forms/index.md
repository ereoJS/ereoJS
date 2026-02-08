# @ereo/forms

Signal-based form library for React with per-field reactivity. Each field gets its own signal from `@ereo/state`, so only the components bound to changed fields re-render. Validation rules derive their trigger behavior automatically -- no manual `validateOn` configuration needed.

## Installation

```bash
bun add @ereo/forms @ereo/state react
```

## Quick Example

```tsx
import { useForm, useField, useFormStatus, required, email } from '@ereo/forms'

function SignupForm() {
  const form = useForm({
    defaultValues: { email: '', password: '' },
    validators: {
      email: [required(), email()],
      password: [required(), minLength(8)],
    },
    onSubmit: async (values) => {
      await fetch('/api/signup', { method: 'POST', body: JSON.stringify(values) })
    },
  })

  const emailField = useField(form, 'email')
  const passwordField = useField(form, 'password')
  const { isSubmitting } = useFormStatus(form)

  return (
    <form onSubmit={(e) => { e.preventDefault(); form.handleSubmit() }}>
      <input {...emailField.inputProps} placeholder="Email" />
      {emailField.touched && emailField.errors[0] && (
        <span>{emailField.errors[0]}</span>
      )}

      <input {...passwordField.inputProps} type="password" placeholder="Password" />
      {passwordField.touched && passwordField.errors[0] && (
        <span>{passwordField.errors[0]}</span>
      )}

      <button type="submit" disabled={isSubmitting}>
        {isSubmitting ? 'Submitting...' : 'Sign Up'}
      </button>
    </form>
  )
}
```

## Features

- **Per-field signals** -- only the component using a changed field re-renders
- **Validation engine** -- 20+ built-in validators with derive-don't-configure trigger behavior
- **Field arrays** -- dynamic add/remove/swap/move for list-based fields
- **Wizard / multi-step forms** -- step management with per-step validation
- **Schema adapters** -- Zod, Valibot, and native `ereoSchema` DSL
- **Server actions** -- progressive enhancement with `ActionForm` and `createFormAction`
- **Accessibility** -- focus management, ARIA live announcements, error focus

## Exports

### Hooks

| Export | Description |
|--------|-------------|
| [`useForm`](/api/forms/use-form) | Create a form instance with default values, validators, and submit handler |
| [`useField`](/api/forms/use-field) | Bind a single field -- returns value, errors, touched, and `inputProps` |
| [`useFieldArray`](/api/forms/use-field-array) | Manage dynamic arrays (append, remove, swap, move, insert) |
| [`useWatch`](/api/forms/use-watch) | Observe field values reactively without registering the field |
| [`useFormStatus`](/api/forms/use-form-status) | Subscribe to form-level status (submitting, dirty, valid) |

### Core

| Export | Description |
|--------|-------------|
| [`FormStore`](/api/forms/form-store) | The underlying store class holding per-field signals |
| [`createFormStore`](/api/forms/form-store) | Factory function to create a `FormStore` outside React |
| [`createValuesProxy`](/api/forms/form-store) | ES Proxy for natural property access (`form.values.user.email`) |

### Context

| Export | Description |
|--------|-------------|
| [`FormProvider`](/api/forms/context) | React context provider for a form instance |
| [`useFormContext`](/api/forms/context) | Consume the nearest `FormProvider` |

### Components

| Export | Description |
|--------|-------------|
| [`Field`](/api/forms/components) | Declarative field component with render prop |
| [`TextareaField`](/api/forms/components) | Pre-built textarea field |
| [`SelectField`](/api/forms/components) | Pre-built select field |
| [`FieldArray`](/api/forms/components) | Declarative field array component |

### Validation

| Export | Description |
|--------|-------------|
| [`required`](/api/forms/validation) | Required field validator |
| [`email`](/api/forms/validation) | Email format validator |
| [`url`](/api/forms/validation) | URL format validator |
| [`date`](/api/forms/validation) | Date format validator |
| [`phone`](/api/forms/validation) | Phone number validator |
| [`minLength` / `maxLength`](/api/forms/validation) | String length validators |
| [`min` / `max`](/api/forms/validation) | Numeric range validators |
| [`pattern`](/api/forms/validation) | RegExp pattern validator |
| [`number` / `integer` / `positive`](/api/forms/validation) | Numeric type validators |
| [`custom`](/api/forms/validation) | Custom sync validator |
| [`async`](/api/forms/validation) | Custom async validator (auto-validates on change with debounce) |
| [`matches`](/api/forms/validation) | Cross-field equality check |
| [`oneOf` / `notOneOf`](/api/forms/validation) | Inclusion / exclusion validators |
| [`fileSize` / `fileType`](/api/forms/validation) | File input validators |
| [`compose`](/api/forms/validation) | Compose multiple validators into one |
| [`when`](/api/forms/validation) | Conditional validator |
| [`v`](/api/forms/validation) | Shorthand namespace re-exporting all validators (e.g. `v.required()`, `v.email()`) |

### Schema Adapters

| Export | Description |
|--------|-------------|
| [`zodAdapter`](/api/forms/schema-adapters) | Adapt a Zod schema for form-level validation |
| [`valibotAdapter`](/api/forms/schema-adapters) | Adapt a Valibot schema for form-level validation |
| [`isStandardSchema`](/api/forms/schema-adapters) | Type guard for Standard Schema V1 (`~standard` property) |
| [`standardSchemaAdapter`](/api/forms/schema-adapters) | Explicit adapter for Standard Schema V1-compliant validators |
| [`createSchemaValidator`](/api/forms/schema-adapters) | Generic schema adapter factory |
| [`ereoSchema`](/api/forms/schema-adapters) | Native schema DSL (sync `safeParse`) |
| [`isEreoSchema`](/api/forms/schema-adapters) | Type guard for `ereoSchema` instances |
| [`formDataToObject`](/api/forms/schema-adapters) | Convert FormData to a typed object |

### Wizard

| Export | Description |
|--------|-------------|
| [`createWizard`](/api/forms/wizard) | Create a multi-step wizard instance |
| [`useWizard`](/api/forms/wizard) | Hook for wizard step navigation and state |
| [`WizardProvider`](/api/forms/wizard) | React context provider for a wizard |
| [`useWizardContext`](/api/forms/wizard) | Consume the nearest `WizardProvider` |
| [`WizardStep`](/api/forms/wizard) | Render the current step's content |
| [`WizardProgress`](/api/forms/wizard) | Step progress indicator component |
| [`WizardNavigation`](/api/forms/wizard) | Next / back / submit navigation buttons |

### Server Actions

| Export | Description |
|--------|-------------|
| [`createFormAction`](/api/forms/server-actions) | Create a server action handler with validation |
| [`ActionForm`](/api/forms/server-actions) | `<form>` wrapper for progressive enhancement |
| [`useFormAction`](/api/forms/server-actions) | Hook to consume server action results |
| [`parseActionResult`](/api/forms/server-actions) | Parse an `ActionResult` from a server response |

### Composition

| Export | Description |
|--------|-------------|
| [`mergeFormConfigs`](/api/forms/composition) | Deep-merge multiple form configurations |
| [`composeSchemas`](/api/forms/composition) | Combine schemas for multi-section forms |

### Accessibility

| Export | Description |
|--------|-------------|
| [`focusFirstError`](/api/forms/accessibility) | Focus the first field with a validation error |
| [`focusField`](/api/forms/accessibility) | Programmatically focus a field by path |
| [`announce`](/api/forms/accessibility) | Push a message to an ARIA live region |
| [`announceErrors`](/api/forms/accessibility) | Announce validation errors to screen readers |
| [`announceSubmitStatus`](/api/forms/accessibility) | Announce form submission outcome |

### Utilities

| Export | Description |
|--------|-------------|
| [`getPath`](/api/forms/utilities) | Read a nested value by dot-path |
| [`setPath`](/api/forms/utilities) | Immutably set a nested value by dot-path |
| [`deepClone`](/api/forms/utilities) | Structured clone with fallback |
| [`deepEqual`](/api/forms/utilities) | Deep equality check |
| [`parsePath`](/api/forms/utilities) | Parse `"a.b[0].c"` into path segments |
| [`flattenToPaths`](/api/forms/utilities) | Flatten a nested object to dot-path entries |

## Related

- [@ereo/state -- Signals](/api/state/signals)
- [@ereo/client -- Form (simple)](/api/client/form)
- [Forms Guide](/guides/forms-basic)
- [TypeScript Types](/api/forms/types)
