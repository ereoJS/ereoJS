/**
 * @oreo/testing
 *
 * Testing utilities for Oreo applications.
 * Makes testing loaders, actions, middleware, and components trivial.
 */

// Test Context
export {
  createTestContext,
  type TestContextOptions,
} from './context';

// Loader Testing
export {
  testLoader,
  createLoaderTester,
  type LoaderTestOptions,
  type LoaderTestResult,
} from './loader';

// Action Testing
export {
  testAction,
  createActionTester,
  type ActionTestOptions,
  type ActionTestResult,
} from './action';

// Middleware Testing
export {
  testMiddleware,
  createMiddlewareTester,
  type MiddlewareTestOptions,
  type MiddlewareTestResult,
} from './middleware';

// Request/Response Utilities
export {
  createMockRequest,
  createMockFormData,
  createMockHeaders,
  parseJsonResponse,
  parseTextResponse,
  type MockRequestOptions,
} from './request';

// Component Testing
export {
  renderRoute,
  createRouteRenderer,
  type RenderRouteOptions,
  type RenderResult,
} from './render';

// Assertions
export {
  assertRedirect,
  assertJson,
  assertStatus,
  assertHeaders,
  assertCookies,
  type AssertionOptions,
} from './assertions';

// Test Server
export {
  createTestServer,
  type TestServer,
  type TestServerOptions,
} from './server';

// Snapshot Testing
export {
  snapshotLoader,
  snapshotAction,
  type SnapshotOptions,
} from './snapshot';
