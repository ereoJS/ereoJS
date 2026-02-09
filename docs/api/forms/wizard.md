# Wizard

Multi-step forms with per-step validation, navigation, progress tracking, and optional persistence.

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
| `steps` | `WizardStepConfig<T>[]` | Array of step definitions (required) |
| `form` | `FormConfig<T>` | Form configuration (passed to `FormStore`) (required) |
| `persist` | `'localStorage' \| 'sessionStorage' \| false` | Persist wizard state across page reloads |
| `persistKey` | `string` | Storage key (default `'ereo-wizard'`) |
| `onComplete` | `SubmitHandler<T>` | Called on final submit |

### WizardStepConfig

| Name | Type | Description |
|------|------|-------------|
| `id` | `string` | Unique step identifier (required) |
| `fields` | `FormPath<T>[]` | Type-safe field paths that belong to this step (validated on `next()`) |
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
| `reset` | `() => void` | Reset form, step, and completed state. Clears persisted data. |
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
| `progress` | `number` | 0-1 progress ratio |

## useWizard

React hook that creates and manages a wizard. Same as `createWizard` but with React lifecycle management.

### Signature

```ts
function useWizard<T extends Record<string, any>>(
  config: WizardConfig<T>
): WizardHelpers<T> & { currentStepState: WizardState }
```

Returns the same `WizardHelpers` plus a reactive `currentStepState` that triggers re-renders when the step or completed steps change. The wizard is created once via `useRef` and disposed on unmount.

## Components

### WizardProvider

Provides wizard context to child components.

```ts
function WizardProvider<T extends Record<string, any>>(props: {
  wizard: WizardHelpers<T>;
  children: ReactNode;
}): ReactElement
```

### useWizardContext

```ts
function useWizardContext<T>(): WizardHelpers<T> | null
```

Retrieves the wizard from context. Returns `null` if no `WizardProvider` is present.

### WizardStep

Renders its children only when the step is active.

| Prop | Type | Description |
|------|------|-------------|
| `id` | `string` | Step ID (must match a `WizardStepConfig.id`) |
| `wizard` | `WizardHelpers` | Wizard instance (optional if inside `WizardProvider`) |
| `keepMounted` | `boolean` | Keep in DOM when inactive (hidden with `display: none`). Default `false`. |
| `children` | `ReactNode` | Step content |

Renders a `<div>` with `role="tabpanel"` and `aria-hidden` for accessibility.

### WizardProgress

Renders a step indicator with active/completed states.

| Prop | Type | Description |
|------|------|-------------|
| `wizard` | `WizardHelpers` | Wizard instance (optional if inside `WizardProvider`) |
| `renderStep` | `(step, index, { isActive, isCompleted }) => ReactNode` | Custom step renderer |

Default rendering produces a `div[role="tablist"]` with `div[role="tab"]` children.

### WizardNavigation

Renders Back / Next / Submit buttons based on the current step.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `wizard` | `WizardHelpers` | context | Wizard instance (optional if inside `WizardProvider`) |
| `backLabel` | `string` | `'Back'` | Back button text |
| `nextLabel` | `string` | `'Next'` | Next button text |
| `submitLabel` | `string` | `'Submit'` | Submit button text (shown on last step) |

## Example: 3-Step Registration

```tsx
import {
  useWizard,
  useField,
  WizardProvider,
  WizardStep,
  WizardProgress,
  WizardNavigation,
  Field,
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
        <Field name="email" label="Email" />
        <Field name="password" label="Password" type="password" />
      </WizardStep>

      <WizardStep id="profile">
        <Field name="name" label="Full Name" />
        <Field name="bio" label="Bio" />
      </WizardStep>

      <WizardStep id="confirm">
        <p>Review your details and submit.</p>
      </WizardStep>

      <WizardNavigation />
    </WizardProvider>
  )
}
```

## Persistence

When `persist` is set, the wizard auto-saves to `localStorage` or `sessionStorage`:

- Saves after any form value change, step change, or completed steps change (debounced 300ms)
- Restores values, step, and completed steps on mount
- Clears storage after successful submit or `reset()`

## Related

- [useForm](/api/forms/use-form) -- single-step form
- [FormStore](/api/forms/form-store) -- underlying form instance
- [Context](/api/forms/context) -- `FormProvider` for the form, `WizardProvider` for the wizard
- [Validation](/api/forms/validation) -- per-step field validation
