# Hooks

React hooks for accessing route data and navigation state.

## Import

```ts
import {
  useLoaderData,
  useRouteLoaderData,
  useActionData,
  useNavigation,
  useError,
  useRouteError,
  isRouteErrorResponse,
  useParams,
  useSearchParams,
  useLocation,
} from '@ereo/client'

// Types
import type {
  NavigationStatus,
  NavigationStateHook,
  LocationState,
  LoaderDataContextValue,
  ActionDataContextValue,
  NavigationContextValue,
  ErrorContextValue,
  ParamsContextValue,
  LocationContextValue,
  LoaderDataProviderProps,
  ActionDataProviderProps,
  NavigationProviderProps,
  ErrorProviderProps,
  ParamsProviderProps,
  LocationProviderProps,
  EreoProviderProps,
} from '@ereo/client'
```

## Types

```ts
// Navigation status for useNavigation hook
type NavigationStatus = 'idle' | 'loading' | 'submitting'

// Navigation state returned by useNavigation
interface NavigationStateHook {
  status: NavigationStatus
  location?: string          // The URL being navigated to
  formData?: FormData        // Form data being submitted
  formMethod?: string        // Form method being used
  formAction?: string        // Form action URL
}

// Location object returned by useLocation
interface LocationState {
  pathname: string           // e.g., '/users/123'
  search: string             // e.g., '?page=1&sort=name'
  hash: string               // e.g., '#section-2'
  state: unknown             // History state object
  key: string                // Unique key for this location entry
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

## useRouteLoaderData

Accesses loader data from a specific route by its ID. Useful for reading data from a parent layout or sibling route without prop drilling.

### Signature

```ts
function useRouteLoaderData<T = unknown>(routeId: string): T | undefined
```

Returns `undefined` if no matching route is found.

### Example

```tsx
import { useRouteLoaderData } from '@ereo/client'

