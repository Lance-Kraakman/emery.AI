#!/bin/sh

if [ "$1" = "scheduler" ]; then
  exec pnpm scheduler:start
else
  exec node server.js
fi
