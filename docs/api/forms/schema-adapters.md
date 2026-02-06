# Schema Adapters

Integrate external validation libraries (Zod, Valibot) or use the native `ereoSchema` DSL for full-form validation.

## Import

```ts
import {
  zodAdapter,
  valibotAdapter,
  ereoSchema,
  createSchemaValidator,
  formDataToObject,
  isStandardSchema,
  standardSchemaAdapter,
} from '@ereo/forms'
```

## Standard Schema V1 (Recommended)

Any schema library that implements [Standard Schema V1](https://standardschema.dev) is auto-detected and used directly -- no adapter needed. This includes Zod v4+, Valibot v1+, ArkType, and others.

The form checks for a `~standard` property on the schema object. If present, it's automatically wrapped using `standardSchemaAdapter()`.

```tsx
import { useForm } from '@ereo/forms'
import { z } from 'zod'  // Zod v4+ supports Standard Schema

const form = useForm({
  defaultValues: { name: '', email: '' },
  schema: z.object({
    name: z.string().min(1),
    email: z.string().email(),
  }),
  // No adapter needed — auto-detected via ~standard property
})
```

### isStandardSchema

```ts
function isStandardSchema(value: unknown): value is StandardSchemaV1
```

Type guard that checks if a value has a `~standard` property, indicating Standard Schema V1 compliance.

### standardSchemaAdapter

```ts
function standardSchemaAdapter<T>(
  schema: StandardSchemaV1<unknown, T>
): ValidationSchema<unknown, T>
```

Explicitly wraps a Standard Schema V1-compliant validator into the `ValidationSchema` interface. You typically don't need to call this directly -- the form auto-detects Standard Schema objects and calls it internally.

## zodAdapter

Wraps a Zod schema into the `ValidationSchema` interface. Use this for Zod v3 or earlier versions that don't support Standard Schema V1. For Zod v4+, you can pass the schema directly (auto-detected).

### Signature

```ts
function zodAdapter<T>(zodSchema: {
  parse: (data: unknown) => T;
  safeParse: (data: unknown) => any;
}): ValidationSchema<unknown, T>
```

### Example

```tsx
import { useForm, zodAdapter } from '@ereo/forms'
import { z } from 'zod'

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
})

const form = useForm({
  defaultValues: { email: '', password: '' },
  schema: zodAdapter(schema),
  onSubmit: async (values) => {
    // values is typed as { email: string; password: string }
  },
})
```

Zod issues are automatically mapped to field paths (e.g. `user.email`) with their messages.

## valibotAdapter

Wraps a Valibot schema. Requires passing the `parse` and `safeParse` functions from Valibot since it uses a functional API.

### Signature

```ts
function valibotAdapter<T>(
  schema: unknown,
  parse: (schema: unknown, data: unknown) => T,
  safeParse: (schema: unknown, data: unknown) => any
): ValidationSchema<unknown, T>
```

### Example

```tsx
import { useForm, valibotAdapter } from '@ereo/forms'
import * as v from 'valibot'

const schema = v.object({
  name: v.pipe(v.string(), v.minLength(1)),
  age: v.pipe(v.number(), v.minValue(18)),
})

const form = useForm({
  defaultValues: { name: '', age: 0 },
  schema: valibotAdapter(schema, v.parse, v.safeParse),
  onSubmit: async (values) => { /* ... */ },
})
```

## ereoSchema

Native validation DSL that maps paths to validators. Uses the same validators from `@ereo/forms`.

### Signature

```ts
function ereoSchema<T>(
  definition: EreoSchemaDefinition
): ValidationSchema<unknown, T>
```

Where `EreoSchemaDefinition` is:

```ts
interface EreoSchemaDefinition {
  [key: string]: ValidatorFunction | ValidatorFunction[] | EreoSchemaDefinition
}
```

### Example

```tsx
import { useForm, ereoSchema, required, email, minLength } from '@ereo/forms'

const schema = ereoSchema({
  email: [required(), email()],
  password: [required(), minLength(8)],
  profile: {
    name: required(),
    bio: minLength(10),
  },
})

const form = useForm({
  defaultValues: { email: '', password: '', profile: { name: '', bio: '' } },
  schema,
  onSubmit: async (values) => { /* ... */ },
})
```

`ereoSchema` runs synchronously via `safeParse`. Async validators are skipped at the schema level -- they run at the field level via the `ValidationEngine`.

### isEreoSchema

```ts
function isEreoSchema(value: unknown): value is EreoSchema<unknown>
```

Type guard to check if a value is an `ereoSchema` instance.

## createSchemaValidator

Wrap any custom validation function into the `ValidationSchema` interface.

### Signature

```ts
function createSchemaValidator<T>(opts: {
  validate: (data: unknown) =>
    | { success: true; data: T }
    | { success: false; errors: Record<string, string[]> }
}): ValidationSchema<unknown, T>
```

### Example

```ts
const schema = createSchemaValidator({
  validate: (data) => {
    const obj = data as { email: string; age: number }
    const errors: Record<string, string[]> = {}

    if (!obj.email) errors.email = ['Required']
    if (obj.age < 18) errors.age = ['Must be 18+']

    return Object.keys(errors).length > 0
      ? { success: false, errors }
      : { success: true, data: obj }
  },
})
```

## formDataToObject

Converts a `FormData` instance into a plain object with optional coercion.

### Signature

```ts
function formDataToObject<T extends Record<string, any>>(
  formData: FormData,
  opts?: FormDataToObjectOptions
): T
```

### Options

| Name | Type | Default | Description |
|------|------|---------|-------------|
| `coerce` | `boolean` | `true` | Auto-coerce `'true'`/`'false'` to booleans, numeric strings to numbers, ISO dates |
| `arrays` | `string[]` | `[]` | Field names that should always be treated as arrays |

### Coercion Rules

- `'true'` / `'false'` to booleans
- `'null'` to `null`
- Numeric strings to numbers (preserves leading zeros like zip codes)
- ISO date strings to `toISOString()` strings
- `File` instances are kept as-is
- Nested paths (`user.name` or `user[0].name`) are expanded into nested objects
- Fields ending with `[]` are automatically treated as arrays

### Example

```ts
const fd = new FormData()
fd.append('name', 'Alice')
fd.append('age', '25')
fd.append('tags[]', 'admin')
fd.append('tags[]', 'user')

const obj = formDataToObject(fd)
// { name: 'Alice', age: 25, tags: ['admin', 'user'] }
```

## ValidationSchema Interface

```ts
interface ValidationSchema<TInput = unknown, TOutput = unknown> {
  parse(data: TInput): TOutput;
  safeParse?(data: TInput):
    | { success: true; data: TOutput }
    | { success: false; error: { issues: Array<{ path: (string | number)[]; message: string }> } };
}
```

All adapters produce an object conforming to this interface. The `safeParse` method is preferred when available; `parse` is used as a fallback (errors are caught and mapped from thrown exceptions).

## Related

- [Validation](/api/forms/validation) -- per-field validators
- [Server Actions](/api/forms/server-actions) -- uses schemas server-side
- [Types -- ValidationSchema](/api/forms/types)
