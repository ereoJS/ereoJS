# Forms (Basic)

For simple forms that submit data to the server and display the result, use the `Form` component from `@ereo/client`. It works as a standard HTML `<form>` without JavaScript and progressively enhances with client-side submission when JS is available.

::: tip When to use this
This guide covers basic forms with `@ereo/client`. If you need client-side validation, dynamic field arrays, multi-step wizards, or per-field reactivity, see [Forms (Advanced)](/guides/forms-advanced).
:::

## Import

```ts
import { Form, useActionData, useNavigation } from '@ereo/client'
```

## Basic Form

A form submits to the current route's `action` by default:

```tsx
// routes/contact.tsx
import { createAction, redirect } from '@ereo/data'
import { Form } from '@ereo/client'

export const action = createAction(async ({ request }) => {
  const formData = await request.formData()
  const name = formData.get('name') as string
  const email = formData.get('email') as string
  const message = formData.get('message') as string

  await sendContactEmail({ name, email, message })
  return redirect('/contact?sent=true')
})

export default function Contact() {
  return (
    <Form method="post">
      <div>
        <label htmlFor="name">Name</label>
        <input type="text" id="name" name="name" required />
      </div>
      <div>
        <label htmlFor="email">Email</label>
        <input type="email" id="email" name="email" required />
      </div>
      <div>
        <label htmlFor="message">Message</label>
        <textarea id="message" name="message" required />
      </div>
      <button type="submit">Send</button>
    </Form>
  )
}
```

## Displaying Action Data

Use `useActionData` to access data returned from the action. This is useful for showing validation errors or success messages without redirecting:

```tsx
// routes/subscribe.tsx
import { createAction } from '@ereo/data'
import { Form, useActionData } from '@ereo/client'

export const action = createAction(async ({ request }) => {
  const formData = await request.formData()
  const email = formData.get('email') as string

  if (!email || !email.includes('@')) {
    return { error: 'Please enter a valid email address', values: { email } }
  }

  await addSubscriber(email)
  return { success: true }
})

export default function Subscribe() {
  const actionData = useActionData()

  return (
    <div>
      {actionData?.success && (
        <p className="success">You have been subscribed.</p>
      )}

      <Form method="post">
        <label htmlFor="email">Email</label>
        <input
          type="email"
          id="email"
          name="email"
          defaultValue={actionData?.values?.email}
        />
        {actionData?.error && <p className="error">{actionData.error}</p>}
        <button type="submit">Subscribe</button>
      </Form>
    </div>
  )
}
```

## Loading States

Use `useNavigation` to show a loading indicator while the form is submitting:

```tsx
import { Form, useActionData, useNavigation } from '@ereo/client'

export default function CreatePost() {
  const actionData = useActionData()
  const navigation = useNavigation()
  const isSubmitting = navigation.status === 'submitting'

  return (
    <Form method="post">
      <input name="title" required disabled={isSubmitting} />
      <textarea name="content" required disabled={isSubmitting} />

      {actionData?.error && <p className="error">{actionData.error}</p>}

      <button type="submit" disabled={isSubmitting}>
        {isSubmitting ? 'Creating...' : 'Create Post'}
      </button>
    </Form>
  )
}
```

## Submitting to a Different Route

Use the `action` prop to submit to a route other than the current one:

```tsx
<Form method="post" action="/api/newsletter">
  <input type="email" name="email" placeholder="you@example.com" />
  <button type="submit">Join Newsletter</button>
</Form>
```

## Different HTTP Methods

The `method` prop supports `get`, `post`, `put`, `patch`, and `delete`:

```tsx
// Search form (GET)
<Form method="get" action="/search">
  <input type="search" name="q" placeholder="Search..." />
  <button type="submit">Search</button>
</Form>

// Delete form
<Form method="delete" action={`/posts/${postId}`}>
  <button type="submit">Delete Post</button>
</Form>
```

## File Uploads

Set `encType="multipart/form-data"` for file uploads:

```tsx
<Form method="post" encType="multipart/form-data">
  <label htmlFor="avatar">Profile Photo</label>
  <input type="file" id="avatar" name="avatar" accept="image/*" />
  <button type="submit">Upload</button>
</Form>
```

The server action receives the file as a `File` object from `formData`:

```ts
export const action = createAction(async ({ request }) => {
  const formData = await request.formData()
  const avatar = formData.get('avatar') as File

  if (!avatar || avatar.size === 0) {
    return { error: 'No file selected' }
  }

  await Bun.write(`./uploads/${avatar.name}`, avatar)
  return { success: true }
})
```

See the [File Uploads guide](/guides/file-uploads) for advanced patterns like streaming and progress tracking.

## Progressive Enhancement

The `Form` component works without JavaScript as a standard HTML form. When JavaScript loads, it intercepts the submission and handles it client-side. This means:

- Forms work immediately on page load, even before JS hydrates
- Users on slow connections or with JS disabled still get a working form
- When JS is available, submissions are faster (no full page reload)

There is no special configuration needed -- progressive enhancement is built in.

## Callbacks

React to submission lifecycle events:

```tsx
<Form
  method="post"
  onSubmitStart={() => console.log('Submitting...')}
  onSubmitEnd={(result) => {
    if (result.ok) {
      toast.success('Saved!')
    } else {
      toast.error('Something went wrong')
    }
  }}
>
  {/* fields */}
</Form>
```

## Related

- [@ereo/client Form API](/api/client/form) -- Full API reference for the Form component
- [Forms (Advanced)](/guides/forms-advanced) -- Client-side validation, field arrays, wizards with `@ereo/forms`
- [Data Loading](/concepts/data-loading) -- Actions and form data handling
- [File Uploads](/guides/file-uploads) -- Advanced file upload patterns
