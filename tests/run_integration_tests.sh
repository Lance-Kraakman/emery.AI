#!/bin/bash
set -e

echo "🧪 Running RLS Integration Tests with Test Container"
echo "=================================================="

# Function to cleanup on exit
cleanup() {
    echo "🧹 Cleaning up test environment..."
    docker-compose -f tests/docker-compose.test.yml down -v
    echo "✅ Cleanup complete"
}

# Set trap to cleanup on script exit
trap cleanup EXIT

# Start test database
echo "🚀 Setting up test database container..."
./tests/setup_test_db.sh

# Run integration tests
echo "🧪 Running RLS integration tests..."
python -m pytest tests/rls/ -v --tb=short --disable-warnings

echo "🎉 Integration tests completed!"