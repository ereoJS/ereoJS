/**
 * @ereo/client-sdk - Type-safe API client
 *
 * Provides end-to-end type safety for API calls.
 */

import type {
  ApiPaths,
  HttpMethod,
  ApiRequestConfig,
  ApiResponse,
  ApiError,
  ClientConfig,
  ResponseType,
  RequestBody,
  QueryParams,
  PathParams,
} from './types';

/** Default client configuration */
const defaultConfig: ClientConfig = {
  baseUrl: '',
  timeout: 30000,
  debug: false,
};

/** Global client instance */
let globalClient: ApiClient | undefined;

/**
 * Type-safe API client for making HTTP requests.
 */
export class ApiClient {
  private config: ClientConfig;

  constructor(config: ClientConfig = {}) {
    this.config = { ...defaultConfig, ...config };
  }

  /**
   * Update client configuration.
   */
  configure(config: Partial<ClientConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Make a type-safe API request.
   */
  async request<
    Path extends ApiPaths,
    Method extends HttpMethod = 'GET'
  >(
    config: ApiRequestConfig<Path, Method>
  ): Promise<ApiResponse<ResponseType<Path, Method>>> {
    const mergedConfig = this.config.onRequest
      ? await this.config.onRequest(config as ApiRequestConfig)
      : config;

    const url = this.buildUrl(mergedConfig);
    const init = this.buildInit(mergedConfig);

    if (this.config.debug) {
      console.log(`[API] ${init.method} ${url}`);
    }

    try {
      const fetchFn = this.config.fetch || fetch;
      const response = await fetchFn(url, init);

      const apiResponse = await this.parseResponse<ResponseType<Path, Method>>(response);

      if (this.config.onResponse) {
        return this.config.onResponse(apiResponse) as Promise<ApiResponse<ResponseType<Path, Method>>>;
      }

      return apiResponse;
    } catch (error) {
      const apiError = this.createError(error as Error, config.path as string, config.method);
      if (this.config.onError) {
        await this.config.onError(apiError);
      }
      throw apiError;
    }
  }

  /**
   * Make a GET request.
   */
  async get<Path extends ApiPaths>(
    path: Path,
    options?: {
      params?: PathParams<Path extends string ? Path : string>;
      query?: QueryParams<Path, 'GET'>;
      headers?: Record<string, string>;
      signal?: AbortSignal;
    }
  ): Promise<ApiResponse<ResponseType<Path, 'GET'>>> {
    return this.request({
      path,
      method: 'GET',
      ...options,
    } as ApiRequestConfig<Path, 'GET'>);
  }

  /**
   * Make a POST request.
   */
  async post<Path extends ApiPaths>(
    path: Path,
    options?: {
      params?: PathParams<Path extends string ? Path : string>;
      body?: RequestBody<Path, 'POST'>;
      headers?: Record<string, string>;
      signal?: AbortSignal;
    }
  ): Promise<ApiResponse<ResponseType<Path, 'POST'>>> {
    return this.request({
      path,
      method: 'POST',
      ...options,
    } as ApiRequestConfig<Path, 'POST'>);
  }

  /**
   * Make a PUT request.
   */
  async put<Path extends ApiPaths>(
    path: Path,
    options?: {
      params?: PathParams<Path extends string ? Path : string>;
      body?: RequestBody<Path, 'PUT'>;
      headers?: Record<string, string>;
      signal?: AbortSignal;
    }
  ): Promise<ApiResponse<ResponseType<Path, 'PUT'>>> {
    return this.request({
      path,
      method: 'PUT',
      ...options,
    } as ApiRequestConfig<Path, 'PUT'>);
  }

  /**
   * Make a PATCH request.
   */
  async patch<Path extends ApiPaths>(
    path: Path,
    options?: {
      params?: PathParams<Path extends string ? Path : string>;
      body?: RequestBody<Path, 'PATCH'>;
      headers?: Record<string, string>;
      signal?: AbortSignal;
    }
  ): Promise<ApiResponse<ResponseType<Path, 'PATCH'>>> {
    return this.request({
      path,
      method: 'PATCH',
      ...options,
    } as ApiRequestConfig<Path, 'PATCH'>);
  }

  /**
   * Make a DELETE request.
   */
  async delete<Path extends ApiPaths>(
    path: Path,
    options?: {
      params?: PathParams<Path extends string ? Path : string>;
      headers?: Record<string, string>;
      signal?: AbortSignal;
    }
  ): Promise<ApiResponse<ResponseType<Path, 'DELETE'>>> {
    return this.request({
      path,
      method: 'DELETE',
      ...options,
    } as ApiRequestConfig<Path, 'DELETE'>);
  }

  /**
   * Build the full URL for a request.
   */
  private buildUrl(config: ApiRequestConfig): string {
    let path = String(config.path);

    // Replace path parameters
    if (config.params) {
      for (const [key, value] of Object.entries(config.params)) {
        path = path.replace(`[${key}]`, encodeURIComponent(String(value)));
      }
    }

    // Build query string
    if (config.query) {
      const params = new URLSearchParams();
      for (const [key, value] of Object.entries(config.query)) {
        if (value !== undefined && value !== null) {
          params.append(key, String(value));
        }
      }
      const queryString = params.toString();
      if (queryString) {
        path += `?${queryString}`;
      }
    }

    return `${this.config.baseUrl}${path}`;
  }

  /**
   * Build fetch init options.
   */
  private buildInit(config: ApiRequestConfig): RequestInit {
    const headers: Record<string, string> = {
      'Accept': 'application/json',
      ...this.config.headers,
      ...config.headers,
    };

    const init: RequestInit = {
      method: config.method,
      headers,
      signal: config.signal,
    };

    if (config.body !== undefined) {
      if (config.body instanceof FormData) {
        // Don't set Content-Type for FormData - browser will set with boundary
        delete headers['Content-Type'];
        init.body = config.body;
      } else if (config.body instanceof URLSearchParams) {
        headers['Content-Type'] = 'application/x-www-form-urlencoded';
        init.body = config.body;
      } else {
        headers['Content-Type'] = 'application/json';
        init.body = JSON.stringify(config.body);
      }
    }

    return init;
  }

  /**
   * Parse the response.
   */
  private async parseResponse<T>(response: Response): Promise<ApiResponse<T>> {
    const contentType = response.headers.get('content-type') || '';
    let data: unknown;

    if (contentType.includes('application/json')) {
      data = await response.json();
    } else {
      data = await response.text();
    }

    return {
      data: data as T,
      status: response.status,
      headers: response.headers,
      ok: response.ok,
    };
  }

  /**
   * Create an API error.
   */
  private createError(error: Error, path: string, method: string): ApiError {
    const apiError = new Error(error.message) as ApiError;
    apiError.status = 0;
    apiError.path = path;
    apiError.method = method;
    apiError.name = 'ApiError';
    return apiError;
  }
}

/**
 * Create a new API client instance.
 */
export function createClient(config?: ClientConfig): ApiClient {
  return new ApiClient(config);
}

/**
 * Get the global API client instance.
 * Creates one if it doesn't exist.
 */
export function getGlobalClient(): ApiClient {
  if (!globalClient) {
    globalClient = new ApiClient();
  }
  return globalClient;
}

/**
 * Configure the global API client.
 */
export function configureClient(config: ClientConfig): void {
  if (!globalClient) {
    globalClient = new ApiClient(config);
  } else {
    globalClient.configure(config);
  }
}

/**
 * Type-safe API request helper.
 * Uses the global client by default.
 *
 * @example
 * const { data: posts } = await api('/api/posts').get();
 * const { data: post } = await api('/api/posts').post({ body: { title: 'Hello' } });
 */
export function api<Path extends ApiPaths>(path: Path) {
  const client = getGlobalClient();

  return {
    get: (options?: { params?: Record<string, string>; query?: Record<string, unknown>; headers?: Record<string, string>; signal?: AbortSignal }) =>
      client.get(path, options as any),
    post: (options?: { params?: Record<string, string>; body?: unknown; headers?: Record<string, string>; signal?: AbortSignal }) =>
      client.post(path, options as any),
    put: (options?: { params?: Record<string, string>; body?: unknown; headers?: Record<string, string>; signal?: AbortSignal }) =>
      client.put(path, options as any),
    patch: (options?: { params?: Record<string, string>; body?: unknown; headers?: Record<string, string>; signal?: AbortSignal }) =>
      client.patch(path, options as any),
    delete: (options?: { params?: Record<string, string>; headers?: Record<string, string>; signal?: AbortSignal }) =>
      client.delete(path, options as any),
  };
}
