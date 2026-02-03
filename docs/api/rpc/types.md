# Type Definitions

Complete TypeScript type reference for `@ereo/rpc`.

## Import

```ts
import type {
  // Schema
  Schema,

  // Context
  BaseContext,
  ExtendedContext,

  // Middleware
  MiddlewareFn,
  MiddlewareDef,
  MiddlewareResult,

  // Procedures
  ProcedureType,
  ProcedureDef,
  QueryProcedure,
  MutationProcedure,
  SubscriptionProcedure,
  SubscriptionYield,
  AnyProcedure,

  // Router
  RouterDef,
  Router,

  // Client inference
  InferClient,
  SubscriptionCallbacks,
  Unsubscribe,

  // Protocol
  RPCRequest,
  RPCResponse,
  RPCErrorShape,
  WSClientMessage,
  WSServerMessage,
  WSConnectionData,
} from '@ereo/rpc'
```

## Schema Types

### Schema

Zod-compatible schema interface for input validation.

```ts
interface Schema<T> {
  /** Parse input and throw on error */
  parse(data: unknown): T

  /** Parse input and return result object (optional) */
  safeParse?(data: unknown):
    | { success: true; data: T }
    | { success: false; error: unknown }
}
```

**Usage:**

```ts
import { z } from 'zod'

// Zod schema (implements Schema<T>)
const userSchema = z.object({
  name: z.string(),
  email: z.string().email(),
})

// Custom schema
const customSchema: Schema<{ id: string }> = {
  parse(data) {
    if (typeof data !== 'object' || !data || !('id' in data)) {
      throw new Error('Invalid input')
    }
    return data as { id: string }
  },
}
```

## Context Types

### BaseContext

Base context available to all procedures.

```ts
interface BaseContext {
  /** Application context (from @ereo/core) */
  ctx: any

  /** The original HTTP request */
  request: Request
}
```

**Usage:**

```ts
const handler = procedure.query(({ ctx, request }) => {
  const appContext = ctx  // Application context
  const headers = request.headers  // HTTP request
  return { /* ... */ }
})
```

### ExtendedContext

Context after middleware extends it with additional properties.

```ts
type ExtendedContext<TBase, TExtension> = TBase & TExtension
```

**Usage:**

```ts
interface UserExtension {
  user: { id: string; name: string }
}

type AuthedContext = ExtendedContext<BaseContext, UserExtension>
// Result: BaseContext & { user: { id: string; name: string } }
```

## Middleware Types

### MiddlewareFn

Middleware function signature.

```ts
type MiddlewareFn<TContextIn, TContextOut> = (opts: {
  /** Input context */
  ctx: TContextIn

  /** Continue to next middleware/handler */
  next: <T>(ctx: T) => MiddlewareResult<T>
}) => MiddlewareResult<TContextOut> | Promise<MiddlewareResult<TContextOut>>
```

**Usage:**

```ts
const authMiddleware: MiddlewareFn<BaseContext, BaseContext & { user: User }> =
  async ({ ctx, next }) => {
    const user = await getUser(ctx.request)
    if (!user) {
      return { ok: false, error: { code: 'UNAUTHORIZED', message: 'Please log in' } }
    }
    return next({ ...ctx, user })
  }
```

### MiddlewareDef

Middleware definition stored on procedure builder.

```ts
interface MiddlewareDef<TContextIn, TContextOut> {
  fn: MiddlewareFn<TContextIn, TContextOut>
}
```

### MiddlewareResult

Result of middleware execution.

```ts
type MiddlewareResult<TContext> =
  | { ok: true; ctx: TContext }      // Continue with new context
  | { ok: false; error: RPCErrorShape }  // Stop and return error
```

**Usage:**

```ts
// Success - continue execution
return next({ ...ctx, user })  // Returns { ok: true, ctx: { ...ctx, user } }

// Error - stop execution
return { ok: false, error: { code: 'FORBIDDEN', message: 'Access denied' } }
```

## Procedure Types

### ProcedureType

Type of procedure.

```ts
type ProcedureType = 'query' | 'mutation' | 'subscription'
```

