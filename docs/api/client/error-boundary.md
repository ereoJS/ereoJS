# Error Boundary

Components and hooks for error handling.

## Import

```ts
import {
  ErrorBoundary,
  RouteErrorBoundary,
  useErrorBoundary,
  useRouteError,
  isRouteErrorResponse,
  createRouteErrorResponse,
  withErrorBoundary,
  RouteError
} from '@ereo/client'
```

## ErrorBoundary

A React error boundary component that catches JavaScript errors in child components.

### Props

```ts
interface ErrorBoundaryProps {
  children: ReactNode

  // Fallback UI when an error occurs
  // Can be a static ReactNode or a function receiving error and reset function
  fallback?: ReactNode | ((error: Error, reset: () => void) => ReactNode)

  // Callback when an error is caught
  onError?: (error: Error, errorInfo: ErrorInfo) => void
}
```

### Basic Usage

```tsx
import { ErrorBoundary } from '@ereo/client'

function App() {
  return (
    <ErrorBoundary fallback={<div>Something went wrong</div>}>
      <MyComponent />
    </ErrorBoundary>
  )
}
```

### With Error Callback

```tsx
<ErrorBoundary
  fallback={<ErrorMessage />}
  onError={(error, errorInfo) => {
    // Log to error tracking service
    Sentry.captureException(error, { extra: errorInfo })
  }}
>
  <MyComponent />
</ErrorBoundary>
```

### Dynamic Fallback with Reset

```tsx
<ErrorBoundary
  fallback={(error, reset) => (
    <div>
      <h1>Error</h1>
      <p>{error.message}</p>
      <button onClick={reset}>
        Try Again
      </button>
    </div>
  )}
>
  <MyComponent />
</ErrorBoundary>
```

## RouteErrorBoundary

An error boundary specifically for route-level error handling. Integrates with route configuration and supports error recovery strategies.

### Props

```ts
interface RouteErrorBoundaryProps {
  // Route identifier
  routeId: string

  // Error configuration from route
  errorConfig?: ErrorConfig

  // Children to render
  children: ReactNode

  // Fallback component from route module
  fallbackComponent?: ComponentType<{ error: Error; params: RouteParams }>

  // Route params
  params?: RouteParams
}
```

### Usage

```tsx
// routes/_error.tsx
import { RouteErrorBoundary, useRouteError, isRouteErrorResponse } from '@ereo/client'

export function ErrorBoundary() {
  const error = useRouteError()

  if (isRouteErrorResponse(error)) {
    return (
      <div>
        <h1>{error.status}</h1>
        <p>{error.statusText}</p>
      </div>
    )
  }

  return (
    <div>
      <h1>Error</h1>
      <p>{error?.message || 'Unknown error'}</p>
    </div>
  )
}
```

## useRouteError

Hook to access the error in an error boundary.

### Signature

```ts
function useRouteError(): RouteErrorResponse | Error | unknown
```

### Example

```tsx
function ErrorBoundary() {
  const error = useRouteError()

  // Handle different error types
  if (isRouteErrorResponse(error)) {
    switch (error.status) {
      case 404:
        return <NotFoundPage />
      case 401:
        return <UnauthorizedPage />
      case 500:
        return <ServerErrorPage />
      default:
        return <GenericErrorPage status={error.status} />
    }
  }

  if (error instanceof Error) {
    return <ErrorPage message={error.message} />
  }

  return <ErrorPage message="An unknown error occurred" />
}
```

## isRouteErrorResponse

Type guard for route error responses.

### Signature

```ts
function isRouteErrorResponse(value: unknown): value is RouteErrorResponse

interface RouteErrorResponse {
  status: number
  statusText: string
  data: any
}
```

### Example

```tsx
const error = useRouteError()

if (isRouteErrorResponse(error)) {
  // error.status, error.statusText, error.data are available
  console.log(error.status) // 404
}
```

## createRouteErrorResponse

Creates a route error response.

### Signature

```ts
function createRouteErrorResponse(
  status: number,
  statusText: string,
  data?: any
): RouteErrorResponse
```

### Example

```tsx
// In a loader
export const loader = createLoader(async ({ params }) => {
  const post = await db.posts.find(params.id)

  if (!post) {
    throw createRouteErrorResponse(404, 'Not Found', {
      message: `Post ${params.id} not found`
    })
  }

  return { post }
})
```

## useErrorBoundary

