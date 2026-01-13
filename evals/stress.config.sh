#!/bin/bash
# AIDEV-NOTE: Stress test configuration
# Source this file or set these env vars before running stress tests

# =============================================================================
# EXECUTION SETTINGS
# =============================================================================

# Number of parallel requests (how many tests run simultaneously)
# - 1 = sequential (baseline, no stress)
# - 5 = at DB pool limit
# - 10 = 2x DB pool (default)
# - 20+ = heavy stress
export STRESS_CONCURRENCY="${STRESS_CONCURRENCY:-10}"

# Number of times to repeat each test suite
# Higher = longer sustained load for ECS scaling tests
export STRESS_REPEAT="${STRESS_REPEAT:-1}"

# Delay between test suites (seconds) - allows system recovery between scenarios
export STRESS_DELAY="${STRESS_DELAY:-2}"

# =============================================================================
# PROFILES (preset configurations)
# =============================================================================
# Usage: STRESS_PROFILE=heavy ./run-evals.sh stress

case "${STRESS_PROFILE:-}" in
    light)
        # Light load - verify basic functionality under minimal stress
        export STRESS_CONCURRENCY=3
        export STRESS_REPEAT=1
        export STRESS_DELAY=5
        ;;
    medium)
        # Medium load - test at infrastructure limits
        export STRESS_CONCURRENCY=10
        export STRESS_REPEAT=2
        export STRESS_DELAY=3
        ;;
    heavy)
        # Heavy load - push past limits, expect errors
        export STRESS_CONCURRENCY=20
        export STRESS_REPEAT=3
        export STRESS_DELAY=1
        ;;
    sustained)
        # Sustained load - for ECS scaling verification (2+ minutes)
        export STRESS_CONCURRENCY=15
        export STRESS_REPEAT=5
        export STRESS_DELAY=0
        ;;
    *)
        # Use individual env var settings
        ;;
esac

# =============================================================================
# TARGET ENVIRONMENT
# =============================================================================

# Override these for different environments
# export EMERY_BASE_URL=https://dev.example.com
# export EMERY_API_KEY=user_xxx

# =============================================================================
# DISPLAY SETTINGS
# =============================================================================

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "STRESS TEST CONFIGURATION"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Profile:     ${STRESS_PROFILE:-custom}"
echo "  Concurrency: $STRESS_CONCURRENCY parallel requests"
echo "  Repeat:      $STRESS_REPEAT times per suite"
echo "  Delay:       ${STRESS_DELAY}s between suites"
echo "  Target:      $EMERY_BASE_URL"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
