# Testing Utilities

The `@ereo/testing` package provides comprehensive utilities for testing EreoJS applications, including loaders, actions, middleware, and components.

## Import

```ts
import {
  // Test Context
  createTestContext,
  createContextFactory,

  // Loader Testing
  testLoader,
  createLoaderTester,
  testLoadersParallel,
  testLoaderMatrix,
  testLoaderError,

  // Action Testing
  testAction,
  createActionTester,
  testActionMatrix,
  testActionError,
  testActionWithFile,

  // Middleware Testing
  testMiddleware,
  createMiddlewareTester,
  testMiddlewareChain,
  testMiddlewareMatrix,
  testMiddlewareError,
  testMiddlewareContext,

  // Request/Response Utilities
  createMockRequest,
  createFormRequest,
  createMockFormData,
  createMockHeaders,
  createMockFile,
  parseJsonResponse,
  parseTextResponse,
  extractCookies,

  // Component Testing
  renderRoute,
  createRouteRenderer,
  renderComponent,
  renderRouteMatrix,
  testRouteRenders,
  getRouteMeta,

  // Assertions
  assertRedirect,
  assertJson,
  assertStatus,
  assertHeaders,
  assertCookies,
  assertThrows,
  assertSchema,

  // Test Server
  createTestServer,
  createMockServer,

  // Snapshot Testing
  snapshotLoader,
  snapshotAction,
  createSnapshotMatrix,
  commonReplacers,
  applyReplacements,
  deterministicSnapshot
} from '@ereo/testing'
```

## Installation

```bash
bun add -D @ereo/testing
```

## Overview

The testing package is organized into several categories:

| Category | Purpose |
|----------|---------|
| Context | Create mock contexts for testing |
| Loader Testing | Test route loaders in isolation |
| Action Testing | Test form actions and mutations |
| Middleware Testing | Test middleware functions |
| Request/Response | Create mock requests and parse responses |
| Component Testing | Render routes with loader data |
| Assertions | Common assertions for responses |
| Test Server | Integration testing with real HTTP |
| Snapshots | Snapshot testing for data |

---

## Test Context

### createTestContext

Creates a mock context for testing loaders, actions, and middleware.

#### Signature

```ts
function createTestContext(options?: TestContextOptions): TestContext
```

#### Options

```ts
interface TestContextOptions {
  // Initial context store values
  store?: Record<string, unknown>

  // Initial environment variables
  env?: Record<string, string>

  // Request URL
  url?: string | URL

  // Initial cache tags
  cacheTags?: string[]

  // Initial response headers
  responseHeaders?: Record<string, string>
}
```

#### TestContext Interface

```ts
interface TestContext extends AppContext {
  // Get all values set in the context store
  getStore(): Record<string, unknown>

  // Get all cache operations performed
  getCacheOperations(): CacheOperation[]

  // Reset the context to initial state
  reset(): void
}
```

#### Example

```ts
const ctx = createTestContext({
  store: { user: { id: 1, name: 'Test User' } },
  env: { DATABASE_URL: 'test://db' },
})

// Use in tests
const result = await loader({ request, params, context: ctx })

// Inspect context after loader execution
const operations = ctx.getCacheOperations()
expect(operations).toHaveLength(1)
```

### createContextFactory

Creates a reusable context factory for repeated test setup.

#### Signature

```ts
function createContextFactory(
  baseOptions?: TestContextOptions
): (overrides?: Partial<TestContextOptions>) => TestContext
```

#### Example

```ts
const contextFactory = createContextFactory({
  store: { user: testUser },
  env: { API_KEY: 'test-key' },
})

test('loader test 1', async () => {
  const ctx = contextFactory()
  // ...
})

test('loader test 2', async () => {
  const ctx = contextFactory({ store: { user: differentUser } })
  // ...
})
```

---

## Loader Testing

### testLoader

Tests a loader function directly with configurable options.

#### Signature

```ts
function testLoader<T = unknown, P = RouteParams>(
  loader: LoaderFunction<T, P>,
  options?: LoaderTestOptions<P>
): Promise<LoaderTestResult<T>>
```

#### Options

```ts
interface LoaderTestOptions<P = RouteParams> {
  // Route parameters
  params?: P

  // Request options
  request?: MockRequestOptions

  // Context options
  context?: TestContextOptions
}
```

#### Result

```ts
interface LoaderTestResult<T = unknown> {
  // The loader's return value
  data: T

  // The test context (for inspection)
  context: TestContext

  // The request used
  request: Request

  // Execution time in milliseconds
  duration: number
}
```

#### Example

