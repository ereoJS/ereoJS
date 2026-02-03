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
  timeout: 30000,
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

## Key Features

- End-to-end type safety with TypeScript
- Path parameter substitution (`/api/posts/[id]`)
- Query string building
- Automatic JSON serialization
- FormData and URLSearchParams support
- Request/response interceptors
- Error handling with custom callbacks
- Configurable timeout
- Debug mode for logging

## Documentation

For full documentation, visit [https://ereo.dev/docs/client-sdk](https://ereo.dev/docs/client-sdk)

## Part of EreoJS

This package is part of the [EreoJS monorepo](https://github.com/anthropics/ereo-js).

## License

MIT
