# Protocol Specification

Complete specification of the HTTP and WebSocket protocols used by `@ereo/rpc`.

## Overview

The RPC system uses two protocols:
- **HTTP** - For queries (read) and mutations (write)
- **WebSocket** - For subscriptions (real-time streaming)

Both protocols share a common error format and path-based procedure resolution.

## HTTP Protocol

### Endpoint

All HTTP requests go to a single endpoint (default: `/api/rpc`).

### Query Requests

Queries support both GET and POST methods.

#### GET Method (Recommended for Queries)

GET requests are cacheable by browsers and CDNs.

```
GET /api/rpc?path=users.list&input={"limit":10}
```

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `path` | `string` | Yes | Dot-separated procedure path |
| `input` | `string` | No | JSON-encoded input data |

**Examples:**

```
# No input
GET /api/rpc?path=health

# With input
GET /api/rpc?path=users.get&input={"id":"123"}

# Nested path
GET /api/rpc?path=v1.admin.users.list

# Complex input
GET /api/rpc?path=posts.search&input={"query":"hello","tags":["tech","news"],"limit":20}
```

**URL Length Warning:**

If input data is large (>1500 characters when JSON-encoded), consider using POST to avoid URL length limits.

#### POST Method

POST can be used for queries when input is large or contains sensitive data.

```
POST /api/rpc
Content-Type: application/json

{
  "path": ["users", "list"],
  "type": "query",
  "input": { "limit": 10 }
}
```

### Mutation Requests

Mutations always use POST.

```
POST /api/rpc
Content-Type: application/json

{
  "path": ["users", "create"],
  "type": "mutation",
  "input": {
    "name": "Alice",
    "email": "alice@example.com"
  }
}
```

### Request Body Schema

```ts
interface RPCRequest {
  /** Procedure path as array of segments */
  path: string[]

  /** Request type */
  type: 'query' | 'mutation'

  /** Input data (optional) */
  input?: unknown
}
```

### Response Format

All responses are JSON with a consistent structure.

#### Success Response

```ts
{
  "ok": true,
  "data": <procedure return value>
}
```

**Examples:**

```json
// Simple value
{ "ok": true, "data": { "status": "healthy" } }

// Object
{ "ok": true, "data": { "id": "123", "name": "Alice", "email": "alice@example.com" } }

// Array
{ "ok": true, "data": [{ "id": "1", "title": "Post 1" }, { "id": "2", "title": "Post 2" }] }

// Null
{ "ok": true, "data": null }
```

#### Error Response

```ts
{
  "ok": false,
  "error": {
    "code": string,
    "message": string,
    "details"?: unknown
  }
}
```

**Examples:**

```json
// Not found
{
  "ok": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "User not found"
  }
}

// Validation error
{
  "ok": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Input validation failed",
    "details": [
      { "path": ["email"], "message": "Invalid email format", "code": "invalid_string" }
    ]
  }
}

// Unauthorized
{
  "ok": false,
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Please log in to continue"
  }
}
```

### HTTP Status Codes

| Code | Condition |
|------|-----------|
| `200` | Success (both `ok: true` and `ok: false` with client errors) |
| `400` | Parse error, validation error, method mismatch |
| `401` | Unauthorized (from `RPCError`) |
| `403` | Forbidden (from `RPCError`) |
| `404` | Procedure not found, resource not found |
| `429` | Rate limited |
| `500` | Internal server error |

### Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `PARSE_ERROR` | 400 | Invalid JSON in request body |
| `NOT_FOUND` | 404 | Procedure path doesn't exist |
| `METHOD_NOT_ALLOWED` | 400 | Subscription called via HTTP |
| `METHOD_MISMATCH` | 400 | Query called as mutation or vice versa |
| `VALIDATION_ERROR` | 400 | Input schema validation failed |
| `INTERNAL_ERROR` | 500 | Unexpected server error |
| `UNAUTHORIZED` | 401 | Authentication required |
| `FORBIDDEN` | 403 | Insufficient permissions |
| `RATE_LIMITED` | 429 | Too many requests |
| `BAD_REQUEST` | 400 | Generic client error |