### ProcedureDef

Base procedure definition.

```ts
interface ProcedureDef<TContext, TInput, TOutput> {
  _type: ProcedureType
  _ctx: TContext
  _input: TInput
  _output: TOutput
  middlewares: MiddlewareDef<any, any>[]
  inputSchema?: Schema<TInput>
  handler: (args: TContext & { input: TInput }) => TOutput | Promise<TOutput>
}
```

### QueryProcedure

Query procedure for read operations.

```ts
interface QueryProcedure<TContext, TInput, TOutput>
  extends ProcedureDef<TContext, TInput, TOutput> {
  _type: 'query'
}
```

**Usage:**

```ts
const getUser: QueryProcedure<BaseContext, { id: string }, User | null> =
  procedure.query(
    z.object({ id: z.string() }),
    async ({ input }) => db.users.find(input.id)
  )
```

### MutationProcedure

Mutation procedure for write operations.

```ts
interface MutationProcedure<TContext, TInput, TOutput>
  extends ProcedureDef<TContext, TInput, TOutput> {
  _type: 'mutation'
}
```

**Usage:**

```ts
const createUser: MutationProcedure<AuthedContext, CreateUserInput, User> =
  authedProcedure.mutation(
    z.object({ name: z.string(), email: z.string().email() }),
    async ({ input }) => db.users.create(input)
  )
```

### SubscriptionProcedure

Subscription procedure for real-time data.

```ts
interface SubscriptionProcedure<TContext, TInput, TOutput> {
  _type: 'subscription'
  _ctx: TContext
  _input: TInput
  _output: TOutput
  middlewares: MiddlewareDef<any, any>[]
  inputSchema?: Schema<TInput>
  handler: (args: TContext & { input: TInput }) => SubscriptionYield<TOutput>
}
```

### SubscriptionYield

Async generator type for subscriptions.

```ts
type SubscriptionYield<T> = AsyncGenerator<T, void, unknown>
```

**Usage:**

```ts
const onMessage: SubscriptionProcedure<AuthedContext, { roomId: string }, Message> =
  authedProcedure.subscription(
    z.object({ roomId: z.string() }),
    async function* ({ input }) {
      for await (const message of messageStream(input.roomId)) {
        yield message
      }
    }
  )
```

### AnyProcedure

Union of all procedure types.

```ts
type AnyProcedure =
  | QueryProcedure<any, any, any>
  | MutationProcedure<any, any, any>
  | SubscriptionProcedure<any, any, any>
```

## Router Types

### RouterDef

Router definition - nested object of procedures.

```ts
type RouterDef = {
  [key: string]: AnyProcedure | RouterDef
}
```

**Usage:**

```ts
const routerDef: RouterDef = {
  health: procedure.query(() => ({ status: 'ok' })),
  users: {
    list: procedure.query(async () => db.users.findMany()),
    get: procedure.query(z.object({ id: z.string() }), async ({ input }) =>
      db.users.find(input.id)
    ),
  },
}
```

### Router

Router instance with handlers.

```ts
interface Router<T extends RouterDef> {
  /** Original definition (for type inference) */
  _def: T

  /** HTTP request handler */
  handler: (request: Request, ctx: any) => Promise<Response>

  /** WebSocket handlers for subscriptions */
  websocket: BunWebSocketHandler<WSConnectionData>
}
```

## Client Inference Types

### InferClient

Infers client type from router definition.

```ts
type InferClient<T extends RouterDef> = {
  [K in keyof T]: T[K] extends QueryProcedure<any, infer TInput, infer TOutput>
    ? TInput extends void
      ? { query: () => Promise<TOutput> }
      : { query: (input: TInput) => Promise<TOutput> }
    : T[K] extends MutationProcedure<any, infer TInput, infer TOutput>
      ? TInput extends void
        ? { mutate: () => Promise<TOutput> }
        : { mutate: (input: TInput) => Promise<TOutput> }
      : T[K] extends SubscriptionProcedure<any, infer TInput, infer TOutput>
        ? TInput extends void
          ? { subscribe: (callbacks: SubscriptionCallbacks<TOutput>) => Unsubscribe }
          : { subscribe: (input: TInput, callbacks: SubscriptionCallbacks<TOutput>) => Unsubscribe }
        : T[K] extends RouterDef
          ? InferClient<T[K]>
          : never
}
```

