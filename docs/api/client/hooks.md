# Hooks

React hooks for accessing route data and navigation state.

## Import

```ts
import {
  useLoaderData,
  useActionData,
  useNavigation,
  useError
} from '@ereo/client'

// Types
import type {
  NavigationStatus,
  NavigationStateHook,
  LoaderDataContextValue,
  ActionDataContextValue,
  NavigationContextValue,
  ErrorContextValue,
  LoaderDataProviderProps,
  ActionDataProviderProps,
  NavigationProviderProps,
  ErrorProviderProps,
  EreoProviderProps
} from '@ereo/client'
```

## Types

```ts
// Navigation status for useNavigation hook
type NavigationStatus = 'idle' | 'loading' | 'submitting'

// Navigation state returned by useNavigation
interface NavigationStateHook {
  status: NavigationStatus
  location?: string          // The location being navigated to
  formData?: FormData        // Form data being submitted
  formMethod?: string        // Form method being used
  formAction?: string        // Form action URL
}
```

## useLoaderData

Accesses the data returned by the route's loader.

### Signature

```ts
function useLoaderData<T = unknown>(): T
```

### Example

```tsx
import { useLoaderData } from '@ereo/client'

interface LoaderData {
  posts: Post[]
  totalCount: number
}

export default function Posts() {
  const { posts, totalCount } = useLoaderData<LoaderData>()

  return (
    <div>
      <h1>Posts ({totalCount})</h1>
      <ul>
        {posts.map(post => (
          <li key={post.id}>{post.title}</li>
        ))}
      </ul>
    </div>
  )
}
```

### With Type Inference

```tsx
import { createLoader } from '@ereo/data'
import { useLoaderData } from '@ereo/client'

export const loader = createLoader(async () => {
  const posts = await db.posts.findMany()
  return { posts, count: posts.length }
})

export default function Posts() {
  // Type is inferred from loader
  const { posts, count } = useLoaderData<Awaited<ReturnType<typeof loader>>>()

  return <div>...</div>
}
```

## useActionData

Accesses the data returned by the route's action.

### Signature

```ts
function useActionData<T = unknown>(): T | undefined
```

Returns `undefined` if no action has been submitted.

### Example

```tsx
import { useActionData } from '@ereo/client'
import { Form } from '@ereo/client'

interface ActionData {
  error?: string
  success?: boolean
  values?: { email: string }
}

export default function Subscribe() {
  const actionData = useActionData<ActionData>()

  return (
    <Form method="post">
      <input
        name="email"
        type="email"
        defaultValue={actionData?.values?.email}
      />

      {actionData?.error && (
        <p className="error">{actionData.error}</p>
      )}

      {actionData?.success && (
        <p className="success">Subscribed successfully!</p>
      )}

      <button type="submit">Subscribe</button>
    </Form>
  )
}
```

### Handling Multiple States

```tsx
export default function ContactForm() {
  const actionData = useActionData<{
    errors?: Record<string, string>
    success?: boolean
    formData?: Record<string, string>
  }>()

  return (
    <Form method="post">
      <div>
        <label htmlFor="name">Name</label>
        <input
          id="name"
          name="name"
          defaultValue={actionData?.formData?.name}
        />
        {actionData?.errors?.name && (
          <span className="error">{actionData.errors.name}</span>
        )}
      </div>

      <div>
        <label htmlFor="email">Email</label>
        <input
          id="email"
          name="email"
          type="email"
          defaultValue={actionData?.formData?.email}
        />
        {actionData?.errors?.email && (
          <span className="error">{actionData.errors.email}</span>
        )}
      </div>

      <button type="submit">Send</button>
    </Form>
  )
}
```

## useNavigation

Tracks the current navigation state.

### Signature

```ts
function useNavigation(): NavigationState

interface NavigationState {
  state: 'idle' | 'loading' | 'submitting'
  location?: Location
  formData?: FormData
  formMethod?: string
  formAction?: string
}
```

### States

- `idle` - No navigation in progress
- `loading` - Navigating to a new page (loader running)
- `submitting` - Form submission in progress (action running)

### Example

```tsx
import { useNavigation } from '@ereo/client'

export default function Page() {
  const navigation = useNavigation()

  return (
    <div>
      {navigation.state === 'loading' && (
        <div className="loading-bar" />
      )}

      <h1>Page Content</h1>
    </div>
  )
}
```

### Form Submit Indicator

```tsx
import { useNavigation } from '@ereo/client'
import { Form } from '@ereo/client'

export default function NewPost() {
  const navigation = useNavigation()
  const isSubmitting = navigation.state === 'submitting'

  return (
    <Form method="post">
      <input name="title" disabled={isSubmitting} />
      <textarea name="content" disabled={isSubmitting} />

      <button type="submit" disabled={isSubmitting}>
        {isSubmitting ? 'Creating...' : 'Create Post'}
      </button>
    </Form>
  )
}
```

### Global Loading Indicator

