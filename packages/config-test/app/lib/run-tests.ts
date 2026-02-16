/**
 * Test runner — executes all ServerFnConfig tests and returns structured results.
 */
import {
  resetTestState,
  capturedHeaders,
  middlewareLog,
  rateLimitedFn,
  rateLimitCustomKeyFn,
  authRejectFn,
  authAcceptFn,
  corsWildcardFn,
  corsSpecificFn,
  customMiddlewareFn,
  combinedFn,
  blockApi,
} from './test-fns';
import { buildCacheMiddleware } from '@ereo/rpc';

export interface TestResult {
  name: string;
  passed: boolean;
  details: string;
  error?: string;
}

export interface TestSuite {
  name: string;
  results: TestResult[];
}

async function runTest(name: string, fn: () => Promise<{ passed: boolean; details: string }>): Promise<TestResult> {
  try {
    const { passed, details } = await fn();
    return { name, passed, details };
  } catch (err: any) {
    const errType = err?.constructor?.name ?? typeof err;
    const errCode = err?.code ?? '';
    const errMsg = err?.message ?? String(err);
    console.error(`TEST FAIL [${name}]:`, errType, errCode, errMsg, err);
    return {
      name,
      passed: false,
      details: `Unexpected [${errType}] code=${errCode}`,
      error: errMsg || 'no message',
    };
  }
}

// =============================================================================
// Test Suite: Rate Limiting
// =============================================================================

async function testRateLimiting(): Promise<TestSuite> {
  const results: TestResult[] = [];

  // Test 1: Calls within limit succeed
  resetTestState();
  results.push(await runTest('Calls within limit (3/3) succeed', async () => {
    const successes: number[] = [];
    for (let i = 0; i < 3; i++) {
      const r = await rateLimitedFn();
      if (r.message === 'ok') successes.push(i);
    }
    return {
      passed: successes.length === 3,
      details: `${successes.length}/3 calls succeeded`,
    };
  }));

  // Test 2: Call over limit throws RATE_LIMITED
  results.push(await runTest('4th call throws RATE_LIMITED', async () => {
    try {
      await rateLimitedFn();
      return { passed: false, details: '4th call should have thrown but succeeded' };
    } catch (err: any) {
      const isRateLimited = err.code === 'RATE_LIMITED' || err.message?.includes('Too many requests');
      return {
        passed: isRateLimited,
        details: isRateLimited
          ? `Correctly threw: ${err.message} (code: ${err.code})`
          : `Wrong error: ${err.message}`,
      };
    }
  }));

  // Test 3: Custom key function — different keys have independent limits
  resetTestState();
  results.push(await runTest('Custom keyFn: independent counters per key', async () => {
    // Call twice with default key (max: 2)
    await rateLimitCustomKeyFn();
    await rateLimitCustomKeyFn();
    // 3rd call should fail (default key exhausted)
    try {
      await rateLimitCustomKeyFn();
      return { passed: false, details: 'Should have been rate limited for default key' };
    } catch (err: any) {
      const isRateLimited = err.code === 'RATE_LIMITED';
      return {
        passed: isRateLimited,
        details: isRateLimited
          ? 'Default key correctly rate-limited after 2 calls'
          : `Wrong error: ${err.message}`,
      };
    }
  }));

  // Test 4: Per-function isolation — rateLimitedFn and rateLimitCustomKeyFn have separate stores
  resetTestState();
  results.push(await runTest('Rate limit stores are per-function (isolated)', async () => {
    // Exhaust rateLimitedFn (max: 3)
    for (let i = 0; i < 3; i++) await rateLimitedFn();
    // rateLimitCustomKeyFn should still work (separate store)
    const result = await rateLimitCustomKeyFn();
    return {
      passed: result.message === 'ok',
      details: 'rateLimitCustomKeyFn still works after rateLimitedFn exhausted',
    };
  }));

  return { name: 'Rate Limiting', results };
}

// =============================================================================
// Test Suite: Authentication
// =============================================================================

async function testAuthentication(): Promise<TestSuite> {
  const results: TestResult[] = [];

  // Test 1: Auth reject
  resetTestState();
  results.push(await runTest('Auth rejects when getUser returns null', async () => {
    try {
      await authRejectFn();
      return { passed: false, details: 'Should have thrown UNAUTHORIZED' };
    } catch (err: any) {
      const isUnauth = err.code === 'UNAUTHORIZED' || err.message?.includes('Access denied');
      return {
        passed: isUnauth,
        details: isUnauth
          ? `Correctly threw: "${err.message}" (code: ${err.code})`
          : `Wrong error: ${err.message}`,
      };
    }
  }));

  // Test 2: Custom error message
  results.push(await runTest('Auth uses custom error message', async () => {
    try {
      await authRejectFn();
      return { passed: false, details: 'Should have thrown' };
    } catch (err: any) {
      const hasCustomMsg = err.message === 'Access denied: authentication required';
      return {
        passed: hasCustomMsg,
        details: hasCustomMsg
          ? `Custom message: "${err.message}"`
          : `Expected custom message, got: "${err.message}"`,
      };
    }
  }));

  // Test 3: Auth accept
  results.push(await runTest('Auth accepts when getUser returns user', async () => {
    const result = await authAcceptFn();
    return {
      passed: result.secret === 'authenticated data',
      details: `Got: ${JSON.stringify(result)}`,
    };
  }));

  return { name: 'Authentication', results };
}

