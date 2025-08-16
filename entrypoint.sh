#!/bin/sh

if [ "$1" = "scheduler" ]; then
  exec pnpm scheduler:start
else
  # AIDEV-NOTE: Use pnpm start for normal Next.js mode (not standalone)
  exec pnpm start
fi