```ts
import { testLoader } from '@ereo/testing'
import { loader } from './routes/blog/[slug]'

test('loads blog post', async () => {
  const result = await testLoader(loader, {
    params: { slug: 'my-post' },
  })

  expect(result.data.title).toBe('My Post')
  expect(result.context.getCacheOperations()).toHaveLength(1)
})
```

### createLoaderTester

Creates a reusable loader tester with preset options.

#### Signature

```ts
function createLoaderTester<T = unknown, P = RouteParams>(
  loader: LoaderFunction<T, P>,
  baseOptions?: LoaderTestOptions<P>
): (overrides?: Partial<LoaderTestOptions<P>>) => Promise<LoaderTestResult<T>>
```

#### Example

```ts
const testPostLoader = createLoaderTester(loader, {
  context: { store: { user: testUser } },
})

test('loads post with user context', async () => {
  const result = await testPostLoader({ params: { slug: 'test' } })
  expect(result.data).toBeDefined()
})

test('loads different post', async () => {
  const result = await testPostLoader({ params: { slug: 'another' } })
  expect(result.data.slug).toBe('another')
})
```

### testLoadersParallel

Tests multiple loaders in parallel for combined loader scenarios.

#### Signature

```ts
function testLoadersParallel<T extends unknown[] = unknown[]>(
  loaders: Array<{
    loader: LoaderFunction<T[number]>
    params?: RouteParams
    request?: MockRequestOptions
    context?: TestContextOptions
  }>
): Promise<LoaderTestResult<T[number]>[]>
```

#### Example

```ts
const results = await testLoadersParallel([
  { loader: userLoader, params: { id: '1' } },
  { loader: postsLoader, params: {} },
])

expect(results[0].data.user).toBeDefined()
expect(results[1].data.posts).toHaveLength(3)
```

### testLoaderMatrix

Tests a loader with multiple parameter combinations.

#### Signature

```ts
function testLoaderMatrix<T = unknown, P = RouteParams>(
  loader: LoaderFunction<T, P>,
  options: {
    params: P[]
    request?: MockRequestOptions
    context?: TestContextOptions
  }
): Promise<LoaderTestResult<T>[]>
```

#### Example

```ts
const results = await testLoaderMatrix(loader, {
  params: [
    { slug: 'post-1' },
    { slug: 'post-2' },
    { slug: 'non-existent' },
  ],
})

expect(results[0].data).toBeDefined()
expect(results[1].data).toBeDefined()
expect(results[2].data).toBeNull()
```

### testLoaderError

Tests loader error handling.

#### Signature

```ts
function testLoaderError<P = RouteParams>(
  loader: LoaderFunction<unknown, P>,
  options?: LoaderTestOptions<P>
): Promise<{
  error: Error | null
  context: TestContext
  request: Request
}>
```

#### Example

```ts
test('handles missing post', async () => {
  const result = await testLoaderError(loader, {
    params: { slug: 'non-existent' },
  })

  expect(result.error).toBeInstanceOf(NotFoundError)
  expect(result.error.status).toBe(404)
})
```

---

## Action Testing

### testAction

Tests an action function directly.

#### Signature

```ts
function testAction<T = unknown, P = RouteParams>(
  action: ActionFunction<T | Response, P>,
  options?: ActionTestOptions<P>
): Promise<ActionTestResult<T>>
```

#### Options

```ts
interface ActionTestOptions<P = RouteParams> {
  // Route parameters
  params?: P

  // Request options (method defaults to POST)
  request?: MockRequestOptions

  // Context options
  context?: TestContextOptions

  // Form data to submit
  formData?: Record<string, string | Blob>

  // JSON body to submit
  body?: Record<string, unknown>
}
```

#### Result

```ts
interface ActionTestResult<T = unknown> {
  // The action's return value (parsed if Response)
  data: T

  // The raw response if action returned a Response
  response: Response | null

  // The test context (for inspection)
  context: TestContext

  // The request used
  request: Request

  // Execution time in milliseconds
  duration: number

  // Whether the action returned a redirect
  isRedirect: boolean

  // Redirect location if applicable
  redirectTo: string | null
}
```

#### Example

```ts
import { testAction } from '@ereo/testing'
import { action } from './routes/blog/[slug]'

test('creates a comment', async () => {
  const result = await testAction(action, {
    params: { slug: 'my-post' },
    formData: { content: 'Great post!' },
  })

  expect(result.data.success).toBe(true)
  expect(result.isRedirect).toBe(false)
})

test('redirects after creation', async () => {
  const result = await testAction(action, {
    params: { slug: 'my-post' },
    formData: { content: 'Test', redirect: 'true' },
  })

  expect(result.isRedirect).toBe(true)
  expect(result.redirectTo).toBe('/blog/my-post')
})
```