### Headers

#### Request Headers

```
Content-Type: application/json  (required for POST)
Authorization: Bearer <token>   (optional, for auth)
X-Request-ID: <uuid>            (optional, for tracing)
```

#### Response Headers

```
Content-Type: application/json
```

## WebSocket Protocol

### Connection

Connect to the same endpoint as HTTP with WebSocket upgrade.

```
ws://localhost:3000/api/rpc
wss://example.com/api/rpc  (production)
```

### Upgrade Request

```
GET /api/rpc HTTP/1.1
Host: localhost:3000
Upgrade: websocket
Connection: Upgrade
Sec-WebSocket-Key: <key>
Sec-WebSocket-Version: 13
```

### Message Format

All messages are JSON strings.

### Client Messages

Messages sent from client to server.

#### Subscribe

Start a subscription.

```ts
{
  "type": "subscribe",
  "id": string,      // Unique subscription ID
  "path": string[],  // Procedure path
  "input"?: unknown  // Input data (optional)
}
```

**Examples:**

```json
// No input
{
  "type": "subscribe",
  "id": "sub_abc123",
  "path": ["notifications", "onNew"]
}

// With input
{
  "type": "subscribe",
  "id": "sub_def456",
  "path": ["chat", "messages"],
  "input": { "roomId": "general" }
}
```

#### Unsubscribe

Stop a subscription.

```ts
{
  "type": "unsubscribe",
  "id": string  // Subscription ID to stop
}
```

**Example:**

```json
{
  "type": "unsubscribe",
  "id": "sub_abc123"
}
```

#### Ping

Heartbeat to keep connection alive.

```ts
{
  "type": "ping"
}
```

### Server Messages

Messages sent from server to client.

#### Data

New data from a subscription.

```ts
{
  "type": "data",
  "id": string,     // Subscription ID
  "data": unknown   // Yielded value
}
```

**Example:**

```json
{
  "type": "data",
  "id": "sub_abc123",
  "data": {
    "id": "notif_1",
    "title": "New message",
    "body": "You have a new message from Alice"
  }
}
```

#### Error

Subscription error.

```ts
{
  "type": "error",
  "id": string,
  "error": {
    "code": string,
    "message": string
  }
}
```

**Example:**

```json
{
  "type": "error",
  "id": "sub_abc123",
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Session expired"
  }
}
```

#### Complete

Subscription ended (generator finished).

```ts
{
  "type": "complete",
  "id": string  // Subscription ID
}
```

**Example:**

```json
{
  "type": "complete",
  "id": "sub_abc123"
}
```

#### Pong

Response to ping heartbeat.

```ts
{
  "type": "pong"
}
```

### WebSocket Error Codes

| Code | Description |
|------|-------------|
| `PARSE_ERROR` | Invalid JSON message |
| `NOT_FOUND` | Subscription procedure not found |
| `METHOD_MISMATCH` | Called non-subscription as subscription |
| `VALIDATION_ERROR` | Input validation failed |
| `SUBSCRIPTION_ERROR` | Error during subscription execution |
| `DUPLICATE_ID` | Subscription ID already in use |
| `UNAUTHORIZED` | Authentication failed (middleware) |
| `FORBIDDEN` | Access denied (middleware) |

### Connection Lifecycle

```
Client                          Server
  |                               |
  |-------- Connect ------------->|
  |<------- Accept ---------------|
  |                               |
  |-------- Subscribe ----------->|
  |<------- Data -----------------|
  |<------- Data -----------------|
  |<------- Data -----------------|
  |                               |
  |-------- Ping ---------------->|
  |<------- Pong -----------------|
  |                               |
  |<------- Data -----------------|
  |                               |
  |-------- Unsubscribe --------->|
  |                               |
  |-------- Close --------------->|
```