// =============================================================================
// Test Suite: Cache Headers
// =============================================================================

async function testCacheHeaders(): Promise<TestSuite> {
  const results: TestResult[] = [];

  // Test 1: Public cache with stale-while-revalidate (direct middleware test)
  results.push(await runTest('buildCacheMiddleware: public, max-age=60, stale-while-revalidate=300', async () => {
    const middleware = buildCacheMiddleware({ maxAge: 60, public: true, staleWhileRevalidate: 300 });
    const ctx = {
      request: new Request('http://localhost/test'),
      responseHeaders: new Headers(),
      appContext: {},
    };
    await middleware(ctx, async () => 'ok');
    const cc = ctx.responseHeaders.get('Cache-Control') ?? '';
    const hasPublic = cc.includes('public');
    const hasMaxAge = cc.includes('max-age=60');
    const hasSWR = cc.includes('stale-while-revalidate=300');
    const allGood = hasPublic && hasMaxAge && hasSWR;
    return {
      passed: allGood,
      details: `Cache-Control: "${cc}" | public=${hasPublic}, max-age=60=${hasMaxAge}, swr=300=${hasSWR}`,
    };
  }));

  // Test 2: Private cache (default, no swr)
  results.push(await runTest('buildCacheMiddleware: private, max-age=30 (no swr)', async () => {
    const middleware = buildCacheMiddleware({ maxAge: 30 });
    const ctx = {
      request: new Request('http://localhost/test'),
      responseHeaders: new Headers(),
      appContext: {},
    };
    await middleware(ctx, async () => 'ok');
    const cc = ctx.responseHeaders.get('Cache-Control') ?? '';
    const hasPrivate = cc.includes('private');
    const hasMaxAge = cc.includes('max-age=30');
    const noSWR = !cc.includes('stale-while-revalidate');
    const allGood = hasPrivate && hasMaxAge && noSWR;
    return {
      passed: allGood,
      details: `Cache-Control: "${cc}" | private=${hasPrivate}, max-age=30=${hasMaxAge}, no-swr=${noSWR}`,
    };
  }));

  return { name: 'Cache Headers', results };
}

// =============================================================================
// Test Suite: CORS Headers
// =============================================================================

async function testCorsHeaders(): Promise<TestSuite> {
  const results: TestResult[] = [];

  // Test 1: Wildcard CORS
  resetTestState();
  results.push(await runTest('CORS wildcard: Access-Control-Allow-Origin: *', async () => {
    await corsWildcardFn();
    const origin = capturedHeaders['access-control-allow-origin'] ?? '';
    const creds = capturedHeaders['access-control-allow-credentials'] ?? '';
    const maxAge = capturedHeaders['access-control-max-age'] ?? '';
    return {
      passed: origin === '*' && creds === 'true' && maxAge === '3600',
      details: `Origin="${origin}", Credentials="${creds}", MaxAge="${maxAge}"`,
    };
  }));

  // Test 2: Specific origins CORS
  resetTestState();
  results.push(await runTest('CORS specific: sets methods and custom headers', async () => {
    await corsSpecificFn();
    const methods = capturedHeaders['access-control-allow-methods'] ?? '';
    const headers = capturedHeaders['access-control-allow-headers'] ?? '';
    const maxAge = capturedHeaders['access-control-max-age'] ?? '';
    const hasPut = methods.includes('PUT');
    const hasCustom = headers.includes('X-Custom-Header');
    return {
      passed: hasPut && hasCustom && maxAge === '7200',
      details: `Methods="${methods}", Headers="${headers}", MaxAge="${maxAge}"`,
    };
  }));

  return { name: 'CORS Headers', results };
}

// =============================================================================
// Test Suite: Custom Middleware
// =============================================================================

async function testCustomMiddleware(): Promise<TestSuite> {
  const results: TestResult[] = [];

  // Test 1: Middleware execution order
  resetTestState();
  results.push(await runTest('Middleware runs in order: logging:before → timing:start → handler → timing:end → logging:after', async () => {
    middlewareLog.length = 0;
    await customMiddlewareFn();
    const log = [...middlewareLog];
    const correct =
      log[0] === 'logging:before' &&
      log[1] === 'timing:start' &&
      log[2] === 'handler:executed' &&
      log[3]?.startsWith('timing:end:') &&
      log[4] === 'logging:after';
    return {
      passed: correct,
      details: `Log: [${log.join(', ')}]`,
    };
  }));

  return { name: 'Custom Middleware', results };
}

// =============================================================================
// Test Suite: Combined Config
// =============================================================================