// Access root layout's loader data from any nested route
function UserAvatar() {
  const rootData = useRouteLoaderData<{ user: User }>('root-layout')

  if (!rootData?.user) return null

  return <img src={rootData.user.avatar} alt={rootData.user.name} />
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
function useNavigation(): NavigationStateHook

interface NavigationStateHook {
  status: 'idle' | 'loading' | 'submitting'
  location?: string           // The URL being navigated to
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
      {navigation.status === 'loading' && (
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
  const isSubmitting = navigation.status === 'submitting'

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

  if (navigation.status === 'idle') {
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
    navigation.status === 'submitting' &&
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

## useRouteError

Accesses the error thrown in a route's error boundary. Unlike `useError` (which returns `Error | undefined`), `useRouteError` returns `unknown` — this allows you to distinguish HTTP error responses from runtime errors using `isRouteErrorResponse`.

### Signature

```ts
function useRouteError(): unknown
```

### Example

```tsx
import { useRouteError, isRouteErrorResponse } from '@ereo/client'

export default function PostsError() {
  const error = useRouteError()

  if (isRouteErrorResponse(error)) {
    // HTTP error response (e.g., thrown from a loader)
    if (error.status === 404) {
      return <h1>Post not found</h1>
    }
    return <h1>Error {error.status}: {error.statusText}</h1>
  }

  // Runtime error
  return <h1>Something went wrong</h1>
}
```

> **`useError` vs `useRouteError`:** Use `useError` when you just need the error message. Use `useRouteError` when you need to check if the error is an HTTP error response (e.g., 404, 403) and render different UI based on the status code.

## isRouteErrorResponse

Type guard that checks if an error is an HTTP error response (has `status`, `statusText`, and `data` properties). Use with `useRouteError` to distinguish HTTP errors from runtime errors.

### Signature

```ts
function isRouteErrorResponse(error: unknown): error is RouteErrorResponse

interface RouteErrorResponse {
  status: number
  statusText: string
  data?: unknown
}
```

### Example

```tsx
import { useRouteError, isRouteErrorResponse } from '@ereo/client'

export default function ErrorPage() {
  const error = useRouteError()

  if (isRouteErrorResponse(error)) {
    switch (error.status) {
      case 404:
        return <h1>Page not found</h1>
      case 401:
        return <h1>Unauthorized — please log in</h1>
      case 403:
        return <h1>You don't have permission to view this page</h1>
      default:
        return <h1>Error {error.status}</h1>
    }
  }

  return (
    <div>
      <h1>Something went wrong</h1>
      <p>{error instanceof Error ? error.message : 'Unknown error'}</p>
    </div>
  )
}
```

## useParams

Accesses the URL parameters from dynamic route segments.

### Signature

```ts
function useParams<T extends Record<string, string> = Record<string, string>>(): T
```

### Example

```tsx
import { useParams } from '@ereo/client'

// In a route file at routes/users/[id].tsx
function UserProfile() {
  const { id } = useParams<{ id: string }>()

  return <div>User ID: {id}</div>
}
```

## useSearchParams

Accesses and modifies the current URL search parameters. Returns a tuple of `[URLSearchParams, setSearchParams]`, similar to `useState`.

### Signature

```ts
function useSearchParams(): [
  URLSearchParams,
  (
    nextParams:
      | URLSearchParams
      | Record<string, string>
      | ((prev: URLSearchParams) => URLSearchParams | Record<string, string>),
    options?: { replace?: boolean }
  ) => void
]
```

### Example

```tsx
import { useSearchParams } from '@ereo/client'

function ProductList() {
  const [searchParams, setSearchParams] = useSearchParams()
  const page = searchParams.get('page') || '1'
  const sort = searchParams.get('sort') || 'name'

  return (
    <div>
      <select
        value={sort}
        onChange={(e) => setSearchParams({ page, sort: e.target.value })}
      >
        <option value="name">Name</option>
        <option value="price">Price</option>
      </select>

      <button onClick={() => setSearchParams({ page: String(Number(page) + 1), sort })}>
        Next Page
      </button>

      {/* Use replace to avoid adding to history */}
      <button onClick={() => setSearchParams({ page: '1', sort }, { replace: true })}>
        Reset
      </button>
    </div>
  )
}
```

### Functional Updates

```tsx
// Update based on previous params
setSearchParams((prev) => {
  const next = new URLSearchParams(prev)
  next.set('page', '2')
  return next
})
```

## useLocation

Accesses the current location object.

### Signature

```ts
function useLocation(): LocationState

interface LocationState {
  pathname: string    // e.g., '/users/123'
  search: string      // e.g., '?page=1'
  hash: string        // e.g., '#section-2'
  state: unknown      // History state object
  key: string         // Unique key for this location entry
}
```

### Example

```tsx
import { useLocation } from '@ereo/client'

function Breadcrumbs() {
  const location = useLocation()
  const segments = location.pathname.split('/').filter(Boolean)

  return (
    <nav>
      <a href="/">Home</a>
      {segments.map((seg, i) => (
        <span key={i}>
          {' / '}
          <a href={'/' + segments.slice(0, i + 1).join('/')}>{seg}</a>
        </span>
      ))}
    </nav>
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
  ParamsProvider,
  LocationProvider,
  EreoProvider,

  // Contexts (for useContext)
  LoaderDataContext,
  ActionDataContext,
  NavigationContext,
  ErrorContext,
  ParamsContext,
  LocationContext,

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

interface ParamsProviderProps {
  children: ReactNode
  initialParams?: Record<string, string>
}

interface LocationProviderProps {
  children: ReactNode
  initialLocation?: LocationState
}

interface EreoProviderProps {
  children: ReactNode
  loaderData?: unknown                   // Initial loader data (typically from SSR)
  actionData?: unknown                   // Initial action data
  navigationState?: NavigationStateHook  // Initial navigation state
  error?: Error                          // Initial error (if rendering error boundary)
  params?: Record<string, string>        // Initial route params (from route matching)
  location?: LocationState               // Initial location (from request URL or window.location)
  matches?: RouteMatchData[]             // Initial matched routes (from route matching)
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
      navigation.status === 'submitting' &&
      navigation.formAction === action
    )
  }

  return navigation.status === 'submitting'
}
```

### useIsLoading

```ts
function useIsLoading() {
  const navigation = useNavigation()
  return navigation.status === 'loading'
}
```

### useFormStatus

```ts
function useFormStatus() {
  const navigation = useNavigation()
  const actionData = useActionData()

  return {
    isSubmitting: navigation.status === 'submitting',
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