### Heartbeat Protocol

1. Client sends `ping` every N seconds (default: 30s)
2. Server responds with `pong`
3. If client misses 2 consecutive `pong` responses, connection is considered dead
4. Client closes connection and initiates reconnect

### Reconnection Protocol

1. On connection loss, client waits `delayMs` (default: 1s)
2. Client attempts to reconnect
3. If failed, wait `delayMs * 2` (exponential backoff)
4. Cap delay at `maxDelayMs` (default: 30s)
5. After `maxAttempts` (default: 10), stop trying
6. On successful reconnect, resubscribe to all active subscriptions

### Subscription Lifecycle

```
┌─────────────────────────────────────────────────────────────┐
│                  Subscription States                         │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  [Idle] ──subscribe msg──> [Active]                         │
│                               │                              │
│                    ┌──────────┼──────────┐                  │
│                    │          │          │                   │
│                    ▼          ▼          ▼                   │
│                 [Data]    [Error]   [Complete]               │
│                    │          │          │                   │
│                    └──────────┼──────────┘                   │
│                               │                              │
│                               ▼                              │
│                            [Done]                            │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## Path Resolution

Procedure paths are resolved from the router definition.

### Path Format

- HTTP GET: Dot-separated string (`users.get`)
- HTTP POST/WS: Array of strings (`["users", "get"]`)

### Resolution Algorithm

```ts
function resolveProcedure(router, path) {
  let current = router._def

  for (const segment of path) {
    if (!current || typeof current !== 'object' || !(segment in current)) {
      return null  // Not found
    }
    current = current[segment]
  }

  if (current && '_type' in current) {
    return current  // Found procedure
  }

  return null  // Path leads to nested router, not procedure
}
```

### Examples

```ts
const router = createRouter({
  health: procedure.query(() => ({ status: 'ok' })),
  users: {
    list: procedure.query(async () => []),
    get: procedure.query(z.object({ id: z.string() }), async () => null),
  },
  v1: {
    admin: {
      stats: procedure.query(async () => ({})),
    },
  },
})

// Valid paths
'health'         → health procedure
'users.list'     → users.list procedure
'users.get'      → users.get procedure
'v1.admin.stats' → v1.admin.stats procedure

// Invalid paths
'users'          → Not a procedure (nested router)
'foo'            → Not found
'users.foo'      → Not found
'health.foo'     → Not found (health is procedure, not router)
```

## Security Considerations

### Input Validation

- All input is validated against schemas before reaching handlers
- Validation errors are sanitized to prevent information leakage
- Only safe fields (`path`, `message`, `code`) are exposed to clients

### Error Sanitization

Internal errors are never exposed to clients:

```ts
// Server throws
throw new Error('Database connection failed: host=db.internal password=secret')

// Client receives
{ "ok": false, "error": { "code": "INTERNAL_ERROR", "message": "An unexpected error occurred" } }
```

### Authentication

- Middleware runs before handlers for every request
- WebSocket connections receive the original HTTP request for auth
- Context is preserved across subscription lifetime

### Rate Limiting

- Applied at middleware level per procedure
- Can be IP-based or user-based
- Returns `RATE_LIMITED` error code with 429 status

## Implementation Notes

### Server Requirements

- Bun runtime with native WebSocket support
- Single endpoint for both HTTP and WebSocket
- JSON parsing for all messages

### Client Requirements

- Fetch API for HTTP requests
- WebSocket API for subscriptions
- JSON serialization

### Serialization

- All data is JSON-serialized
- Dates become ISO strings
- BigInt, Symbol, functions are not supported
- Consider using `superjson` for complex types

## Related

- [Client](/api/rpc/client) - Client implementation
- [Router](/api/rpc/router) - Server implementation
- [Types](/api/rpc/types) - TypeScript definitions
