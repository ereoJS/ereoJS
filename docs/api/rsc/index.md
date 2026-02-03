# React Server Components

React Server Components (RSC) support for EreoJS.

## Import

```ts
import {
  serializeRSC,
  parseRSCStream,
  isServerComponent,
  isClientComponent,
  createRSCRenderConfig
} from '@ereo/rsc'
```

## Overview

React Server Components allow you to render components on the server and stream them to the client. Server components can directly access databases, file systems, and other server-only resources without exposing them to the client bundle.

EreoJS provides first-class RSC support through the `@ereo/rsc` package, enabling:

- Zero-bundle server components
- Streaming HTML with progressive hydration
- Automatic client/server boundary detection
- Efficient serialization of component trees

## How RSC Works

### Server Components

Server components run exclusively on the server. They:

- Can use async/await directly
- Have access to server-only resources
- Never ship JavaScript to the client
- Use `'use server'` or `'use rsc'` directive

```tsx
// components/UserProfile.tsx
'use server'

import { db } from '../lib/db'

export async function UserProfile({ userId }: { userId: string }) {
  const user = await db.users.findById(userId)

  return (
    <div>
      <h2>{user.name}</h2>
      <p>{user.email}</p>
    </div>
  )
}
```

### Client Components

Client components run on the client and can use interactivity. They:

- Can use hooks like `useState`, `useEffect`
- Handle user interactions
- Ship JavaScript to the client
- Use `'use client'` directive

```tsx
// components/LikeButton.tsx
'use client'

import { useState } from 'react'

export function LikeButton({ initialLikes }: { initialLikes: number }) {
  const [likes, setLikes] = useState(initialLikes)

  return (
    <button onClick={() => setLikes(l => l + 1)}>
      Likes: {likes}
    </button>
  )
}
```

### The Boundary

Server components can import and render client components, but client components cannot import server components. Data flows from server to client.

```tsx
// routes/post/[id].tsx (Server Component)
'use server'

import { LikeButton } from '../components/LikeButton'
import { db } from '../lib/db'

export default async function PostPage({ params }) {
  const post = await db.posts.findById(params.id)

  return (
    <article>
      <h1>{post.title}</h1>
      <p>{post.content}</p>

      {/* Client component receives serializable props */}
      <LikeButton initialLikes={post.likes} />
    </article>
  )
}
```

## API Reference

### serializeRSC

Serializes a server component tree to an RSC stream format.

#### Signature

```ts
function serializeRSC(
  component: React.ReactElement,
  config?: RSCConfig
): ReadableStream<Uint8Array>
```

#### Parameters

| Name | Type | Description |
|------|------|-------------|
| `component` | `React.ReactElement` | The React element tree to serialize |
| `config` | `RSCConfig` | Optional RSC configuration |

#### Returns

A `ReadableStream<Uint8Array>` containing the serialized RSC payload.

#### Example

```ts
import { serializeRSC } from '@ereo/rsc'

const element = <UserProfile userId="123" />
const stream = serializeRSC(element, {
  enabled: true,
  clientManifest: manifest
})

// Stream to response
return new Response(stream, {
  headers: { 'Content-Type': 'text/x-component' }
})
```

### parseRSCStream

Parses an RSC stream back into a component representation.

#### Signature

```ts
function parseRSCStream(
  stream: ReadableStream<Uint8Array>
): Promise<unknown>
```

#### Parameters

| Name | Type | Description |
|------|------|-------------|
| `stream` | `ReadableStream<Uint8Array>` | The RSC stream to parse |

#### Returns

A `Promise` that resolves to the parsed RSC payload.

#### Example

```ts
import { parseRSCStream } from '@ereo/rsc'

const response = await fetch('/api/rsc/user')
const payload = await parseRSCStream(response.body)

// payload contains the component tree data
console.log(payload.type) // 'rsc'
console.log(payload.component) // serialized component
console.log(payload.clientRefs) // ['LikeButton', 'ShareButton']
```

### isServerComponent

Checks if a component is a server component.

#### Signature

```ts
function isServerComponent(component: unknown): boolean
```

#### Parameters

| Name | Type | Description |
|------|------|-------------|
| `component` | `unknown` | The component to check |

