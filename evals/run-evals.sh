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
    # Layer 1: CRUD operations
    crud)
        pnpm exec promptfoo eval --config scenarios/crud/database-operations.yaml
        pnpm exec promptfoo eval --config scenarios/crud/field-operations.yaml
        pnpm exec promptfoo eval --config scenarios/crud/row-operations.yaml
        pnpm exec promptfoo eval --config scenarios/crud/table-operations.yaml
        ;;
    crud:database)
        pnpm exec promptfoo eval --config scenarios/crud/database-operations.yaml
        ;;

    # Layer 2: Tool executor
    tool-executor)
        pnpm exec promptfoo eval --config scenarios/tool-executor/basic-operations.yaml
        ;;

    # Layer 3: Agent single-turn tests
    agents:skill)
        pnpm exec promptfoo eval --config scenarios/agents/skill-builder.yaml
        ;;
    agents:schema)
        pnpm exec promptfoo eval --config scenarios/agents/schema-builder-simple.yaml
        ;;

    # Layer 4: HITL workflow tests
    agents:hitl)
        pnpm exec promptfoo eval --config scenarios/agents/schema-builder-hitl.yaml
        ;;

    # Combined agent tests
    agents)
        pnpm exec promptfoo eval --config scenarios/agents/skill-builder.yaml
        pnpm exec promptfoo eval --config scenarios/agents/schema-builder-simple.yaml
        pnpm exec promptfoo eval --config scenarios/agents/schema-builder-hitl.yaml
        ;;

    adversarial|security)
        pnpm exec promptfoo eval --config scenarios/adversarial/injection-attempts.yaml
        ;;
    skills)
        pnpm exec promptfoo eval --config scenarios/skills/basic-execution.yaml
        ;;
    stress)
        # Load stress config (sets STRESS_CONCURRENCY, STRESS_REPEAT, STRESS_DELAY)
        source ./stress.config.sh

        run_stress_suite() {
            local config=$1
            local name=$2
            echo "▶ Running: $name"
            for i in $(seq 1 "$STRESS_REPEAT"); do
                [ "$STRESS_REPEAT" -gt 1 ] && echo "  Round $i/$STRESS_REPEAT"
                pnpm exec promptfoo eval --config "$config" --max-concurrency "$STRESS_CONCURRENCY"
            done
            [ "$STRESS_DELAY" -gt 0 ] && sleep "$STRESS_DELAY"
        }

        run_stress_suite scenarios/stress/db-pool-exhaustion.yaml "DB Pool Exhaustion"
        run_stress_suite scenarios/stress/grpc-table-saturation.yaml "gRPC/S3 Saturation"
        run_stress_suite scenarios/stress/mixed-workload.yaml "Mixed Workload"
        run_stress_suite scenarios/stress/sustained-load.yaml "Sustained Load"
        ;;

    # Individual stress tests
    stress:db)
        source ./stress.config.sh
        pnpm exec promptfoo eval --config scenarios/stress/db-pool-exhaustion.yaml --max-concurrency "$STRESS_CONCURRENCY" --repeat "$STRESS_REPEAT"
        ;;
    stress:grpc)
        source ./stress.config.sh
        pnpm exec promptfoo eval --config scenarios/stress/grpc-table-saturation.yaml --max-concurrency "$STRESS_CONCURRENCY" --repeat "$STRESS_REPEAT"
        ;;
    stress:mixed)
        source ./stress.config.sh
        pnpm exec promptfoo eval --config scenarios/stress/mixed-workload.yaml --max-concurrency "$STRESS_CONCURRENCY" --repeat "$STRESS_REPEAT"
        ;;
    stress:sustained)
        source ./stress.config.sh
        pnpm exec promptfoo eval --config scenarios/stress/sustained-load.yaml --max-concurrency "$STRESS_CONCURRENCY" --repeat "$STRESS_REPEAT"
        ;;
    all)
        pnpm exec promptfoo eval --config promptfooconfig.yaml
        ;;
    *)
        echo "Usage: $0 [command]"
        echo ""
        echo "Layer 1 - CRUD Operations:"
        echo "  crud           - Run all CRUD tests"
        echo "  crud:database  - Database operations only"
        echo ""
        echo "Layer 2 - Tool Executor:"
        echo "  tool-executor  - Natural language → CRUD translation"
        echo ""
        echo "Layer 3 - Agent Single-Turn:"
        echo "  agents:skill   - Skill builder tests"
        echo "  agents:schema  - Schema builder simple tests"
        echo ""
        echo "Layer 4 - HITL Workflows:"
        echo "  agents:hitl    - Full HITL workflow tests"
        echo ""
        echo "Combined:"
        echo "  agents         - All agent tests (Layer 3 + 4)"
        echo "  adversarial    - Security/injection tests"
        echo "  skills         - Basic skill execution"
        echo "  all            - Run all tests (default)"
        echo ""
        echo "Stress Tests:"
        echo "  stress         - Run all stress tests"
        echo "  stress:db      - DB connection pool exhaustion"
        echo "  stress:grpc    - gRPC/S3 write saturation"
        echo "  stress:mixed   - Mixed workload (realistic traffic)"
        echo "  stress:sustained - Sustained load (ECS scaling)"
        echo ""
        echo "Setup:"
        echo "  setup          - Create test fixtures"
        echo ""
        echo "Environment Variables:"
        echo "  EMERY_API_KEY=user_xxx       (required)"
        echo "  TEST_DATABASE_ID=1           (for database tests)"
        echo "  SCHEMA_BUILDER_AGENT_ID=2    (for schema builder)"
        echo "  SKILL_BUILDER_AGENT_ID=3     (for skill builder)"
        exit 1
        ;;
esac

echo ""
echo "Done! View results: pnpm exec promptfoo view"