```tsx
// components/LoadingIndicator.tsx
import { useNavigation } from '@ereo/client'

export function LoadingIndicator() {
  const navigation = useNavigation()

  if (navigation.state === 'idle') {
    return null
  }

  return (
    <div className="fixed top-0 left-0 right-0 h-1 bg-blue-500 animate-pulse" />
  )
}
```

### Optimistic UI

```tsx
import { useNavigation } from '@ereo/client'
import { Form } from '@ereo/client'

export default function TodoItem({ todo }) {
  const navigation = useNavigation()

  // Check if this item is being toggled
  const isToggling =
    navigation.state === 'submitting' &&
    navigation.formData?.get('todoId') === todo.id &&
    navigation.formData?.get('intent') === 'toggle'

  // Optimistic completed state
  const completed = isToggling ? !todo.completed : todo.completed

  return (
    <Form method="post">
      <input type="hidden" name="todoId" value={todo.id} />
      <input type="hidden" name="intent" value="toggle" />
      <button type="submit" className={completed ? 'completed' : ''}>
        {todo.title}
      </button>
    </Form>
  )
}
```

## useError

Accesses the error thrown in an error boundary.

### Signature

```ts
function useError(): Error | undefined
```

### Example

```tsx
import { useError } from '@ereo/client'

export function ErrorBoundary() {
  const error = useError()

  return (
    <div className="error-page">
      <h1>Oops!</h1>
      <p>{error?.message || 'Something went wrong'}</p>
      <a href="/">Go home</a>
    </div>
  )
}
```

## Context Providers

EreoJS exports context providers for testing, custom setups, and direct context access.

### Import

```ts
import {
  // Providers
  LoaderDataProvider,
  ActionDataProvider,
  NavigationProvider,
  ErrorProvider,
  EreoProvider,

  // Contexts (for useContext)
  LoaderDataContext,
  ActionDataContext,
  NavigationContext,
  ErrorContext,

  // Internal context accessors
  useLoaderDataContext,
  useActionDataContext,
  useNavigationContext,
  useErrorContext,
} from '@ereo/client'
```

### Provider Props

```ts
interface LoaderDataProviderProps {
  children: ReactNode
  initialData?: unknown
}

interface ActionDataProviderProps {
  children: ReactNode
  initialData?: unknown
}

interface NavigationProviderProps {
  children: ReactNode
  initialState?: NavigationStateHook
}

interface ErrorProviderProps {
  children: ReactNode
  initialError?: Error
}

interface EreoProviderProps {
  children: ReactNode
  loaderData?: unknown       // Initial loader data (typically from SSR)
  actionData?: unknown       // Initial action data
  navigationState?: NavigationStateHook
  error?: Error              // Initial error (if rendering error boundary)
}
```

### EreoProvider

Combines all providers into a single wrapper:

```tsx
import { EreoProvider } from '@ereo/client'

function App({ loaderData, actionData }) {
  return (
    <EreoProvider loaderData={loaderData} actionData={actionData}>
      <Routes />
    </EreoProvider>
  )
}
```

### Individual Providers

```tsx
import { LoaderDataProvider, ActionDataProvider } from '@ereo/client'

function App() {
  return (
    <LoaderDataProvider initialData={{ posts: [] }}>
      <ActionDataProvider>
        <MyComponent />
      </ActionDataProvider>
    </LoaderDataProvider>
  )
}
```

### Testing with Providers

```tsx
import { render } from '@testing-library/react'
import { LoaderDataProvider } from '@ereo/client'
import PostList from './PostList'

test('renders posts', () => {
  render(
    <LoaderDataProvider initialData={{ posts: [{ id: 1, title: 'Test Post' }] }}>
      <PostList />
    </LoaderDataProvider>
  )

  expect(screen.getByText('Test Post')).toBeInTheDocument()
})
```

### Context Accessors (Internal)

These hooks provide direct access to the full context value including setters:

```ts
// Get full loader data context with setter
const { data, setData } = useLoaderDataContext()

// Get full action data context with setter and clear
const { data, setData, clearData } = useActionDataContext()

// Get full navigation context with state controls
const { state, setState, startLoading, startSubmitting, complete } = useNavigationContext()

// Get full error context with setter and clear
const { error, setError, clearError } = useErrorContext()
```

## Custom Hooks

Build on top of the base hooks:

### useIsSubmitting

```ts
function useIsSubmitting(action?: string) {
  const navigation = useNavigation()

  if (action) {
    return (
      navigation.state === 'submitting' &&
      navigation.formAction === action
    )
  }

  return navigation.state === 'submitting'
}
```

### useIsLoading

```ts
function useIsLoading() {
  const navigation = useNavigation()
  return navigation.state === 'loading'
}
```

### useFormStatus

```ts
function useFormStatus() {
  const navigation = useNavigation()
  const actionData = useActionData()

  return {
    isSubmitting: navigation.state === 'submitting',
    isSuccess: actionData?.success === true,
    isError: actionData?.error !== undefined,
    error: actionData?.error
  }
}
```

## Related

- [Data Loading](/core-concepts/data-loading)
- [Form Component](/api/client/form)
- [Navigation](/api/client/navigation)
