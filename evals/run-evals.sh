#!/bin/bash
# Emery Eval Runner
# Usage: ./run-evals.sh [setup|crud|adversarial|skills|all]

set -e
cd "$(dirname "$0")"

# Run setup if requested
if [ "$1" = "setup" ]; then
    ./setup-fixtures.sh
    exit 0
fi

# Load .env if exists
[ -f .env ] && export $(grep -v '^#' .env | xargs)

# Defaults
: "${EMERY_BASE_URL:=http://localhost:3002}"
: "${TEST_TABLE_ID:=1}"
: "${TEST_AGENT_ID:=1}"

# Check API key
if [ -z "$EMERY_API_KEY" ]; then
    echo "ERROR: EMERY_API_KEY required"
    echo "  export EMERY_API_KEY=user_xxx"
    echo "  or add to evals/.env"
    exit 1
fi

# Check API is up
if ! curl -sf "$EMERY_BASE_URL/api/health" > /dev/null 2>&1; then
    echo "ERROR: API not reachable at $EMERY_BASE_URL"
    echo "  docker compose -f src/tests/docker-compose.integration.yml up -d"
    exit 1
fi

# Install deps if needed
[ ! -d node_modules ] && pnpm install

# Export for promptfoo
export EMERY_BASE_URL EMERY_API_KEY TEST_TABLE_ID TEST_AGENT_ID

# Enable tsx for TypeScript provider files
export NODE_OPTIONS="--import tsx"

# Run evals
case "${1:-all}" in
    crud)
        pnpm exec promptfoo eval --config scenarios/crud/field-operations.yaml
        pnpm exec promptfoo eval --config scenarios/crud/row-operations.yaml
        pnpm exec promptfoo eval --config scenarios/crud/table-operations.yaml
        ;;
    adversarial|security)
        pnpm exec promptfoo eval --config scenarios/adversarial/injection-attempts.yaml
        ;;
    skills)
        pnpm exec promptfoo eval --config scenarios/skills/basic-execution.yaml
        ;;
    all)
        pnpm exec promptfoo eval --config promptfooconfig.yaml
        ;;
    *)
        echo "Usage: $0 [setup|crud|adversarial|skills|all]"
        echo "  setup       - Create test table and find agent ID"
        echo "  crud        - Run CRUD operation tests"
        echo "  adversarial - Run security/injection tests"
        echo "  skills      - Run agent skill tests"
        echo "  all         - Run all tests (default)"
        exit 1
        ;;
esac

echo ""
echo "Done! View results: pnpm exec promptfoo view"
