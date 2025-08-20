#!/bin/bash
set -e

echo "🧪 Setting up integration test database"
echo "======================================"

# Start test database container
echo "📦 Starting test database container..."
docker-compose -f tests/docker-compose.test.yml up -d

# Wait for database to be ready
echo "⏳ Waiting for database to be ready..."
until docker-compose -f tests/docker-compose.test.yml exec -T postgres-test pg_isready -U postgres -d emery_test; do
  echo "Waiting for postgres..."
  sleep 2
done

echo "✅ Test database is ready!"

# Enable required extensions
echo "🔧 Enabling PostgreSQL extensions..."
docker-compose -f tests/docker-compose.test.yml exec -T postgres-test psql -U postgres -d emery_test -c "
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS \"uuid-ossp\";
"

# Apply migrations to test database
echo "🔧 Applying migrations to test database..."
DATABASE_URL="postgresql://postgres:test_password@localhost:5434/emery_test" pnpm db:migrate

echo "✅ Test database setup complete!"
echo "📝 Test database URL: postgresql://postgres:test_password@localhost:5434/emery_test"