#### Returns

`true` if the component has a `'use server'` or `'use rsc'` directive.

#### Example

```ts
import { isServerComponent } from '@ereo/rsc'

function ServerComp() {
  'use server'
  return <div>Server</div>
}

function RegularComp() {
  return <div>Regular</div>
}

isServerComponent(ServerComp)  // true
isServerComponent(RegularComp) // false
```

### isClientComponent

Checks if a component is a client component.

#### Signature

```ts
function isClientComponent(component: unknown): boolean
```

#### Parameters

| Name | Type | Description |
|------|------|-------------|
| `component` | `unknown` | The component to check |

#### Returns

`true` if the component has a `'use client'` directive.

#### Example

```ts
import { isClientComponent } from '@ereo/rsc'

function ClientComp() {
  'use client'
  return <div>Client</div>
}

function ServerComp() {
  'use server'
  return <div>Server</div>
}

isClientComponent(ClientComp) // true
isClientComponent(ServerComp) // false
```

### createRSCRenderConfig

Creates a render configuration for RSC mode.

#### Signature

```ts
function createRSCRenderConfig(config?: RSCConfig): RenderConfig
```

#### Parameters

| Name | Type | Description |
|------|------|-------------|
| `config` | `RSCConfig` | Optional RSC configuration |

#### Returns

A `RenderConfig` object configured for RSC rendering with streaming enabled.

#### Example

```ts
import { createRSCRenderConfig } from '@ereo/rsc'

const renderConfig = createRSCRenderConfig({
  enabled: true,
  clientManifest: {
    'LikeButton.tsx': 'client'
  }
})

// renderConfig.mode === 'rsc'
// renderConfig.streaming.enabled === true
```

## Types

### RSCConfig

```ts
interface RSCConfig {
  /** Enable React Server Components */
  enabled: boolean

  /** Client reference manifest for bundling */
  clientManifest?: Record<string, unknown>

  /** Server reference manifest */
  serverManifest?: Record<string, unknown>
}
```

### RSCChunk

```ts
interface RSCChunk {
  /** Chunk ID */
  id: string

  /** Chunk data */
  data: unknown

  /** Whether this is the final chunk */
  done: boolean
}
```

## Serialization and Data Flow

### What Gets Serialized

When a server component tree is serialized:

1. **Intrinsic elements** (`div`, `span`, etc.) are serialized as element descriptors
2. **Server components** are rendered and their output is serialized
3. **Client components** become references that the client resolves
4. **Props** are serialized, with functions becoming client references

### Payload Structure

```ts
{
  type: 'rsc',
  component: {
    type: 'element',
    tag: 'div',
    props: {
      children: [
        {
          type: 'server-component',
          name: 'UserProfile',
          props: { userId: '123' }
        },
        {
          type: 'client-ref',
          id: 'LikeButton',
          props: { initialLikes: 42 }
        }
      ]
    }
  },
  clientRefs: ['LikeButton']
}
```

### Data Flow

```
Server                          Client
  |                               |
  | 1. Render server components   |
  |                               |
  | 2. Serialize tree --------->  |
  |                               |
  |                     3. Parse stream
  |                               |
  |                     4. Resolve client refs
  |                               |
  |                     5. Hydrate client components
```

## Server Component Patterns

### Async Data Fetching

```tsx
'use server'

export async function ProductList({ category }: { category: string }) {
  const products = await db.products.findByCategory(category)

  return (
    <ul>
      {products.map(product => (
        <li key={product.id}>
          <ProductCard product={product} />
        </li>
      ))}
    </ul>
  )
}
```

### Conditional Client Components

```tsx
'use server'

import { AdminPanel } from './AdminPanel' // client component

export async function Dashboard({ userId }: { userId: string }) {
  const user = await db.users.findById(userId)

  return (
    <div>
      <h1>Welcome, {user.name}</h1>
      {user.isAdmin && <AdminPanel />}
    </div>
  )
}
```

### Streaming with Suspense

```tsx
'use server'

import { Suspense } from 'react'

export async function Page() {
  return (
    <div>
      <Header />

      <Suspense fallback={<Loading />}>
        <SlowComponent />
      </Suspense>

      <Footer />
    </div>
  )
}
```

