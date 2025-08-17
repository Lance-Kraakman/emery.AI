#!/bin/sh

if [ "$1" = "scheduler" ]; then
  # AIDEV-NOTE: Run bundled scheduler (single file, no dependencies)
  exec node scheduler.js
else
  # AIDEV-NOTE: Use regular Next.js start command
  exec pnpm start
fi