### createActionTester

Creates a reusable action tester with preset options.

#### Signature

```ts
function createActionTester<T = unknown, P = RouteParams>(
  action: ActionFunction<T | Response, P>,
  baseOptions?: ActionTestOptions<P>
): (overrides?: Partial<ActionTestOptions<P>>) => Promise<ActionTestResult<T>>
```

#### Example

```ts
const testCommentAction = createActionTester(action, {
  context: { store: { user: testUser } },
})

test('creates comment', async () => {
  const result = await testCommentAction({
    params: { slug: 'test' },
    formData: { content: 'Hello!' },
  })
  expect(result.data.success).toBe(true)
})

test('requires content', async () => {
  const result = await testCommentAction({
    params: { slug: 'test' },
    formData: { content: '' },
  })
  expect(result.data.error).toBeDefined()
})
```

### testActionMatrix

Tests an action with multiple form submissions.

#### Signature

```ts
function testActionMatrix<T = unknown, P = RouteParams>(
  action: ActionFunction<T | Response, P>,
  options: {
    params?: P
    submissions: Array<{
      formData?: Record<string, string | Blob>
      body?: Record<string, unknown>
    }>
    context?: TestContextOptions
  }
): Promise<ActionTestResult<T>[]>
```

#### Example

```ts
const results = await testActionMatrix(action, {
  params: { slug: 'post-1' },
  submissions: [
    { formData: { content: 'Comment 1' } },
    { formData: { content: 'Comment 2' } },
    { formData: { content: '' } }, // Invalid
  ],
})

expect(results[0].data.success).toBe(true)
expect(results[1].data.success).toBe(true)
expect(results[2].data.error).toBeDefined()
```

### testActionError

Tests action error handling.

#### Signature

```ts
function testActionError<P = RouteParams>(
  action: ActionFunction<unknown, P>,
  options?: ActionTestOptions<P>
): Promise<{
  error: Error | null
  context: TestContext
  request: Request
}>
```

#### Example

```ts
test('handles validation error', async () => {
  const result = await testActionError(action, {
    formData: { content: '' },
  })

  expect(result.error).toBeInstanceOf(ValidationError)
})
```

### testActionWithFile

Tests an action with file upload.

#### Signature

```ts
function testActionWithFile<T = unknown, P = RouteParams>(
  action: ActionFunction<T | Response, P>,
  options: {
    params?: P
    file: {
      field: string
      name: string
      content: string | Blob
      type?: string
    }
    extraFields?: Record<string, string>
    context?: TestContextOptions
  }
): Promise<ActionTestResult<T>>
```

#### Example

```ts
test('uploads file', async () => {
  const result = await testActionWithFile(action, {
    params: { id: '1' },
    file: {
      field: 'avatar',
      name: 'avatar.png',
      content: imageBlob,
      type: 'image/png',
    },
    extraFields: {
      description: 'Profile picture',
    },
  })

  expect(result.data.url).toContain('avatar.png')
})
```

---

## Middleware Testing

### testMiddleware

Tests a middleware function directly.

#### Signature

```ts
function testMiddleware(
  middleware: MiddlewareHandler,
  options?: MiddlewareTestOptions
): Promise<MiddlewareTestResult>
```

#### Options

```ts
interface MiddlewareTestOptions {
  // Request options
  request?: MockRequestOptions

  // Context options
  context?: TestContextOptions

  // Custom next function (defaults to returning 200 OK)
  next?: NextFunction

  // Expected response from next (for pass-through testing)
  nextResponse?: Response
}
```

#### Result

```ts
interface MiddlewareTestResult {
  // The response returned by middleware
  response: Response

  // The test context (for inspection)
  context: TestContext

  // The request used
  request: Request

  // Whether next() was called
  nextCalled: boolean

  // How many times next() was called
  nextCallCount: number

  // Execution time in milliseconds
  duration: number
}
```

#### Example

```ts
import { testMiddleware } from '@ereo/testing'
import { authMiddleware } from './middleware/auth'

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
```

### createMiddlewareTester

Creates a reusable middleware tester with preset options.

#### Signature

```ts
function createMiddlewareTester(
  middleware: MiddlewareHandler,
  baseOptions?: MiddlewareTestOptions
): (overrides?: Partial<MiddlewareTestOptions>) => Promise<MiddlewareTestResult>
```

#### Example

