# Navigation

Programmatic navigation API for client-side SPA navigation.

## Import

```ts
import {
  navigate,
  goBack,
  goForward,
  onNavigate,
  getNavigationState,
  fetchLoaderData,
  submitAction,
  setupScrollRestoration,
  router
} from '@ereo/client'
```

## Types

```ts
interface NavigationState {
  pathname: string
  search: string
  hash: string
  state?: unknown
}

interface NavigationEvent {
  type: 'push' | 'replace' | 'pop'
  from: NavigationState
  to: NavigationState
}

type NavigationListener = (event: NavigationEvent) => void
```

## navigate

Programmatically navigate to a URL.

### Signature

```ts
function navigate(
  to: string,
  options?: {
    replace?: boolean
    state?: unknown
    viewTransition?: boolean | ViewTransitionOptions
  }
): Promise<void>
```

### Examples

```ts
import { navigate } from '@ereo/client'

// Basic navigation
await navigate('/posts')

// Replace history entry
await navigate('/posts', { replace: true })

// With state
await navigate('/posts', {
  state: { from: 'search', query: 'react' }
})

// With view transition animation
await navigate('/posts', { viewTransition: true })
```

### In Event Handlers

```tsx
function SearchForm() {
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    const query = new FormData(e.target).get('q')
    await navigate(`/search?q=${encodeURIComponent(query)}`)
  }

  return (
    <form onSubmit={handleSubmit}>
      <input name="q" />
      <button type="submit">Search</button>
    </form>
  )
}
```

### After Actions

```tsx
async function handleDelete(postId: string) {
  await fetch(`/api/posts/${postId}`, { method: 'DELETE' })
  await navigate('/posts', { replace: true })
}
```

## goBack

Navigate back in history.

### Signature

```ts
function goBack(): void
```

### Example

```tsx
import { goBack } from '@ereo/client'

function BackButton() {
  return (
    <button onClick={goBack}>
      ← Back
    </button>
  )
}
```

## goForward

Navigate forward in history.

### Signature

```ts
function goForward(): void
```

### Example

```tsx
import { goForward } from '@ereo/client'

function ForwardButton() {
  return (
    <button onClick={goForward}>
      Forward →
    </button>
  )
}
```

## onNavigate

Subscribe to navigation events.

### Signature

```ts
function onNavigate(listener: NavigationListener): () => void

type NavigationListener = (event: NavigationEvent) => void

interface NavigationEvent {
  type: 'push' | 'replace' | 'pop'
  from: NavigationState
  to: NavigationState
}
```

### Example

```tsx
import { onNavigate } from '@ereo/client'
import { useEffect } from 'react'

function Analytics() {
  useEffect(() => {
    const unsubscribe = onNavigate((event) => {
      // Track page views
      analytics.pageView(event.to.pathname)
    })

    return unsubscribe
  }, [])

  return null
}
```

### Track Navigation Direction

```tsx
function NavigationTracker() {
  useEffect(() => {
    const unsubscribe = onNavigate((event) => {
      if (event.type === 'pop') {
        console.log('Browser back/forward navigation')
      } else if (event.type === 'push') {
        console.log('Navigation to new page')
      } else if (event.type === 'replace') {
        console.log('History replacement')
      }
    })

    return unsubscribe
  }, [])

  return null
}
```

## getNavigationState

Get the current navigation state.

### Signature

```ts
function getNavigationState(): NavigationState

interface NavigationState {
  pathname: string
  search: string
  hash: string
  state?: unknown
}
```

### Example

```ts
import { getNavigationState } from '@ereo/client'

function checkNavigation() {
  const state = getNavigationState()
  console.log('Current path:', state.pathname)
  console.log('Search params:', state.search)
  console.log('Hash:', state.hash)
}
```

## router

The global client router instance for advanced use cases.

### Methods

