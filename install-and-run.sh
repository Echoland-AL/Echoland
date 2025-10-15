#!/bin/bash

# Clear Bun cache and install dependencies
echo "Clearing Bun cache and installing dependencies..."
bun pm cache rm || true
rm -rf node_modules
rm -f bun.lockb
rm -rf ~/.bun/install/cache/elysia* || true
rm -rf /tmp/bun-cache || true

# Set custom cache directory
export BUN_INSTALL_CACHE_DIR=/tmp/bun-cache

# Install dependencies
echo "Installing dependencies with fresh cache..."
bun install --force --verbose

# Run the server
echo "Starting server..."
bun game-server.ts