```ts
const testAuth = createMiddlewareTester(authMiddleware, {
  context: { env: { AUTH_SECRET: 'test-secret' } },
})

test('allows valid tokens', async () => {
  const result = await testAuth({
    request: { headers: { Authorization: 'Bearer valid' } },
  })
  expect(result.nextCalled).toBe(true)
})

test('rejects invalid tokens', async () => {
  const result = await testAuth({
    request: { headers: { Authorization: 'Bearer invalid' } },
  })
  expect(result.response.status).toBe(401)
})
```

### testMiddlewareChain

Tests a chain of middleware functions.

#### Signature

```ts
function testMiddlewareChain(
  middlewares: MiddlewareHandler[],
  options?: MiddlewareTestOptions
): Promise<{
  response: Response
  context: TestContext
  request: Request
  middlewareResults: Array<{
    index: number
    nextCalled: boolean
    duration: number
  }>
}>
```

#### Example

```ts
const result = await testMiddlewareChain([
  loggingMiddleware,
  authMiddleware,
  rateLimitMiddleware,
], {
  request: { url: '/api/data' },
})

expect(result.response.status).toBe(200)
expect(result.middlewareResults[0].nextCalled).toBe(true)
expect(result.middlewareResults[1].nextCalled).toBe(true)
expect(result.middlewareResults[2].nextCalled).toBe(true)
```

### testMiddlewareMatrix

Tests middleware with multiple request scenarios.

#### Signature

```ts
function testMiddlewareMatrix(
  middleware: MiddlewareHandler,
  options: {
    requests: MockRequestOptions[]
    context?: TestContextOptions
  }
): Promise<MiddlewareTestResult[]>
```

#### Example

```ts
const results = await testMiddlewareMatrix(authMiddleware, {
  requests: [
    { url: '/public' },
    { url: '/admin', headers: { Authorization: 'Bearer valid' } },
    { url: '/admin' }, // No auth
  ],
})

expect(results[0].response.status).toBe(200)
expect(results[1].response.status).toBe(200)
expect(results[2].response.status).toBe(401)
```

### testMiddlewareError

Tests middleware error handling.

#### Signature

```ts
function testMiddlewareError(
  middleware: MiddlewareHandler,
  options: MiddlewareTestOptions & {
    next: NextFunction
  }
): Promise<{
  response: Response | null
  error: Error | null
  context: TestContext
}>
```

#### Example

```ts
test('handles errors gracefully', async () => {
  const result = await testMiddlewareError(errorMiddleware, {
    next: async () => {
      throw new Error('Downstream error')
    },
  })

  expect(result.response?.status).toBe(500)
  expect(result.error).toBeNull() // Middleware caught the error
})
```

### testMiddlewareContext

Tests that middleware modifies context correctly.

#### Signature

```ts
function testMiddlewareContext(
  middleware: MiddlewareHandler,
  options: MiddlewareTestOptions & {
    expectContextValues: Record<string, unknown>
  }
): Promise<{
  response: Response
  context: TestContext
  contextMatches: boolean
  contextDiff: Record<string, { expected: unknown; actual: unknown }>
}>
```

#### Example

```ts
test('sets user in context', async () => {
  const result = await testMiddlewareContext(authMiddleware, {
    request: { headers: { Authorization: 'Bearer valid' } },
    expectContextValues: {
      user: { id: '1', role: 'user' },
    },
  })

  expect(result.contextMatches).toBe(true)
})
```

---

## Request/Response Utilities

### createMockRequest

Creates a mock Request object for testing.

#### Signature

```ts
function createMockRequest(
  url?: string | MockRequestOptions,
  options?: MockRequestOptions
): Request
```

#### Options

```ts
interface MockRequestOptions {
  // HTTP method (default: GET)
  method?: string

  // Request URL or path
  url?: string

  // Request headers
  headers?: Record<string, string>

  // Request body (for POST/PUT/PATCH)
  body?: BodyInit | Record<string, unknown>

  // Query parameters
  searchParams?: Record<string, string | string[]>

  // Form data
  formData?: Record<string, string | Blob>

  // Cookies
  cookies?: Record<string, string>
}
```

#### Examples

```ts
// Simple GET request
const request = createMockRequest({ url: '/api/posts' })

// POST with JSON body
const request = createMockRequest({
  method: 'POST',
  url: '/api/posts',
  body: { title: 'Test Post' },
})

// POST with form data
const request = createMockRequest({
  method: 'POST',
  url: '/api/login',
  formData: { email: 'test@example.com', password: 'secret' },
})

// With cookies and headers
const request = createMockRequest({
  url: '/dashboard',
  cookies: { session: 'abc123' },
  headers: { 'X-Custom-Header': 'value' },
})

// With query parameters
const request = createMockRequest({
  url: '/api/search',
  searchParams: { q: 'test', tags: ['a', 'b'] },
})
```

