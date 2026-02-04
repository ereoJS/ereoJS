# React Hooks

React hooks for seamless integration with RPC procedures.

## Import

```ts
import {
  useQuery,
  useMutation,
  useSubscription,
} from '@ereo/rpc/client'

import type {
  UseQueryOptions,
  UseQueryResult,
  UseMutationOptions,
  UseMutationResult,
  UseSubscriptionOptions,
  UseSubscriptionResult,
  SubscriptionStatus,
} from '@ereo/rpc/client'
```

## useQuery

Executes a query procedure with automatic state management.

### Signature

```ts
function useQuery<TInput, TOutput>(
  procedure: QueryFn<TInput, TOutput>,
  options?: UseQueryOptions<TInput>
): UseQueryResult<TOutput>
```

### Type Definitions

```ts
interface UseQueryOptions<TInput> {
  /** Input to pass to the query */
  input?: TInput
  /** Whether the query should execute (default: true) */
  enabled?: boolean
  /** Auto-refetch interval in milliseconds */
  refetchInterval?: number
}

interface UseQueryResult<TOutput> {
  /** The query data */
  data: TOutput | undefined
  /** Error if query failed */
  error: Error | undefined
  /** Whether query is currently loading */
  isLoading: boolean
  /** Whether query resulted in an error */
  isError: boolean
  /** Whether query was successful */
  isSuccess: boolean
  /** Function to manually refetch */
  refetch: () => Promise<void>
}
```

### Parameters

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `input` | `TInput` | `undefined` | Input to pass to the procedure |
| `enabled` | `boolean` | `true` | Whether to execute the query |
| `refetchInterval` | `number` | `undefined` | Auto-refetch interval (ms) |

### Returns

| Property | Type | Description |
|----------|------|-------------|
| `data` | `TOutput \| undefined` | Query result data |
| `error` | `Error \| undefined` | Error if query failed |
| `isLoading` | `boolean` | True while query is in progress |
| `isError` | `boolean` | True if query resulted in error |
| `isSuccess` | `boolean` | True if query succeeded |
| `refetch` | `() => Promise<void>` | Manually trigger refetch |

### Examples

#### Basic Query

```tsx
function UserProfile() {
  const { data: user, isLoading, error } = useQuery(rpc.users.me)

  if (isLoading) return <div>Loading...</div>
  if (error) return <div>Error: {error.message}</div>

  return <div>Hello, {user.name}!</div>
}
```

#### Query with Input

```tsx
function PostDetail({ postId }: { postId: string }) {
  const { data: post, isLoading } = useQuery(rpc.posts.get, {
    input: { id: postId },
  })

  if (isLoading) return <PostSkeleton />
  if (!post) return <NotFound />

  return (
    <article>
      <h1>{post.title}</h1>
      <p>{post.content}</p>
    </article>
  )
}
```

#### Conditional Query

```tsx
function UserPosts({ userId }: { userId?: string }) {
  const { data: posts } = useQuery(rpc.posts.byUser, {
    input: { userId: userId! },
    enabled: !!userId, // Only fetch when userId is available
  })

  return posts ? <PostList posts={posts} /> : null
}
```

#### Auto-Refetch

```tsx
function LiveDashboard() {
  const { data: stats } = useQuery(rpc.analytics.live, {
    refetchInterval: 5000, // Refetch every 5 seconds
  })

  return <DashboardStats stats={stats} />
}
```

#### Manual Refetch

```tsx
function PostList() {
  const { data: posts, isLoading, refetch } = useQuery(rpc.posts.list)

  return (
    <div>
      <button onClick={() => refetch()} disabled={isLoading}>
        {isLoading ? 'Refreshing...' : 'Refresh'}
      </button>

      <ul>
        {posts?.map((post) => (
          <li key={post.id}>{post.title}</li>
        ))}
      </ul>
    </div>
  )
}
```

#### Error Handling

```tsx
function UserData() {
  const { data, error, isError, refetch } = useQuery(rpc.users.me)

  if (isError) {
    return (
      <div className="error">
        <p>Failed to load user data: {error?.message}</p>
        <button onClick={() => refetch()}>Retry</button>
      </div>
    )
  }

  return <UserProfile user={data} />
}
```

