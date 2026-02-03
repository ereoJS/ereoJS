# Form

Components and hooks for handling forms with progressive enhancement.

## Import

```ts
import {
  Form,
  FormProvider,
  useFormContext,
  useSubmit,
  useFetcher,
  serializeFormData,
  parseFormData,
  formDataToObject,
  objectToFormData
} from '@ereo/client'
```

## Form

A form component that works with and without JavaScript.

### Props

```ts
interface FormProps extends React.FormHTMLAttributes<HTMLFormElement> {
  // HTTP method (default: 'post')
  method?: 'get' | 'post' | 'put' | 'patch' | 'delete'

  // Action URL (default: current route)
  action?: string

  // Replace history instead of push
  replace?: boolean

  // Callback after successful submission
  onSuccess?: (data: unknown) => void

  // Callback on submission error
  onError?: (error: Error) => void

  // Prevent default navigation
  preventNavigation?: boolean
}
```

### Basic Usage

```tsx
import { Form } from '@ereo/client'

export default function NewPost() {
  return (
    <Form method="post">
      <input name="title" required />
      <textarea name="content" required />
      <button type="submit">Create</button>
    </Form>
  )
}
```

### With Action URL

```tsx
<Form method="post" action="/api/subscribe">
  <input name="email" type="email" />
  <button type="submit">Subscribe</button>
</Form>
```

### With Callbacks

```tsx
<Form
  method="post"
  onSuccess={(data) => {
    console.log('Success:', data)
    toast.success('Saved!')
  }}
  onError={(error) => {
    console.error('Error:', error)
    toast.error('Failed to save')
  }}
>
  ...
</Form>
```

### Delete Form

```tsx
<Form method="delete" action={`/posts/${postId}`}>
  <button type="submit">Delete Post</button>
</Form>
```

## useSubmit

Programmatic form submission.

### Signature

```ts
function useSubmit(): SubmitFunction

type SubmitFunction = (
  target: HTMLFormElement | FormData | Record<string, any>,
  options?: SubmitOptions
) => void

interface SubmitOptions {
  method?: 'get' | 'post' | 'put' | 'patch' | 'delete'
  action?: string
  replace?: boolean
}
```

### Example

```tsx
import { useSubmit } from '@ereo/client'

export default function SearchForm() {
  const submit = useSubmit()

  const handleSearch = (query: string) => {
    submit(
      { q: query },
      { method: 'get', action: '/search' }
    )
  }

  return (
    <input
      type="search"
      onChange={(e) => handleSearch(e.target.value)}
    />
  )
}
```

### Submit Form Reference

```tsx
import { useSubmit, useRef } from '@ereo/client'

export default function AutoSaveForm() {
  const formRef = useRef<HTMLFormElement>(null)
  const submit = useSubmit()

  useEffect(() => {
    const interval = setInterval(() => {
      if (formRef.current) {
        submit(formRef.current)
      }
    }, 30000) // Auto-save every 30 seconds

    return () => clearInterval(interval)
  }, [submit])

  return (
    <Form ref={formRef} method="post">
      <textarea name="content" />
    </Form>
  )
}
```

## useFetcher

Non-navigating form submission for inline updates.

### Signature

```ts
function useFetcher<T = unknown>(): Fetcher<T>

interface Fetcher<T> {
  state: 'idle' | 'loading' | 'submitting'
  data: T | undefined
  formData: FormData | undefined
  formAction: string | undefined
  formMethod: string | undefined
  Form: React.ComponentType<FetcherFormProps>
  submit: SubmitFunction
  load: (href: string) => void
}
```

### Example

```tsx
import { useFetcher } from '@ereo/client'

function LikeButton({ postId, likes }: { postId: string; likes: number }) {
  const fetcher = useFetcher<{ likes: number }>()

  // Optimistic UI
  const displayLikes = fetcher.data?.likes ?? likes
  const isSubmitting = fetcher.state === 'submitting'

  return (
    <fetcher.Form method="post" action="/api/like">
      <input type="hidden" name="postId" value={postId} />
      <button type="submit" disabled={isSubmitting}>
        {displayLikes} Likes
      </button>
    </fetcher.Form>
  )
}
```