Hook for programmatic error boundary control. Provides access to error state and functions to reset or trigger errors.

### Signature

```ts
function useErrorBoundary(): UseErrorBoundaryReturn

interface UseErrorBoundaryReturn {
  // Current error (undefined if no error)
  error: Error | undefined

  // Reset the error boundary
  reset: () => void

  // Programmatically trigger an error in the boundary
  showBoundary: (error: Error) => void
}
```

### Example

```tsx
function DataLoader() {
  const { showBoundary } = useErrorBoundary()

  const loadData = async () => {
    try {
      const data = await fetchData()
      return data
    } catch (error) {
      showBoundary(error)
    }
  }

  return <button onClick={loadData}>Load</button>
}
```

### Reset Boundary

```tsx
function ErrorFallback() {
  const { error, reset } = useErrorBoundary()

  return (
    <div>
      <h1>Error</h1>
      <p>{error?.message}</p>
      <button onClick={reset}>Try Again</button>
    </div>
  )
}
```

## withErrorBoundary

HOC to wrap a component with an error boundary.

### Signature

```ts
function withErrorBoundary<P>(
  Component: ComponentType<P>,
  options?: ErrorBoundaryOptions
): ComponentType<P>
```

### Example

```tsx
const SafeComponent = withErrorBoundary(RiskyComponent, {
  fallback: <div>Error loading component</div>,
  onError: (error) => console.error(error)
})

// Use like normal component
<SafeComponent prop="value" />
```

## RouteError

Custom error class for route errors with HTTP status codes.

### Constructor

```ts
class RouteError extends Error {
  status: number
  statusText: string
  data: unknown

  constructor(status: number, statusText: string, data?: unknown)

  // Convert to RouteErrorResponse
  toResponse(): RouteErrorResponse
}
```

### Example

```tsx
import { RouteError } from '@ereo/client'

// In a loader
export async function loader({ params }) {
  const post = await db.posts.find(params.id)

  if (!post) {
    throw new RouteError(404, 'Not Found', { message: 'Post not found' })
  }

  if (!post.published) {
    throw new RouteError(403, 'Forbidden', { postId: params.id })
  }

  return { post }
}

// Converting to response
const error = new RouteError(404, 'Not Found')
const response = error.toResponse()
// { status: 404, statusText: 'Not Found', data: undefined }
```

## Error Boundary Patterns

### Nested Error Boundaries

```tsx
function App() {
  return (
    <ErrorBoundary fallback={<AppError />}>
      <Layout>
        <ErrorBoundary fallback={<SidebarError />}>
          <Sidebar />
        </ErrorBoundary>

        <ErrorBoundary fallback={<ContentError />}>
          <Content />
        </ErrorBoundary>
      </Layout>
    </ErrorBoundary>
  )
}
```

### Retry on Error

```tsx
function RetryableComponent({ children }) {
  const [key, setKey] = useState(0)

  return (
    <ErrorBoundary
      key={key}
      fallback={(error) => (
        <div>
          <p>{error.message}</p>
          <button onClick={() => setKey(k => k + 1)}>
            Retry
          </button>
        </div>
      )}
    >
      {children}
    </ErrorBoundary>
  )
}
```

### Error Logging

```tsx
function App() {
  const logError = (error: Error, errorInfo: React.ErrorInfo) => {
    // Log to service
    fetch('/api/log-error', {
      method: 'POST',
      body: JSON.stringify({
        error: error.message,
        stack: error.stack,
        componentStack: errorInfo.componentStack
      })
    })
  }

  return (
    <ErrorBoundary
      fallback={<ErrorPage />}
      onError={logError}
    >
      <App />
    </ErrorBoundary>
  )
}
```

### Route Error Page

```tsx
// routes/_error.tsx
export function ErrorBoundary() {
  const error = useRouteError()

  if (isRouteErrorResponse(error)) {
    return (
      <div className="error-page">
        <h1>{error.status}</h1>
        <p>{error.statusText}</p>
        {error.status === 404 && (
          <Link href="/">Go Home</Link>
        )}
      </div>
    )
  }

  return (
    <div className="error-page">
      <h1>Oops!</h1>
      <p>Something went wrong.</p>
      <button onClick={() => window.location.reload()}>
        Reload Page
      </button>
    </div>
  )
}
```

## Related

- [Error Handling Guide](/guides/error-handling)
- [Loaders](/api/data/loaders)
- [Routing](/core-concepts/routing)
