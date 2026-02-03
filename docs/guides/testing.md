# Testing

This guide covers testing strategies for EreoJS applications.

## Setup

EreoJS works with Bun's built-in test runner.

```bash
# Run all tests
bun test

# Run specific file
bun test src/lib/utils.test.ts

# Watch mode
bun test --watch
```

## Unit Testing

### Testing Utility Functions

```ts
// lib/utils.test.ts
import { expect, test, describe } from 'bun:test'
import { slugify, formatDate, truncate } from './utils'

describe('slugify', () => {
  test('converts to lowercase', () => {
    expect(slugify('Hello World')).toBe('hello-world')
  })

  test('removes special characters', () => {
    expect(slugify('Hello! World?')).toBe('hello-world')
  })

  test('handles multiple spaces', () => {
    expect(slugify('Hello    World')).toBe('hello-world')
  })
})

describe('formatDate', () => {
  test('formats date correctly', () => {
    const date = new Date('2024-01-15')
    expect(formatDate(date)).toBe('January 15, 2024')
  })
})

describe('truncate', () => {
  test('truncates long text', () => {
    const text = 'This is a very long text that needs truncating'
    expect(truncate(text, 20)).toBe('This is a very long...')
  })

  test('leaves short text unchanged', () => {
    expect(truncate('Short', 20)).toBe('Short')
  })
})
```

### Testing Database Functions

```ts
// lib/repositories/posts.test.ts
import { expect, test, describe, beforeAll, afterAll } from 'bun:test'
import Database from 'better-sqlite3'
import { createPostsRepository } from './posts'

describe('Posts Repository', () => {
  let db: Database.Database
  let posts: ReturnType<typeof createPostsRepository>

  beforeAll(() => {
    // Use in-memory database for tests
    db = new Database(':memory:')
    db.exec(`
      CREATE TABLE posts (
        id INTEGER PRIMARY KEY,
        title TEXT NOT NULL,
        content TEXT NOT NULL
      )
    `)
    posts = createPostsRepository(db)
  })

  afterAll(() => {
    db.close()
  })

  test('creates a post', () => {
    const id = posts.create({ title: 'Test', content: 'Content' })
    expect(id).toBeGreaterThan(0)
  })

  test('finds a post by id', () => {
    const id = posts.create({ title: 'Find Me', content: 'Content' })
    const post = posts.findById(id)
    expect(post?.title).toBe('Find Me')
  })

  test('returns undefined for non-existent post', () => {
    const post = posts.findById(99999)
    expect(post).toBeUndefined()
  })
})
```

## Testing Loaders

```ts
// routes/posts/[id].test.ts
import { expect, test, describe } from 'bun:test'
import { loader } from './[id]'

describe('Post Loader', () => {
  test('returns post data', async () => {
    const request = new Request('http://localhost/posts/1')
    const params = { id: '1' }
    const context = new Map()

    const result = await loader({ request, params, context })

    expect(result.post).toBeDefined()
    expect(result.post.id).toBe(1)
  })

  test('throws 404 for non-existent post', async () => {
    const request = new Request('http://localhost/posts/99999')
    const params = { id: '99999' }
    const context = new Map()

    await expect(
      loader({ request, params, context })
    ).rejects.toThrow()
  })
})
```

## Testing Actions

```ts
// routes/posts/new.test.ts
import { expect, test, describe } from 'bun:test'
import { action } from './new'

describe('Create Post Action', () => {
  test('creates post with valid data', async () => {
    const formData = new FormData()
    formData.append('title', 'Test Post')
    formData.append('content', 'This is test content')

    const request = new Request('http://localhost/posts/new', {
      method: 'POST',
      body: formData
    })

    const result = await action({ request, params: {}, context: new Map() })

    // Should redirect on success
    expect(result.status).toBe(302)
  })

  test('returns errors with invalid data', async () => {
    const formData = new FormData()
    formData.append('title', 'AB') // Too short
    formData.append('content', '')

    const request = new Request('http://localhost/posts/new', {
      method: 'POST',
      body: formData
    })

    const result = await action({ request, params: {}, context: new Map() })

    expect(result.errors).toBeDefined()
    expect(result.errors.title).toBeDefined()
    expect(result.errors.content).toBeDefined()
  })
})
```

## Testing Components

### Setup Test Utilities

