#!/bin/bash
# Create test fixtures for evals
# Usage: ./setup-fixtures.sh

set -e
cd "$(dirname "$0")"

# Load .env if exists
[ -f .env ] && export $(grep -v '^#' .env | xargs)

# Defaults
: "${EMERY_BASE_URL:=http://localhost:3002}"
: "${TEST_DATABASE_ID:=1}"

# Check API key
if [ -z "$EMERY_API_KEY" ]; then
    echo "ERROR: EMERY_API_KEY required"
    echo "  export EMERY_API_KEY=user_xxx"
    exit 1
fi

# Check API is up
echo "Checking API..."
if ! curl -sf "$EMERY_BASE_URL/api/health" > /dev/null 2>&1; then
    echo "ERROR: API not reachable at $EMERY_BASE_URL"
    exit 1
fi
echo "API is up"

# Check auth
echo "Checking auth..."
AUTH_CHECK=$(curl -s -w "%{http_code}" -o /dev/null \
    -H "Authorization: Bearer $EMERY_API_KEY" \
    "$EMERY_BASE_URL/api/tables")

if [ "$AUTH_CHECK" = "401" ]; then
    echo "ERROR: Invalid API key"
    exit 1
fi
echo "Auth OK"

# Create test table
echo ""
echo "Creating Eval Test Table..."
TABLE_RESPONSE=$(curl -s \
    -X POST \
    -H "Authorization: Bearer $EMERY_API_KEY" \
    -H "Content-Type: application/json" \
    -d "{\"name\": \"Eval Test Table\", \"databaseId\": $TEST_DATABASE_ID, \"description\": \"Created by eval setup\"}" \
    "$EMERY_BASE_URL/api/tables")

# Extract table ID (works with jq if available, falls back to grep)
if command -v jq &> /dev/null; then
    TABLE_ID=$(echo "$TABLE_RESPONSE" | jq -r '.data.id // .id // empty')
else
    TABLE_ID=$(echo "$TABLE_RESPONSE" | grep -o '"id":[0-9]*' | head -1 | cut -d: -f2)
fi

if [ -n "$TABLE_ID" ] && [ "$TABLE_ID" != "null" ]; then
    echo "Created table ID: $TABLE_ID"
else
    echo "Table creation response: $TABLE_RESPONSE"
    echo ""
    echo "If table already exists, find its ID with:"
    echo "  curl -H \"Authorization: Bearer \$EMERY_API_KEY\" $EMERY_BASE_URL/api/tables"
    TABLE_ID="1"
fi

# Get first agent (agents are user-owned, we just find one)
echo ""
echo "Looking for existing agent..."
AGENTS_RESPONSE=$(curl -s \
    -H "Authorization: Bearer $EMERY_API_KEY" \
    "$EMERY_BASE_URL/api/agents")

if command -v jq &> /dev/null; then
    AGENT_ID=$(echo "$AGENTS_RESPONSE" | jq -r '.agents[0].id // .data[0].id // .[0].id // empty')
else
    AGENT_ID=$(echo "$AGENTS_RESPONSE" | grep -o '"id":[0-9]*' | head -1 | cut -d: -f2)
fi

if [ -n "$AGENT_ID" ] && [ "$AGENT_ID" != "null" ]; then
    echo "Found agent ID: $AGENT_ID"
else
    echo "No agents found. Create one in the UI first."
    AGENT_ID="1"
fi

# Output
echo ""
echo "================================"
echo "Add to evals/.env:"
echo ""
echo "TEST_TABLE_ID=$TABLE_ID"
echo "TEST_AGENT_ID=$AGENT_ID"
echo "================================"

# Update .env if it exists
if [ -f .env ]; then
    # Remove old values and add new ones
    grep -v "^TEST_TABLE_ID=" .env | grep -v "^TEST_AGENT_ID=" > .env.tmp || true
    echo "TEST_TABLE_ID=$TABLE_ID" >> .env.tmp
    echo "TEST_AGENT_ID=$AGENT_ID" >> .env.tmp
    mv .env.tmp .env
    echo ""
    echo "Updated .env file"
fi

echo ""
echo "Setup complete! Run: ./run-evals.sh"
