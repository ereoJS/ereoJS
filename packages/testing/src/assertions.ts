/**
 * @areo/testing - Assertions
 *
 * Common assertions for testing responses.
 */

/**
 * Assertion options.
 */
export interface AssertionOptions {
  /** Custom error message */
  message?: string;
}

/**
 * Assert that a response is a redirect.
 *
 * @example
 * const result = await testAction(action, { formData: {} });
 * assertRedirect(result.response, '/login');
 */
export function assertRedirect(
  response: Response | null,
  expectedLocation?: string,
  options: AssertionOptions & { status?: number } = {}
): void {
  if (!response) {
    throw new Error(options.message || 'Expected a response but got null');
  }

  const status = response.status;
  const expectedStatus = options.status || 302;

  if (status < 300 || status >= 400) {
    throw new Error(
      options.message ||
        `Expected redirect status (3xx) but got ${status}`
    );
  }

  if (options.status && status !== expectedStatus) {
    throw new Error(
      options.message ||
        `Expected redirect status ${expectedStatus} but got ${status}`
    );
  }

  const location = response.headers.get('Location');

  if (expectedLocation) {
    if (!location) {
      throw new Error(
        options.message ||
          'Expected Location header but it was not set'
      );
    }

    if (location !== expectedLocation) {
      throw new Error(
        options.message ||
          `Expected redirect to "${expectedLocation}" but got "${location}"`
      );
    }
  }
}

/**
 * Assert that a response has the expected JSON body.
 *
 * @example
 * const result = await testLoader(loader, { params: { id: '1' } });
 * await assertJson(result.data, { id: 1, name: 'Test' });
 */
export async function assertJson<T = unknown>(
  responseOrData: Response | T,
  expected: Partial<T>,
  options: AssertionOptions = {}
): Promise<void> {
  let data: T;

  if (responseOrData instanceof Response) {
    try {
      data = await responseOrData.clone().json();
    } catch {
      throw new Error(
        options.message ||
          'Failed to parse response body as JSON'
      );
    }
  } else {
    data = responseOrData;
  }

  // Deep partial match
  for (const [key, value] of Object.entries(expected as Record<string, unknown>)) {
    const actual = (data as Record<string, unknown>)[key];

    if (JSON.stringify(actual) !== JSON.stringify(value)) {
      throw new Error(
        options.message ||
          `Expected "${key}" to be ${JSON.stringify(value)} but got ${JSON.stringify(actual)}`
      );
    }
  }
}

/**
 * Assert that a response has the expected status code.
 *
 * @example
 * const result = await testMiddleware(authMiddleware, {});
 * assertStatus(result.response, 401);
 */
export function assertStatus(
  response: Response | null,
  expected: number | number[],
  options: AssertionOptions = {}
): void {
  if (!response) {
    throw new Error(options.message || 'Expected a response but got null');
  }

  const expectedStatuses = Array.isArray(expected) ? expected : [expected];

  if (!expectedStatuses.includes(response.status)) {
    throw new Error(
      options.message ||
        `Expected status ${expectedStatuses.join(' or ')} but got ${response.status}`
    );
  }
}

/**
 * Assert that a response has the expected headers.
 *
 * @example
 * const result = await testLoader(loader, {});
 * assertHeaders(result.response, {
 *   'Content-Type': 'application/json',
 *   'Cache-Control': /max-age=\d+/,
 * });
 */
export function assertHeaders(
  response: Response | null,
  expected: Record<string, string | RegExp>,
  options: AssertionOptions = {}
): void {
  if (!response) {
    throw new Error(options.message || 'Expected a response but got null');
  }

  for (const [name, expectedValue] of Object.entries(expected)) {
    const actual = response.headers.get(name);

    if (actual === null) {
      throw new Error(
        options.message ||
          `Expected header "${name}" to be set but it was not`
      );
    }

    if (expectedValue instanceof RegExp) {
      if (!expectedValue.test(actual)) {
        throw new Error(
          options.message ||
            `Expected header "${name}" to match ${expectedValue} but got "${actual}"`
        );
      }
    } else {
      if (actual !== expectedValue) {
        throw new Error(
          options.message ||
            `Expected header "${name}" to be "${expectedValue}" but got "${actual}"`
        );
      }
    }
  }
}

/**
 * Assert that a response sets the expected cookies.
 *
 * @example
 * const result = await testAction(loginAction, {
 *   formData: { email: 'test@example.com', password: 'secret' },
 * });
 * assertCookies(result.response, {
 *   session: { exists: true, httpOnly: true },
 * });
 */
