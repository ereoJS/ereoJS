/**
 * @ereo/testing
 *
 * Testing utilities for EreoJS applications.
 * Makes testing loaders, actions, middleware, and components trivial.
 */

// Test Context
export {
  createTestContext,
  createContextFactory,
  type TestContextOptions,
  type TestContext,
} from './context';

// Loader Testing
export {
  testLoader,
  createLoaderTester,
  testLoadersParallel,
  testLoaderMatrix,
  testLoaderError,
  type LoaderTestOptions,
  type LoaderTestResult,
} from './loader';

// Action Testing
export {
  testAction,
  createActionTester,
  testActionMatrix,
  testActionError,
  testActionWithFile,
  type ActionTestOptions,
  type ActionTestResult,
} from './action';

// Middleware Testing
export {
  testMiddleware,
  createMiddlewareTester,
  testMiddlewareChain,
  testMiddlewareMatrix,
  testMiddlewareError,
  testMiddlewareContext,
  type MiddlewareTestOptions,
  type MiddlewareTestResult,
} from './middleware';

// Request/Response Utilities
export {
  createMockRequest,
  createFormRequest,
  createMockFormData,
  createMockHeaders,
  createMockFile,
  parseJsonResponse,
  parseTextResponse,
  extractCookies,
  type MockRequestOptions,
} from './request';

// Component Testing
export {
  renderRoute,
  createRouteRenderer,
  renderComponent,
  renderRouteMatrix,
  testRouteRenders,
  getRouteMeta,
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
  assertThrows,
  assertSchema,
  type AssertionOptions,
} from './assertions';

// Test Server
export {
  createTestServer,
  createMockServer,
  type TestServer,
  type TestServerOptions,
} from './server';

// Snapshot Testing
export {
  snapshotLoader,
  snapshotAction,
  createSnapshotMatrix,
  commonReplacers,
  applyReplacements,
  deterministicSnapshot,
  type SnapshotOptions,
} from './snapshot';
