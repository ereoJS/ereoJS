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
  useActionData,      // Form-specific
  useNavigation,      // Form-specific
  serializeFormData,
  parseFormData,
  formDataToObject,
  objectToFormData
} from '@ereo/client'

// Types
import type {
  FormProps,
  ActionResult,
  SubmissionState,
  SubmitOptions,
  FetcherState,
  Fetcher,
  FormContextValue,
  FormNavigationState
} from '@ereo/client'
```

## Types

```ts
// Result from a form action submission
interface ActionResult<T = unknown> {
  data?: T
  error?: Error
  status: number
  ok: boolean
}

// Submission state for tracking form submissions
type SubmissionState = 'idle' | 'submitting' | 'loading' | 'error'

// Submit options for programmatic submission
interface SubmitOptions {
  method?: 'get' | 'post' | 'put' | 'patch' | 'delete'
  action?: string
  replace?: boolean
  preventScrollReset?: boolean
  encType?: 'application/x-www-form-urlencoded' | 'multipart/form-data'
  fetcherKey?: string
}
```

## Form

A form component with progressive enhancement. Works without JavaScript as a standard HTML form and enhances with client-side submission when JS is available.

### Props

```ts
interface FormProps extends Omit<FormHTMLAttributes<HTMLFormElement>, 'method' | 'action' | 'encType'> {
  // HTTP method (default: 'post')
  method?: 'get' | 'post' | 'put' | 'patch' | 'delete'

  // Action URL (default: current route)
  action?: string

  // Called when submission starts
  onSubmitStart?: () => void

  // Called when submission completes
  onSubmitEnd?: (result: ActionResult) => void

  // Replace history instead of push
  replace?: boolean

  // Prevent scroll reset after navigation
  preventScrollReset?: boolean

  // Encoding type
  encType?: 'application/x-www-form-urlencoded' | 'multipart/form-data'

  // Fetcher key for non-navigation submissions
  fetcherKey?: string

  // Form children
  children?: ReactNode
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
  onSubmitStart={() => {
    console.log('Submission started')
  }}
  onSubmitEnd={(result) => {
    if (result.ok) {
      console.log('Success:', result.data)
      toast.success('Saved!')
    } else {
      console.error('Error:', result.error)
      toast.error('Failed to save')
    }
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

Hook for programmatic form submission.

### Signature

```ts
function useSubmit(): (
  target: HTMLFormElement | FormData | URLSearchParams | Record<string, string>,
  options?: SubmitOptions
) => Promise<ActionResult>
```

The returned function submits form data and returns a Promise with the result.

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

Hook for non-navigation form submissions. Useful for inline updates that don't require page navigation.

### Signature

```ts
function useFetcher<T = unknown>(key?: string): Fetcher<T>

interface FetcherState<T = unknown> {
  state: SubmissionState
  data?: T
  error?: Error
  formData?: FormData
  formMethod?: string
  formAction?: string
}

interface Fetcher<T = unknown> extends FetcherState<T> {
  // Form component for the fetcher
  Form: (props: Omit<FormProps, 'fetcherKey'>) => ReactElement

  // Submit function for programmatic submission
  submit: (
    target: HTMLFormElement | FormData | URLSearchParams | Record<string, string>,
    options?: SubmitOptions
  ) => Promise<void>

  // Load data from a URL
  load: (href: string) => Promise<void>

  // Reset fetcher state
  reset: () => void
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

### FormContextValue

```ts
interface FormContextValue {
  // Current action data from the last submission
  actionData: unknown

  // Current submission state
  state: SubmissionState

  // Update action data
  setActionData: (data: unknown) => void

  // Update submission state
  setState: (state: SubmissionState) => void
}
```

### Example

```tsx
import { FormProvider, useFormContext, Form } from '@ereo/client'

function FormFields() {
  const context = useFormContext()
  const isSubmitting = context?.state === 'submitting'

  return (
    <>
      <input name="email" disabled={isSubmitting} />
    </>
  )
}

function SubmitButton() {
  const context = useFormContext()
  const isSubmitting = context?.state === 'submitting'

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

Serialize FormData to a URL-encoded string.

```ts
function serializeFormData(formData: FormData): string
```

```ts
const formData = new FormData()
formData.append('name', 'John')
formData.append('email', 'john@example.com')

const serialized = serializeFormData(formData)
// 'name=John&email=john%40example.com'
```

### parseFormData

Parse a URL-encoded string to FormData.

```ts
function parseFormData(data: string): FormData
```

```ts
const formData = parseFormData('name=John&email=john%40example.com')
// FormData with name and email entries
```

### formDataToObject

Convert FormData to a plain object. Handles multiple values for the same key by creating arrays.

```ts
function formDataToObject(formData: FormData): Record<string, string | string[]>
```

```ts
const formData = new FormData()
formData.append('name', 'John')
formData.append('tags', 'react')
formData.append('tags', 'typescript')

const obj = formDataToObject(formData)
// { name: 'John', tags: ['react', 'typescript'] }
```

### objectToFormData

Convert a plain object to FormData. Handles arrays by appending multiple values.

```ts
function objectToFormData(obj: Record<string, string | string[] | number | boolean>): FormData
```

```ts
const formData = objectToFormData({
  name: 'John',
  tags: ['react', 'typescript'],
  count: 5,
  active: true
})
// FormData with name, tags (twice), count, active entries
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
