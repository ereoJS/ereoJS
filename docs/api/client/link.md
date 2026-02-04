# Link

Components for client-side navigation.

## Import

```ts
import { Link, NavLink, useIsActive } from '@ereo/client'
```

## Link

A component for client-side navigation that renders an anchor tag for accessibility and SEO while intercepting clicks for client-side navigation.

### Props

```ts
interface LinkProps extends Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> {
  // URL to navigate to
  to: string

  // Prefetch strategy (default: 'intent')
  prefetch?: 'none' | 'intent' | 'render' | 'viewport'

  // Replace history instead of push
  replace?: boolean

  // Prevent scroll reset after navigation
  preventScrollReset?: boolean

  // State to pass to the new location
  state?: unknown

  // Reload the document instead of client navigation
  reloadDocument?: boolean

  // Children elements
  children?: React.ReactNode
}
```

### Basic Usage

```tsx
import { Link } from '@ereo/client'

export default function Navigation() {
  return (
    <nav>
      <Link to="/">Home</Link>
      <Link to="/about">About</Link>
      <Link to="/posts">Posts</Link>
    </nav>
  )
}
```

### With Prefetching

```tsx
// Prefetch on hover/focus (default behavior)
<Link to="/posts/123" prefetch="intent">
  Read Post
</Link>

// Prefetch when link renders
<Link to="/dashboard" prefetch="render">
  Dashboard
</Link>

// Prefetch when visible in viewport
<Link to="/contact" prefetch="viewport">
  Contact
</Link>

// No prefetching
<Link to="/external" prefetch="none">
  External Link
</Link>
```

### Replace History

```tsx
// Replace current history entry instead of pushing
<Link to="/step-2" replace>
  Next Step
</Link>
```

### With State

```tsx
<Link
  to="/posts"
  state={{ from: 'search', query: 'react' }}
>
  Back to Results
</Link>
```

### Prevent Scroll Reset

```tsx
// Prevent scrolling to top after navigation
<Link to="/posts#comments" preventScrollReset>
  Jump to Comments
</Link>
```

### Reload Document

Force a full page reload instead of client-side navigation:

```tsx
<Link to="/legacy-page" reloadDocument>
  Legacy Page
</Link>
```

### External Links

Link automatically detects external URLs and uses standard anchor behavior:

```tsx
// External URLs navigate normally without client-side routing
<Link to="https://github.com">
  GitHub
</Link>
```

### Styling

```tsx
<Link to="/posts" className="nav-link">
  Posts
</Link>

<Link
  to="/posts"
  style={{ color: 'blue', fontWeight: 'bold' }}
>
  Posts
</Link>
```

## NavLink

A Link variant that provides active state for styling navigation links.

### Props

```ts
interface NavLinkActiveProps {
  isActive: boolean
  isPending: boolean
}

interface NavLinkProps extends Omit<LinkProps, 'className' | 'style'> {
  // Class name - can be a function that receives active state
  className?: string | ((props: NavLinkActiveProps) => string)

  // Style - can be a function that receives active state
  style?: React.CSSProperties | ((props: NavLinkActiveProps) => React.CSSProperties)

  // Match exact path only (default: false)
  end?: boolean
}
```

### Basic Usage

```tsx
import { NavLink } from '@ereo/client'

export default function Navigation() {
  return (
    <nav>
      <NavLink
        to="/"
        className={({ isActive }) => isActive ? 'active' : ''}
        end
      >
        Home
      </NavLink>

      <NavLink
        to="/posts"
        className={({ isActive }) => isActive ? 'active' : ''}
      >
        Posts
      </NavLink>
    </nav>
  )
}
```

### With Tailwind CSS

```tsx
<NavLink
  to="/dashboard"
  className={({ isActive }) =>
    `px-4 py-2 rounded ${isActive
      ? 'bg-blue-500 text-white'
      : 'text-gray-600 hover:bg-gray-100'
    }`
  }
>
  Dashboard
</NavLink>
```

### Dynamic Styles

```tsx
<NavLink
  to="/settings"
  style={({ isActive }) => ({
    fontWeight: isActive ? 'bold' : 'normal',
    color: isActive ? 'blue' : 'inherit'
  })}
>
  Settings
</NavLink>
```

