# Validation

Built-in validators, composition utilities, and the `v` shorthand object. Includes 18 validator factories, two composition functions, and a derive-don't-configure validation strategy.

## Import

```ts
import {
  required, email, url, date, phone,
  minLength, maxLength, min, max,
  pattern, number, integer, positive,
  custom, async, matches,
  oneOf, notOneOf, fileSize, fileType,
  compose, when, v,
} from '@ereo/forms'
```

All validators are also available via the `v` shorthand:

```ts
import { v } from '@ereo/forms'

const validators = {
  email: [v.required(), v.email()],
  age: [v.required(), v.min(18)],
}
```

## Derive-Don't-Configure

The validation engine automatically derives **when** to validate based on validator types:

| Validator Type | Derived Timing | Rationale |
|---------------|----------------|-----------|
| `async()` validators | `change` with debounce | Provide feedback while typing |
| `required()` only | `blur` | Don't nag on empty fields while typing |
| All other validators | `blur` | Default -- validate after leaving the field |

You can override with `validateOn` per-field or per-form, but the defaults handle most cases.

## Core Validators

### required

```ts
function required(msg?: string): ValidatorFunction
```

Fails on `null`, `undefined`, `''`, and empty arrays. Marks the validator with `_isRequired = true` which drives blur-only timing.

```ts
required()                       // "This field is required"
required('Please enter a name')  // custom message
```

### email

```ts
function email(msg?: string): ValidatorFunction<string>
```

Validates email format (`/^[^\s@]+@[^\s@]+\.[^\s@]+$/`). Skips empty values.

```ts
email()                          // "Invalid email address"
```

### url

```ts
function url(msg?: string): ValidatorFunction<string>
```

Uses `new URL()` to validate. Skips empty values.

### date

```ts
function date(msg?: string): ValidatorFunction<string>
```

Validates that the value parses as a valid `Date`.

### phone

```ts
function phone(msg?: string): ValidatorFunction<string>
```

Requires at least 7 digits. Allows `+`, spaces, hyphens, and parentheses.

## Length / Range Validators

### minLength

```ts
function minLength(n: number, msg?: string): ValidatorFunction<string>
```

```ts
minLength(8)                     // "Must be at least 8 characters"
minLength(3, 'Too short')       // custom message
```

### maxLength

```ts
function maxLength(n: number, msg?: string): ValidatorFunction<string>
```

### min

```ts
function min(n: number, msg?: string): ValidatorFunction<number>
```

```ts
min(0)    // "Must be at least 0"
min(18)   // "Must be at least 18"
```

### max

```ts
function max(n: number, msg?: string): ValidatorFunction<number>
```

## Pattern / Type Validators

### pattern

```ts
function pattern(regex: RegExp, msg?: string): ValidatorFunction<string>
```

```ts
pattern(/^[A-Z]{2}\d{4}$/, 'Must be format: XX0000')
```

### number

```ts
function number(msg?: string): ValidatorFunction
```

Validates that the value is numeric (uses `isNaN(Number(value))`).

### integer

```ts
function integer(msg?: string): ValidatorFunction
```

Validates that the value is an integer (`Number.isInteger`).

### positive

```ts
function positive(msg?: string): ValidatorFunction<number>
```

Validates that the value is greater than 0.

## Custom Validators

### custom

```ts
function custom<T = unknown>(
  fn: (value: T) => string | undefined,
  msg?: string
): ValidatorFunction<T>
```

Create a synchronous validator from any function. Return a string to indicate an error, or `undefined` for success.

```ts
custom((value: string) => {
  if (value.includes(' ')) return 'No spaces allowed'
})
```

### async

```ts
function async<T = unknown>(
  fn: (value: T) => Promise<string | undefined>,
  opts?: { debounce?: number; message?: string }
): ValidatorFunction<T>
```

Create an async validator. Marked with `_isAsync = true`, which causes the ValidationEngine to derive `change` as the trigger. Default debounce is 300ms.

```ts
async(async (username: string) => {
  const res = await fetch(`/api/check-username?q=${username}`)
  const { available } = await res.json()
  return available ? undefined : 'Username is taken'
}, { debounce: 500 })
```

The validation engine:
- Debounces calls (configurable, default 300ms for async)
- Aborts in-flight requests when superseded
- Provides an `AbortSignal` via the validation context
- Tracks `validating` state per field

## Cross-Field Validators

### matches