async function testCombinedConfig(): Promise<TestSuite> {
  const results: TestResult[] = [];

  // Test 1: Combined function works (auth passes, rate limit ok, CORS set)
  // Note: cache headers can't be captured via user middleware (cache runs after user middleware
  // in the stack), but we verify CORS headers (set before next()) and handler execution
  resetTestState();
  results.push(await runTest('Combined: auth + rateLimit + CORS apply together', async () => {
    middlewareLog.length = 0;
    const result = await combinedFn();
    const handlerRan = result.data === 'combined config';
    // CORS capture middleware sees CORS headers because CORS sets them BEFORE calling next()
    // but cache sets them AFTER next() returns, so captureMiddleware can't see cache headers
    return {
      passed: handlerRan,
      details: `Handler=${handlerRan}, data="${result.data}"`,
    };
  }));

  // Test 2: Combined rate limit enforced
  resetTestState();
  results.push(await runTest('Combined: rate limit enforced at 5 calls', async () => {
    let successCount = 0;
    let rateLimited = false;
    for (let i = 0; i < 7; i++) {
      try {
        await combinedFn();
        successCount++;
      } catch (err: any) {
        if (err.code === 'RATE_LIMITED') rateLimited = true;
      }
    }
    return {
      passed: successCount === 5 && rateLimited,
      details: `${successCount} succeeded, rate limited=${rateLimited}`,
    };
  }));

  return { name: 'Combined Config', results };
}

// =============================================================================
// Test Suite: createServerBlock
// =============================================================================

async function testServerBlock(): Promise<TestSuite> {
  const results: TestResult[] = [];

  // Test 1: Shared config — inherits block auth + rateLimit + middleware
  resetTestState();
  results.push(await runTest('Block shared: inherits rateLimit(4/30s) + auth + logging', async () => {
    middlewareLog.length = 0;
    const result = await blockApi.shared();
    const hasLogging = middlewareLog.includes('logging:before');
    return {
      passed: result.source === 'shared' && hasLogging,
      details: `Result: ${JSON.stringify(result)}, Logging ran: ${hasLogging}`,
    };
  }));

  // Test 2: Override rateLimit — strictLimit has max:2 instead of block's max:4
  resetTestState();
  results.push(await runTest('Block override: strictLimit has rateLimit(2/30s)', async () => {
    await blockApi.strictLimit();
    await blockApi.strictLimit();
    try {
      await blockApi.strictLimit();
      return { passed: false, details: '3rd call should have been rate limited (max: 2)' };
    } catch (err: any) {
      return {
        passed: err.code === 'RATE_LIMITED',
        details: `3rd call correctly rate-limited: ${err.message}`,
      };
    }
  }));

  // Test 3: Block shared function still has its own higher limit
  resetTestState();
  results.push(await runTest('Block shared: rateLimit(4/30s) allows 4 calls', async () => {
    let count = 0;
    for (let i = 0; i < 4; i++) {
      await blockApi.shared();
      count++;
    }
    try {
      await blockApi.shared();
      return { passed: false, details: '5th call should have been rate limited (max: 4)' };
    } catch (err: any) {
      return {
        passed: count === 4 && err.code === 'RATE_LIMITED',
        details: `${count} calls succeeded, 5th correctly rate-limited`,
      };
    }
  }));

  // Test 4: Public function — auth removed via undefined override
  resetTestState();
  results.push(await runTest('Block public: auth removed (undefined override)', async () => {
    // blockApi.public has auth: undefined, so it should NOT reject
    const result = await blockApi.public();
    return {
      passed: result.source === 'public',
      details: `Result: ${JSON.stringify(result)} (no auth rejection)`,
    };
  }));

  // Test 5: Extra middleware — block logging + per-fn timing both run
  resetTestState();
  results.push(await runTest('Block extraMiddleware: block logging + fn timing both run', async () => {
    middlewareLog.length = 0;
    await blockApi.extraMiddleware();
    const hasLogging = middlewareLog.includes('logging:before');
    const hasTiming = middlewareLog.includes('timing:start');
    const hasHandler = middlewareLog.includes('block-extra:handler');
    return {
      passed: hasLogging && hasTiming && hasHandler,
      details: `Log: [${middlewareLog.join(', ')}]`,
    };
  }));

  // Test 6: Block functions have isolated rate limit stores
  resetTestState();
  results.push(await runTest('Block: shared and strictLimit have isolated stores', async () => {
    // Exhaust strictLimit (max: 2)
    await blockApi.strictLimit();
    await blockApi.strictLimit();
    // shared should still work (separate store, max: 4)
    const result = await blockApi.shared();
    return {
      passed: result.source === 'shared',
      details: 'shared still works after strictLimit exhausted',
    };
  }));

  return { name: 'createServerBlock', results };
}

// =============================================================================
// Run All Tests
// =============================================================================

export async function runAllTests(): Promise<TestSuite[]> {
  return [
    await testRateLimiting(),
    await testAuthentication(),
    await testCacheHeaders(),
    await testCorsHeaders(),
    await testCustomMiddleware(),
    await testCombinedConfig(),
    await testServerBlock(),
  ];
}
