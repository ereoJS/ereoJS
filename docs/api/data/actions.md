# Actions

Actions handle form submissions and data mutations. They run on the server when a non-GET request (POST, PUT, DELETE, etc.) is sent to a route.

> **Not sure which approach to use?** See the [Data Loading overview](/concepts/data-loading) for a comparison of all three approaches (plain export, createAction, defineRoute).

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
  throwRedirect,
  json,
  data,
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

Creates a type-safe action function. Accepts either a **plain function** (shorthand) or an **options object** (with validation, error handling, and automatic FormData parsing).

### Signature

```ts
// Shorthand — pass a function directly
function createAction<T, P = Record<string, string>>(
  fn: (args: ActionArgs<P>) => T | Promise<T>
): ActionFunction<T, P>

// Full options — with validation, auto-parsed FormData, error handling
function createAction<T, P = Record<string, string>>(
  options: ActionOptions<T, P>
): ActionFunction<T, P>
```

### ActionOptions

```ts
interface ActionOptions<T, P> {
  handler: (args: ActionArgs<P> & { formData: FormData }) => T | Promise<T>;
  validate?: (formData: FormData) => ValidationResult | Promise<ValidationResult>;
  onError?: (error: Error, args: ActionArgs<P>) => T | Response | Promise<T | Response>;
}
```

### ActionArgs

```ts
interface ActionArgs<P = RouteParams> {
  request: Request;    // The incoming Request object
  params: P;           // URL parameters from dynamic segments
  context: AppContext;  // App context (cookies, headers, session, etc.)
}
```

### Examples

#### Shorthand (Plain Function)

The simplest way to use `createAction` — just pass an async function. You handle FormData parsing yourself:

```ts
export const action = createAction(async ({ request }) => {
  const formData = await request.formData()
  const title = formData.get('title') as string
  const content = formData.get('content') as string

  const post = await db.posts.create({ title, content })
  return redirect(`/posts/${post.id}`)
})
```

This is equivalent to a plain function export:

```ts
// These two are equivalent:
export const action = createAction(async (args) => { ... })
export async function action(args) { ... }
```

#### Options Object (With Validation)

Use the options object when you want automatic FormData parsing and a validation step. The `handler` receives pre-parsed `formData`, and validation runs before the handler:

```ts
export const action = createAction({
  handler: async ({ formData }) => {
    // formData is already parsed — no need to call request.formData()
    await db.posts.create(Object.fromEntries(formData))
    return redirect('/posts')
  },
  validate: (formData) => {
    const errors: Record<string, string[]> = {}
    if (!formData.get('title')) {
      errors.title = ['Title is required']
    }
    if (!formData.get('content')) {
      errors.content = ['Content is required']
    }
    return { success: Object.keys(errors).length === 0, errors }
  },
})
```

When validation fails, the action returns `{ success: false, errors: { ... } }` without calling the handler.

#### Returning Errors

```ts
export const action = createAction(async ({ request }) => {
  const formData = await request.formData()
  const email = formData.get('email') as string

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

## Plain Function Export (Alternative)

You can also export a plain async function as `action`. No imports needed:

```ts
import type { ActionArgs } from '@ereo/core'

export async function action({ request, params }: ActionArgs<{ id: string }>) {
  const formData = await request.formData()
  const intent = formData.get('intent')

  if (intent === 'delete') {
    await db.posts.delete(params.id)
    return redirect('/posts')
  }

  return { success: true }
}
```

This works because the EreoJS server calls whatever function is exported as `action`. The `createAction` helpers add features like validation and automatic FormData parsing on top.

## action (Shorthand Helper)

A convenience function that wraps a handler in `createAction`. The handler receives `formData` as part of its arguments (no need to parse it yourself):

```ts
import { action } from '@ereo/data'

