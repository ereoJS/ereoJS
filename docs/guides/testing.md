# Testing

This guide covers testing strategies for EreoJS applications, from unit tests to end-to-end tests.

> **Tip:** The [`@ereo/testing`](/api/testing/) package provides purpose-built utilities like `testLoader()`, `testAction()`, `testMiddleware()`, `createTestServer()`, and more. Install it as a dev dependency to get started:
>
> ```bash
> bun add -D @ereo/testing
> ```

## Setup

EreoJS works with Bun's built-in test runner.

```bash
# Run all tests
bun test

# Run specific file
bun test app/lib/utils.test.ts

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

Loaders are async functions that fetch data for your route components. EreoJS provides two ways to test them.

### Using @ereo/testing (Recommended)

The `testLoader` function creates the mock request, context, and params for you. It also tracks execution time and gives you access to the test context for inspecting side effects like cache operations.

```ts
// routes/posts/[id].test.ts
import { expect, test, describe } from 'bun:test'
import { testLoader, createLoaderTester } from '@ereo/testing'
import { loader } from './[id]'

describe('Post Loader', () => {
  test('returns post data', async () => {
    const result = await testLoader(loader, {
      params: { id: '1' },
    })

    expect(result.data.post).toBeDefined()
    expect(result.data.post.id).toBe(1)
  })

  // Create reusable tester with preset context
  const testWithUser = createLoaderTester(loader, {
    context: { store: { user: { id: '1', role: 'admin' } } },
  })

  test('loads post for authenticated user', async () => {
    const result = await testWithUser({ params: { id: '1' } })
    expect(result.data.canEdit).toBe(true)
  })
})
```

#### Testing Multiple Parameter Combinations

Use `testLoaderMatrix` to test a loader with several different parameter sets at once:

```ts
import { testLoaderMatrix } from '@ereo/testing'

test('handles various post IDs', async () => {
  const results = await testLoaderMatrix(loader, {
    params: [
      { id: '1' },        // Valid post
      { id: '2' },        // Another valid post
      { id: '99999' },    // Non-existent
    ],
  })

  expect(results[0].data.post).toBeDefined()
  expect(results[1].data.post).toBeDefined()
  expect(results[2].data).toBeNull()
})
```

#### Testing Error Handling

Use `testLoaderError` to verify that a loader throws the expected error:

```ts
import { testLoaderError } from '@ereo/testing'

test('throws 404 for non-existent post', async () => {
  const result = await testLoaderError(loader, {
    params: { id: 'non-existent' },
  })

  expect(result.error).toBeDefined()
  expect(result.error.status).toBe(404)
})
```

### Manual Approach

You can also test loaders without the `@ereo/testing` package by constructing the request, params, and context manually. This gives you full control but requires more setup.

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

> **Note:** The manual approach and the `@ereo/testing` approach are both valid. They produce the same result because `testLoader` is a convenience wrapper that constructs the `request`, `params`, and `context` objects for you. Use whichever fits your preference.

## Testing Actions

Actions handle form submissions and mutations. They default to `POST` requests.

### Using @ereo/testing (Recommended)

The `testAction` function automatically defaults the HTTP method to `POST` and accepts `formData` or `body` directly in the options. It also detects redirects and parses JSON responses automatically.

```ts
// routes/posts/new.test.ts
import { expect, test, describe } from 'bun:test'
import { testAction, createActionTester, assertRedirect } from '@ereo/testing'
import { action } from './new'

describe('Create Post Action', () => {
  test('creates post with valid data', async () => {
    const result = await testAction(action, {
      formData: {
        title: 'Test Post',
        content: 'This is test content',
      },
    })

    // Use built-in assertions
    assertRedirect(result.response, '/posts')
  })

  test('returns errors with invalid data', async () => {
    const result = await testAction(action, {
      formData: {
        title: 'AB', // Too short
        content: '',
      },
    })

    expect(result.data.errors).toBeDefined()
    expect(result.data.errors.title).toBeDefined()
  })
})
```

#### Testing Multiple Submissions

Use `testActionMatrix` to verify behavior across several different form submissions:

```ts
import { testActionMatrix } from '@ereo/testing'

test('handles various inputs', async () => {
  const results = await testActionMatrix(action, {
    submissions: [
      { formData: { title: 'Valid Post', content: 'Good content' } },
      { formData: { title: 'AB', content: '' } },       // Invalid
      { body: { title: 'JSON Post', content: 'Body' } }, // JSON body
    ],
  })

  expect(results[0].isRedirect).toBe(true)
  expect(results[1].data.errors).toBeDefined()
  expect(results[2].data.success).toBe(true)
})
```

#### Testing File Uploads

Use `testActionWithFile` for actions that handle file uploads:

```ts
import { testActionWithFile } from '@ereo/testing'

