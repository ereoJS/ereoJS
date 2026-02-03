# @ereo/client-sdk

Type-safe client SDK for making API calls to EreoJS applications. Provides end-to-end type safety from your API routes to your client code.

## Import

```ts
import {
  ApiClient,
  createClient,
  getGlobalClient,
  configureClient,
  api
} from '@ereo/client-sdk'
```

## Overview

The `@ereo/client-sdk` package provides a fully type-safe HTTP client for consuming EreoJS API routes. When used with TypeScript, it offers autocomplete for routes, type checking for request bodies and query parameters, and typed responses.

## Installation

```bash
bun add @ereo/client-sdk
```

## Quick Start

```ts
import { api } from '@ereo/client-sdk'

// Make type-safe API calls
const { data: posts } = await api('/api/posts').get()
const { data: post } = await api('/api/posts').post({ body: { title: 'Hello' } })
```

## API Reference

### createClient

Creates a new API client instance with custom configuration.

#### Signature

```ts
function createClient(config?: ClientConfig): ApiClient
```

#### Configuration

```ts
interface ClientConfig {
  // Base URL for API requests
  baseUrl?: string

  // Default headers for all requests
  headers?: Record<string, string>

  // Request timeout in milliseconds (default: 30000)
  timeout?: number

  // Enable request/response logging
  debug?: boolean

  // Custom fetch implementation
  fetch?: typeof fetch

  // Request interceptor
  onRequest?: (config: ApiRequestConfig) => ApiRequestConfig | Promise<ApiRequestConfig>

  // Response interceptor
  onResponse?: <T>(response: ApiResponse<T>) => ApiResponse<T> | Promise<ApiResponse<T>>

  // Error handler
  onError?: (error: ApiError) => void | Promise<void>
}
```

#### Example

```ts
import { createClient } from '@ereo/client-sdk'

const client = createClient({
  baseUrl: 'https://api.example.com',
  headers: {
    'Authorization': `Bearer ${token}`
  },
  timeout: 10000,
  debug: process.env.NODE_ENV === 'development'
})
```

### configureClient

Configures the global API client.

#### Signature

```ts
function configureClient(config: ClientConfig): void
```

#### Example

```ts
import { configureClient } from '@ereo/client-sdk'

// Configure once at app startup
configureClient({
  baseUrl: '/api',
  headers: {
    'X-API-Version': '1'
  }
})
```

### getGlobalClient

Gets the global API client instance, creating one if it does not exist.

#### Signature

```ts
function getGlobalClient(): ApiClient
```

### api

Type-safe API request helper using the global client.

#### Signature

```ts
function api<Path extends ApiPaths>(path: Path): {
  get: (options?) => Promise<ApiResponse<ResponseType<Path, 'GET'>>>
  post: (options?) => Promise<ApiResponse<ResponseType<Path, 'POST'>>>
  put: (options?) => Promise<ApiResponse<ResponseType<Path, 'PUT'>>>
  patch: (options?) => Promise<ApiResponse<ResponseType<Path, 'PATCH'>>>
  delete: (options?) => Promise<ApiResponse<ResponseType<Path, 'DELETE'>>>
}
```

#### Example

```ts
import { api } from '@ereo/client-sdk'

// GET request
const { data: users } = await api('/api/users').get()

// GET with query parameters
const { data: filteredUsers } = await api('/api/users').get({
  query: { role: 'admin', limit: 10 }
})

// POST with body
const { data: newUser } = await api('/api/users').post({
  body: { name: 'John', email: 'john@example.com' }
})

// PUT with path parameters
const { data: updatedUser } = await api('/api/users/[id]').put({
  params: { id: '123' },
  body: { name: 'John Updated' }
})

// DELETE
await api('/api/users/[id]').delete({
  params: { id: '123' }
})
```

### ApiClient Class

The main client class for making HTTP requests.

#### Methods

| Method | Description |
|--------|-------------|
| `configure(config)` | Update client configuration |
| `request(config)` | Make a generic request |
| `get(path, options?)` | Make a GET request |
| `post(path, options?)` | Make a POST request |
| `put(path, options?)` | Make a PUT request |
| `patch(path, options?)` | Make a PATCH request |
| `delete(path, options?)` | Make a DELETE request |

#### Example

```ts
import { createClient } from '@ereo/client-sdk'

const client = createClient({ baseUrl: '/api' })

// Using convenience methods
const users = await client.get('/users')
const newUser = await client.post('/users', { body: { name: 'John' } })

// Using generic request
const result = await client.request({
  path: '/users',
  method: 'GET',
  query: { limit: 10 }
})
```

## Type Safety

### Defining API Types

API types can be defined directly in your route files:

