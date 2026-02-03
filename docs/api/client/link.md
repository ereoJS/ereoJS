# Link

Components for client-side navigation.

## Import

```ts
import { Link, NavLink, useIsActive } from '@ereo/client'
```

## Link

A component for client-side navigation that enhances standard anchor tags.

### Props

```ts
interface LinkProps extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
  // The URL to navigate to
  href: string

  // Prefetch strategy
  prefetch?: 'none' | 'intent' | 'render' | 'viewport'

  // Replace history instead of push
  replace?: boolean

  // Scroll to top on navigation
  scroll?: boolean

  // State to pass to the new location
  state?: any
}
```

### Basic Usage

```tsx
import { Link } from '@ereo/client'

export default function Navigation() {
  return (
    <nav>
      <Link href="/">Home</Link>
      <Link href="/about">About</Link>
      <Link href="/posts">Posts</Link>
    </nav>
  )
}
```

### With Prefetching

```tsx
// Prefetch on hover/focus
<Link href="/posts/123" prefetch="intent">
  Read Post
</Link>

// Prefetch when link renders
<Link href="/dashboard" prefetch="render">
  Dashboard
</Link>

// Prefetch when visible in viewport
<Link href="/contact" prefetch="viewport">
  Contact
</Link>

// No prefetching
<Link href="/external" prefetch="none">
  External Link
</Link>
```

### Replace History

```tsx
// Replace current history entry instead of pushing
<Link href="/step-2" replace>
  Next Step
</Link>
```

### With State

```tsx
<Link
  href="/posts"
  state={{ from: 'search', query: 'react' }}
>
  Back to Results
</Link>

// Access in the target route
const location = useLocation()
console.log(location.state.from) // 'search'
```

### Scroll Behavior

```tsx
// Prevent scrolling to top
<Link href="/posts#comments" scroll={false}>
  Jump to Comments
</Link>
```

### External Links

Link automatically detects external URLs and renders a standard anchor:

```tsx
// Renders as regular <a> with target="_blank"
<Link href="https://github.com">
  GitHub
</Link>
```

### Styling

```tsx
<Link href="/posts" className="nav-link">
  Posts
</Link>

<Link
  href="/posts"
  style={{ color: 'blue', fontWeight: 'bold' }}
>
  Posts
</Link>
```

## NavLink

A Link variant that knows when it's active.

### Props

```ts
interface NavLinkProps extends LinkProps {
  // Class name when active (string or function)
  className?: string | ((props: { isActive: boolean }) => string)

  // Style when active
  style?: CSSProperties | ((props: { isActive: boolean }) => CSSProperties)

  // Match end of URL only
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
        href="/"
        className={({ isActive }) => isActive ? 'active' : ''}
        end
      >
        Home
      </NavLink>

      <NavLink
        href="/posts"
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
  href="/dashboard"
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
  href="/settings"
  style={({ isActive }) => ({
    fontWeight: isActive ? 'bold' : 'normal',
    color: isActive ? 'blue' : 'inherit'
  })}
>
  Settings
</NavLink>
```

### End Matching

By default, NavLink is active when the URL starts with the href. Use `end` to match exactly:

```tsx
// Active only on "/" exactly
<NavLink href="/" end>
  Home
</NavLink>

// Active on "/posts", "/posts/123", "/posts/new", etc.
<NavLink href="/posts">
  Posts
</NavLink>

// Active only on "/posts" exactly
<NavLink href="/posts" end>
  All Posts
</NavLink>
```

### Custom Active Logic

```tsx
import { NavLink, useIsActive } from '@ereo/client'

function CustomNavLink({ href, children }) {
  const isActive = useIsActive(href, { exact: true })

  return (
    <Link
      href={href}
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

Hook to check if a path is active.

### Signature

```ts
function useIsActive(
  to: string,
  options?: { exact?: boolean }
): boolean
```

### Example

```tsx
import { useIsActive } from '@ereo/client'

function Sidebar() {
  const isPostsActive = useIsActive('/posts')
  const isSettingsActive = useIsActive('/settings', { exact: true })

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
          <li key={item.href} className="flex items-center gap-2">
            {index > 0 && <span>/</span>}
            {index === items.length - 1 ? (
              <span aria-current="page">{item.label}</span>
            ) : (
              <Link href={item.href}>{item.label}</Link>
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
          key={tab.href}
          href={tab.href}
          role="tab"
          className={({ isActive }) =>
            `tab ${isActive ? 'tab-active' : ''}`
          }
          aria-selected={({ isActive }) => isActive}
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
        href="/"
        onClick={onClose}
        className={({ isActive }) => isActive ? 'active' : ''}
      >
        Home
      </NavLink>
      <NavLink
        href="/posts"
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
function ConditionalLink({ href, disabled, children }) {
  if (disabled) {
    return (
      <span className="text-gray-400 cursor-not-allowed">
        {children}
      </span>
    )
  }

  return <Link href={href}>{children}</Link>
}
```

## Related

- [Navigation](/api/client/navigation)
- [Prefetch](/api/client/prefetch)
- [Routing](/core-concepts/routing)