test('uploads avatar', async () => {
  const result = await testActionWithFile(action, {
    params: { id: '1' },
    file: {
      field: 'avatar',
      name: 'photo.png',
      content: 'fake-image-content',
      type: 'image/png',
    },
    extraFields: {
      description: 'Profile photo',
    },
  })

  expect(result.data.url).toContain('photo.png')
})
```

### Manual Approach

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

## Testing Middleware

Middleware functions intercept requests before they reach your route handlers. The `@ereo/testing` package provides utilities that track whether `next()` was called and how many times.

### Testing a Single Middleware

```ts
// middleware/auth.test.ts
import { expect, test, describe } from 'bun:test'
import { testMiddleware, createMiddlewareTester } from '@ereo/testing'
import { authMiddleware } from './auth'

describe('Auth Middleware', () => {
  test('blocks unauthenticated requests', async () => {
    const result = await testMiddleware(authMiddleware, {
      request: { url: '/admin' },
    })

    expect(result.response.status).toBe(401)
    expect(result.nextCalled).toBe(false)
  })

  test('allows authenticated requests', async () => {
    const result = await testMiddleware(authMiddleware, {
      request: {
        url: '/admin',
        headers: { Authorization: 'Bearer valid-token' },
      },
    })

    expect(result.nextCalled).toBe(true)
    expect(result.response.status).toBe(200)
  })
})
```

### Testing Multiple Scenarios

Use `testMiddlewareMatrix` to test a middleware against several different request configurations:

```ts
import { testMiddlewareMatrix } from '@ereo/testing'

test('handles various request types', async () => {
  const results = await testMiddlewareMatrix(authMiddleware, {
    requests: [
      { url: '/public' },                                            // Public route
      { url: '/admin', headers: { Authorization: 'Bearer valid' } }, // Authenticated
      { url: '/admin' },                                             // Missing auth
    ],
  })

  expect(results[0].response.status).toBe(200)
  expect(results[1].response.status).toBe(200)
  expect(results[2].response.status).toBe(401)
})
```

### Testing a Middleware Chain

Use `testMiddlewareChain` to verify that several middleware functions work together correctly:

```ts
import { testMiddlewareChain } from '@ereo/testing'

test('middleware chain passes through', async () => {
  const result = await testMiddlewareChain([
    loggingMiddleware,
    authMiddleware,
    rateLimitMiddleware,
  ], {
    request: {
      url: '/api/data',
      headers: { Authorization: 'Bearer valid' },
    },
  })

  expect(result.response.status).toBe(200)
  // Verify each middleware called next()
  expect(result.middlewareResults[0].nextCalled).toBe(true)
  expect(result.middlewareResults[1].nextCalled).toBe(true)
  expect(result.middlewareResults[2].nextCalled).toBe(true)
})
```

### Testing Context Modifications

Use `testMiddlewareContext` to verify that a middleware sets the expected values in the request context:

```ts
import { testMiddlewareContext } from '@ereo/testing'

test('sets user in context', async () => {
  const result = await testMiddlewareContext(authMiddleware, {
    request: { headers: { Authorization: 'Bearer valid-token' } },
    expectContextValues: {
      user: { id: '1', role: 'admin' },
    },
  })

  expect(result.contextMatches).toBe(true)
})
```

## Testing Components

### Using @ereo/testing

The `renderRoute` function runs a route module's loader (or uses provided mock data) and creates a React element with the correct props. You can then pass the element to your testing library.

```tsx
// routes/posts/index.test.tsx
import { expect, test, describe } from 'bun:test'
import { render, screen } from '@testing-library/react'
import { renderRoute } from '@ereo/testing'
import * as PostsPage from './index'

describe('Posts Page', () => {
  test('renders posts list', async () => {
    const result = await renderRoute(PostsPage, {
      loaderData: {
        posts: [
          { id: 1, title: 'First Post', excerpt: 'Excerpt 1' },
          { id: 2, title: 'Second Post', excerpt: 'Excerpt 2' },
        ],
      },
    })

    const { getByText } = render(result.element)
    expect(getByText('First Post')).toBeDefined()
    expect(getByText('Second Post')).toBeDefined()
  })

  test('shows empty state when no posts', async () => {
    const result = await renderRoute(PostsPage, {
      loaderData: { posts: [] },
    })

    const { getByText } = render(result.element)
    expect(getByText('No posts yet')).toBeDefined()
  })
})
```

#### Smoke Testing Routes

Use `testRouteRenders` as a quick smoke test to verify that a route renders without errors:

```ts
import { testRouteRenders } from '@ereo/testing'
import * as BlogPost from './routes/blog/[slug]'

test('blog post renders without errors', async () => {
  const result = await testRouteRenders(BlogPost, {
    params: { slug: 'test-post' },
  })

  expect(result.renders).toBe(true)
  expect(result.error).toBeNull()
})
```

#### Testing Route Meta Tags

Use `getRouteMeta` to verify that your route's meta function returns the correct SEO tags:

```ts
import { getRouteMeta } from '@ereo/testing'
import * as BlogPost from './routes/blog/[slug]'

