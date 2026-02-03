#!/bin/bash
set -e

TARGET="${1:-https://dev.enhancd.ai}"
API_KEY="${ZAP_API_KEY:-}"
REPORT_DIR="./security/reports"
mkdir -p "$REPORT_DIR"

if [ -z "$API_KEY" ]; then
  echo "Error: Set ZAP_API_KEY environment variable"
  echo "Usage: ZAP_API_KEY=user_xxx ./security/zap-authenticated.sh"
  exit 1
fi

echo "Running authenticated ZAP scan on $TARGET..."

docker run --rm -v "$(pwd)/$REPORT_DIR:/zap/wrk:rw" \
  -t zaproxy/zap-stable zap-baseline.py \
  -t "$TARGET" \
  -r auth-report.html \
  -J auth-report.json \
  -z "-config replacer.full_list(0).description=AddAuth \
      -config replacer.full_list(0).enabled=true \
      -config replacer.full_list(0).matchtype=REQ_HEADER \
      -config replacer.full_list(0).matchstr=Authorization \
      -config replacer.full_list(0).replacement='Bearer $API_KEY'"

echo "Reports saved to $REPORT_DIR/"
