#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
BENCHMARKS_DIR="$(dirname "$SCRIPT_DIR")"
APPS_DIR="$BENCHMARKS_DIR/apps"

echo "=== Benchmark Suite Setup ==="
echo ""

# Install benchmark deps
echo "Installing benchmark dependencies..."
cd "$BENCHMARKS_DIR"
bun install

# Install Ereo app deps (uses bun + workspace)
echo ""
echo "Installing Ereo app dependencies..."
cd "$APPS_DIR/ereo-bench"
bun install

# Install Next.js app deps
echo ""
echo "Installing Next.js app dependencies..."
cd "$APPS_DIR/nextjs-bench"
if command -v pnpm &> /dev/null; then
  pnpm install
else
  npm install
fi

# Install Remix app deps
echo ""
echo "Installing Remix app dependencies..."
cd "$APPS_DIR/remix-bench"
if command -v pnpm &> /dev/null; then
  pnpm install
else
  npm install
fi

# Install Astro app deps
echo ""
echo "Installing Astro app dependencies..."
cd "$APPS_DIR/astro-bench"
if command -v pnpm &> /dev/null; then
  pnpm install
else
  npm install
fi

# Check for load testing tools
echo ""
echo "=== Checking tools ==="
if command -v bombardier &> /dev/null; then
  echo "✓ bombardier found"
else
  echo "✗ bombardier not found (install with: brew install bombardier)"
  echo "  Will fall back to autocannon (npm)"
fi

if command -v lighthouse &> /dev/null || npx lighthouse --version &> /dev/null; then
  echo "✓ lighthouse available"
else
  echo "✗ lighthouse not found (will be installed via npx)"
fi

echo ""
echo "=== Setup complete ==="
echo ""
echo "Run benchmarks with:"
echo "  bun run benchmarks/scripts/run-all.ts"
echo ""
echo "Or run specific categories:"
echo "  bun run benchmarks/scripts/run-all.ts --build"
echo "  bun run benchmarks/scripts/run-all.ts --server"
echo "  bun run benchmarks/scripts/run-all.ts --client"
echo "  bun run benchmarks/scripts/run-all.ts --startup"
