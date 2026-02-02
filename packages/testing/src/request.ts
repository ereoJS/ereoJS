/**
 * @oreo/testing - Request Utilities
 *
 * Create mock requests for testing.
 */

/**
 * Options for creating a mock request.
 */
export interface MockRequestOptions {
  /** HTTP method (default: GET) */
  method?: string;
  /** Request URL or path */
  url?: string;
  /** Request headers */
  headers?: Record<string, string>;
  /** Request body (for POST/PUT/PATCH) */
  body?: BodyInit | Record<string, unknown>;
  /** Query parameters */
  searchParams?: Record<string, string | string[]>;
  /** Form data */
  formData?: Record<string, string | Blob>;
  /** Cookies */
  cookies?: Record<string, string>;
}

/**
 * Create a mock Request object for testing.
 *
 * @example
 * // Simple GET request
 * const request = createMockRequest({ url: '/api/posts' });
 *
 * // POST with JSON body
 * const request = createMockRequest({
 *   method: 'POST',
 *   url: '/api/posts',
 *   body: { title: 'Test Post' },
 * });
 *
 * // POST with form data
 * const request = createMockRequest({
 *   method: 'POST',
 *   url: '/api/login',
 *   formData: { email: 'test@example.com', password: 'secret' },
 * });
 */
export function createMockRequest(url?: string | MockRequestOptions, options?: MockRequestOptions): Request {
  // Support both (options) and (url, options) signatures
  if (typeof url === 'string') {
    options = { ...options, url };
  } else if (url) {
    options = url;
  } else {
    options = options || {};
  }
  return createMockRequestImpl(options);
}

function createMockRequestImpl(options: MockRequestOptions = {}): Request {
  const {
    method = 'GET',
    url = '/',
    headers = {},
    body,
    searchParams,
    formData,
    cookies,
  } = options;

  // Build URL with search params
  let requestUrl = url.startsWith('http') ? url : `http://localhost:3000${url}`;
  if (searchParams) {
    const urlObj = new URL(requestUrl);
    for (const [key, value] of Object.entries(searchParams)) {
      if (Array.isArray(value)) {
        value.forEach((v) => urlObj.searchParams.append(key, v));
      } else {
        urlObj.searchParams.set(key, value);
      }
    }
    requestUrl = urlObj.toString();
  }

  // Build headers
  const requestHeaders = new Headers(headers);

  // Add cookies
  if (cookies) {
    const cookieString = Object.entries(cookies)
      .map(([name, value]) => `${name}=${value}`)
      .join('; ');
    requestHeaders.set('Cookie', cookieString);
  }

  // Build body
  let requestBody: BodyInit | null = null;

  if (formData) {
    const fd = new FormData();
    for (const [key, value] of Object.entries(formData)) {
      fd.append(key, value);
    }
    requestBody = fd;
  } else if (body) {
    if (typeof body === 'object' && !(body instanceof Blob) && !(body instanceof FormData)) {
      requestBody = JSON.stringify(body);
      if (!requestHeaders.has('Content-Type')) {
        requestHeaders.set('Content-Type', 'application/json');
      }
    } else {
      requestBody = body as BodyInit;
    }
  }

  return new Request(requestUrl, {
    method,
    headers: requestHeaders,
    body: requestBody,
  });
}

/**
 * Create a POST request with form data (convenience function).
 *
 * @example
 * const request = createFormRequest('/api/login', {
 *   email: 'test@example.com',
 *   password: 'secret',
 * });
 */
export function createFormRequest(
  url: string,
  data: Record<string, string | Blob>
): Request {
  const formData = new URLSearchParams();
  for (const [key, value] of Object.entries(data)) {
    if (typeof value === 'string') {
      formData.append(key, value);
    }
  }
  return new Request(url.startsWith('http') ? url : `http://localhost:3000${url}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: formData.toString(),
  });
}

/**
 * Create mock FormData for testing.
 *
 * @example
 * const formData = createMockFormData({
 *   email: 'test@example.com',
 *   password: 'secret',
 * });
 */
export function createMockFormData(
  data: Record<string, string | Blob | File>
): FormData {
  const formData = new FormData();
  for (const [key, value] of Object.entries(data)) {
    formData.append(key, value);
  }
  return formData;
}

/**
 * Create mock Headers for testing.
 *
 * @example
 * const headers = createMockHeaders({
 *   'Authorization': 'Bearer token123',
 *   'Content-Type': 'application/json',
 * });
 */
export function createMockHeaders(data: Record<string, string>): Headers {
  return new Headers(data);
}

/**
 * Parse JSON from a Response.
 *
 * @example
 * const result = await testAction(action, options);
 * const data = await parseJsonResponse<MyData>(result.response);
 */
export async function parseJsonResponse<T = unknown>(response: Response): Promise<T> {
  const text = await response.text();
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(`Failed to parse JSON response: ${text.slice(0, 100)}`);
  }
}

/**
 * Parse text from a Response.
 */
export async function parseTextResponse(response: Response): Promise<string> {
  return response.text();
}

/**
 * Create a mock File for testing file uploads.
 *
 * @example
 * const file = createMockFile('test.txt', 'Hello World', 'text/plain');
 */
export function createMockFile(
  name: string,
  content: string | Blob,
  type = 'application/octet-stream'
): File {
  const blob = typeof content === 'string' ? new Blob([content], { type }) : content;
  return new File([blob], name, { type });
}

/**
 * Extract cookies from a Response.
 *
 * @example
 * const cookies = extractCookies(response);
 * expect(cookies.session).toBeDefined();
 */
export function extractCookies(response: Response): Record<string, string> {
  const cookies: Record<string, string> = {};
  const setCookieHeaders = response.headers.getSetCookie?.() || [];

  for (const header of setCookieHeaders) {
    const [nameValue] = header.split(';');
    const [name, value] = nameValue.split('=');
    if (name && value !== undefined) {
      cookies[name.trim()] = value.trim();
    }
  }

  return cookies;
}
