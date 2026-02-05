# Wizard

Multi-step forms with per-step validation, navigation, and optional persistence.

## Import

```ts
import {
  createWizard,
  useWizard,
  WizardProvider,
  useWizardContext,
  WizardStep,
  WizardProgress,
  WizardNavigation,
} from '@ereo/forms'
```

## createWizard

Creates a wizard instance outside of React. Useful for programmatic control or non-React usage.

### Signature

```ts
function createWizard<T extends Record<string, any>>(
  config: WizardConfig<T>
): WizardHelpers<T>
```

### WizardConfig

| Name | Type | Description |
|------|------|-------------|
| `steps` | `WizardStepConfig[]` | Array of step definitions |
| `form` | `FormConfig<T>` | Form configuration (passed to `FormStore`) |
| `persist` | `'localStorage' \| 'sessionStorage' \| false` | Persist wizard state across page reloads |
| `persistKey` | `string` | Storage key (default `'ereo-wizard'`) |
| `onComplete` | `SubmitHandler<T>` | Called on final submit |

### WizardStepConfig

| Name | Type | Description |
|------|------|-------------|
| `id` | `string` | Unique step identifier |
| `fields` | `string[]` | Field paths that belong to this step (validated on `next()`) |
| `validate` | `() => Promise<boolean> \| boolean` | Custom step-level validation |

### WizardHelpers

| Name | Type | Description |
|------|------|-------------|
| `form` | `FormStore<T>` | The form store instance |
| `currentStep` | `Signal<number>` | Current step index signal |
| `completedSteps` | `Signal<Set<string>>` | Set of completed step IDs |
| `state` | `WizardState` | Current state snapshot (getter) |
| `next` | `() => Promise<boolean>` | Validate current step and advance; returns `false` if validation fails |
| `prev` | `() => void` | Go to previous step |
| `goTo` | `(stepIdOrIndex: string \| number) => void` | Jump to a step by ID or index |
| `submit` | `() => Promise<void>` | Validate current step and submit the form |
| `reset` | `() => void` | Reset form, step, and completed state |
| `dispose` | `() => void` | Clean up subscriptions and timers |
| `getStepConfig` | `(index: number) => WizardStepConfig \| undefined` | Get config for a step |
| `canGoNext` | `() => boolean` | Whether there is a next step |
| `canGoPrev` | `() => boolean` | Whether there is a previous step |

### WizardState

| Name | Type | Description |
|------|------|-------------|
| `currentStep` | `number` | Zero-based step index |
| `currentStepId` | `string` | ID of the current step |
| `completedSteps` | `Set<string>` | Completed step IDs |
| `totalSteps` | `number` | Total number of steps |
| `isFirst` | `boolean` | Whether on the first step |
| `isLast` | `boolean` | Whether on the last step |
| `progress` | `number` | 0–1 progress ratio |

## useWizard

React hook that creates and manages a wizard. Same as `createWizard` but with React lifecycle management.

### Signature

```ts
function useWizard<T extends Record<string, any>>(
  config: WizardConfig<T>
): WizardHelpers<T> & { currentStepState: WizardState }
```

Returns the same `WizardHelpers` plus a reactive `currentStepState` that triggers re-renders when the step or completed steps change.

## Components

### WizardProvider

Provides wizard context to child components.

```tsx
<WizardProvider wizard={wizard}>
  {children}
</WizardProvider>
```

### useWizardContext

```ts
function useWizardContext<T>(): WizardHelpers<T> | null
```

Retrieves the wizard from context.

### WizardStep

Renders its children only when the step is active.

| Prop | Type | Description |
|------|------|-------------|
| `id` | `string` | Step ID (must match a `WizardStepConfig.id`) |
| `wizard` | `WizardHelpers` | Wizard instance (optional if inside `WizardProvider`) |
| `keepMounted` | `boolean` | Keep in DOM when inactive (hidden with `display: none`) |

### WizardProgress

Renders a step indicator.

| Prop | Type | Description |
|------|------|-------------|
| `wizard` | `WizardHelpers` | Wizard instance (optional if inside `WizardProvider`) |
| `renderStep` | `(step, index, { isActive, isCompleted }) => ReactNode` | Custom step renderer |

Default rendering produces a `div[role="tablist"]` with `div[role="tab"]` children.

### WizardNavigation

Renders Back / Next / Submit buttons.

| Prop | Type | Description |
|------|------|-------------|
| `wizard` | `WizardHelpers` | Wizard instance (optional if inside `WizardProvider`) |
| `backLabel` | `string` | Back button text (default `'Back'`) |
| `nextLabel` | `string` | Next button text (default `'Next'`) |
| `submitLabel` | `string` | Submit button text (default `'Submit'`) |

## Example: 3-Step Registration

```tsx
import {
  useWizard,
  useField,
  WizardProvider,
  WizardStep,
  WizardProgress,
  WizardNavigation,
  required,
  email,
  minLength,
} from '@ereo/forms'

function RegistrationWizard() {
  const wizard = useWizard({
    steps: [
      { id: 'account', fields: ['email', 'password'] },
      { id: 'profile', fields: ['name', 'bio'] },
      { id: 'confirm' },
    ],
    form: {
      defaultValues: { email: '', password: '', name: '', bio: '' },
      validators: {
        email: [required(), email()],
        password: [required(), minLength(8)],
        name: [required()],
      },
    },
    persist: 'localStorage',
    onComplete: async (values) => {
      await fetch('/api/register', {
        method: 'POST',
        body: JSON.stringify(values),
      })
    },
  })

  return (
    <WizardProvider wizard={wizard}>
      <WizardProgress />

      <WizardStep id="account">
        <AccountStep form={wizard.form} />
      </WizardStep>

      <WizardStep id="profile">
        <ProfileStep form={wizard.form} />
      </WizardStep>

      <WizardStep id="confirm">
        <ConfirmStep form={wizard.form} />
      </WizardStep>

      <WizardNavigation />
    </WizardProvider>
  )
}

function AccountStep({ form }) {
  const emailField = useField(form, 'email')
  const passwordField = useField(form, 'password')

  return (
    <div>
      <input {...emailField.inputProps} placeholder="Email" />
      <input {...passwordField.inputProps} type="password" placeholder="Password" />
    </div>
  )
}

function ProfileStep({ form }) {
  const name = useField(form, 'name')
  const bio = useField(form, 'bio')

  return (
    <div>
      <input {...name.inputProps} placeholder="Name" />
      <textarea {...bio.inputProps} placeholder="Bio" />
    </div>
  )
}

function ConfirmStep({ form }) {
  return (
    <div>
      <p>Email: {form.values.email}</p>
      <p>Name: {form.values.name}</p>
    </div>
  )
}
```

## Persistence

When `persist` is set, the wizard auto-saves to `localStorage` or `sessionStorage`:

- Saves after any form value change (debounced 300ms)
- Saves on step changes
- Restores values, step, and completed steps on mount
- Clears storage after successful submit or reset

## Related

- [useForm](/api/forms/use-form) — single-step form
- [FormStore](/api/forms/form-store) — underlying form instance
- [Validation](/api/forms/validation) — per-step field validation
