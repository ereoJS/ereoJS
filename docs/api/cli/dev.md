# dev

Starts the development server with hot module replacement.

## Usage

```bash
bun ereo dev [options]
```

Or via package.json:

```json
{
  "scripts": {
    "dev": "ereo dev"
  }
}
```

```bash
bun dev
```

## Options

| Option | Alias | Description | Default |
|--------|-------|-------------|---------|
| `--port` | `-p` | Port to listen on | `3000` |
| `--host` | `-h` | Host to bind to | `localhost` |
| `--open` | `-o` | Open browser on start | `false` |

## Examples

### Basic Usage

```bash
# Start on default port (3000)
bun ereo dev

# Start on custom port
bun ereo dev --port 8080

# Bind to all interfaces
bun ereo dev --host 0.0.0.0

# Open browser automatically
bun ereo dev --open
```

### Combined Options

```bash
bun ereo dev --port 4000 --host 0.0.0.0 --open
```

## Features

### Hot Module Replacement (HMR)

The dev server automatically reloads when files change:

- **Route changes** - New routes are immediately available
- **Component changes** - React Fast Refresh updates components
- **Style changes** - CSS updates without full reload
- **Configuration changes** - Restart required for config changes

### Error Overlay

When errors occur, a full-screen error overlay shows:

- Error message
- Stack trace
- Source code context
- File location (clickable to open in editor)

### TypeScript Support

TypeScript files are compiled on-the-fly:

- No build step required
- Type errors shown in terminal
- Source maps for debugging

### Fast Refresh

React components maintain state during updates:

```tsx
// Changes to this component preserve count state
function Counter() {
  const [count, setCount] = useState(0)
  return <button onClick={() => setCount(c + 1)}>{count}</button>
}
```

## Configuration

Configure dev server in `ereo.config.ts`:

```ts
import { defineConfig } from '@ereo/core'

export default defineConfig({
  server: {
    port: 3000,
    host: 'localhost',
    https: {
      key: './certs/localhost-key.pem',
      cert: './certs/localhost.pem'
    }
  },
  dev: {
    // Enable island debugging
    islands: {
      debug: true
    },
    // Enable cache debugging
    cache: {
      debug: true
    }
  }
})
```

## Programmatic Usage

```ts
import { dev } from '@ereo/cli'

await dev({
  port: 3000,
  host: 'localhost',
  open: true
})
```

## Environment Variables

The dev server loads environment files in this order:

1. `.env`
2. `.env.local`
3. `.env.development`
4. `.env.development.local`

Access in code:

```ts
const apiUrl = process.env.PUBLIC_API_URL
```

## Debugging

### Verbose Output

```bash
DEBUG=ereo:* bun ereo dev
```

This enables detailed logging for:

- Route discovery
- File changes
- HMR updates
- Request handling

### Inspector

Enable Node.js inspector for debugging:

```bash
bun --inspect ereo dev
```

Then connect Chrome DevTools or VS Code debugger.

## Troubleshooting

### Port Already in Use

```bash
# Find process using port
lsof -i :3000

# Kill process
kill -9 <PID>

# Or use different port
bun ereo dev --port 3001
```

### HMR Not Working

1. Check browser console for WebSocket errors
2. Ensure firewall allows WebSocket connections
3. Try hard refresh (Cmd+Shift+R / Ctrl+Shift+R)

### Slow Startup

1. Check for large files in routes directory
2. Exclude node_modules in file watching
3. Use SSD for better file system performance

## Related

- [build](/api/cli/build)
- [start](/api/cli/start)
- [Environment Variables](/guides/environment-variables)
