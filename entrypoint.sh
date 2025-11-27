#!/bin/sh

if [ "$1" = "scheduler" ]; then
  # AIDEV-NOTE: Run scheduler with tsx to avoid bundling issues
  exec npx tsx --tsconfig tsconfig.json src/scripts/run-scheduler.ts
elif [ "$1" = "migrate" ]; then
  # Run database migrations with AWS Secrets Manager support
  echo "Running database migrations..."
  exec npx tsx src/scripts/migrate.ts
elif [ "$1" = "dev" ]; then
  # AIDEV-NOTE: Run in development mode with hot reloading
  exec pnpm dev
else
  # AIDEV-NOTE: Use regular Next.js start command
  exec pnpm start
fi
