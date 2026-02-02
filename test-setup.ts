// Global test setup for Bun test runner
// This file is preloaded before all tests

// Suppress console output during tests unless DEBUG is set
if (!process.env.DEBUG) {
  // Keep console available but can be mocked in individual tests
}

// Global test utilities
declare global {
  var testUtils: {
    createMockRequest: (url: string, init?: RequestInit) => Request;
    createMockContext: () => import('./packages/core/src/context').RequestContext;
  };
}

globalThis.testUtils = {
  createMockRequest: (url: string, init?: RequestInit) => {
    return new Request(new URL(url, 'http://localhost:3000'), init);
  },
  createMockContext: () => {
    // Will be implemented when core package is ready
    return {} as any;
  },
};

export {};