### createFormRequest

Creates a POST request with form data (convenience function).

#### Signature

```ts
function createFormRequest(
  url: string,
  data: Record<string, string | Blob>
): Request
```

#### Example

```ts
const request = createFormRequest('/api/login', {
  email: 'test@example.com',
  password: 'secret',
})
```

### createMockFormData

Creates mock FormData for testing.

#### Signature

```ts
function createMockFormData(
  data: Record<string, string | Blob | File>
): FormData
```

#### Example

```ts
const formData = createMockFormData({
  email: 'test@example.com',
  avatar: new File(['...'], 'avatar.png', { type: 'image/png' }),
})
```

### createMockHeaders

Creates mock Headers for testing.

#### Signature

```ts
function createMockHeaders(data: Record<string, string>): Headers
```

#### Example

```ts
const headers = createMockHeaders({
  'Authorization': 'Bearer token123',
  'Content-Type': 'application/json',
})
```

### createMockFile

Creates a mock File for testing file uploads.

#### Signature

```ts
function createMockFile(
  name: string,
  content: string | Blob,
  type?: string
): File
```

#### Example

```ts
const file = createMockFile('test.txt', 'Hello World', 'text/plain')
const imageFile = createMockFile('image.png', imageBlob, 'image/png')
```

### parseJsonResponse

Parses JSON from a Response.

#### Signature

```ts
function parseJsonResponse<T = unknown>(response: Response): Promise<T>
```

#### Example

```ts
const result = await testAction(action, options)
const data = await parseJsonResponse<MyData>(result.response)
```

### parseTextResponse

Parses text from a Response.

#### Signature

```ts
function parseTextResponse(response: Response): Promise<string>
```

### extractCookies

Extracts cookies from a Response.

#### Signature

```ts
function extractCookies(response: Response): Record<string, string>
```

#### Example

```ts
const cookies = extractCookies(response)
expect(cookies.session).toBeDefined()
```

---

## Component Testing

### renderRoute

Renders a route component with its loader data.

#### Signature

```ts
function renderRoute<T = unknown, P = RouteParams>(
  module: RouteModule,
  options?: RenderRouteOptions<P>
): Promise<RenderResult<T>>
```

#### Options

```ts
interface RenderRouteOptions<P = RouteParams> {
  // Route parameters
  params?: P

  // Request options
  request?: MockRequestOptions

  // Context options
  context?: TestContextOptions

  // Initial loader data (skip loader execution)
  loaderData?: unknown

  // Children to render
  children?: ReactElement
}
```

#### Result

```ts
interface RenderResult<T = unknown> {
  // The rendered element
  element: ReactElement

  // The loader data used
  loaderData: T

  // The test context
  context: TestContext

  // The request used
  request: Request

  // Props passed to the component
  props: RouteComponentProps<T>
}
```

#### Example

```ts
import { renderRoute } from '@ereo/testing'
import { render } from '@testing-library/react'
import * as BlogPost from './routes/blog/[slug]'

test('renders blog post', async () => {
  const result = await renderRoute(BlogPost, {
    params: { slug: 'my-post' },
  })

  // Use with React Testing Library
  const { getByText } = render(result.element)
  expect(getByText('My Post')).toBeInTheDocument()
})

test('renders with mock data', async () => {
  const result = await renderRoute(BlogPost, {
    loaderData: { title: 'Test', content: 'Content' },
  })

  const { getByText } = render(result.element)
  expect(getByText('Test')).toBeInTheDocument()
})
```

### createRouteRenderer

Creates a reusable route renderer.

#### Signature

```ts
function createRouteRenderer<T = unknown, P = RouteParams>(
  module: RouteModule,
  baseOptions?: RenderRouteOptions<P>
): (overrides?: Partial<RenderRouteOptions<P>>) => Promise<RenderResult<T>>
```

#### Example

```ts
const renderBlogPost = createRouteRenderer(BlogPost, {
  context: { store: { user: testUser } },
})

test('renders for authenticated user', async () => {
  const result = await renderBlogPost({ params: { slug: 'test' } })
  // ...
})
```

### renderComponent

Renders a standalone component with props.

#### Signature

```ts
function renderComponent<P extends object>(
  Component: ComponentType<P>,
  props: P
): ReactElement
```

#### Example

```ts
const element = renderComponent(Counter, { count: 5 })
```

### renderRouteMatrix

Renders a route with multiple param sets.

#### Signature