### Loading Data

```tsx
import { useFetcher } from '@ereo/client'

function UserCard({ userId }: { userId: string }) {
  const fetcher = useFetcher<User>()

  useEffect(() => {
    fetcher.load(`/api/users/${userId}`)
  }, [userId])

  if (fetcher.state === 'loading') {
    return <Skeleton />
  }

  if (fetcher.data) {
    return <div>{fetcher.data.name}</div>
  }

  return null
}
```

### Multiple Fetchers

```tsx
function PostActions({ postId }) {
  const likeFetcher = useFetcher()
  const bookmarkFetcher = useFetcher()
  const shareFetcher = useFetcher()

  return (
    <div className="actions">
      <likeFetcher.Form method="post" action="/api/like">
        <input type="hidden" name="postId" value={postId} />
        <button>Like</button>
      </likeFetcher.Form>

      <bookmarkFetcher.Form method="post" action="/api/bookmark">
        <input type="hidden" name="postId" value={postId} />
        <button>Bookmark</button>
      </bookmarkFetcher.Form>

      <shareFetcher.Form method="post" action="/api/share">
        <input type="hidden" name="postId" value={postId} />
        <button>Share</button>
      </shareFetcher.Form>
    </div>
  )
}
```

## FormProvider / useFormContext

Share form state across components.

```tsx
import { FormProvider, useFormContext } from '@ereo/client'

function FormFields() {
  const { isSubmitting, errors } = useFormContext()

  return (
    <>
      <input name="email" disabled={isSubmitting} />
      {errors.email && <span>{errors.email}</span>}
    </>
  )
}

function SubmitButton() {
  const { isSubmitting } = useFormContext()

  return (
    <button type="submit" disabled={isSubmitting}>
      {isSubmitting ? 'Saving...' : 'Save'}
    </button>
  )
}

export default function MyForm() {
  return (
    <FormProvider>
      <Form method="post">
        <FormFields />
        <SubmitButton />
      </Form>
    </FormProvider>
  )
}
```

## Utility Functions

### serializeFormData

Converts an object to FormData.

```ts
function serializeFormData(data: Record<string, any>): FormData
```

```ts
const formData = serializeFormData({
  title: 'Hello',
  tags: ['a', 'b', 'c']
})
```

### parseFormData

Parses FormData to an object.

```ts
function parseFormData(formData: FormData): Record<string, any>
```

```ts
const data = parseFormData(formData)
// { title: 'Hello', tags: ['a', 'b', 'c'] }
```

### formDataToObject / objectToFormData

Convert between FormData and objects.

```ts
function formDataToObject(formData: FormData): Record<string, any>
function objectToFormData(obj: Record<string, any>): FormData
```

## Patterns

### Confirmation Dialog

```tsx
function DeleteButton({ postId }) {
  const [confirm, setConfirm] = useState(false)
  const fetcher = useFetcher()

  if (confirm) {
    return (
      <div>
        <p>Are you sure?</p>
        <fetcher.Form method="delete" action={`/posts/${postId}`}>
          <button type="submit">Yes, delete</button>
        </fetcher.Form>
        <button onClick={() => setConfirm(false)}>Cancel</button>
      </div>
    )
  }

  return <button onClick={() => setConfirm(true)}>Delete</button>
}
```

### File Upload

```tsx
<Form method="post" encType="multipart/form-data">
  <input type="file" name="avatar" accept="image/*" />
  <button type="submit">Upload</button>
</Form>
```

### Debounced Search

```tsx
function SearchInput() {
  const submit = useSubmit()
  const [query, setQuery] = useState('')

  useEffect(() => {
    const timeout = setTimeout(() => {
      if (query) {
        submit({ q: query }, { method: 'get', action: '/search' })
      }
    }, 300)

    return () => clearTimeout(timeout)
  }, [query, submit])

  return (
    <input
      type="search"
      value={query}
      onChange={(e) => setQuery(e.target.value)}
      placeholder="Search..."
    />
  )
}
```

## Related

- [Forms Guide](/guides/forms)
- [Actions](/api/data/actions)
- [useActionData](/api/client/hooks#useactiondata)
- [useNavigation](/api/client/hooks#usenavigation)
