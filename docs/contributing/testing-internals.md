# Testing Internals

How the EreoJS test suite is organized and how to write tests for the framework.

## Test Runner

EreoJS uses Bun's built-in test runner. Tests are written with the `bun:test` module:

```ts
import { test, expect, describe, beforeEach } from 'bun:test'

describe('Signal', () => {
  test('initial value', () => {
    const s = signal(42)
    expect(s.get()).toBe(42)
  })
})
```

Run all tests:

```bash
bun test
```

Run tests for a specific package:

```bash
bun test packages/forms
```

## Test File Conventions

Test files follow the `*.test.ts` (or `*.test.tsx`) naming convention and are placed in a `__tests__/` directory within each package's `src/`:

```
packages/forms/src/
  __tests__/
    validation.test.ts
    field-array.test.ts
    wizard.test.ts
    useField.test.tsx
  validation.ts
  field-array.ts
  wizard.ts
```

Some packages also have integration tests at the package root:

```
packages/forms/
  tests/
    integration/
      form-submission.test.tsx
```

## Fixture-Based Route Testing

The router and server packages use fixture-based tests that define a temporary routes directory and verify resolution, loading, and rendering:

```ts
import { test, expect } from 'bun:test'
import { createTestRouter } from '@ereo/router/test'

test('resolves dynamic route', async () => {
  const router = createTestRouter({
    routes: {
      'posts/[id].tsx': {
        loader: async ({ params }) => ({ id: params.id }),
        default: ({ loaderData }) => `Post ${loaderData.id}`,
      },
    },
  })

  const match = router.match('/posts/123')
  expect(match).toBeDefined()
  expect(match.params.id).toBe('123')
})
```

For full server integration tests:

```ts
import { createTestServer } from '@ereo/server/test'

test('renders page with loader data', async () => {
  const server = await createTestServer({
    routes: {
      'index.tsx': {
        loader: async () => ({ message: 'Hello' }),
        default: ({ loaderData }) => `<h1>${loaderData.message}</h1>`,
      },
    },
  })

  const res = await server.fetch('/')
  const html = await res.text()

  expect(html).toContain('<h1>Hello</h1>')
  server.close()
})
```

## Snapshot Tests

Some packages use snapshot tests for rendered output or serialized data:

```ts
import { test, expect } from 'bun:test'

test('serializes loader data safely', () => {
  const data = { title: '<script>alert("xss")</script>' }
  const result = serializeLoaderData(data)
  expect(result).toMatchSnapshot()
})
```

Snapshots are stored alongside test files in `__snapshots__/` directories. Update snapshots with:

```bash
bun test --update-snapshots
```

## Test Coverage

Generate coverage reports:

```bash
bun test --coverage
```

This outputs a coverage summary to the terminal. For HTML reports, configure in `bunfig.toml`:

```toml
[test]
coverage = true
coverageReporter = ["text", "html"]
coverageDirectory = "./coverage"
```

## Testing Forms (Package-Specific)

The `@ereo/forms` package has the largest test suite (~391 tests). Tests cover:

- Validation engine (sync, async, schema, cross-field)
- Field arrays (add, remove, swap, move, insert)
- Wizard steps and navigation
- Error source tracking
- Signal subscription cleanup
- React hook integration (using a test renderer)

Example from the forms test suite:

```ts
test('sync validators gate async validators', async () => {
  const form = createFormStore({
    defaultValues: { username: '' },
    validators: {
      username: [required(), async(checkAvailability)],
    },
  })

  form.trigger('username')
  // required() fails, so checkAvailability never runs
  expect(checkAvailability).not.toHaveBeenCalled()
})
```

## Writing New Tests

When contributing, follow these guidelines:

1. Place tests in the relevant package's `__tests__/` directory
2. Name the file `descriptive-name.test.ts`
3. Use `describe` blocks to group related tests
4. Test both success and error paths
5. Clean up resources (servers, subscriptions, timers) in `afterEach`
6. Avoid testing implementation details --- test the public API
7. For async operations, use `async/await` rather than callbacks
