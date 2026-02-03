# Error Handling

Ereo provides multiple ways to handle errors gracefully.

## Throwing Errors in Loaders

Throw a `Response` to show error pages:

```tsx
export const loader = createLoader(async ({ params }) => {
  const post = await db.posts.find(params.id)

  if (!post) {
    throw new Response('Not Found', { status: 404 })
  }

  if (!post.published) {
    throw new Response('Post not available', { status: 403 })
  }

  return { post }
})
```

## Route Error Boundaries

Create `_error.tsx` files to handle errors:

```tsx
// routes/posts/_error.tsx
import { useRouteError, isRouteErrorResponse } from '@ereo/client'
import { Link } from '@ereo/client'

export default function PostsError() {
  const error = useRouteError()

  if (isRouteErrorResponse(error)) {
    switch (error.status) {
      case 404:
        return (
          <div>
            <h1>Post Not Found</h1>
            <p>The post you're looking for doesn't exist.</p>
            <Link href="/posts">View all posts</Link>
          </div>
        )
      case 403:
        return (
          <div>
            <h1>Access Denied</h1>
            <p>You don't have permission to view this post.</p>
          </div>
        )
      default:
        return (
          <div>
            <h1>Error {error.status}</h1>
            <p>{error.statusText}</p>
          </div>
        )
    }
  }

  // Unknown error
  return (
    <div>
      <h1>Something Went Wrong</h1>
      <p>An unexpected error occurred.</p>
    </div>
  )
}
```

## Error Boundary Nesting

Error boundaries cascade up the route tree:

```
routes/
├── _error.tsx         # Catches errors from all routes
├── _layout.tsx
├── index.tsx
└── posts/
    ├── _error.tsx     # Catches errors from /posts/*
    ├── index.tsx
    └── [id].tsx
```

If `/posts/123` throws and `posts/_error.tsx` exists, it handles the error.
Otherwise, the root `_error.tsx` handles it.

## Component Error Boundaries

Use `ErrorBoundary` for component-level errors:

```tsx
import { ErrorBoundary } from '@ereo/client'

function App() {
  return (
    <div>
      <Header />

      <ErrorBoundary fallback={<p>Widget failed to load</p>}>
        <RiskyWidget />
      </ErrorBoundary>

      <Footer />
    </div>
  )
}
```

## Error Boundary with Reset

```tsx
import { ErrorBoundary, useErrorBoundary } from '@ereo/client'

function ErrorFallback() {
  const { error, resetBoundary } = useErrorBoundary()

  return (
    <div>
      <h2>Error</h2>
      <p>{error?.message}</p>
      <button onClick={resetBoundary}>Try Again</button>
    </div>
  )
}

function App() {
  return (
    <ErrorBoundary fallback={<ErrorFallback />}>
      <Content />
    </ErrorBoundary>
  )
}
```

## Action Error Handling

Handle errors in actions:

```tsx
export const action = createAction(async ({ request }) => {
  try {
    const formData = await request.formData()
    await db.posts.create(Object.fromEntries(formData))
    return redirect('/posts')
  } catch (error) {
    if (error instanceof ValidationError) {
      return { error: error.message, fields: error.fields }
    }

    // Re-throw unexpected errors
    throw error
  }
})
```

## Global Error Handling

Add global error handling in your app:

```tsx
// routes/_layout.tsx
export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        <ErrorBoundary
          fallback={<GlobalErrorFallback />}
          onError={(error, errorInfo) => {
            // Log to error tracking service
            logError(error, errorInfo)
          }}
        >
          {children}
        </ErrorBoundary>
      </body>
    </html>
  )
}
```

## Error Logging

Log errors to a service:

```tsx
function logError(error: Error, errorInfo: React.ErrorInfo) {
  fetch('/api/log-error', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      url: window.location.href,
      timestamp: new Date().toISOString()
    })
  })
}
```

## API Error Responses

For API routes, return proper error responses:

```tsx
// routes/api/posts.ts
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const post = await db.posts.create(body)
    return Response.json(post, { status: 201 })
  } catch (error) {
    if (error instanceof ValidationError) {
      return Response.json(
        { error: error.message, fields: error.fields },
        { status: 400 }
      )
    }

    console.error('Failed to create post:', error)
    return Response.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
```

## Best Practices

1. **Be specific with error messages** - Help users understand what went wrong
2. **Provide recovery options** - Give users a way to try again or navigate away
3. **Log unexpected errors** - Track errors for debugging
4. **Don't expose internals** - Show user-friendly messages, log technical details
5. **Test error states** - Verify error boundaries work as expected