```ts
// app/routes/api/posts.ts
import type { DefineApiTypes } from '@ereo/client-sdk'

interface Post {
  id: string
  title: string
  content: string
}

interface CreatePostInput {
  title: string
  content: string
}

export interface ApiTypes extends DefineApiTypes<{
  GET: {
    response: Post[]
    query: { limit?: number; offset?: number }
  }
  POST: {
    body: CreatePostInput
    response: Post
  }
}> {}

export async function GET({ query }) {
  // query is typed as { limit?: number; offset?: number }
  return { posts: await getPosts(query) }
}

export async function POST({ body }) {
  // body is typed as CreatePostInput
  return { post: await createPost(body) }
}
```

### Module Augmentation

For full end-to-end type safety, augment the `ApiRoutes` interface:

```ts
// types/api.d.ts
declare module '@ereo/client-sdk' {
  interface ApiRoutes {
    '/api/posts': {
      GET: {
        response: Post[]
        query?: { limit?: number; offset?: number }
      }
      POST: {
        body: CreatePostInput
        response: Post
      }
    }
    '/api/posts/[id]': {
      GET: {
        response: Post
      }
      PUT: {
        body: Partial<CreatePostInput>
        response: Post
      }
      DELETE: {
        response: { success: boolean }
      }
    }
  }
}
```

Now your API calls are fully typed:

```ts
import { api } from '@ereo/client-sdk'

// Autocomplete for paths
const { data } = await api('/api/posts').get({
  query: { limit: 10 } // Type checked
})

// data is typed as Post[]
console.log(data[0].title)
```

## Error Handling

### ApiError Interface

```ts
interface ApiError extends Error {
  status: number    // HTTP status code
  data?: unknown    // Response data (if any)
  path: string      // Request path
  method: string    // Request method
}
```

### Handling Errors

```ts
import { api } from '@ereo/client-sdk'

try {
  const { data } = await api('/api/posts').get()
} catch (error) {
  if (error.status === 404) {
    console.log('Resource not found')
  } else if (error.status === 401) {
    // Redirect to login
  } else {
    console.error('API Error:', error.message)
  }
}
```

### Global Error Handler

```ts
import { configureClient } from '@ereo/client-sdk'

configureClient({
  onError: async (error) => {
    if (error.status === 401) {
      // Refresh token or redirect to login
      await refreshAuth()
    }

    // Log to error tracking service
    trackError(error)
  }
})
```

## Interceptors

### Request Interceptor

Modify requests before they are sent:

```ts
import { configureClient } from '@ereo/client-sdk'

configureClient({
  onRequest: async (config) => {
    // Add auth token to every request
    const token = await getAuthToken()

    return {
      ...config,
      headers: {
        ...config.headers,
        'Authorization': `Bearer ${token}`
      }
    }
  }
})
```

### Response Interceptor

Transform responses before they are returned:

```ts
import { configureClient } from '@ereo/client-sdk'

configureClient({
  onResponse: async (response) => {
    // Log all responses
    console.log(`[${response.status}] ${response.ok ? 'OK' : 'Error'}`)

    // Transform data
    return {
      ...response,
      data: camelCaseKeys(response.data)
    }
  }
})
```

## Request Options

### Query Parameters

```ts
const { data } = await api('/api/posts').get({
  query: {
    page: 1,
    limit: 20,
    sort: 'createdAt',
    order: 'desc'
  }
})
```

### Path Parameters

For dynamic routes like `/api/posts/[id]`:

```ts
const { data } = await api('/api/posts/[id]').get({
  params: { id: '123' }
})
```

### Request Headers

```ts
const { data } = await api('/api/posts').get({
  headers: {
    'X-Custom-Header': 'value'
  }
})
```

### Abort Signal

```ts
const controller = new AbortController()

// Cancel after 5 seconds
setTimeout(() => controller.abort(), 5000)

const { data } = await api('/api/posts').get({
  signal: controller.signal
})
```

### FormData

```ts
const formData = new FormData()
formData.append('file', fileInput.files[0])
formData.append('name', 'My File')

const { data } = await api('/api/upload').post({
  body: formData
})
```

## Response Structure

### ApiResponse Interface

```ts
interface ApiResponse<T = unknown> {
  data: T          // Response data
  status: number   // HTTP status code
  headers: Headers // Response headers
  ok: boolean      // Whether response was successful (2xx)
}
```

### Example

```ts
const response = await api('/api/posts').get()

console.log(response.data)    // Post[]
console.log(response.status)  // 200
console.log(response.ok)      // true
console.log(response.headers.get('x-total-count'))
```

## Type Helpers

### HttpMethod

```ts
type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS'
```

### PathParams

Extracts path parameters from a route:

```ts
type Params = PathParams<'/api/posts/[id]/comments/[commentId]'>
// { id: string; commentId: string }
```

### ResponseType

Gets the response type for a path and method:

```ts
type PostsResponse = ResponseType<'/api/posts', 'GET'>
// Post[] (if defined in ApiRoutes)
```

### RequestBody

Gets the request body type for a path and method:

```ts
type CreatePostBody = RequestBody<'/api/posts', 'POST'>
// CreatePostInput (if defined in ApiRoutes)
```

## Related

- [API Routes](/api/router/route-config)
- [Data Loaders](/api/data/loaders)
- [Actions](/api/data/actions)
