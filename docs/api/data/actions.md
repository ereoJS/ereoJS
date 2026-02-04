# Actions

Actions handle form submissions and data mutations.

## Import

```ts
import {
  createAction,
  action,
  typedAction,
  jsonAction,
  parseRequestBody,
  formDataToObject,
  parseFormData,
  coerceValue,
  validateRequired,
  combineValidators,
  redirect,
  json,
  error,
  type ActionOptions,
  type TypedActionOptions,
  type ActionResult,
  type ValidationResult,
  type TypedActionArgs,
  type ActionBody,
} from '@ereo/data'
```

## createAction

Creates a type-safe action function.

### Signature

```ts
function createAction<T, P = Record<string, string>>(
  options: ActionOptions<T, P> | ActionHandler<T, P>
): ActionFunction<T, P>
```

### Parameters

```ts
interface ActionOptions<T, P> {
  // The action handler function
  handler: ActionHandler<T, P>

  // Validation function
  validate?: (formData: FormData) => ValidationResult

  // Transform formData before handling
  transform?: (formData: FormData) => any
}

type ActionHandler<T, P> = (args: ActionArgs<P>) => T | Promise<T>

interface ActionArgs<P> {
  request: Request
  params: P
  context: RequestContext
}
```

### Examples

#### Basic Action

```ts
export const action = createAction(async ({ request }) => {
  const formData = await request.formData()
  const title = formData.get('title')
  const content = formData.get('content')

  const post = await db.posts.create({ title, content })
  return redirect(`/posts/${post.id}`)
})
```

#### With Validation

```ts
export const action = createAction({
  handler: async ({ request }) => {
    const formData = await request.formData()
    await db.posts.create(Object.fromEntries(formData))
    return redirect('/posts')
  },
  validate: (formData) => {
    const errors = {}
    if (!formData.get('title')) {
      errors.title = 'Title is required'
    }
    if (!formData.get('content')) {
      errors.content = 'Content is required'
    }
    return Object.keys(errors).length ? { errors } : { valid: true }
  }
})
```

#### Returning Errors

```ts
export const action = createAction(async ({ request }) => {
  const formData = await request.formData()
  const email = formData.get('email')

  if (!isValidEmail(email)) {
    return {
      error: 'Invalid email address',
      values: { email }
    }
  }

  await subscribe(email)
  return { success: true }
})
```

## action

Shorthand for creating simple actions.

### Signature

```ts
function action<T, P>(
  handler: (args: ActionArgs<P> & { formData: FormData }) => T | Promise<T>
): ActionFunction<T, P>
```

### Example

```ts
export const action = action(async ({ formData, params }) => {
  const title = formData.get('title')
  await db.posts.update(params.id, { title })
  return { success: true }
})
```

## typedAction

Creates an action with typed request body.

### Signature

```ts
function typedAction<TBody, TResult, P>(
  options: TypedActionOptions<TBody, TResult, P>
): ActionFunction<TResult, P>
```

### Example

```ts
interface CreatePostBody {
  title: string
  content: string
  tags: string[]
}

export const action = typedAction<CreatePostBody, { id: string }>({
  handler: async ({ body }) => {
    const post = await db.posts.create(body)
    return { id: post.id }
  },
  validate: (body) => {
    if (!body.title || body.title.length < 3) {
      return { error: 'Title must be at least 3 characters' }
    }
    return { valid: true }
  }
})
```

## jsonAction

Creates an action that accepts JSON body.

### Signature

```ts
function jsonAction<T, P>(
  handler: (args: ActionArgs<P> & { body: any }) => T | Promise<T>
): ActionFunction<T, P>
```

### Example

```ts
export const action = jsonAction(async ({ body, params }) => {
  const { title, content } = body
  await db.posts.update(params.id, { title, content })
  return { success: true }
})
```

## Response Helpers

### redirect

Creates a redirect response.

```ts
function redirect(url: string, status?: number): Response
```

```ts
return redirect('/posts')           // 302 redirect
return redirect('/posts', 301)      // 301 redirect
return redirect('/posts', 303)      // 303 redirect (after POST)
```

### json

Creates a JSON response.

```ts
function json(data: any, init?: ResponseInit): Response
```

```ts
return json({ success: true })
return json({ error: 'Not found' }, { status: 404 })
return json(data, {
  headers: { 'X-Custom': 'header' }
})
```

### error

Creates an error response.

```ts
function error(message: string, status?: number): Response
```

```ts
return error('Not found', 404)
return error('Unauthorized', 401)
return error('Server error', 500)
```

## Utility Functions

### parseRequestBody

Parses the request body based on content type.

```ts
function parseRequestBody(request: Request): Promise<any>
```

```ts
export const action = createAction(async ({ request }) => {
  // Automatically handles JSON, FormData, URLSearchParams
  const body = await parseRequestBody(request)
  return { received: body }
})
```

### formDataToObject

Converts FormData to a typed object with automatic type coercion and nested object support.

```ts
function formDataToObject<T = Record<string, unknown>>(
  formData: FormData,
  options?: { coerce?: boolean }
): T
```

**Features:**
- `field[]` or multiple same-name fields → array
- `field.nested` → nested object
- `field[0]`, `field[1]` → indexed array
- Automatic type coercion (when `coerce: true`, default)

```ts
const formData = new FormData()
formData.append('user.name', 'Alice')
formData.append('user.email', 'alice@example.com')
formData.append('tags[]', 'typescript')
formData.append('tags[]', 'react')
formData.append('items[0].name', 'Item 1')
formData.append('items[0].price', '100')
formData.append('active', 'true')

const data = formDataToObject(formData)
// {
//   user: { name: 'Alice', email: 'alice@example.com' },
//   tags: ['typescript', 'react'],
//   items: [{ name: 'Item 1', price: 100 }],
//   active: true  // coerced from string
// }

// Disable coercion to keep string values
const rawData = formDataToObject(formData, { coerce: false })
// { ..., active: 'true', items: [{ price: '100' }] }
```