```tsx
// test/utils.tsx
import { render } from '@testing-library/react'
import {
  LoaderDataProvider,
  ActionDataProvider,
  NavigationProvider
} from '@ereo/client'

export function renderWithProviders(
  ui: React.ReactElement,
  {
    loaderData = {},
    actionData = undefined,
    navigation = { state: 'idle' }
  } = {}
) {
  return render(
    <LoaderDataProvider value={loaderData}>
      <ActionDataProvider value={actionData}>
        <NavigationProvider value={navigation}>
          {ui}
        </NavigationProvider>
      </ActionDataProvider>
    </LoaderDataProvider>
  )
}
```

### Testing Route Components

```tsx
// routes/posts/index.test.tsx
import { expect, test, describe } from 'bun:test'
import { screen } from '@testing-library/react'
import { renderWithProviders } from '../../test/utils'
import PostsPage from './index'

describe('Posts Page', () => {
  test('renders posts list', () => {
    const posts = [
      { id: 1, title: 'First Post', excerpt: 'Excerpt 1' },
      { id: 2, title: 'Second Post', excerpt: 'Excerpt 2' }
    ]

    renderWithProviders(<PostsPage />, {
      loaderData: { posts }
    })

    expect(screen.getByText('First Post')).toBeDefined()
    expect(screen.getByText('Second Post')).toBeDefined()
  })

  test('shows empty state when no posts', () => {
    renderWithProviders(<PostsPage />, {
      loaderData: { posts: [] }
    })

    expect(screen.getByText('No posts yet')).toBeDefined()
  })
})
```

### Testing Islands

```tsx
// islands/Counter.test.tsx
import { expect, test, describe } from 'bun:test'
import { render, screen, fireEvent } from '@testing-library/react'
import Counter from './Counter'

describe('Counter Island', () => {
  test('renders with initial count', () => {
    render(<Counter initialCount={5} />)
    expect(screen.getByText('Count: 5')).toBeDefined()
  })

  test('increments on click', () => {
    render(<Counter initialCount={0} />)

    const button = screen.getByRole('button')
    fireEvent.click(button)

    expect(screen.getByText('Count: 1')).toBeDefined()
  })
})
```

## Integration Testing

### Testing API Routes

```ts
// routes/api/posts.test.ts
import { expect, test, describe } from 'bun:test'

const BASE_URL = 'http://localhost:3000'

describe('Posts API', () => {
  test('GET /api/posts returns posts', async () => {
    const response = await fetch(`${BASE_URL}/api/posts`)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(Array.isArray(data)).toBe(true)
  })

  test('POST /api/posts creates a post', async () => {
    const response = await fetch(`${BASE_URL}/api/posts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'Test Post',
        content: 'Test content'
      })
    })

    expect(response.status).toBe(201)

    const data = await response.json()
    expect(data.id).toBeDefined()
    expect(data.title).toBe('Test Post')
  })
})
```

## E2E Testing with Playwright

### Setup

```bash
bun add -d @playwright/test
bunx playwright install
```

### Configuration

```ts
// playwright.config.ts
import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  webServer: {
    command: 'bun dev',
    port: 3000,
    reuseExistingServer: !process.env.CI
  }
})
```

### E2E Tests

```ts
// e2e/blog.spec.ts
import { test, expect } from '@playwright/test'

test.describe('Blog', () => {
  test('can view posts list', async ({ page }) => {
    await page.goto('/')
    await page.click('text=Posts')

    await expect(page).toHaveURL('/posts')
    await expect(page.locator('h1')).toContainText('All Posts')
  })

  test('can create a new post', async ({ page }) => {
    await page.goto('/posts/new')

    await page.fill('input[name="title"]', 'E2E Test Post')
    await page.fill('textarea[name="content"]', 'This is test content')
    await page.click('button[type="submit"]')

    // Should redirect to new post
    await expect(page).toHaveURL(/\/posts\/e2e-test-post/)
    await expect(page.locator('h1')).toContainText('E2E Test Post')
  })

  test('shows validation errors', async ({ page }) => {
    await page.goto('/posts/new')

    await page.fill('input[name="title"]', 'AB')
    await page.click('button[type="submit"]')

    await expect(page.locator('.error')).toBeVisible()
  })
})
```

## Test Configuration

```json
// package.json
{
  "scripts": {
    "test": "bun test",
    "test:watch": "bun test --watch",
    "test:e2e": "playwright test",
    "test:coverage": "bun test --coverage"
  }
}
```

## Best Practices

1. **Test behavior, not implementation** - Focus on what code does
2. **Use realistic test data** - Mirror production scenarios
3. **Isolate tests** - Each test should be independent
4. **Mock external services** - Don't depend on APIs
5. **Test error cases** - Not just happy paths
6. **Keep tests fast** - Use in-memory databases
7. **Run tests in CI** - Automate quality checks
