# Components

Pre-built React components for common form fields. Each component handles labels, error display, ARIA attributes, and type inference automatically.

## Import

```ts
import { Field, TextareaField, SelectField, FieldArray } from '@ereo/forms'
```

All components accept either a `form` prop or use `useFormContext()` to find the nearest `FormProvider`.

## Field

Renders a labeled `<input>` with automatic type inference and error display.

### Signature

```ts
function Field<T extends Record<string, any>, K extends string>(
  props: FieldComponentProps<T, K>
): ReactElement | null
```

### Props

| Name | Type | Description |
|------|------|-------------|
| `form` | `FormStoreInterface<T>` | Form store (optional if inside `FormProvider`) |
| `name` | `string` | Field path (required) |
| `type` | `string` | HTML input type (auto-inferred from name if omitted) |
| `label` | `string` | Label text |
| `placeholder` | `string` | Input placeholder |
| `required` | `boolean` | Override required detection (auto-detected from validators) |
| `disabled` | `boolean` | Disable the input |
| `className` | `string` | CSS class for the input |
| `children` | `(field: FieldHandle) => ReactNode` | Render prop for custom rendering |

### Type Inference

When `type` is not provided, the component infers it from the last segment of `name`:

| Name contains | Inferred type |
|---------------|--------------|
| `email` | `email` |
| `password` | `password` |
| `phone`, `tel` | `tel` |
| `url`, `website` | `url` |
| `date` | `date` |
| `time` | `time` |
| `number`, `age`, `quantity` | `number` |
| `search` | `search` |
| _(default)_ | `text` |

### Basic Usage

```tsx
<Field form={form} name="email" label="Email" />
<Field form={form} name="password" label="Password" />
<Field form={form} name="age" label="Age" />
```

### Render Prop

Use the `children` render prop for full control over rendering:

```tsx
<Field form={form} name="email">
  {(field) => (
    <div className="custom-field">
      <label>{field.value ? 'Email' : 'Enter email'}</label>
      <input {...field.inputProps} className="custom-input" />
      {field.errors.length > 0 && (
        <ul>
          {field.errors.map((err, i) => <li key={i}>{err}</li>)}
        </ul>
      )}
    </div>
  )}
</Field>
```

### Default HTML Output

Without a render prop, `Field` renders:

```html
<div data-field="email">
  <label for="email" id="email-label">Email <span aria-hidden="true"> *</span></label>
  <input name="email" id="email" type="email" required aria-required />
  <div id="email-error" role="alert" aria-live="polite">Invalid email address</div>
</div>
```

Error messages only appear when the field is `touched`.

## TextareaField

Like `Field` but renders a `<textarea>`.

### Signature

```ts
function TextareaField<T extends Record<string, any>, K extends string>(
  props: TextareaFieldProps<T, K>
): ReactElement | null
```

### Props

Extends `FieldComponentProps` with:

| Name | Type | Description |
|------|------|-------------|
| `rows` | `number` | Textarea rows |
| `cols` | `number` | Textarea cols |
| `maxLength` | `number` | Max character count |

### Example

```tsx
<TextareaField
  form={form}
  name="bio"
  label="Bio"
  rows={4}
  maxLength={500}
  placeholder="Tell us about yourself..."
/>
```

## SelectField

Renders a `<select>` with options.

### Signature

```ts
function SelectField<T extends Record<string, any>, K extends string>(
  props: SelectFieldProps<T, K>
): ReactElement | null
```

### Props

Extends `FieldComponentProps` with:

| Name | Type | Description |
|------|------|-------------|
| `options` | `Array<{ value: string; label: string; disabled?: boolean }>` | Select options (required) |
| `multiple` | `boolean` | Allow multiple selection |

### Example

```tsx
<SelectField
  form={form}
  name="role"
  label="Role"
  options={[
    { value: '', label: 'Select a role' },
    { value: 'admin', label: 'Admin' },
    { value: 'user', label: 'User' },
    { value: 'guest', label: 'Guest', disabled: true },
  ]}
/>
```

## FieldArray

Render prop component for dynamic arrays. Wraps `useFieldArray`.

### Signature

```ts
function FieldArray<T extends Record<string, any>, K extends string>(
  props: FieldArrayComponentProps<T, K>
): ReactElement | null
```

### Props

| Name | Type | Description |
|------|------|-------------|
| `form` | `FormStoreInterface<T>` | Form store (optional if inside `FormProvider`) |
| `name` | `string` | Array field path (required) |
| `children` | `(helpers: ArrayFieldHelpers) => ReactNode` | Render function receiving array helpers (required) |

### Example

```tsx
<FieldArray form={form} name="tags">
  {({ fields, append, remove }) => (
    <div>
      {fields.map((item) => (
        <div key={item.id}>
          <Field form={form} name={`tags.${item.index}`} />
          <button type="button" onClick={() => remove(item.index)}>
            Remove
          </button>
        </div>
      ))}
      <button type="button" onClick={() => append('')}>
        Add Tag
      </button>
    </div>
  )}
</FieldArray>
```

## Using with FormProvider

When wrapped in a `FormProvider`, all components find the form automatically:

```tsx
import { FormProvider, Field, SelectField } from '@ereo/forms'

function MyForm() {
  const form = useForm({ defaultValues: { name: '', role: 'user' } })

  return (
    <FormProvider form={form}>
      <Field name="name" label="Name" />
      <SelectField
        name="role"
        label="Role"
        options={[
          { value: 'admin', label: 'Admin' },
          { value: 'user', label: 'User' },
        ]}
      />
    </FormProvider>
  )
}
```

## Related

- [useField](/api/forms/use-field) -- lower-level hook
- [useFieldArray](/api/forms/use-field-array) -- lower-level hook
- [Context](/api/forms/context) -- FormProvider details
- [Accessibility](/api/forms/accessibility) -- ARIA helpers used by components
