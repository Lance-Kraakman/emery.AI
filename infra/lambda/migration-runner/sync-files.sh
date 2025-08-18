#!/bin/bash
# Sync files from project root for CDK Lambda build

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"

echo "Syncing migration files for CDK build..."

# Copy drizzle config
cp "$PROJECT_ROOT/drizzle.config.ts" "$SCRIPT_DIR/"

# Copy lib directory
rm -rf "$SCRIPT_DIR/lib"
cp -r "$PROJECT_ROOT/lib" "$SCRIPT_DIR/"

# Copy drizzle migrations
rm -rf "$SCRIPT_DIR/drizzle"
cp -r "$PROJECT_ROOT/drizzle" "$SCRIPT_DIR/"

echo "Files synced successfully!"