### End Matching

By default, NavLink is active when the URL starts with the `to` path. Use `end` to match exactly:

```tsx
// Active only on "/" exactly
<NavLink to="/" end>
  Home
</NavLink>

// Active on "/posts", "/posts/123", "/posts/new", etc.
<NavLink to="/posts">
  Posts
</NavLink>

// Active only on "/posts" exactly
<NavLink to="/posts" end>
  All Posts
</NavLink>
```

### Custom Active Logic

```tsx
import { Link, useIsActive } from '@ereo/client'

function CustomNavLink({ to, children }) {
  const isActive = useIsActive(to, true) // true = end matching

  return (
    <Link
      to={to}
      className={isActive ? 'active' : ''}
      aria-current={isActive ? 'page' : undefined}
    >
      {isActive && <span className="indicator" />}
      {children}
    </Link>
  )
}
```

## useIsActive

Hook to check if a path is currently active.

### Signature

```ts
function useIsActive(path: string, end?: boolean): boolean
```

### Parameters

- `path` - The path to check against current location
- `end` - If `true`, match exactly. If `false` (default), match if current path starts with the given path

### Example

```tsx
import { useIsActive } from '@ereo/client'

function Sidebar() {
  const isPostsActive = useIsActive('/posts')       // matches /posts, /posts/123, etc.
  const isSettingsActive = useIsActive('/settings', true)  // matches only /settings

  return (
    <aside>
      <div className={isPostsActive ? 'section-active' : ''}>
        <h3>Posts</h3>
        <nav>...</nav>
      </div>

      <div className={isSettingsActive ? 'section-active' : ''}>
        <h3>Settings</h3>
        <nav>...</nav>
      </div>
    </aside>
  )
}
```

## Patterns

### Breadcrumbs

```tsx
function Breadcrumbs({ items }) {
  return (
    <nav aria-label="Breadcrumb">
      <ol className="flex gap-2">
        {items.map((item, index) => (
          <li key={item.to} className="flex items-center gap-2">
            {index > 0 && <span>/</span>}
            {index === items.length - 1 ? (
              <span aria-current="page">{item.label}</span>
            ) : (
              <Link to={item.to}>{item.label}</Link>
            )}
          </li>
        ))}
      </ol>
    </nav>
  )
}
```

### Tab Navigation

```tsx
function Tabs({ tabs }) {
  return (
    <div className="tabs" role="tablist">
      {tabs.map(tab => (
        <NavLink
          key={tab.to}
          to={tab.to}
          role="tab"
          className={({ isActive }) =>
            `tab ${isActive ? 'tab-active' : ''}`
          }
        >
          {tab.label}
        </NavLink>
      ))}
    </div>
  )
}
```

### Mobile Menu

```tsx
function MobileMenu({ isOpen, onClose }) {
  return (
    <nav className={`mobile-menu ${isOpen ? 'open' : ''}`}>
      <NavLink
        to="/"
        onClick={onClose}
        className={({ isActive }) => isActive ? 'active' : ''}
      >
        Home
      </NavLink>
      <NavLink
        to="/posts"
        onClick={onClose}
        className={({ isActive }) => isActive ? 'active' : ''}
      >
        Posts
      </NavLink>
    </nav>
  )
}
```

### Disabled Link

```tsx
function ConditionalLink({ to, disabled, children }) {
  if (disabled) {
    return (
      <span className="text-gray-400 cursor-not-allowed">
        {children}
      </span>
    )
  }

  return <Link to={to}>{children}</Link>
}
```

## PrefetchStrategy Type

```ts
type PrefetchStrategy = 'none' | 'intent' | 'render' | 'viewport'
```

| Strategy | Description |
|----------|-------------|
| `none` | No prefetching |
| `intent` | Prefetch on hover/focus (default) |
| `render` | Prefetch when link renders |
| `viewport` | Prefetch when link enters viewport |

## Related

- [Navigation](/api/client/navigation)
- [Prefetch](/api/client/prefetch)
- [Routing](/core-concepts/routing)