```ts
function renderRouteMatrix<T = unknown, P = RouteParams>(
  module: RouteModule,
  options: {
    params: P[]
    request?: MockRequestOptions
    context?: TestContextOptions
  }
): Promise<RenderResult<T>[]>
```

#### Example

```ts
const renders = await renderRouteMatrix(BlogPost, {
  params: [
    { slug: 'post-1' },
    { slug: 'post-2' },
  ],
})

renders.forEach((result, index) => {
  expect(result.element).toMatchSnapshot(`render-${index}`)
})
```

### testRouteRenders

Tests that a route renders without throwing.

#### Signature

```ts
function testRouteRenders<P = RouteParams>(
  module: RouteModule,
  options?: RenderRouteOptions<P>
): Promise<{
  renders: boolean
  error: Error | null
  result: RenderResult | null
}>
```

#### Example

```ts
test('renders without errors', async () => {
  const result = await testRouteRenders(BlogPost, {
    params: { slug: 'test' },
  })

  expect(result.renders).toBe(true)
  expect(result.error).toBeNull()
})
```

### getRouteMeta

Gets the meta tags for a route.

#### Signature

```ts
function getRouteMeta<P = RouteParams>(
  module: RouteModule,
  options?: RenderRouteOptions<P>
): Promise<MetaDescriptor[]>
```

#### Example

```ts
const meta = await getRouteMeta(BlogPost, {
  params: { slug: 'my-post' },
})

expect(meta.find(m => m.title)).toEqual({ title: 'My Post' })
```

---

## Assertions

### assertRedirect

Asserts that a response is a redirect.

#### Signature

```ts
function assertRedirect(
  response: Response | null,
  expectedLocation?: string,
  options?: AssertionOptions & { status?: number }
): void
```

#### Example

```ts
const result = await testAction(action, { formData: {} })
assertRedirect(result.response, '/login')

// With specific status
assertRedirect(result.response, '/dashboard', { status: 301 })
```

### assertJson

Asserts that a response has the expected JSON body.

#### Signature

```ts
function assertJson<T = unknown>(
  responseOrData: Response | T,
  expected: Partial<T>,
  options?: AssertionOptions
): Promise<void>
```

#### Example

```ts
const result = await testLoader(loader, { params: { id: '1' } })
await assertJson(result.data, { id: 1, name: 'Test' })
```

### assertStatus

Asserts that a response has the expected status code.

#### Signature

```ts
function assertStatus(
  response: Response | null,
  expected: number | number[],
  options?: AssertionOptions
): void
```

#### Example

```ts
const result = await testMiddleware(authMiddleware, {})
assertStatus(result.response, 401)

// Multiple acceptable statuses
assertStatus(result.response, [200, 201])
```

### assertHeaders

Asserts that a response has the expected headers.

#### Signature

```ts
function assertHeaders(
  response: Response | null,
  expected: Record<string, string | RegExp>,
  options?: AssertionOptions
): void
```

#### Example

```ts
const result = await testLoader(loader, {})
assertHeaders(result.response, {
  'Content-Type': 'application/json',
  'Cache-Control': /max-age=\d+/,
})
```

### assertCookies

Asserts that a response sets the expected cookies.

#### Signature

```ts
function assertCookies(
  response: Response | null,
  expected: Record<string, {
    exists?: boolean
    value?: string | RegExp
    httpOnly?: boolean
    secure?: boolean
    sameSite?: 'Strict' | 'Lax' | 'None'
    path?: string
    maxAge?: number
    expires?: boolean
  }>,
  options?: AssertionOptions
): void
```

#### Example

```ts
const result = await testAction(loginAction, {
  formData: { email: 'test@example.com', password: 'secret' },
})

assertCookies(result.response, {
  session: { exists: true, httpOnly: true, secure: true },
  _csrf: { exists: false },
})
```

### assertThrows

Asserts that a function throws an error.

#### Signature

```ts
function assertThrows(
  fn: () => Promise<unknown>,
  expected?: {
    message?: string | RegExp
    name?: string
    status?: number
  },
  options?: AssertionOptions
): Promise<void>
```

#### Example

```ts
await assertThrows(
  () => testLoader(loader, { params: { id: 'invalid' } }),
  { message: /not found/i, status: 404 }
)
```

### assertSchema

Asserts that a value matches a basic type schema.

#### Signature

```ts
function assertSchema(
  data: unknown,
  schema: Record<string, 'string' | 'number' | 'boolean' | 'object' | 'array' | 'null' | 'undefined'>,
  options?: AssertionOptions
): void
```

#### Example

