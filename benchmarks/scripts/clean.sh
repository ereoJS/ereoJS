#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
BENCHMARKS_DIR="$(dirname "$SCRIPT_DIR")"
APPS_DIR="$BENCHMARKS_DIR/apps"

echo "=== Cleaning benchmark artifacts ==="

# Clean each app
echo "Cleaning Ereo..."
rm -rf "$APPS_DIR/ereo-bench/dist" "$APPS_DIR/ereo-bench/.ereo"

echo "Cleaning Next.js..."
rm -rf "$APPS_DIR/nextjs-bench/.next" "$APPS_DIR/nextjs-bench/out"

echo "Cleaning Remix..."
rm -rf "$APPS_DIR/remix-bench/build" "$APPS_DIR/remix-bench/.cache"

echo "Cleaning Astro..."
rm -rf "$APPS_DIR/astro-bench/dist" "$APPS_DIR/astro-bench/.astro"

# Clean results
echo "Cleaning results..."
rm -rf "$BENCHMARKS_DIR/results"

echo ""
echo "Done. Reports in benchmarks/reports/ were preserved."
