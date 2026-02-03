# Forms

EreoJS provides progressive enhancement for forms - they work without JavaScript and enhance when it's available.

## Basic Form

```tsx
import { Form } from '@ereo/client'
import { createAction, redirect } from '@ereo/data'

export const action = createAction(async ({ request }) => {
  const formData = await request.formData()
  const name = formData.get('name')
  const email = formData.get('email')

  await createUser({ name, email })
  return redirect('/users')
})

export default function NewUser() {
  return (
    <Form method="post">
      <label>
        Name
        <input name="name" required />
      </label>
      <label>
        Email
        <input name="email" type="email" required />
      </label>
      <button type="submit">Create User</button>
    </Form>
  )
}
```

## Showing Validation Errors

```tsx
import { useActionData } from '@ereo/client'

export const action = createAction(async ({ request }) => {
  const formData = await request.formData()
  const email = formData.get('email')

  const errors: Record<string, string> = {}

  if (!email) {
    errors.email = 'Email is required'
  } else if (!isValidEmail(email)) {
    errors.email = 'Invalid email address'
  }

  if (Object.keys(errors).length > 0) {
    return { errors, values: { email } }
  }

  await subscribe(email)
  return { success: true }
})

export default function Subscribe() {
  const actionData = useActionData()

  return (
    <Form method="post">
      <label>
        Email
        <input
          name="email"
          type="email"
          defaultValue={actionData?.values?.email}
        />
      </label>
      {actionData?.errors?.email && (
        <p className="error">{actionData.errors.email}</p>
      )}

      {actionData?.success && (
        <p className="success">Subscribed!</p>
      )}

      <button type="submit">Subscribe</button>
    </Form>
  )
}
```

## Loading States

```tsx
import { useNavigation } from '@ereo/client'

export default function ContactForm() {
  const navigation = useNavigation()
  const isSubmitting = navigation.state === 'submitting'

  return (
    <Form method="post">
      <input name="message" disabled={isSubmitting} />
      <button type="submit" disabled={isSubmitting}>
        {isSubmitting ? 'Sending...' : 'Send'}
      </button>
    </Form>
  )
}
```

## Multiple Actions

Use an `intent` field to handle different actions:

```tsx
export const action = createAction(async ({ request }) => {
  const formData = await request.formData()
  const intent = formData.get('intent')

  switch (intent) {
    case 'save':
      return handleSave(formData)
    case 'delete':
      return handleDelete(formData)
    default:
      throw new Response('Unknown intent', { status: 400 })
  }
})

export default function Editor({ loaderData }) {
  return (
    <div>
      <Form method="post">
        <input name="title" defaultValue={loaderData.post.title} />
        <button name="intent" value="save">Save</button>
      </Form>

      <Form method="post">
        <button name="intent" value="delete">Delete</button>
      </Form>
    </div>
  )
}
```

## Non-Navigation Forms with useFetcher

For inline updates that don't navigate:

```tsx
import { useFetcher } from '@ereo/client'

function LikeButton({ postId, initialLikes }) {
  const fetcher = useFetcher()

  // Optimistic UI
  const likes = fetcher.formData
    ? initialLikes + 1
    : (fetcher.data?.likes ?? initialLikes)

  return (
    <fetcher.Form method="post" action="/api/like">
      <input type="hidden" name="postId" value={postId} />
      <button type="submit">
        {likes} Likes
      </button>
    </fetcher.Form>
  )
}
```

## File Uploads

```tsx
<Form method="post" encType="multipart/form-data">
  <input type="file" name="avatar" accept="image/*" />
  <button type="submit">Upload</button>
</Form>
```

Handle on the server:

```tsx
export const action = createAction(async ({ request }) => {
  const formData = await request.formData()
  const file = formData.get('avatar') as File

  const arrayBuffer = await file.arrayBuffer()
  await Bun.write(`./uploads/${file.name}`, arrayBuffer)

  return { success: true }
})
```

## Programmatic Submission

```tsx
import { useSubmit } from '@ereo/client'

function SearchInput() {
  const submit = useSubmit()

  return (
    <input
      type="search"
      onChange={(e) => {
        submit(
          { q: e.target.value },
          { method: 'get', action: '/search' }
        )
      }}
    />
  )
}
```

## Best Practices

1. **Always validate server-side** - Client validation is for UX, not security
2. **Return form values on error** - So users don't lose their input
3. **Use loading states** - Show when the form is submitting
4. **Handle all error cases** - Network errors, validation errors, server errors
5. **Redirect after mutations** - Prevents form resubmission on refresh