```ts
assertSchema(result.data, {
  id: 'number',
  name: 'string',
  tags: 'array',
  meta: 'object',
})
```

---

## Test Server

### createTestServer

Creates a test server for integration testing.

#### Signature

```ts
function createTestServer(options?: TestServerOptions): Promise<TestServer>
```

#### Options

```ts
interface TestServerOptions {
  // Framework configuration
  config?: FrameworkConfig

  // Port to run on (default: random available port)
  port?: number

  // Routes directory
  routesDir?: string
}
```

#### TestServer Interface

```ts
interface TestServer {
  // Server base URL
  url: string

  // Port the server is running on
  port: number

  // Make a request to the server
  fetch: (path: string, init?: RequestInit) => Promise<Response>

  // HTTP method helpers
  get: (path: string, init?: RequestInit) => Promise<Response>
  post: (path: string, body?: unknown, init?: RequestInit) => Promise<Response>
  put: (path: string, body?: unknown, init?: RequestInit) => Promise<Response>
  delete: (path: string, init?: RequestInit) => Promise<Response>
  patch: (path: string, body?: unknown, init?: RequestInit) => Promise<Response>

  // Submit a form
  submitForm: (path: string, formData: Record<string, string>, init?: RequestInit) => Promise<Response>

  // Stop the server
  stop: () => Promise<void>
}
```

#### Example

```ts
import { createTestServer, TestServer } from '@ereo/testing'

describe('API routes', () => {
  let server: TestServer

  beforeAll(async () => {
    server = await createTestServer({
      routesDir: './app/routes',
    })
  })

  afterAll(async () => {
    await server.stop()
  })

  test('GET /api/posts', async () => {
    const response = await server.get('/api/posts')
    expect(response.status).toBe(200)

    const posts = await response.json()
    expect(posts).toHaveLength(3)
  })

  test('POST /api/posts', async () => {
    const response = await server.post('/api/posts', {
      title: 'New Post',
      content: 'Content here',
    })
    expect(response.status).toBe(201)
  })

  test('form submission', async () => {
    const response = await server.submitForm('/api/contact', {
      name: 'Test User',
      email: 'test@example.com',
    })
    expect(response.status).toBe(200)
  })
})
```

### createMockServer

Creates a simple mock server for external API testing.

#### Signature

```ts
function createMockServer(options: {
  routes: Record<string, unknown | ((request: { body?: unknown; params?: Record<string, string> }) => unknown)>
  port?: number
}): Promise<{ url: string; port: number; stop: () => Promise<void> }>
```

#### Example

```ts
const mockApi = await createMockServer({
  routes: {
    'GET /users/1': { id: 1, name: 'Test User' },
    'POST /users': (req) => ({ id: 2, ...req.body }),
    'GET /users': [{ id: 1 }, { id: 2 }],
  },
})

// In your test, use mockApi.url as the API base URL
process.env.API_URL = mockApi.url

// Run tests...

// After test
await mockApi.stop()
```

---

## Snapshot Testing

### snapshotLoader

Creates a snapshot of loader data.

#### Signature

```ts
function snapshotLoader<T = unknown, P = RouteParams>(
  loader: LoaderFunction<T, P>,
  testOptions?: LoaderTestOptions<P>,
  snapshotOptions?: SnapshotOptions
): Promise<unknown>
```

#### SnapshotOptions

```ts
interface SnapshotOptions {
  // Fields to exclude from snapshot
  exclude?: string[]

  // Fields to include in snapshot (if specified, only these are included)
  include?: string[]

  // Custom serializer
  serialize?: (data: unknown) => string

  // Replace dynamic values
  replacers?: Record<string, unknown>
}
```

#### Example

```ts
test('loader snapshot', async () => {
  const snapshot = await snapshotLoader(loader, {
    params: { slug: 'test-post' },
  }, {
    exclude: ['createdAt', 'updatedAt'],
    replacers: { id: '[ID]' },
  })

  expect(snapshot).toMatchSnapshot()
})
```

### snapshotAction

Creates a snapshot of action result.

#### Signature

```ts
function snapshotAction<T = unknown, P = RouteParams>(
  action: ActionFunction<T | Response, P>,
  testOptions?: ActionTestOptions<P>,
  snapshotOptions?: SnapshotOptions
): Promise<unknown>
```

#### Example

```ts
test('action snapshot', async () => {
  const snapshot = await snapshotAction(action, {
    formData: { title: 'Test', content: 'Content' },
  }, {
    exclude: ['id', 'createdAt'],
  })

  expect(snapshot).toMatchSnapshot()
})
```

### createSnapshotMatrix

