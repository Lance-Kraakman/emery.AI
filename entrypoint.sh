#!/bin/sh

if [ "$1" = "scheduler" ]; then
  # AIDEV-NOTE: Run scheduler with tsx to avoid bundling issues
  exec npx tsx --tsconfig tsconfig.json scripts/run-scheduler.ts
else
  # AIDEV-NOTE: Use regular Next.js start command
  exec pnpm start
fi
