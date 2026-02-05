# useFieldArray

Manages a dynamic array of fields within a form, providing helpers for append, remove, reorder, and other array mutations while maintaining stable React keys.

## Import

```ts
import { useFieldArray } from '@ereo/forms'
```

## Signature

```ts
function useFieldArray<T extends Record<string, any>, Item = unknown>(
  form: FormStoreInterface<T>,
  name: string
): ArrayFieldHelpers<Item>
```

## Parameters

| Name | Type | Description |
|------|------|-------------|
| `form` | `FormStoreInterface<T>` | The form store (from `useForm` or `createFormStore`) |
| `name` | `string` | Dot-path to the array field (e.g. `'items'` or `'order.lineItems'`) |

## Returns

### ArrayFieldHelpers

| Name | Type | Description |
|------|------|-------------|
| `fields` | `ArrayFieldItem<Item>[]` | Current array items with stable IDs and indices |
| `append` | `(value: Item) => void` | Add an item to the end |
| `prepend` | `(value: Item) => void` | Add an item to the beginning |
| `insert` | `(index: number, value: Item) => void` | Insert an item at a specific index |
| `remove` | `(index: number) => void` | Remove an item by index |
| `swap` | `(indexA: number, indexB: number) => void` | Swap two items by index |
| `move` | `(from: number, to: number) => void` | Move an item from one index to another |
| `replace` | `(index: number, value: Item) => void` | Replace an item at a specific index (keeps same ID) |
| `replaceAll` | `(values: Item[]) => void` | Replace the entire array (generates new IDs) |
| `clone` | `(index: number) => void` | Deep-clone an item and insert the copy after it |

### ArrayFieldItem

```ts
interface ArrayFieldItem<T> {
  id: string;    // Stable unique ID -- use as React key
  value: T;      // Current value of the item
  index: number; // Current index in the array
}
```

## Examples

### Basic String List

```tsx
import { useForm, useField, useFieldArray } from '@ereo/forms'

function TagsForm() {
  const form = useForm({
    defaultValues: { tags: [''] },
    onSubmit: async (values) => console.log(values.tags),
  })

  const { fields, append, remove } = useFieldArray(form, 'tags')

  return (
    <form onSubmit={(e) => { e.preventDefault(); form.handleSubmit() }}>
      {fields.map((item) => (
        <div key={item.id}>
          <input
            value={item.value}
            onChange={(e) => form.setValue(`tags.${item.index}`, e.target.value)}
          />
          <button type="button" onClick={() => remove(item.index)}>
            Remove
          </button>
        </div>
      ))}
      <button type="button" onClick={() => append('')}>
        Add Tag
      </button>
      <button type="submit">Save</button>
    </form>
  )
}
```

### Object Array

```tsx
interface LineItem {
  product: string
  quantity: number
  price: number
}

function OrderForm() {
  const form = useForm({
    defaultValues: {
      items: [{ product: '', quantity: 1, price: 0 }] as LineItem[],
    },
    onSubmit: async (values) => {
      await submitOrder(values)
    },
  })

  const { fields, append, remove } = useFieldArray(form, 'items')

  return (
    <form onSubmit={(e) => { e.preventDefault(); form.handleSubmit() }}>
      {fields.map((item) => (
        <div key={item.id}>
          <input
            value={item.value.product}
            onChange={(e) =>
              form.setValue(`items.${item.index}.product`, e.target.value)
            }
            placeholder="Product"
          />
          <input
            type="number"
            value={item.value.quantity}
            onChange={(e) =>
              form.setValue(`items.${item.index}.quantity`, Number(e.target.value))
            }
          />
          <button type="button" onClick={() => remove(item.index)}>
            Remove
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() => append({ product: '', quantity: 1, price: 0 })}
      >
        Add Line Item
      </button>
    </form>
  )
}
```

### All Operations

```tsx
const { fields, append, prepend, insert, remove, swap, move, replace, replaceAll, clone } = useFieldArray(form, 'items')

// Add items
append({ name: 'New item' })
prepend({ name: 'First item' })
insert(2, { name: 'Third item' })

// Remove and reorder
remove(0)
swap(0, 1)
move(2, 0) // move index 2 to index 0

// Update
replace(0, { name: 'Updated' }) // keeps same stable ID
replaceAll([{ name: 'A' }, { name: 'B' }]) // generates new IDs

// Duplicate
clone(0) // deep-clones item at index 0, inserts after it
```

## Stable Keys

Each array item gets a stable `id` generated as `{name}-{counter}`. The ID array is maintained in a parallel `useRef` and kept in sync with the form value:

- `append` / `prepend` / `insert` / `clone` generate new IDs
- `remove` / `swap` / `move` rearrange existing IDs
- `replace` keeps the same ID (same position, new value)
- `replaceAll` generates all new IDs

Always use `item.id` as the React `key`, never the index:

```tsx
// Correct
fields.map((item) => <div key={item.id}>...</div>)

// Incorrect -- causes bugs on reorder
fields.map((item, i) => <div key={i}>...</div>)
```

## Related

- [useField](/api/forms/use-field) -- bind fields inside each array item
- [Components -- FieldArray](/api/forms/components) -- declarative component
- [FormStore](/api/forms/form-store) -- underlying value storage
