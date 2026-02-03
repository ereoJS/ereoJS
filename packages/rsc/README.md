# @ereo/rsc

React Server Components support for the EreoJS framework. Enables streaming RSC rendering with automatic client/server component detection.

## Installation

```bash
bun add @ereo/rsc
```

## Quick Start

```typescript
import { defineConfig } from '@ereo/core';
import { createRSCRenderConfig } from '@ereo/rsc';

export default defineConfig({
  render: createRSCRenderConfig({
    enabled: true,
  }),
});
```

```tsx
// Server Component (default)
async function ProductList() {
  const products = await db.products.findMany();
  return (
    <ul>
      {products.map(p => <li key={p.id}>{p.name}</li>)}
    </ul>
  );
}

// Client Component
'use client';
function Counter() {
  const [count, setCount] = useState(0);
  return <button onClick={() => setCount(c => c + 1)}>{count}</button>;
}
```

## Key Features

- **Streaming Support**: Stream RSC payloads for faster initial page loads
- **Server Components**: Render components on the server with direct data access
- **Client Components**: Automatic detection and handling of `'use client'` directives
- **Component Detection**: Utilities to check if components are server or client
- **RSC Serialization**: Serialize component trees for network transport
- **Stream Parsing**: Parse RSC streams back into component data
- **Client References**: Automatic extraction of client component references
- **TypeScript Support**: Full type definitions for RSC configuration

## API Reference

- `serializeRSC(component, config)` - Serialize a component tree to RSC format
- `parseRSCStream(stream)` - Parse an RSC stream back into component data
- `isServerComponent(component)` - Check if a component is a server component
- `isClientComponent(component)` - Check if a component is a client component
- `createRSCRenderConfig(config)` - Create RSC render configuration

## Documentation

For full documentation, visit the [EreoJS Documentation](https://ereojs.dev/docs/rsc).

## Part of EreoJS

This package is part of the [EreoJS](https://github.com/ereojs/ereo) monorepo - a modern full-stack JavaScript framework.

## License

MIT