## useMutation

Executes a mutation procedure with loading and success/error callbacks.

### Signature

```ts
function useMutation<TInput, TOutput>(
  procedure: MutationFn<TInput, TOutput>,
  options?: UseMutationOptions<TOutput>
): UseMutationResult<TInput, TOutput>
```

### Type Definitions

```ts
interface UseMutationOptions<TOutput> {
  /** Called on successful mutation */
  onSuccess?: (data: TOutput) => void
  /** Called on mutation error */
  onError?: (error: Error) => void
  /** Called when mutation settles (success or error) */
  onSettled?: () => void
}

interface UseMutationResult<TInput, TOutput> {
  /** Trigger mutation (fire-and-forget) */
  mutate: TInput extends void ? () => void : (input: TInput) => void
  /** Trigger mutation and await result */
  mutateAsync: TInput extends void ? () => Promise<TOutput> : (input: TInput) => Promise<TOutput>
  /** Mutation result data */
  data: TOutput | undefined
  /** Error if mutation failed */
  error: Error | undefined
  /** Whether mutation is in progress */
  isPending: boolean
  /** Whether mutation resulted in error */
  isError: boolean
  /** Whether mutation was successful */
  isSuccess: boolean
  /** Reset mutation state */
  reset: () => void
}
```

### Parameters

| Option | Type | Description |
|--------|------|-------------|
| `onSuccess` | `(data: TOutput) => void` | Called on success |
| `onError` | `(error: Error) => void` | Called on error |
| `onSettled` | `() => void` | Called when complete |

### Returns