test('returns correct meta tags', async () => {
  const meta = await getRouteMeta(BlogPost, {
    params: { slug: 'my-post' },
  })

  expect(meta.find(m => m.title)).toEqual({ title: 'My Post' })
})
```

### Testing Islands

Islands are interactive components that hydrate on the client. Test them like regular React components:

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

You can also use `renderComponent` from `@ereo/testing` to create the element:

```tsx
import { renderComponent } from '@ereo/testing'
import { render, screen } from '@testing-library/react'
import Counter from './Counter'

test('renders counter', () => {
  const element = renderComponent(Counter, { initialCount: 5 })
  const { getByText } = render(element)
  expect(getByText('Count: 5')).toBeDefined()
})
```

## Integration Testing

### Using @ereo/testing (Recommended)

The `createTestServer` function spins up a real EreoJS server on a random port, loads all your route modules, and provides convenient HTTP method helpers. This lets you test the full request/response cycle.

```ts
// integration/api.test.ts
import { expect, test, describe, beforeAll, afterAll } from 'bun:test'
import { createTestServer, assertStatus, extractCookies } from '@ereo/testing'
import type { TestServer } from '@ereo/testing'

describe('Posts API', () => {
  let server: TestServer

  beforeAll(async () => {
    server = await createTestServer({
      routesDir: './app/routes',
    })
  })

  afterAll(async () => {
    await server.stop()
  })

  test('GET /api/posts returns posts', async () => {
    const response = await server.get('/api/posts')
    assertStatus(response, 200)

    const data = await response.json()
    expect(Array.isArray(data)).toBe(true)
  })

  test('POST /api/posts creates a post', async () => {
    const response = await server.post('/api/posts', {
      title: 'Test Post',
      content: 'Test content',
    })
    assertStatus(response, 201)

    const data = await response.json()
    expect(data.id).toBeDefined()
    expect(data.title).toBe('Test Post')
  })

  test('form submission', async () => {
    const response = await server.submitForm('/api/contact', {
      name: 'Test User',
      email: 'test@example.com',
    })
    assertStatus(response, 200)
  })
})
```

### Mocking External APIs

Use `createMockServer` to create a fake API server for testing code that calls external services:

```ts
import { createMockServer } from '@ereo/testing'

describe('with mock API', () => {
  let mockApi: Awaited<ReturnType<typeof createMockServer>>

  beforeAll(async () => {
    mockApi = await createMockServer({
      routes: {
        'GET /users/1': { id: 1, name: 'Alice' },
        'POST /users': (req) => ({ id: 2, ...req.body }),
        'GET /users': [{ id: 1, name: 'Alice' }],
      },
    })

    // Point your app at the mock API
    process.env.API_URL = mockApi.url
  })

  afterAll(async () => {
    await mockApi.stop()
  })

  test('fetches user from external API', async () => {
    const result = await testLoader(loader, {
      params: { id: '1' },
    })
    expect(result.data.user.name).toBe('Alice')
  })
})
```

### Manual Approach

If you prefer not to use the testing package for integration tests, you can use Bun's built-in `fetch` against a running dev server:

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

> **Note:** The manual approach requires a running dev server (`bun dev`). The `createTestServer` approach is self-contained and doesn't need an external process.

## Snapshot Testing

Snapshot tests capture the output of a loader or action and compare it against a saved baseline. The `@ereo/testing` package provides utilities for creating stable snapshots that don't break on dynamic values like timestamps or IDs.

```ts
import { snapshotLoader, snapshotAction, createSnapshotMatrix } from '@ereo/testing'

test('loader snapshot', async () => {
  const snapshot = await snapshotLoader(loader, {
    params: { slug: 'test-post' },
  }, {
    exclude: ['createdAt', 'updatedAt'],
    replacers: { id: '[ID]' },
  })

  expect(snapshot).toMatchSnapshot()
})

test('action snapshot', async () => {
  const snapshot = await snapshotAction(action, {
    formData: { title: 'Test', content: 'Content' },
  }, {
    exclude: ['id', 'createdAt'],
  })

  expect(snapshot).toMatchSnapshot()
})

test('multiple scenarios', async () => {
  const snapshots = await createSnapshotMatrix(loader, {
    scenarios: {
      'featured posts': { params: { featured: 'true' } },
      'recent posts': { params: { sort: 'recent' } },
      'by author': { params: { author: 'test-user' } },
    },
  })

  expect(snapshots).toMatchSnapshot()
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

1. **Test behavior, not implementation** - Focus on what code does, not how it does it
2. **Use realistic test data** - Mirror production scenarios for meaningful tests
3. **Isolate tests** - Each test should be independent; use `createTestContext()` for fresh state
4. **Mock external services** - Use `createMockServer()` instead of depending on live APIs
5. **Test error cases** - Not just happy paths; use `testLoaderError` and `testActionError`
6. **Keep tests fast** - Use in-memory databases and `createTestServer()` for self-contained integration tests
7. **Run tests in CI** - Automate quality checks as part of your deployment pipeline
8. **Use factory functions** - Create reusable testers with `createLoaderTester()` and `createActionTester()` to reduce boilerplate