```ts
function matches(otherField: string, msg?: string): ValidatorFunction
```

Validates that the value equals the value of another field. Uses the `CrossFieldValidationContext` to access other fields. Marked with `_crossField = true`.

```ts
// Confirm password matches password
const validators = {
  password: [required(), minLength(8)],
  confirmPassword: [required(), matches('password', 'Passwords do not match')],
}
```

The `context` parameter provides:

```ts
interface CrossFieldValidationContext<T> {
  getValue: (path: string) => unknown  // read any field
  getValues: () => T                   // get all values
  signal?: AbortSignal                 // abort signal for async
}
```

## Collection Validators

### oneOf

```ts
function oneOf<T>(values: T[], msg?: string): ValidatorFunction<T>
```

```ts
oneOf(['admin', 'user', 'guest'], 'Invalid role')
```

### notOneOf

```ts
function notOneOf<T>(values: T[], msg?: string): ValidatorFunction<T>
```

```ts
notOneOf(['root', 'admin'], 'Reserved username')
```

## File Validators

### fileSize

```ts
function fileSize(maxBytes: number, msg?: string): ValidatorFunction
```

```ts
fileSize(5 * 1024 * 1024)  // "File must be less than 5120KB"
```

### fileType

```ts
function fileType(types: string[], msg?: string): ValidatorFunction
```

```ts
fileType(['image/png', 'image/jpeg'], 'Must be PNG or JPEG')
```

## Composition

### compose

```ts
function compose<T = unknown>(
  ...rules: ValidatorFunction<T>[]
): ValidatorFunction<T>
```

Chain multiple validators into one. Runs validators in order and stops on the first error. Inherits `_isAsync`, `_isRequired`, `_crossField`, and `_debounce` properties from composed validators.

```ts
const passwordValidator = compose(
  required(),
  minLength(8),
  pattern(/[A-Z]/, 'Must contain uppercase'),
  pattern(/[0-9]/, 'Must contain a number'),
)
```

### when

```ts
function when<T = unknown>(
  condition: (value: T, context?: CrossFieldValidationContext) => boolean,
  rule: ValidatorFunction<T>
): ValidatorFunction<T>
```

Conditionally apply a validator. The rule only runs if `condition` returns `true`.

```ts
when(
  (_, ctx) => ctx?.getValue('accountType') === 'business',
  required('Company name is required for business accounts')
)
```

## The `v` Shorthand

The `v` object re-exports all validators and composition functions as a single namespace:

```ts
import { v } from '@ereo/forms'

v.required, v.email, v.url, v.date, v.phone,
v.minLength, v.maxLength, v.min, v.max,
v.pattern, v.number, v.integer, v.positive,
v.custom, v.async, v.matches,
v.oneOf, v.notOneOf, v.fileSize, v.fileType,
v.compose, v.when
```

## ValidatorFunction Interface

```ts
interface ValidatorFunction<T = unknown> {
  (value: T, context?: CrossFieldValidationContext<any>):
    | string
    | undefined
    | Promise<string | undefined>;
  _isAsync?: boolean;
  _isRequired?: boolean;
  _crossField?: boolean;
  _debounce?: number;
}
```

Validators return `undefined` for valid, or an error `string`. The metadata flags are used by the ValidationEngine to derive behavior.

## ValidationEngine Internals

The `ValidationEngine` determines **when** to validate each field using a derive-don't-configure strategy based on validator metadata:

| Configuration | Timing |
|--------------|--------|
| Default (sync validators) | `blur` |
| `required()` only | `blur` |
| Contains `async()` | `change` + debounce (default 300ms) |
| `validateOn: 'change'` (explicit) | `change` |
| `validateOn: 'submit'` (explicit) | `submit` only |

When validation triggers:
- **`change`** -- `onFieldChange()` runs the validators. Async validators use debounce (configurable via `_debounce`).
- **`blur`** -- `onFieldBlur()` runs the validators immediately. Cancels any pending debounced validation.
- **`submit`** -- validators only run when `validateAll()` is called during form submission.

Async validations use `AbortController` and per-field generation tracking to cancel stale results when a newer validation starts.

## Related

- [Schema Adapters](/api/forms/schema-adapters) -- Zod, Valibot, ereoSchema
- [useField -- Field-Level Validation](/api/forms/use-field)
- [useForm -- Form-Level Validators](/api/forms/use-form)
- [Types -- ValidatorFunction](/api/forms/types)