### Passing Server Data to Client

```tsx
'use server'

import { InteractiveChart } from './InteractiveChart'

export async function AnalyticsDashboard() {
  const data = await analytics.getMetrics()

  // Data is serialized and passed to client component
  return <InteractiveChart data={data} />
}
```

## Client Component Boundaries

### When to Use Client Components

Use client components when you need:

- Event handlers (`onClick`, `onChange`)
- React hooks (`useState`, `useEffect`, `useContext`)
- Browser APIs (`window`, `document`, `localStorage`)
- Third-party libraries that use hooks

### Minimizing Client JavaScript

Push client boundaries down the tree to minimize JavaScript:

```tsx
// Bad: Entire page is a client component
'use client'

export function ProductPage({ productId }) {
  const [quantity, setQuantity] = useState(1)
  // All content ships to client
}
```

```tsx
// Good: Only interactive part is client component
'use server'

export async function ProductPage({ productId }) {
  const product = await db.products.findById(productId)

  return (
    <div>
      {/* Static content stays on server */}
      <h1>{product.name}</h1>
      <p>{product.description}</p>

      {/* Only this ships to client */}
      <AddToCartButton productId={productId} />
    </div>
  )
}
```

### Composition Pattern

```tsx
// ServerWrapper.tsx - Server Component
'use server'

import { ClientInteractive } from './ClientInteractive'

export function ServerWrapper({ children }) {
  const serverData = getServerOnlyData()

  return (
    <ClientInteractive data={serverData}>
      {children}
    </ClientInteractive>
  )
}
```

## Best Practices

### 1. Default to Server Components

Start with server components and only add `'use client'` when needed:

```tsx
// Start here - no directive needed for server components
export function StaticContent() {
  return <div>This renders on the server</div>
}
```

### 2. Keep Serializable Props

Only pass serializable data to client components:

```tsx
// Good: serializable props
<ClientComponent
  id={user.id}
  name={user.name}
  createdAt={user.createdAt.toISOString()}
/>

// Bad: non-serializable props
<ClientComponent
  user={user}           // might have methods
  onClick={handleClick} // functions can't serialize
/>
```

### 3. Use Composition for Interactivity

Wrap server content with client interactivity:

```tsx
'use client'

export function Accordion({ title, children }) {
  const [open, setOpen] = useState(false)

  return (
    <div>
      <button onClick={() => setOpen(!open)}>{title}</button>
      {open && children} {/* children can be server components */}
    </div>
  )
}
```

### 4. Colocate Data and Components

Fetch data where it's used:

```tsx
'use server'

// Data fetching colocated with component
export async function UserAvatar({ userId }) {
  const user = await db.users.findById(userId)
  return <img src={user.avatarUrl} alt={user.name} />
}
```

### 5. Handle Loading States

Use Suspense for async server components:

```tsx
import { Suspense } from 'react'

export function Page() {
  return (
    <Suspense fallback={<Skeleton />}>
      <AsyncServerComponent />
    </Suspense>
  )
}
```

## Integration with EreoJS

### Route Configuration

```ts
// ereo.config.ts
import { defineConfig } from '@ereo/core'

export default defineConfig({
  render: {
    mode: 'rsc',
    streaming: {
      enabled: true
    }
  }
})
```

### With File Router

```tsx
// routes/users/[id].tsx
'use server'

import { useParams } from '@ereo/router'
import { UserActions } from '../../components/UserActions'

export default async function UserPage() {
  const { id } = useParams()
  const user = await db.users.findById(id)

  return (
    <div>
      <h1>{user.name}</h1>
      <UserActions userId={id} />
    </div>
  )
}
```

### With Data Loaders

```tsx
// routes/products.tsx
'use server'

export const loader = async () => {
  return { products: await db.products.findAll() }
}

export default function ProductsPage({ data }) {
  return (
    <ul>
      {data.products.map(p => (
        <li key={p.id}>{p.name}</li>
      ))}
    </ul>
  )
}
```

## Related

- [Streaming](/api/server/streaming)
- [Islands](/api/client/islands)
- [Data Loaders](/api/data/loaders)