export const myAction = action(async ({ formData, params }) => {
  const title = formData.get('title') as string
  await db.posts.update(params.id, { title })
  return { success: true }
})
```

> **Note:** Avoid naming conflicts by using a different variable name (e.g., `myAction`) when importing the `action` helper, since route files conventionally export `action`.

## typedAction

Creates an action with a typed request body. Automatically handles both JSON and FormData content types with type coercion.

### Signature

```ts
function typedAction<TBody, TResult, P>(
  options: TypedActionOptions<TBody, TResult, P>
): ActionFunction<ActionResult<TResult>, P>
```

### TypedActionOptions

```ts
interface TypedActionOptions<TBody, TResult, P> {
  handler: (args: TypedActionArgs<TBody, P>) => TResult | Promise<TResult>;
  validate?: (body: TBody) => ValidationResult | Promise<ValidationResult>;
  transform?: (raw: unknown) => TBody;
  schema?: { parse(data: unknown): TBody; safeParse?(...): {...} };
  onError?: (error: Error, args: ActionArgs<P>) => TResult | Response | Promise<TResult | Response>;
}
```

### Examples

#### With Inline Type

```ts
interface CreatePostBody {
  title: string
  content: string
  tags: string[]
}

export const action = typedAction<CreatePostBody, { id: string }>({
  handler: async ({ body }) => {
    // body is typed as CreatePostBody
    const post = await db.posts.create(body)
    return { id: post.id }
  },
  validate: (body) => {
    if (!body.title || body.title.length < 3) {
      return { success: false, errors: { title: ['Title must be at least 3 characters'] } }
    }
    return { success: true }
  },
})
```

#### With Schema (Zod)

```ts
import { z } from 'zod'

const CreatePostSchema = z.object({
  title: z.string().min(1).max(200),
  content: z.string().min(10),
  tags: z.array(z.string()).default([]),
  published: z.boolean().default(false),
})

export const action = typedAction({
  schema: CreatePostSchema,
  handler: async ({ body }) => {
    // body is inferred from schema. Validation is automatic.
    return db.posts.create({ data: body })
  },
})
```

## jsonAction

Creates an action that only accepts JSON payloads. Useful for strict API endpoints.

### Signature

```ts
function jsonAction<TBody, TResult = TBody, P = RouteParams>(
  options: Omit<TypedActionOptions<TBody, TResult, P>, 'transform'> & { strict?: boolean }
): ActionFunction<ActionResult<TResult>, P>
```

> **Note:** `jsonAction` does not support the `transform` option (unlike `typedAction`). If you need a custom transform step, use `typedAction` instead.

### Example

```ts
export const action = jsonAction<{ ids: number[] }>({
  strict: true,  // Returns 415 if Content-Type is not application/json
  handler: async ({ body }) => {
    await db.posts.deleteMany({ where: { id: { in: body.ids } } })
    return { deleted: body.ids.length }
  },
})
```

## Response Helpers

### redirect

Creates a redirect response.

```ts
function redirect(url: string, statusOrInit?: number | ResponseInit): Response
```

```ts
return redirect('/posts')           // 302 redirect (default)
return redirect('/posts', 301)      // 301 permanent redirect
return redirect('/posts', 303)      // 303 redirect (after POST)
```

### throwRedirect

Throws a redirect response, immediately stopping execution. Useful inside loaders where you want to bail out early:

```ts
function throwRedirect(url: string, statusOrInit?: number | ResponseInit): never
```

```ts
// This throws — execution stops immediately
throwRedirect('/login')

// Code after throwRedirect is never reached
```

### json

Creates a JSON response.

```ts
function json<T>(data: T, init?: ResponseInit): Response
```

```ts
return json({ success: true })
return json({ error: 'Not found' }, { status: 404 })
```

### data

Creates an XSS-safe JSON response. Escapes `<`, `>`, `&`, and `'` characters to prevent script injection when embedding data in HTML:

```ts
function data<T>(value: T, init?: ResponseInit): Response
```

```ts
// Use this when embedding data in HTML/script tags
return data({ post })
```

### error

Creates an error response.

```ts
function error(message: string, status?: number): Response
```

```ts
throw error('Not found', 404)
throw error('Unauthorized', 401)
```

## Utility Functions

### parseRequestBody