**Usage:**

```ts
// Server
const api = createRouter({
  users: {
    get: procedure.query(
      z.object({ id: z.string() }),
      async ({ input }): Promise<User | null> => db.users.find(input.id)
    ),
  },
})

export type Api = typeof api

// Client
import type { Api } from './server'
const rpc = createClient<Api>({ httpEndpoint: '/api/rpc' })

// Fully inferred types
const user = await rpc.users.get.query({ id: '123' })
//    ^? User | null
```

### SubscriptionCallbacks

Callbacks for subscription events.

```ts
interface SubscriptionCallbacks<T> {
  /** Called when new data arrives */
  onData: (data: T) => void

  /** Called on subscription error */
  onError?: (error: Error) => void

  /** Called when subscription completes */
  onComplete?: () => void
}
```

### Unsubscribe

Function to unsubscribe from a subscription.

```ts
type Unsubscribe = () => void
```

## Protocol Types

### RPCRequest

HTTP RPC request body.

```ts
interface RPCRequest {
  /** Procedure path as array */
  path: string[]

  /** Request type */
  type: 'query' | 'mutation'

  /** Input data (optional) */
  input?: unknown
}
```

**Example:**

```json
{
  "path": ["users", "create"],
  "type": "mutation",
  "input": { "name": "Alice", "email": "alice@example.com" }
}
```

### RPCResponse

HTTP RPC response body.

```ts
type RPCResponse<T = unknown> =
  | { ok: true; data: T }
  | { ok: false; error: RPCErrorShape }
```

**Examples:**

```json
// Success
{ "ok": true, "data": { "id": "123", "name": "Alice" } }

// Error
{ "ok": false, "error": { "code": "NOT_FOUND", "message": "User not found" } }
```

### RPCErrorShape

Error object structure.

```ts
interface RPCErrorShape {
  /** Machine-readable error code */
  code: string

  /** Human-readable error message */
  message: string

  /** Additional error details (optional) */
  details?: unknown
}
```

### WSClientMessage

WebSocket messages from client to server.

```ts
type WSClientMessage =
  | { type: 'subscribe'; id: string; path: string[]; input?: unknown }
  | { type: 'unsubscribe'; id: string }
  | { type: 'ping' }
```

**Examples:**

```json
// Subscribe
{ "type": "subscribe", "id": "sub_1", "path": ["posts", "onCreated"], "input": {} }

// Unsubscribe
{ "type": "unsubscribe", "id": "sub_1" }

// Heartbeat
{ "type": "ping" }
```

### WSServerMessage

WebSocket messages from server to client.

```ts
type WSServerMessage =
  | { type: 'data'; id: string; data: unknown }
  | { type: 'error'; id: string; error: RPCErrorShape }
  | { type: 'complete'; id: string }
  | { type: 'pong' }
```

**Examples:**

```json
// Data
{ "type": "data", "id": "sub_1", "data": { "title": "New Post" } }

// Error
{ "type": "error", "id": "sub_1", "error": { "code": "UNAUTHORIZED", "message": "Session expired" } }

// Complete
{ "type": "complete", "id": "sub_1" }

// Heartbeat response
{ "type": "pong" }
```

### WSConnectionData

Per-connection WebSocket state.

```ts
interface WSConnectionData {
  /** Active subscriptions (id → abort controller) */
  subscriptions: Map<string, AbortController>

  /** Application context */
  ctx: any

  /** Original HTTP request that initiated the upgrade */
  originalRequest?: Request
}
```

## Procedure Builder Type

### ProcedureBuilder

Interface for the chainable procedure builder.

