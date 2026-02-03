# Navigation

Programmatic navigation API.

## Import

```ts
import {
  navigate,
  goBack,
  goForward,
  onNavigate,
  getNavigationState,
  router
} from '@ereo/client'
```

## navigate

Programmatically navigate to a URL.

### Signature

```ts
function navigate(
  href: string,
  options?: NavigationOptions
): Promise<void>

interface NavigationOptions {
  // Replace history instead of push
  replace?: boolean

  // Scroll behavior
  scroll?: boolean

  // State to pass to the new location
  state?: any
}
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

// Prevent scroll to top
await navigate('/posts#section', { scroll: false })
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
function onNavigate(
  listener: NavigationListener
): () => void

type NavigationListener = (event: NavigationEvent) => void

interface NavigationEvent {
  type: 'start' | 'complete' | 'error'
  url: string
  state?: any
}
```

### Example

```tsx
import { onNavigate } from '@ereo/client'
import { useEffect } from 'react'

function Analytics() {
  useEffect(() => {
    const unsubscribe = onNavigate((event) => {
      if (event.type === 'complete') {
        analytics.pageView(event.url)
      }
    })

    return unsubscribe
  }, [])

  return null
}
```

### Loading Indicator

```tsx
function GlobalLoadingIndicator() {
  const [isNavigating, setIsNavigating] = useState(false)

  useEffect(() => {
    const unsubscribe = onNavigate((event) => {
      if (event.type === 'start') {
        setIsNavigating(true)
      } else {
        setIsNavigating(false)
      }
    })

    return unsubscribe
  }, [])

  if (!isNavigating) return null

  return <div className="loading-bar" />
}
```

## getNavigationState

Get the current navigation state.

### Signature

```ts
function getNavigationState(): NavigationState

interface NavigationState {
  state: 'idle' | 'loading' | 'submitting'
  location?: Location
  formData?: FormData
  formMethod?: string
  formAction?: string
}
```

### Example

```ts
import { getNavigationState } from '@ereo/client'

function checkNavigation() {
  const state = getNavigationState()

  if (state.state === 'loading') {
    console.log('Currently navigating to:', state.location?.pathname)
  }
}
```

## router

The underlying router instance for advanced use cases.

### Properties

```ts
interface Router {
  // Current location
  location: Location

  // Navigation methods
  navigate(href: string, options?: NavigationOptions): Promise<void>
  back(): void
  forward(): void

  // Event subscription
  subscribe(listener: (location: Location) => void): () => void

  // Prefetch
  prefetch(href: string): Promise<void>
}
```

### Example

```ts
import { router } from '@ereo/client'

// Access current location
console.log(router.location.pathname)

// Subscribe to location changes
const unsubscribe = router.subscribe((location) => {
  console.log('Location changed:', location.pathname)
})

// Prefetch a route
await router.prefetch('/posts')
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

### Confirmation Before Leave

```tsx
import { onNavigate } from '@ereo/client'

function UnsavedChangesWarning({ hasChanges }) {
  useEffect(() => {
    if (!hasChanges) return

    const unsubscribe = onNavigate((event) => {
      if (event.type === 'start') {
        if (!confirm('You have unsaved changes. Leave anyway?')) {
          event.preventDefault?.()
        }
      }
    })

    return unsubscribe
  }, [hasChanges])

  return null
}
```

### Scroll Restoration

```tsx
import { onNavigate } from '@ereo/client'

function ScrollRestoration() {
  const scrollPositions = useRef(new Map())

  useEffect(() => {
    const unsubscribe = onNavigate((event) => {
      if (event.type === 'start') {
        // Save scroll position
        scrollPositions.current.set(
          location.pathname,
          window.scrollY
        )
      }

      if (event.type === 'complete') {
        // Restore scroll position
        const savedPosition = scrollPositions.current.get(event.url)
        if (savedPosition !== undefined) {
          window.scrollTo(0, savedPosition)
        }
      }
    })

    return unsubscribe
  }, [])

  return null
}
```

### Route Change Animation

```tsx
import { onNavigate } from '@ereo/client'

function PageTransition({ children }) {
  const [isTransitioning, setIsTransitioning] = useState(false)

  useEffect(() => {
    const unsubscribe = onNavigate((event) => {
      if (event.type === 'start') {
        setIsTransitioning(true)
      }
      if (event.type === 'complete') {
        setTimeout(() => setIsTransitioning(false), 300)
      }
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

## Related

- [Link Component](/api/client/link)
- [Prefetch](/api/client/prefetch)
- [useNavigation Hook](/api/client/hooks#usenavigation)
- [Routing](/core-concepts/routing)
