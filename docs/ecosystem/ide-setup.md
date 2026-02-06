# IDE Setup

Configure your editor for the best EreoJS development experience.

## VS Code

### Recommended Extensions

Install these extensions for EreoJS projects:

- **[ESLint](https://marketplace.visualstudio.com/items?itemName=dbaeumer.vscode-eslint)** --- Linting and code quality
- **[Prettier](https://marketplace.visualstudio.com/items?itemName=esbenp.prettier-vscode)** --- Code formatting
- **[Bun for Visual Studio Code](https://marketplace.visualstudio.com/items?itemName=oven.bun-vscode)** --- Bun runtime support, debugging
- **[Tailwind CSS IntelliSense](https://marketplace.visualstudio.com/items?itemName=bradlc.vscode-tailwindcss)** --- Autocomplete for Tailwind classes (if using Tailwind)

### Settings

Add these to your `.vscode/settings.json` for optimal Bun and EreoJS support:

```json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": "explicit"
  },
  "typescript.preferences.importModuleSpecifier": "non-relative",
  "typescript.tsdk": "node_modules/typescript/lib",
  "files.associations": {
    "*.island.tsx": "typescriptreact"
  }
}
```

### Path Alias IntelliSense

If your `tsconfig.json` includes path aliases, VS Code picks them up automatically. Ensure your config includes:

```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "~/*": ["./src/*"],
      "@ereo/*": ["./node_modules/@ereo/*/dist/index.d.ts"]
    }
  }
}
```

This enables autocomplete and go-to-definition for imports like `~/components/Header`.

### Debugging in VS Code

Add a launch configuration for debugging with Bun:

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "bun",
      "request": "launch",
      "name": "Debug EreoJS Dev",
      "program": "${workspaceFolder}/node_modules/.bin/ereo",
      "args": ["dev"],
      "cwd": "${workspaceFolder}"
    },
    {
      "type": "bun",
      "request": "launch",
      "name": "Debug Tests",
      "program": "${workspaceFolder}/node_modules/.bin/bun",
      "args": ["test", "${file}"],
      "cwd": "${workspaceFolder}"
    }
  ]
}
```

## IntelliJ / WebStorm

### Bun Plugin

Install the Bun plugin from the JetBrains Marketplace:

1. Go to **Settings** > **Plugins** > **Marketplace**
2. Search for "Bun" and install
3. Set Bun as the package manager: **Settings** > **Languages & Frameworks** > **Node.js** > **Package manager**: select Bun

### Run Configurations

Create run configurations for common tasks:

- **Dev server:** Bun script `dev`
- **Tests:** Bun script `test`
- **Build:** Bun script `build`

### TypeScript Configuration

Ensure IntelliJ uses the project's TypeScript version:

1. Go to **Settings** > **Languages & Frameworks** > **TypeScript**
2. Set **TypeScript** to `node_modules/typescript/lib`

## ESLint Configuration

Create an ESLint config for EreoJS projects:

```js
// eslint.config.js
import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import react from 'eslint-plugin-react'

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    plugins: { react },
    rules: {
      'react/react-in-jsx-scope': 'off',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    },
    settings: {
      react: { version: 'detect' },
    },
  },
)
```

## TypeScript Settings

EreoJS projects should use these TypeScript compiler options at minimum:

```json
{
  "compilerOptions": {
    "target": "ESNext",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true
  },
  "include": ["src", "routes"]
}
```

The `"moduleResolution": "bundler"` setting is important for proper resolution of `@ereo/*` packages and virtual modules.
