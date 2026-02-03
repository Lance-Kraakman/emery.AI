#!/bin/bash
set -e

TARGET="${1:-https://dev.enhancd.ai}"
REPORT_DIR="./security/reports"
mkdir -p "$REPORT_DIR"

echo "Running ZAP baseline scan on $TARGET..."

docker run --rm -v "$(pwd)/$REPORT_DIR:/zap/wrk:rw" \
  -t zaproxy/zap-stable zap-baseline.py \
  -t "$TARGET" \
  -r baseline-report.html \
  -J baseline-report.json

echo "Reports saved to $REPORT_DIR/"