```ts
interface ProcedureBuilder<TContext extends BaseContext> {
  /** Add middleware */
  use<TNewContext extends BaseContext>(
    middleware: MiddlewareFn<TContext, TNewContext>
  ): ProcedureBuilder<TNewContext>

  /** Create query (no input) */
  query<TOutput>(
    handler: (ctx: TContext) => TOutput | Promise<TOutput>
  ): QueryProcedure<TContext, void, Awaited<TOutput>>

  /** Create query (with input) */
  query<TInput, TOutput>(
    schema: Schema<TInput>,
    handler: (ctx: TContext & { input: TInput }) => TOutput | Promise<TOutput>
  ): QueryProcedure<TContext, TInput, Awaited<TOutput>>

  /** Create mutation (no input) */
  mutation<TOutput>(
    handler: (ctx: TContext) => TOutput | Promise<TOutput>
  ): MutationProcedure<TContext, void, Awaited<TOutput>>

  /** Create mutation (with input) */
  mutation<TInput, TOutput>(
    schema: Schema<TInput>,
    handler: (ctx: TContext & { input: TInput }) => TOutput | Promise<TOutput>
  ): MutationProcedure<TContext, TInput, Awaited<TOutput>>

  /** Create subscription (no input) */
  subscription<TOutput>(
    handler: (ctx: TContext) => SubscriptionYield<TOutput>
  ): SubscriptionProcedure<TContext, void, TOutput>

  /** Create subscription (with input) */
  subscription<TInput, TOutput>(
    schema: Schema<TInput>,
    handler: (ctx: TContext & { input: TInput }) => SubscriptionYield<TOutput>
  ): SubscriptionProcedure<TContext, TInput, TOutput>
}
```

## Client Types

### RPCClientOptions

Client configuration options.

```ts
interface RPCClientOptions {
  httpEndpoint: string
  wsEndpoint?: string
  fetch?: typeof fetch
  headers?: Record<string, string> | (() => Record<string, string>)
  reconnect?: {
    enabled?: boolean
    maxAttempts?: number
    delayMs?: number
    maxDelayMs?: number
  }
  usePostForQueries?: boolean
  heartbeatInterval?: number
  heartbeatEnabled?: boolean
}
```

### RPCClientError

Client-side error with additional context.

```ts
interface RPCClientError extends Error {
  code: string
  path: string
  details?: unknown
}
```

## React Hook Types

### UseQueryOptions / UseQueryResult

```ts
interface UseQueryOptions<TInput> {
  input?: TInput
  enabled?: boolean
  refetchInterval?: number
}

interface UseQueryResult<TOutput> {
  data: TOutput | undefined
  error: Error | undefined
  isLoading: boolean
  isError: boolean
  isSuccess: boolean
  refetch: () => Promise<void>
}
```

### UseMutationOptions / UseMutationResult

```ts
interface UseMutationOptions<TOutput> {
  onSuccess?: (data: TOutput) => void
  onError?: (error: Error) => void
  onSettled?: () => void
}

interface UseMutationResult<TInput, TOutput> {
  mutate: (input?: TInput) => void
  mutateAsync: (input?: TInput) => Promise<TOutput>
  data: TOutput | undefined
  error: Error | undefined
  isPending: boolean
  isError: boolean
  isSuccess: boolean
  reset: () => void
}
```

### UseSubscriptionOptions / UseSubscriptionResult

```ts
type SubscriptionStatus = 'idle' | 'connecting' | 'connected' | 'error' | 'closed'

interface UseSubscriptionOptions<TInput> {
  input?: TInput
  enabled?: boolean
  onData?: (data: unknown) => void
  onError?: (error: Error) => void
}

interface UseSubscriptionResult<TOutput> {
  data: TOutput | undefined
  history: TOutput[]
  error: Error | undefined
  status: SubscriptionStatus
  isActive: boolean
  unsubscribe: () => void
  resubscribe: () => void
}
```

## Related

- [Procedure Builder](/api/rpc/procedure) - Creating procedures
- [Router](/api/rpc/router) - Combining procedures
- [Client](/api/rpc/client) - Client proxy
- [Protocol](/api/rpc/protocol) - Wire protocol specification
