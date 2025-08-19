#!/bin/sh

if [ "$1" = "scheduler" ]; then
  # AIDEV-NOTE: Run scheduler with tsx to avoid bundling issues
  exec npx tsx --tsconfig tsconfig.json scripts/run-scheduler.ts
elif [ "$1" = "migrate" ]; then
  # Run database migrations with AWS Secrets Manager support
  echo "Running database migrations..."
  exec node scripts/migrate.js
else
  # AIDEV-NOTE: Use regular Next.js start command
  exec pnpm start
fi
