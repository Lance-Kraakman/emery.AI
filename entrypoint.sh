#!/bin/sh

if [ "$1" = "scheduler" ]; then
  # AIDEV-NOTE: Run bundled scheduler (single file, no dependencies)
  exec node scheduler.js
else
  # AIDEV-NOTE: Use standalone Node.js server for minimal production deployment
  exec node server.js
fi
