#!/bin/bash

# AIDEV-NOTE: Port collision prevention script for integration tests
# Ensures integration test ports are available before starting containers

set -e

check_port() {
  local port=$1
  local service=$2
  
  if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1; then
    echo "❌ Port $port is already in use (needed for $service)"
    echo "   Process using port: $(lsof -Pi :$port -sTCP:LISTEN -n -P | tail -1)"
    return 1
  else
    echo "✅ Port $port is available for $service"
    return 0
  fi
}

echo "🔍 Checking integration test ports..."
echo "=========================================="

# Port allocation:
# Main containers:     5433 (DB), 3000 (App), 50051 (Agent)  
# RLS tests:          5434 (DB only)
# Integration tests:  5436 (DB), 3002 (App), 50053 (Agent), 50054 (Table Services)

all_ports_available=true

check_port 5436 "Integration Test PostgreSQL" || all_ports_available=false
check_port 3002 "Integration Test Next.js App" || all_ports_available=false  
check_port 50053 "Integration Test gRPC Agent" || all_ports_available=false
check_port 50054 "Integration Test gRPC Table Services" || all_ports_available=false

echo ""

if [ "$all_ports_available" = true ]; then
  echo "✅ All integration test ports are available"
  echo "Ready to start integration test containers!"
  exit 0
else
  echo "❌ Some ports are already in use"
  echo ""
  echo "Solutions:"
  echo "1. Stop the processes using those ports"
  echo "2. Change the ports in tests/docker-compose.integration.yml"
  echo "3. Wait for the processes to finish and try again"
  exit 1
fi