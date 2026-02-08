# @ereo/testing

Testing utilities for EreoJS applications. Makes testing loaders, actions, middleware, and components trivial with a clean, intuitive API.

## Installation

```bash
bun add @ereo/testing
```

## Quick Start

```typescript
import { testLoader, testAction, createTestContext } from '@ereo/testing';
import { loader, action } from './routes/users';

// Test a loader
const result = await testLoader(loader, {
  params: { id: '123' },
});
expect(result.data.user.id).toBe('123');

// Test an action
const actionResult = await testAction(action, {
  method: 'POST',
  formData: { name: 'John' },
});
expect(actionResult.status).toBe(200);
```

## Key Features

- **Loader Testing** - Test loaders with `testLoader` and `createLoaderTester`
- **Action Testing** - Test actions with `testAction` and `createActionTester`
- **Middleware Testing** - Test middleware with `testMiddleware` and `createMiddlewareTester`
- **Component Testing** - Render routes with `renderRoute` and `createRouteRenderer`
- **Mock Utilities** - Create mock requests with `createMockRequest` and `createFormRequest`
- **Assertions** - Built-in assertions: `assertRedirect`, `assertJson`, `assertStatus`
- **Snapshot Testing** - Snapshot loaders and actions with `snapshotLoader` and `snapshotAction`
- **Test Server** - Spin up a test server with `createTestServer`

## Middleware Testing

```typescript
import { testMiddleware, createMockRequest } from '@ereo/testing';

const result = await testMiddleware(authMiddleware, {
  request: createMockRequest('/protected', {
    headers: { Authorization: 'Bearer token' },
  }),
});

expect(result.continued).toBe(true);
```

## Component Testing

```typescript
import { renderRoute, assertStatus } from '@ereo/testing';

const result = await renderRoute('/users/123', {
  loaderData: { user: { id: '123', name: 'John' } },
});

expect(result.html).toContain('John');
assertStatus(result.response, 200);
```

## Test Server

```typescript
import { createTestServer } from '@ereo/testing';

const server = await createTestServer({
  routesDir: './src/routes',
});

const response = await server.fetch('/api/users');
expect(response.status).toBe(200);

await server.close();
```

## Documentation

For full documentation, visit [https://ereojs.dev/docs/testing](https://ereojs.dev/docs/testing)

## Part of EreoJS

This package is part of the [EreoJS](https://github.com/ereoJS/ereoJS) monorepo - a modern full-stack framework built for Bun.

## License

MIT