### parseFormData

Simple FormData to typed object conversion without nested object support.

```ts
function parseFormData<T extends Record<string, unknown>>(
  formData: FormData
): Partial<T>
```

```ts
interface ContactForm {
  name: string
  email: string
  tags: string[]
}

const formData = await request.formData()
const data = parseFormData<ContactForm>(formData)
// { name: 'John', email: 'john@example.com', tags: ['support'] }
```

### coerceValue

Coerces a string value to the appropriate JavaScript type.

```ts
function coerceValue(value: string): unknown
```

**Supported conversions:**
- `'true'` / `'false'` → boolean
- `'null'` → null
- `'undefined'` → undefined
- Numeric strings → number
- ISO date strings → Date
- JSON objects/arrays → parsed object

```ts
coerceValue('true')           // true (boolean)
coerceValue('false')          // false (boolean)
coerceValue('null')           // null
coerceValue('undefined')      // undefined
coerceValue('42')             // 42 (number)
coerceValue('3.14')           // 3.14 (number)
coerceValue('2024-01-15')     // Date object
coerceValue('{"a":1}')        // { a: 1 } (parsed JSON)
coerceValue('[1,2,3]')        // [1, 2, 3] (parsed JSON array)
coerceValue('hello')          // 'hello' (string unchanged)
```

### validateRequired

Validates that required fields are present in FormData.

```ts
function validateRequired(
  formData: FormData,
  fields: string[]
): ValidationResult

interface ValidationResult {
  success: boolean
  errors?: Record<string, string[]>
}
```

```ts
const formData = new FormData()
formData.append('email', 'user@example.com')

const result = validateRequired(formData, ['email', 'password'])
// {
//   success: false,
//   errors: { password: ['password is required'] }
// }

// Use in createAction
export const action = createAction({
  validate: (formData) => validateRequired(formData, ['title', 'content']),
  handler: async ({ formData }) => {
    // ...
  },
})
```

### combineValidators

Combines multiple validation functions into one. Collects all errors from all validators.

```ts
function combineValidators(
  ...validators: Array<(formData: FormData) => ValidationResult | Promise<ValidationResult>>
): (formData: FormData) => Promise<ValidationResult>
```

```ts
const validateEmail = (formData: FormData): ValidationResult => {
  const email = formData.get('email') as string
  if (!email?.includes('@')) {
    return { success: false, errors: { email: ['Invalid email format'] } }
  }
  return { success: true }
}

const validatePassword = (formData: FormData): ValidationResult => {
  const password = formData.get('password') as string
  if (!password || password.length < 8) {
    return { success: false, errors: { password: ['Password must be at least 8 characters'] } }
  }
  return { success: true }
}

// Combine validators
const validateSignup = combineValidators(
  (fd) => validateRequired(fd, ['email', 'password', 'name']),
  validateEmail,
  validatePassword
)

export const action = createAction({
  validate: validateSignup,
  handler: async ({ formData }) => {
    // All validations passed
    const email = formData.get('email')
    // ...
  },
})
```

## Handling Multiple Actions

Use an `intent` field to handle multiple actions in one route:

```ts
export const action = createAction(async ({ request }) => {
  const formData = await request.formData()
  const intent = formData.get('intent')

  switch (intent) {
    case 'create':
      return handleCreate(formData)
    case 'update':
      return handleUpdate(formData)
    case 'delete':
      return handleDelete(formData)
    default:
      return error('Unknown action', 400)
  }
})
```

In the component:

```tsx
<Form method="post">
  <input name="title" />
  <button name="intent" value="create">Create</button>
  <button name="intent" value="update">Update</button>
</Form>

<Form method="post">
  <button name="intent" value="delete">Delete</button>
</Form>
```

## Using Action Data

Access action results in components:

```tsx
import { useActionData } from '@ereo/client'

export default function NewPost() {
  const actionData = useActionData()

  return (
    <Form method="post">
      <input
        name="title"
        defaultValue={actionData?.values?.title}
      />
      {actionData?.error && (
        <p className="error">{actionData.error}</p>
      )}
      {actionData?.success && (
        <p className="success">Created!</p>
      )}
      <button type="submit">Create</button>
    </Form>
  )
}
```

## Optimistic Updates

Combine actions with optimistic UI:

```tsx
import { useFetcher } from '@ereo/client'

function LikeButton({ postId, initialLikes }) {
  const fetcher = useFetcher()

  // Optimistic value
  const likes = fetcher.formData
    ? initialLikes + 1
    : initialLikes

  return (
    <fetcher.Form method="post" action="/api/like">
      <input type="hidden" name="postId" value={postId} />
      <button disabled={fetcher.state !== 'idle'}>
        {likes} Likes
      </button>
    </fetcher.Form>
  )
}
```

## Best Practices

1. **Validate input** - Always validate form data before processing
2. **Return meaningful data** - Include success/error status and relevant data
3. **Use redirects after mutations** - Prevent form resubmission
4. **Handle errors gracefully** - Return error objects instead of throwing
5. **Use intent for multiple actions** - Keep related actions in one file
6. **Type your actions** - Use generics for type safety

## Related

- [Data Loading Concepts](/core-concepts/data-loading)
- [Loaders](/api/data/loaders)
- [Forms Guide](/guides/forms)
- [useActionData](/api/client/hooks#useactiondata)
- [Form Component](/api/client/form)
