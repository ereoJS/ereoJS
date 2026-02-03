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
  redirect,
  json,
  error
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

Converts FormData to a plain object.

```ts
function formDataToObject(formData: FormData): Record<string, any>
```

```ts
const formData = await request.formData()
const data = formDataToObject(formData)
// { title: 'Hello', tags: ['a', 'b'] }
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