export function assertCookies(
  response: Response | null,
  expected: Record<string, {
    exists?: boolean;
    value?: string | RegExp;
    httpOnly?: boolean;
    secure?: boolean;
    sameSite?: 'Strict' | 'Lax' | 'None';
    path?: string;
    maxAge?: number;
    expires?: boolean;
  }>,
  options: AssertionOptions = {}
): void {
  if (!response) {
    throw new Error(options.message || 'Expected a response but got null');
  }

  const setCookieHeaders = response.headers.getSetCookie?.() || [];
  const cookies = new Map<string, string>();

  for (const header of setCookieHeaders) {
    const [nameValue] = header.split(';');
    const eqIndex = nameValue.indexOf('=');
    if (eqIndex > 0) {
      const name = nameValue.slice(0, eqIndex).trim();
      cookies.set(name, header);
    }
  }

  for (const [name, expectations] of Object.entries(expected)) {
    const cookieHeader = cookies.get(name);

    if (expectations.exists === false) {
      if (cookieHeader) {
        throw new Error(
          options.message ||
            `Expected cookie "${name}" not to be set but it was`
        );
      }
      continue;
    }

    if (expectations.exists !== false && !cookieHeader) {
      throw new Error(
        options.message ||
          `Expected cookie "${name}" to be set but it was not`
      );
    }

    if (!cookieHeader) continue;

    const headerLower = cookieHeader.toLowerCase();

    if (expectations.value) {
      const [nameValue] = cookieHeader.split(';');
      const value = nameValue.split('=').slice(1).join('=');

      if (expectations.value instanceof RegExp) {
        if (!expectations.value.test(value)) {
          throw new Error(
            options.message ||
              `Expected cookie "${name}" value to match ${expectations.value} but got "${value}"`
          );
        }
      } else {
        if (value !== expectations.value) {
          throw new Error(
            options.message ||
              `Expected cookie "${name}" value to be "${expectations.value}" but got "${value}"`
          );
        }
      }
    }

    if (expectations.httpOnly !== undefined) {
      const hasHttpOnly = headerLower.includes('httponly');
      if (expectations.httpOnly !== hasHttpOnly) {
        throw new Error(
          options.message ||
            `Expected cookie "${name}" HttpOnly to be ${expectations.httpOnly}`
        );
      }
    }

    if (expectations.secure !== undefined) {
      const hasSecure = headerLower.includes('secure');
      if (expectations.secure !== hasSecure) {
        throw new Error(
          options.message ||
            `Expected cookie "${name}" Secure to be ${expectations.secure}`
        );
      }
    }

    if (expectations.sameSite) {
      const hasSameSite = headerLower.includes(`samesite=${expectations.sameSite.toLowerCase()}`);
      if (!hasSameSite) {
        throw new Error(
          options.message ||
            `Expected cookie "${name}" SameSite to be ${expectations.sameSite}`
        );
      }
    }

    if (expectations.path) {
      const hasPath = headerLower.includes(`path=${expectations.path.toLowerCase()}`);
      if (!hasPath) {
        throw new Error(
          options.message ||
            `Expected cookie "${name}" Path to be ${expectations.path}`
        );
      }
    }
  }
}

/**
 * Assert that an error was thrown.
 *
 * @example
 * await assertThrows(
 *   () => testLoader(loader, { params: { id: 'invalid' } }),
 *   { message: /not found/i, status: 404 }
 * );
 */
export async function assertThrows(
  fn: () => Promise<unknown>,
  expected: {
    message?: string | RegExp;
    name?: string;
    status?: number;
  } = {},
  options: AssertionOptions = {}
): Promise<void> {
  let error: Error | null = null;

  try {
    await fn();
  } catch (e) {
    error = e instanceof Error ? e : new Error(String(e));
  }

  if (!error) {
    throw new Error(options.message || 'Expected function to throw but it did not');
  }

  if (expected.message) {
    if (expected.message instanceof RegExp) {
      if (!expected.message.test(error.message)) {
        throw new Error(
          options.message ||
            `Expected error message to match ${expected.message} but got "${error.message}"`
        );
      }
    } else {
      if (error.message !== expected.message) {
        throw new Error(
          options.message ||
            `Expected error message to be "${expected.message}" but got "${error.message}"`
        );
      }
    }
  }

  if (expected.name && error.name !== expected.name) {
    throw new Error(
      options.message ||
        `Expected error name to be "${expected.name}" but got "${error.name}"`
    );
  }

  if (expected.status && 'status' in error && (error as { status: number }).status !== expected.status) {
    throw new Error(
      options.message ||
        `Expected error status to be ${expected.status} but got ${(error as { status: number }).status}`
    );
  }
}

/**
 * Assert that a value matches a schema (basic type checking).
 *
 * @example
 * await assertSchema(result.data, {
 *   id: 'number',
 *   name: 'string',
 *   tags: 'array',
 *   meta: 'object',
 * });
 */
export function assertSchema(
  data: unknown,
  schema: Record<string, 'string' | 'number' | 'boolean' | 'object' | 'array' | 'null' | 'undefined'>,
  options: AssertionOptions = {}
): void {
  if (typeof data !== 'object' || data === null) {
    throw new Error(options.message || 'Expected data to be an object');
  }

  const obj = data as Record<string, unknown>;

  for (const [key, expectedType] of Object.entries(schema)) {
    const value = obj[key];
    let actualType: string;

    if (value === null) {
      actualType = 'null';
    } else if (value === undefined) {
      actualType = 'undefined';
    } else if (Array.isArray(value)) {
      actualType = 'array';
    } else {
      actualType = typeof value;
    }

    if (actualType !== expectedType) {
      throw new Error(
        options.message ||
          `Expected "${key}" to be ${expectedType} but got ${actualType}`
      );
    }
  }
}