```ts
interface ClientRouter {
  // Navigate to a new URL
  navigate(to: string, options?: { replace?: boolean; state?: unknown; viewTransition?: boolean | ViewTransitionOptions }): Promise<void>

  // Go back in history
  back(): void

  // Go forward in history
  forward(): void

  // Go to a specific history entry
  go(delta: number): void

  // Subscribe to navigation events
  subscribe(listener: NavigationListener): () => void

  // Get current state
  getState(): NavigationState

  // Check if a URL is active
  isActive(path: string, exact?: boolean): boolean
}
```

### Example

```ts
import { router } from '@ereo/client'

// Get current state
const state = router.getState()
console.log('Current path:', state.pathname)

// Subscribe to location changes
const unsubscribe = router.subscribe((event) => {
  console.log('Navigated to:', event.to.pathname)
})

// Check if path is active
const isPostsActive = router.isActive('/posts')
const isExactMatch = router.isActive('/posts', true)
```

## fetchLoaderData

Fetch loader data for a route programmatically.

### Signature

```ts
function fetchLoaderData<T = unknown>(
  pathname: string,
  params?: Record<string, string | undefined>
): Promise<T>
```

### Example

```ts
import { fetchLoaderData } from '@ereo/client'

// Fetch data for a route
const data = await fetchLoaderData<{ posts: Post[] }>('/posts')

// Fetch with params
const userData = await fetchLoaderData<{ user: User }>('/users', {
  id: '123'
})
```

## submitAction

Submit an action programmatically.

### Signature

```ts
function submitAction<T = unknown>(
  pathname: string,
  formData: FormData,
  options?: { method?: string }
): Promise<T>
```

### Example

```ts
import { submitAction } from '@ereo/client'

const formData = new FormData()
formData.append('title', 'New Post')
formData.append('content', 'Post content')

const result = await submitAction('/posts/create', formData, {
  method: 'POST'
})
```

## setupScrollRestoration

Setup scroll restoration for SPA navigation.

### Signature

```ts
function setupScrollRestoration(): void
```

This function:
- Disables browser's default scroll restoration
- Stores scroll positions per pathname
- Restores scroll position on back/forward navigation
- Scrolls to top on push/replace navigation

### Example

```ts
import { setupScrollRestoration } from '@ereo/client'

// Usually called by initClient(), but can be called manually
setupScrollRestoration()
```

## Patterns

### Protected Navigation

```tsx
import { navigate } from '@ereo/client'

function useProtectedNavigation() {
  const { hasUnsavedChanges } = useFormState()

  const protectedNavigate = async (href: string) => {
    if (hasUnsavedChanges) {
      const confirmed = window.confirm('Discard unsaved changes?')
      if (!confirmed) return
    }
    await navigate(href)
  }

  return protectedNavigate
}
```

### Route Change Animation

```tsx
import { onNavigate } from '@ereo/client'

function PageTransition({ children }) {
  const [isTransitioning, setIsTransitioning] = useState(false)

  useEffect(() => {
    const unsubscribe = onNavigate((event) => {
      setIsTransitioning(true)
      // Reset after animation
      setTimeout(() => setIsTransitioning(false), 300)
    })

    return unsubscribe
  }, [])

  return (
    <div className={isTransitioning ? 'fade-out' : 'fade-in'}>
      {children}
    </div>
  )
}
```

### Custom Scroll Behavior

```tsx
import { onNavigate } from '@ereo/client'
import { useRef, useEffect } from 'react'

function CustomScrollRestoration() {
  const scrollPositions = useRef(new Map<string, number>())

  useEffect(() => {
    const unsubscribe = onNavigate((event) => {
      // Save scroll position before leaving
      scrollPositions.current.set(event.from.pathname, window.scrollY)

      // Restore scroll position on back/forward
      if (event.type === 'pop') {
        const savedPosition = scrollPositions.current.get(event.to.pathname)
        if (savedPosition !== undefined) {
          requestAnimationFrame(() => {
            window.scrollTo(0, savedPosition)
          })
        }
      }
    })

    return unsubscribe
  }, [])

  return null
}
```

## Related

- [Link Component](/api/client/link)
- [Prefetch](/api/client/prefetch)
- [useNavigation Hook](/api/client/hooks#usenavigation)
- [Routing](/concepts/routing)
