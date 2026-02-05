# Context

React context for providing a form store to nested components without prop drilling.

## Import

```ts
import { FormProvider, useFormContext } from '@ereo/forms'
```

## FormProvider

```ts
function FormProvider<T extends Record<string, any>>(props: {
  form: FormStoreInterface<T>;
  children: ReactNode;
}): ReactElement
```

Provides a form store to all descendant components via React context.

### Props

| Name | Type | Description |
|------|------|-------------|
| `form` | `FormStoreInterface<T>` | The form store to provide |
| `children` | `ReactNode` | Child components |

### Example

```tsx
import { useForm, FormProvider, Field } from '@ereo/forms'

function ProfileForm() {
  const form = useForm({
    defaultValues: { name: '', email: '', bio: '' },
  })

  return (
    <FormProvider form={form}>
      <form onSubmit={(e) => { e.preventDefault(); form.handleSubmit() }}>
        <NameSection />
        <ContactSection />
        <button type="submit">Save</button>
      </form>
    </FormProvider>
  )
}

function NameSection() {
  return <Field name="name" label="Name" />
}

function ContactSection() {
  return <Field name="email" label="Email" />
}
```

## useFormContext

```ts
function useFormContext<
  T extends Record<string, any> = Record<string, any>
>(): FormStoreInterface<T> | null
```

Retrieves the nearest form store from context. Returns `null` if no `FormProvider` is present above in the tree.

### Example

```tsx
import { useFormContext, useField } from '@ereo/forms'

function CustomField({ name }: { name: string }) {
  const form = useFormContext()
  if (!form) throw new Error('CustomField must be inside a FormProvider')

  const field = useField(form, name)

  return (
    <div>
      <input {...field.inputProps} />
      {field.errors[0] && <span>{field.errors[0]}</span>}
    </div>
  )
}
```

## How Components Use Context

The built-in `Field`, `TextareaField`, `SelectField`, and `FieldArray` components all check for context automatically:

```ts
const contextForm = useFormContext()
const form = props.form ?? contextForm
if (!form) throw new Error('Field requires a form prop or FormProvider')
```

This means you can either pass `form` explicitly or wrap in a `FormProvider` -- both work.

## Related

- [Components](/api/forms/components) -- components that use context
- [useForm](/api/forms/use-form) -- create the form store to provide
- [Wizard -- WizardProvider](/api/forms/wizard) -- similar pattern for wizards