Creates snapshots for multiple test scenarios.

#### Signature

```ts
function createSnapshotMatrix<T = unknown, P = RouteParams>(
  loader: LoaderFunction<T, P>,
  options: {
    scenarios: Record<string, LoaderTestOptions<P>>
    snapshotOptions?: SnapshotOptions
  }
): Promise<Record<string, unknown>>
```

#### Example

```ts
const snapshots = await createSnapshotMatrix(loader, {
  scenarios: {
    'loads featured posts': { params: { featured: 'true' } },
    'loads recent posts': { params: { sort: 'recent' } },
    'loads by author': { params: { author: 'test-user' } },
  },
})

expect(snapshots).toMatchSnapshot()
```

### commonReplacers

Common regex patterns for dynamic values.

```ts
const commonReplacers = {
  // Replace ISO date strings
  date: /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z/g,

  // Replace UUIDs
  uuid: /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi,

  // Replace numeric IDs
  numericId: /\d+/g,
}
```

### applyReplacements

Applies string replacements for snapshot stability.

#### Signature

```ts
function applyReplacements(
  data: unknown,
  replacements: Record<string, string>
): unknown
```

#### Example

```ts
const stableData = applyReplacements(data, {
  [commonReplacers.date]: '[DATE]',
  [commonReplacers.uuid]: '[UUID]',
})
```

### deterministicSnapshot

Creates a deterministic snapshot by sorting object keys.

#### Signature

```ts
function deterministicSnapshot(data: unknown): string
```

#### Example

```ts
const snapshot = deterministicSnapshot(result.data)
expect(snapshot).toMatchSnapshot()
```

---

## Best Practices

### 1. Use Factory Functions

Create reusable testers for commonly tested functions:

```ts
// test/helpers.ts
import { createLoaderTester, createActionTester, createContextFactory } from '@ereo/testing'
import { loader, action } from '../routes/posts/[id]'

export const testUser = { id: '1', name: 'Test User', role: 'admin' }

export const contextFactory = createContextFactory({
  store: { user: testUser },
  env: { DATABASE_URL: 'test://db' },
})

export const testPostLoader = createLoaderTester(loader, {
  context: { store: { user: testUser } },
})

export const testPostAction = createActionTester(action, {
  context: { store: { user: testUser } },
})
```

### 2. Test Edge Cases with Matrix Testing

```ts
test('handles various inputs', async () => {
  const results = await testLoaderMatrix(loader, {
    params: [
      { id: '1' },           // Valid
      { id: '999' },         // Not found
      { id: 'invalid' },     // Invalid format
    ],
  })

  expect(results[0].data).toBeDefined()
  expect(results[1].data).toBeNull()
  // results[2] might throw - use testLoaderError for that case
})
```

### 3. Isolate Tests with Fresh Contexts

```ts
test('test 1', async () => {
  const ctx = createTestContext({ store: { count: 0 } })
  // ctx is fresh for this test
})

test('test 2', async () => {
  const ctx = createTestContext({ store: { count: 0 } })
  // ctx is independent from test 1
})
```

### 4. Use Assertions for Cleaner Tests

```ts
test('login action', async () => {
  const result = await testAction(loginAction, {
    formData: { email: 'test@example.com', password: 'secret' },
  })

  assertRedirect(result.response, '/dashboard')
  assertCookies(result.response, {
    session: { exists: true, httpOnly: true },
  })
})
```

### 5. Use Test Server for Integration Tests

```ts
describe('full request cycle', () => {
  let server: TestServer

  beforeAll(async () => {
    server = await createTestServer()
  })

  afterAll(async () => {
    await server.stop()
  })

  test('complete flow', async () => {
    // Login
    const loginRes = await server.post('/api/login', {
      email: 'test@example.com',
      password: 'secret',
    })
    const cookies = extractCookies(loginRes)

    // Access protected resource
    const dataRes = await server.get('/api/me', {
      headers: { Cookie: `session=${cookies.session}` },
    })
    expect(dataRes.status).toBe(200)
  })
})
```

### 6. Snapshot Dynamic Data Carefully

```ts
test('loader snapshot', async () => {
  const snapshot = await snapshotLoader(loader, {
    params: { id: '1' },
  }, {
    exclude: ['createdAt', 'updatedAt', 'id'],
    replacers: {
      authorId: '[AUTHOR_ID]',
    },
  })

  expect(snapshot).toMatchSnapshot()
})
```

---

## Related

- [Loaders](/api/data/loaders)
- [Actions](/api/data/actions)
- [Middleware](/api/router/middleware)
- [Request Context](/api/core/context)
