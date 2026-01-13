#!/bin/bash
# Setup test fixtures for evals
# Usage: ./setup-fixtures.sh

cd "$(dirname "$0")"

# Load .env if exists
[ -f .env ] && set -a && source .env && set +a

# Run Python setup script
python3 setup_fixtures.py
