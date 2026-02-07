# Prerequisites

Before you start building with EreoJS, make sure your system meets the following requirements. This page covers installing Bun, verifying your environment, and setting up optional tools that improve the development experience.

## System Requirements

| Requirement | Minimum | Recommended |
|-------------|---------|-------------|
| **Operating System** | macOS 12+, Linux (glibc 2.17+), Windows 10+ (via WSL2) | macOS 13+ or Ubuntu 22.04+ |
| **CPU Architecture** | x86_64 or ARM64 (Apple Silicon) | ARM64 for best Bun performance |
| **Memory** | 4 GB RAM | 8 GB RAM or more |
| **Disk Space** | 500 MB (Bun + project dependencies) | 2 GB for larger projects with database tooling |

EreoJS requires **Bun v1.0.0 or later**. The framework uses Bun as both the runtime and the package manager, so Node.js is not required (though it won't conflict if installed).

## Install Bun

### macOS and Linux

The recommended installation method is the official install script:

```bash
curl -fsSL https://bun.sh/install | bash
```

This downloads the latest Bun binary and adds it to your `PATH` via your shell profile (`~/.bashrc`, `~/.zshrc`, or `~/.bash_profile`).

### Homebrew (macOS)

If you prefer Homebrew:

```bash
brew install oven-sh/bun/bun
```

### npm (Any Platform)

If you already have Node.js and npm installed, you can install Bun globally:

```bash
npm install -g bun
```

This is useful as a quick bootstrap method, though the curl installer is preferred for production setups since it does not depend on Node.js.

### Windows (WSL2)

EreoJS requires WSL2 (Windows Subsystem for Linux) on Windows. Native Windows support is not available yet.

```powershell
# Step 1: Install WSL2 (run in PowerShell as Administrator)
wsl --install

# Step 2: Restart your computer, then open your WSL terminal

# Step 3: Inside WSL, install Bun
curl -fsSL https://bun.sh/install | bash

# Step 4: Restart your terminal or source your profile
source ~/.bashrc
```

After installation, all `bun` and `ereo` commands should be run inside your WSL terminal, not in PowerShell or Command Prompt.

## Verify Installation

After installing Bun, open a new terminal window and run:

```bash
bun --version
```

You should see a version number like `1.1.34` or later. If you see `command not found`, see the troubleshooting section below.

Also verify the binary location:

```bash
which bun
```

This should print a path like `/Users/yourname/.bun/bin/bun` (macOS/Linux) or `/home/yourname/.bun/bin/bun` (WSL).

### Updating Bun

To update to the latest version:

```bash
bun upgrade
```

## Troubleshooting Bun Installation

### `command not found: bun`

The Bun binary is not on your `PATH`. The install script adds it to your shell profile, but you need to either restart your terminal or manually source the profile:

```bash
# For bash
source ~/.bashrc

# For zsh
source ~/.zshrc
```

If the line is missing from your profile, add it manually:

```bash
# Add to ~/.bashrc or ~/.zshrc
export BUN_INSTALL="$HOME/.bun"
export PATH="$BUN_INSTALL/bin:$PATH"
```

### Permission denied during installation

If the curl installer fails with a permission error, avoid using `sudo`. Instead, ensure your home directory is writable:

```bash
# Check ownership of ~/.bun
ls -la ~/.bun

# If needed, fix ownership (replace 'yourname' with your username)
sudo chown -R yourname:yourname ~/.bun
```

### Bun version is too old

EreoJS requires Bun v1.0.0 or later. If `bun --version` shows an older version:

```bash
bun upgrade
```

If `bun upgrade` fails, remove the old installation and reinstall:

```bash
rm -rf ~/.bun
curl -fsSL https://bun.sh/install | bash
```

### WSL2-specific issues

If Bun runs slowly on WSL2, make sure your project files are on the Linux filesystem (e.g., `/home/yourname/projects/`), not on the Windows mount (`/mnt/c/`). File operations on `/mnt/c/` go through a compatibility layer that significantly reduces performance.

## Node.js Compatibility

EreoJS runs entirely on Bun — you do not need Node.js installed. However, Bun includes a Node.js compatibility layer, so most npm packages work without changes. If you have Node.js installed alongside Bun, they will not conflict.

A few things to be aware of:

- **npm packages** — The vast majority of npm packages work on Bun. Packages that use native Node.js C++ addons may need Bun-specific builds. Check [Bun's compatibility page](https://bun.sh/docs/runtime/nodejs-apis) for details.
- **Scripts** — Bun can run `node` scripts via `bun run`, but EreoJS commands always use `bun` directly (e.g., `bun dev`, `bun build`).
- **Package manager** — EreoJS projects use Bun as the package manager. Running `npm install` or `yarn install` in an EreoJS project may create incompatible lockfiles. Always use `bun install`.

## Recommended Editor Setup

### VS Code

VS Code works well with EreoJS out of the box since Bun executes TypeScript natively. For the best experience, install these extensions:

- **[Ereo](https://marketplace.visualstudio.com)** — Provides IntelliSense for EreoJS config files, route conventions, and code snippets for loaders, actions, and components.
- **[TypeScript](https://marketplace.visualstudio.com/items?itemName=ms-vscode.vscode-typescript-next)** — The nightly TypeScript extension provides better support for template literal types used in route typing.
- **[Tailwind CSS IntelliSense](https://marketplace.visualstudio.com/items?itemName=bradlc.vscode-tailwindcss)** — If you are using the Tailwind plugin, this provides autocomplete for class names.

Add these settings to your project's `.vscode/settings.json` for a smoother experience:

```json
{
  "typescript.tsdk": "node_modules/typescript/lib",
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "files.associations": {
    "*.island.tsx": "typescriptreact"
  }
}
```

### Other Editors

EreoJS works with any editor that supports TypeScript. JetBrains WebStorm, Neovim with `typescript-language-server`, and Sublime Text with the LSP plugin all provide type checking and autocompletion for EreoJS projects.

## Optional Tools

These tools are not required but are useful for a complete development workflow:

- **[Git](https://git-scm.com/)** — Version control. The `create-ereo` scaffolder initializes a Git repository automatically.
- **[Docker](https://www.docker.com/)** — For containerized deployment. See the [Docker deployment guide](/ecosystem/deployment/docker) for the recommended Dockerfile.
- **Database tools** — If your app uses a database, install the appropriate client:
  - **SQLite** — Built into Bun, no extra install needed
  - **PostgreSQL** — `brew install postgresql` or your platform's package manager
  - **SurrealDB** — `curl -sSf https://install.surrealdb.com | sh`
- **[Drizzle Kit](https://orm.drizzle.team/kit-docs/overview)** — If using the Drizzle database adapter, install `drizzle-kit` for migration tooling: `bun add -d drizzle-kit`

## Verify Everything Works

Run through this checklist to confirm your environment is ready:

```bash
# 1. Bun is installed and up to date
bun --version
# Expected: 1.0.0 or later

# 2. You can create a new project
bunx create-ereo@latest test-app

# 3. Dependencies install successfully
cd test-app && bun install

# 4. The dev server starts
bun dev
# Expected: Server running at http://localhost:3000

# 5. Clean up the test project
cd .. && rm -rf test-app
```

If all five steps complete without errors, your system is ready for EreoJS development.

## Next Steps

- **[Installation](/getting-started/installation)** — Create your first EreoJS project and explore the starter templates
- **[Project Structure](/getting-started/project-structure)** — Understand how files are organized in an EreoJS app
