#!/bin/sh
# Fetch authorized SSH keys from the API
#
# Called by sshd's AuthorizedKeysCommand on each SSH connection.
# Returns keys in authorized_keys format (one key per line).
#
# Note: sshd runs AuthorizedKeysCommand in a clean environment without
# container env vars. We source from linuxserver's s6 environment.

set -e

# Source environment from linuxserver s6 (works for Docker env vars)
if [ -d /run/s6/container_environment ]; then
  for f in /run/s6/container_environment/*; do
    [ -f "$f" ] && export "$(basename "$f")=$(cat "$f")"
  done
fi

API_HOST="${API_HOST:-host.docker.internal:3000}"
URL="http://${API_HOST}/api/internal/authorized-keys"

# Fetch keys from API (silent on error, SSH will fall back to other auth methods)
curl -sf -H "X-Internal-Secret: ${INTERNAL_API_SECRET}" "$URL" 2>/dev/null || true