Parses the request body based on content type. Automatically handles JSON, FormData, and text.

```ts
function parseRequestBody(request: Request): Promise<{
  body: unknown;
  formData?: FormData;
  contentType: 'json' | 'form' | 'text' | 'unknown';
}>
```

```ts
export const action = createAction(async ({ request }) => {
  const { body, contentType } = await parseRequestBody(request)
  // body is parsed based on Content-Type header
})
```

### formDataToObject

Converts FormData to a typed object with automatic type coercion and support for nested objects/arrays.

```ts
function formDataToObject<T = Record<string, unknown>>(
  formData: FormData,
  options?: { coerce?: boolean }
): T
```

**Conventions supported:**
- `field[]` or multiple same-name fields -> array
- `field.nested` -> nested object
- `field[0]`, `field[1]` -> indexed array
- Automatic type coercion: `"true"` -> `true`, `"42"` -> `42`, ISO dates -> `Date`

```ts
const formData = new FormData()
formData.append('user.name', 'Alice')
formData.append('user.email', 'alice@example.com')
formData.append('tags[]', 'typescript')
formData.append('tags[]', 'react')
formData.append('active', 'true')

const data = formDataToObject(formData)
// {
//   user: { name: 'Alice', email: 'alice@example.com' },
//   tags: ['typescript', 'react'],
//   active: true  // coerced from string
// }
```

### parseFormData

Simple FormData to typed object conversion (flat only, no nested objects).

```ts
function parseFormData<T extends Record<string, unknown>>(formData: FormData): Partial<T>
```

### coerceValue

Coerces a string value to the appropriate JavaScript type.

```ts
function coerceValue(value: string): unknown
```

Supported conversions: `'true'`/`'false'` -> boolean, `'null'` -> null, numeric strings -> number, ISO dates -> Date, JSON strings -> parsed object.

### validateRequired

Validates that required fields are present in FormData.

```ts
function validateRequired(formData: FormData, fields: string[]): ValidationResult
```

```ts
const result = validateRequired(formData, ['email', 'password'])
// { success: false, errors: { password: ['password is required'] } }
```

### combineValidators

Combines multiple validation functions into one. Collects all errors from all validators.

```ts
function combineValidators(
  ...validators: Array<(formData: FormData) => ValidationResult | Promise<ValidationResult>>
): (formData: FormData) => Promise<ValidationResult>
```

```ts
const validateSignup = combineValidators(
  (fd) => validateRequired(fd, ['email', 'password', 'name']),
  validateEmail,
  validatePassword,
)

export const action = createAction({
  validate: validateSignup,
  handler: async ({ formData }) => {
    // All validations passed
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
      throw error('Unknown action', 400)
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
      {actionData?.error && <p className="error">{actionData.error}</p>}
      {actionData?.success && <p className="success">Created!</p>}
      <button type="submit">Create</button>
    </Form>
  )
}
```

## Optimistic Updates

Combine actions with optimistic UI using `useFetcher`:

```tsx
import { useFetcher } from '@ereo/client'

function LikeButton({ postId, initialLikes }) {
  const fetcher = useFetcher()

  // Optimistic: show +1 immediately while submitting
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

1. **Start with the shorthand** — Use `createAction(fn)` until you need validation
2. **Validate input** — Use the options object form for server-side validation
3. **Return meaningful data** — Include success/error status and relevant data
4. **Use redirects after mutations** — Prevent form resubmission with POST-redirect-GET
5. **Handle errors gracefully** — Return error objects for the UI, throw for error boundaries
6. **Use intent for multiple actions** — Keep related actions in one route file
7. **Type your actions** — Use `typedAction` or generics for type safety

## Related

- [Data Loading Concepts](/concepts/data-loading) — Overview of all approaches
- [Loaders](/api/data/loaders) — Data fetching
- [defineRoute Builder](/api/data/define-route) — Builder pattern
- [Forms Guide](/guides/forms) — Form handling patterns
- [useActionData](/api/client/hooks#useactiondata) — Client hook
- [Form Component](/api/client/form) — Enhanced form component
