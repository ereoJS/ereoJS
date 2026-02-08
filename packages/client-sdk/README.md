# @ereo/client-sdk

Type-safe client SDK for EreoJS framework APIs. Provides end-to-end type safety for HTTP requests with a clean, ergonomic API.

## Installation

```bash
bun add @ereo/client-sdk
```

## Quick Start

```typescript
import { api, createClient, configureClient } from '@ereo/client-sdk';

// Configure the global client
configureClient({
  baseUrl: 'https://api.example.com',
  headers: { 'Authorization': 'Bearer token' },
});

// Simple API calls
const { data: posts } = await api('/api/posts').get();
const { data: post } = await api('/api/posts').post({
  body: { title: 'Hello World' },
});

// Or create a dedicated client instance
const client = createClient({
  baseUrl: 'https://api.example.com',
  timeout: 10000, // default is 30000ms
});

const { data } = await client.get('/api/users', {
  query: { page: 1, limit: 10 },
});
```

## API

### `api(path)`

Quick helper using the global client.

```typescript
// GET request
const { data } = await api('/api/posts').get();

// POST with body
const { data } = await api('/api/posts').post({
  body: { title: 'New Post' },
});

// With path parameters
const { data } = await api('/api/posts/[id]').get({
  params: { id: '123' },
});

// With query parameters
const { data } = await api('/api/posts').get({
  query: { page: 1, limit: 10 },
});
```

### `createClient(config?)`

Create a new API client instance.

```typescript
const client = createClient({
  baseUrl: 'https://api.example.com',
  timeout: 30000,
  headers: { 'X-API-Key': 'key' },
  debug: true,
  onRequest: async (config) => config,
  onResponse: async (response) => response,
  onError: async (error) => console.error(error),
});
```

### `configureClient(config)`

Configure the global API client instance. Call once at app startup.

```typescript
import { configureClient } from '@ereo/client-sdk';

configureClient({
  baseUrl: '/api',
  headers: { 'X-API-Version': '1' },
  onError: async (error) => {
    if (error.status === 401) {
      // Handle unauthorized
    }
  },
});
```

### `getGlobalClient()`

Get the global API client instance, creating one if it does not exist.

```typescript
import { getGlobalClient } from '@ereo/client-sdk';

const client = getGlobalClient();
const { data } = await client.get('/api/users');
```

### `ApiClient` Class

The main client class returned by `createClient()`.

```typescript
import { createClient, ApiClient } from '@ereo/client-sdk';

const client: ApiClient = createClient({ baseUrl: '/api' });

// Instance methods
client.configure({ debug: true }); // Update configuration
client.get(path, options?)         // GET request
client.post(path, options?)        // POST request
client.put(path, options?)         // PUT request
client.patch(path, options?)       // PATCH request
client.delete(path, options?)      // DELETE request
client.request(config)             // Generic request
```

### HTTP Methods

All standard HTTP methods are supported:

```typescript
client.get(path, options?)
client.post(path, options?)
client.put(path, options?)
client.patch(path, options?)
client.delete(path, options?)
```

### Request Options

```typescript
{
  params?: Record<string, string>,  // Path parameters
  query?: Record<string, unknown>,  // Query string parameters
  body?: unknown,                   // Request body (POST/PUT/PATCH)
  headers?: Record<string, string>, // Additional headers
  signal?: AbortSignal,             // Abort controller signal
}
```

## Body Types

The client automatically handles different body types:

```typescript
// JSON body (default)
await api('/api/posts').post({
  body: { title: 'Hello', content: 'World' },
});

// FormData (for file uploads)
const formData = new FormData();
formData.append('file', fileInput.files[0]);
formData.append('name', 'My File');

await api('/api/upload').post({ body: formData });

// URLSearchParams
const params = new URLSearchParams();
params.append('grant_type', 'client_credentials');

await api('/api/oauth/token').post({ body: params });
```

## Error Handling

```typescript
import { api } from '@ereo/client-sdk';
import type { ApiError } from '@ereo/client-sdk';

try {
  const { data } = await api('/api/posts').get();
} catch (error) {
  const apiError = error as ApiError;
  console.log(apiError.status);  // HTTP status code
  console.log(apiError.path);    // Request path
  console.log(apiError.method);  // Request method
  console.log(apiError.message); // Error message
}
```

## Type Exports

The package exports the following types for TypeScript users:

```typescript
import type {
  HttpMethod,           // 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS'
  ApiRoutes,            // Module augmentation interface for route types
  ApiPaths,             // All registered API route paths
  MethodsFor,           // Get supported methods for a path
  RequestBody,          // Get request body type for path/method
  ResponseType,         // Get response type for path/method
  QueryParams,          // Get query params type for path/method
  PathParams,           // Extract path params from route string
  ApiRequestConfig,     // Full request configuration
  ApiResponse,          // Response wrapper { data, status, headers, ok }
  ApiError,             // Error with status, path, method
  ClientConfig,         // Client configuration options
  DefineApiTypes,       // Helper for defining route API types
} from '@ereo/client-sdk';
```

## Key Features

- End-to-end type safety with TypeScript
- Path parameter substitution (`/api/posts/[id]`)
- Query string building
- Automatic JSON serialization
- FormData and URLSearchParams support
- Request/response interceptors
- Error handling with custom callbacks
- Configurable timeout (default: 30000ms)
- Debug mode for logging

## Documentation

For full documentation, visit [https://ereo.dev/docs/client-sdk](https://ereo.dev/docs/client-sdk)

## Part of EreoJS

This package is part of the [EreoJS monorepo](https://github.com/ereoJS/ereoJS).

## License

MIT
