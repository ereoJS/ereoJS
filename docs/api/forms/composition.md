# Composition

Utilities for merging form configurations and composing validation schemas from multiple sources.

## Import

```ts
import { mergeFormConfigs, composeSchemas } from '@ereo/forms'
```

## mergeFormConfigs

Deep-merges two `FormConfig` objects into one. Useful for building forms from reusable config fragments.

### Signature

```ts
function mergeFormConfigs<
  A extends Record<string, any>,
  B extends Record<string, any>,
>(configA: FormConfig<A>, configB: FormConfig<B>): FormConfig<A & B>
```

### Merge Rules

| Property | Strategy |
|----------|----------|
| `defaultValues` | Deep-merged (B overrides A for conflicting keys) |
| `validators` | Concatenated -- same-path validators from both configs are combined into arrays |
| `onSubmit` | B wins (B ?? A) |
| `schema` | B wins (B ?? A) |
| `validateOn` | B wins (B ?? A) |
| `validateOnMount` | B wins (B ?? A) |
| `resetOnSubmit` | B wins (B ?? A) |

### Example

```ts
import { mergeFormConfigs, useForm, required, email, minLength } from '@ereo/forms'

const accountConfig = {
  defaultValues: { email: '', password: '' },
  validators: {
    email: [required(), email()],
    password: [required(), minLength(8)],
  },
}

const profileConfig = {
  defaultValues: { name: '', bio: '' },
  validators: {
    name: required(),
  },
}

// Combine into one form
const merged = mergeFormConfigs(accountConfig, profileConfig)
const form = useForm(merged)
// form.values has { email, password, name, bio }
```

### Validator Concatenation

If both configs have validators for the same path, they are combined:

```ts
const a = {
  defaultValues: { email: '' },
  validators: { email: required() },
}
const b = {
  defaultValues: { email: '' },
  validators: { email: email() },
}

const merged = mergeFormConfigs(a, b)
// merged.validators.email === [required(), email()]
```

## composeSchemas

Combines two validation schemas under different prefixes into one schema.

### Signature

```ts
function composeSchemas<A, B>(
  prefix1: string,
  schema1: ValidationSchema<unknown, A>,
  prefix2: string,
  schema2: ValidationSchema<unknown, B>
): ValidationSchema<unknown, Record<string, unknown>>
```

### Parameters

| Name | Type | Description |
|------|------|-------------|
| `prefix1` | `string` | Key for the first schema's data (e.g. `'account'`) |
| `schema1` | `ValidationSchema` | First schema |
| `prefix2` | `string` | Key for the second schema's data (e.g. `'profile'`) |
| `schema2` | `ValidationSchema` | Second schema |

### Example

```ts
import { composeSchemas, zodAdapter } from '@ereo/forms'
import { z } from 'zod'

const addressSchema = zodAdapter(z.object({
  street: z.string().min(1),
  city: z.string().min(1),
}))

const paymentSchema = zodAdapter(z.object({
  cardNumber: z.string().min(16),
  expiry: z.string(),
}))

const combinedSchema = composeSchemas(
  'shipping', addressSchema,
  'payment', paymentSchema
)

// Validates: { shipping: { street, city }, payment: { cardNumber, expiry } }
// Errors are prefixed: 'shipping.street', 'payment.cardNumber', etc.
```

### How It Works

- `parse()` calls `schema1.parse(data[prefix1])` and `schema2.parse(data[prefix2])`
- `safeParse()` collects all issues from both schemas, prefixing paths with the respective prefix
- If both schemas pass, returns the combined result
- If either fails, returns all issues from both

## Related

- [useForm](/api/forms/use-form) -- accepts the merged config
- [Schema Adapters](/api/forms/schema-adapters) -- schemas to compose
- [Validation](/api/forms/validation) -- validators that get merged