| Property | Type | Description |
|----------|------|-------------|
| `mutate` | `Function` | Trigger mutation (doesn't throw) |
| `mutateAsync` | `Function` | Trigger mutation (throws on error) |
| `data` | `TOutput \| undefined` | Mutation result |
| `error` | `Error \| undefined` | Error if failed |
| `isPending` | `boolean` | True while in progress |
| `isError` | `boolean` | True if failed |
| `isSuccess` | `boolean` | True if succeeded |
| `reset` | `() => void` | Reset state |

### Examples

#### Basic Mutation

```tsx
function CreatePostButton() {
  const { mutate, isPending } = useMutation(rpc.posts.create)

  return (
    <button
      onClick={() => mutate({ title: 'New Post', content: 'Hello!' })}
      disabled={isPending}
    >
      {isPending ? 'Creating...' : 'Create Post'}
    </button>
  )
}
```

#### With Callbacks

```tsx
function CreatePostForm() {
  const { mutate, isPending, error } = useMutation(rpc.posts.create, {
    onSuccess: (post) => {
      toast.success(`Post "${post.title}" created!`)
      navigate(`/posts/${post.id}`)
    },
    onError: (error) => {
      toast.error(`Failed to create post: ${error.message}`)
    },
    onSettled: () => {
      console.log('Mutation completed')
    },
  })

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    const formData = new FormData(e.target)
    mutate({
      title: formData.get('title') as string,
      content: formData.get('content') as string,
    })
  }

  return (
    <form onSubmit={handleSubmit}>
      <input name="title" required />
      <textarea name="content" required />
      <button type="submit" disabled={isPending}>
        {isPending ? 'Creating...' : 'Create'}
      </button>
      {error && <p className="error">{error.message}</p>}
    </form>
  )
}
```

#### Async/Await Pattern

```tsx
function DeleteButton({ postId }: { postId: string }) {
  const { mutateAsync, isPending } = useMutation(rpc.posts.delete)

  const handleDelete = async () => {
    if (!confirm('Are you sure?')) return

    try {
      await mutateAsync({ id: postId })
      toast.success('Post deleted')
      navigate('/posts')
    } catch (error) {
      toast.error('Failed to delete post')
    }
  }

  return (
    <button onClick={handleDelete} disabled={isPending}>
      {isPending ? 'Deleting...' : 'Delete'}
    </button>
  )
}
```

#### Reset State

```tsx
function FeedbackForm() {
  const { mutate, isPending, isSuccess, reset } = useMutation(rpc.feedback.submit)

  if (isSuccess) {
    return (
      <div>
        <p>Thank you for your feedback!</p>
        <button onClick={reset}>Submit Another</button>
      </div>
    )
  }

  return (
    <form onSubmit={(e) => {
      e.preventDefault()
      mutate({ message: e.target.message.value })
    }}>
      <textarea name="message" required />
      <button type="submit" disabled={isPending}>
        {isPending ? 'Submitting...' : 'Submit'}
      </button>
    </form>
  )
}
```

#### Optimistic Updates with Refetch

```tsx
function LikeButton({ postId }: { postId: string }) {
  const { data: post, refetch } = useQuery(rpc.posts.get, {
    input: { id: postId },
  })

  const { mutate, isPending } = useMutation(rpc.posts.like, {
    onSuccess: () => refetch(),
  })

  return (
    <button onClick={() => mutate({ postId })} disabled={isPending}>
      {post?.liked ? 'Unlike' : 'Like'} ({post?.likeCount ?? 0})
    </button>
  )
}
```

## useSubscription

Subscribes to a subscription procedure for real-time data.

### Signature

```ts
function useSubscription<TInput, TOutput>(
  procedure: SubscribeFn<TInput, TOutput>,
  options?: UseSubscriptionOptions<TInput>
): UseSubscriptionResult<TOutput>
```

### Type Definitions

```ts
type SubscriptionStatus = 'idle' | 'connecting' | 'connected' | 'error' | 'closed'

interface UseSubscriptionOptions<TInput> {
  /** Input to pass to the subscription */
  input?: TInput
  /** Whether subscription should be active (default: true) */
  enabled?: boolean
  /** Called when new data arrives */
  onData?: (data: unknown) => void
  /** Called on subscription error */
  onError?: (error: Error) => void
}

interface UseSubscriptionResult<TOutput> {
  /** Most recent data received */
  data: TOutput | undefined
  /** All data received (for accumulating results) */
  history: TOutput[]
  /** Current error if any */
  error: Error | undefined
  /** Connection status */
  status: SubscriptionStatus
  /** Whether currently receiving data */
  isActive: boolean
  /** Manually unsubscribe */
  unsubscribe: () => void
  /** Resubscribe after unsubscribing */
  resubscribe: () => void
}
```

### Parameters

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `input` | `TInput` | `undefined` | Input to pass to subscription |
| `enabled` | `boolean` | `true` | Whether subscription is active |
| `onData` | `(data) => void` | `undefined` | Called on new data |
| `onError` | `(error) => void` | `undefined` | Called on error |

### Returns

| Property | Type | Description |
|----------|------|-------------|
| `data` | `TOutput \| undefined` | Most recent value |
| `history` | `TOutput[]` | All received values |
| `error` | `Error \| undefined` | Error if failed |
| `status` | `SubscriptionStatus` | Connection status |
| `isActive` | `boolean` | True if connected or connecting |
| `unsubscribe` | `() => void` | Manually disconnect |
| `resubscribe` | `() => void` | Reconnect after disconnect |

### Status Values

| Status | Description |
|--------|-------------|
| `'idle'` | Not started |
| `'connecting'` | WebSocket connecting |
| `'connected'` | Actively receiving data |
| `'error'` | Connection error occurred |
| `'closed'` | Subscription ended |

### Examples

#### Basic Subscription

```tsx
function NotificationBell() {
  const { data: notification, status } = useSubscription(rpc.notifications.onNew)

  useEffect(() => {
    if (notification) {
      showNotification(notification.title, notification.message)
    }
  }, [notification])

  return (
    <div className="notification-bell">
      <BellIcon />
      {status === 'error' && <span className="offline">Offline</span>}
    </div>
  )
}
```

#### With Input

```tsx
function ChatRoom({ roomId }: { roomId: string }) {
  const { history: messages, status } = useSubscription(rpc.chat.messages, {
    input: { roomId },
  })

  return (
    <div className="chat-room">
      <div className="status">
        {status === 'connected' ? 'Connected' : 'Connecting...'}
      </div>

      <div className="messages">
        {messages.map((msg, i) => (
          <Message key={i} message={msg} />
        ))}
      </div>
    </div>
  )
}
```

#### Conditional Subscription

```tsx
function LiveUpdates({ enabled }: { enabled: boolean }) {
  const { data, status } = useSubscription(rpc.updates.live, {
    enabled,
  })

  if (!enabled) return <div>Live updates paused</div>

  return (
    <div>
      <span>Status: {status}</span>
      <span>Latest: {data?.value}</span>
    </div>
  )
}
```

#### With Callbacks

```tsx
function StockTicker({ symbol }: { symbol: string }) {
  const { data: price } = useSubscription(rpc.stocks.price, {
    input: { symbol },
    onData: (price) => {
      console.log(`${symbol}: $${price.value}`)
    },
    onError: (error) => {
      console.error('Stock feed error:', error)
    },
  })

  return (
    <div className="ticker">
      <span>{symbol}</span>
      <span>${price?.value.toFixed(2)}</span>
    </div>
  )
}
```

#### Manual Control

```tsx
function LiveStream() {
  const { data, status, unsubscribe, resubscribe, isActive } = useSubscription(
    rpc.stream.live
  )

  return (
    <div>
      <div className="controls">
        {isActive ? (
          <button onClick={unsubscribe}>Pause</button>
        ) : (
          <button onClick={resubscribe}>Resume</button>
        )}
      </div>

      <div className="stream">
        {data && <StreamContent data={data} />}
      </div>

      <div className="status">
        Status: {status}
      </div>
    </div>
  )
}
```

#### Accumulating History

```tsx
function ActivityFeed() {
  const { history: activities, data: latest } = useSubscription(
    rpc.activity.feed
  )

  return (
    <div className="activity-feed">
      {latest && (
        <div className="latest">
          New: {latest.message}
        </div>
      )}

      <ul>
        {activities.map((activity, i) => (
          <li key={i}>
            {activity.timestamp}: {activity.message}
          </li>
        ))}
      </ul>
    </div>
  )
}
```

#### Error Recovery

```tsx
function ResilientStream() {
  const { data, status, error, resubscribe } = useSubscription(rpc.stream.data)

  if (status === 'error') {
    return (
      <div className="error">
        <p>Connection lost: {error?.message}</p>
        <button onClick={resubscribe}>Reconnect</button>
      </div>
    )
  }

  return <StreamDisplay data={data} status={status} />
}
```

## Subscription Error Handling

Subscription generators can throw errors during iteration. Understanding how errors propagate helps build resilient applications.

### How Subscription Errors Work

On the server, when a subscription generator throws an error:

```ts
const riskySubscription = procedure.subscription(async function* () {
  for (let i = 0; i < 10; i++) {
    if (i === 5) {
      throw new Error('Something went wrong at iteration 5')
    }
    yield { count: i }
  }
})
```

The error is caught and sent to the client:
```ts
// Server-side error handling (internal)
try {
  for await (const value of generator) {
    ws.send({ type: 'data', id, data: value })
  }
} catch (error) {
  const errorMsg = error instanceof Error ? error.message : 'Subscription error'
  ws.send({ type: 'error', id, error: { code: 'SUBSCRIPTION_ERROR', message: errorMsg } })
}
```

### Handling Errors in Components

Use the `onError` callback and `error` state to handle subscription errors:

```tsx
function DataStream() {
  const [retryCount, setRetryCount] = useState(0)

  const { data, error, status, resubscribe } = useSubscription(
    rpc.stream.data,
    {
      onError: (err) => {
        console.error('Subscription error:', err.message)

        // Auto-retry up to 3 times
        if (retryCount < 3) {
          setRetryCount((c) => c + 1)
          setTimeout(() => resubscribe(), 1000 * retryCount)
        }
      },
    }
  )

  if (error && retryCount >= 3) {
    return (
      <div className="error">
        <p>Connection failed after {retryCount} retries</p>
        <p>Error: {error.message}</p>
        <button onClick={() => {
          setRetryCount(0)
          resubscribe()
        }}>
          Try Again
        </button>
      </div>
    )
  }

  return <StreamDisplay data={data} status={status} />
}
```

### Error Recovery Patterns

#### Pattern 1: Exponential Backoff

```tsx
function useSubscriptionWithBackoff<T>(
  procedure: SubscribeFn<void, T>,
  maxRetries = 5
) {
  const [retries, setRetries] = useState(0)
  const timeoutRef = useRef<NodeJS.Timeout>()

  const result = useSubscription(procedure, {
    onError: (error) => {
      if (retries < maxRetries) {
        const delay = Math.min(1000 * Math.pow(2, retries), 30000)
        console.log(`Retrying in ${delay}ms (attempt ${retries + 1})`)

        timeoutRef.current = setTimeout(() => {
          setRetries((r) => r + 1)
          result.resubscribe()
        }, delay)
      }
    },
  })

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [])

  return {
    ...result,
    retries,
    resetRetries: () => setRetries(0),
  }
}
```

#### Pattern 2: Error Boundary Integration

```tsx
function SubscriptionErrorBoundary({ children }: { children: React.ReactNode }) {
  const [hasError, setHasError] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  if (hasError) {
    return (
      <div className="error-boundary">
        <h2>Something went wrong</h2>
        <p>{errorMessage}</p>
        <button onClick={() => setHasError(false)}>Retry</button>
      </div>
    )
  }

  return (
    <SubscriptionErrorContext.Provider
      value={{
        onError: (error) => {
          setErrorMessage(error.message)
          setHasError(true)
        },
      }}
    >
      {children}
    </SubscriptionErrorContext.Provider>
  )
}

// Usage in child component
function LiveFeed() {
  const { onError } = useContext(SubscriptionErrorContext)

  const { data } = useSubscription(rpc.feed.live, {
    onError,
  })

  return <FeedDisplay data={data} />
}
```

#### Pattern 3: Graceful Degradation

```tsx
function LiveOrPolledData() {
  const [usePolling, setUsePolling] = useState(false)

  // Try subscription first
  const subscription = useSubscription(rpc.data.live, {
    enabled: !usePolling,
    onError: () => {
      console.log('Falling back to polling')
      setUsePolling(true)
    },
  })

  // Fall back to polling
  const query = useQuery(rpc.data.get, {
    enabled: usePolling,
    refetchInterval: 5000,
  })

  const data = usePolling ? query.data : subscription.data
  const isLoading = usePolling ? query.isLoading : subscription.status === 'connecting'

  return (
    <div>
      {usePolling && (
        <div className="notice">
          Using polling mode.
          <button onClick={() => setUsePolling(false)}>
            Try live updates
          </button>
        </div>
      )}
      <DataDisplay data={data} isLoading={isLoading} />
    </div>
  )
}
```

## Combining Hooks

```tsx
function PostsPage() {
  // Fetch initial data
  const { data: posts, isLoading, refetch } = useQuery(rpc.posts.list)

  // Create new posts
  const { mutate: createPost, isPending } = useMutation(rpc.posts.create, {
    onSuccess: () => refetch(),
  })

  // Real-time updates for new posts
  const { data: newPost } = useSubscription(rpc.posts.onCreated, {
    onData: () => refetch(), // Refetch list when new post arrives
  })

  if (isLoading) return <Loading />

  return (
    <div>
      <CreatePostForm
        onSubmit={(data) => createPost(data)}
        isPending={isPending}
      />

      {newPost && (
        <Toast>New post: {newPost.title}</Toast>
      )}

      <PostList posts={posts} />
    </div>
  )
}
```

## Best Practices

1. **Use `enabled` for conditional queries** - Prevent unnecessary requests
2. **Handle all states** - Check `isLoading`, `isError`, and `isSuccess`
3. **Use callbacks for side effects** - Toast notifications, navigation, etc.
4. **Clean up subscriptions** - Use `enabled: false` or call `unsubscribe()`
5. **Reset mutation state** - Call `reset()` when needed
6. **Combine with refetch** - Refresh queries after mutations

## Related

- [Client](/api/rpc/client) - Client proxy creation
- [Procedure Builder](/api/rpc/procedure) - Server-side procedures
