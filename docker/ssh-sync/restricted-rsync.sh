#!/bin/bash
# Restrict rsync to specific organization folder
# Called via SSH ForceCommand: command="/usr/local/bin/restricted-rsync.sh ORG_ID"
#
# Security: Validates that the rsync path is within the allowed org folder
# before executing the command. Rejects attempts to access other orgs.

ORG_ID=$1

if [ -z "$ORG_ID" ]; then
  echo "Error: Organization ID not provided" >&2
  exit 1
fi

if [ -z "$SSH_ORIGINAL_COMMAND" ]; then
  echo "Error: No command provided" >&2
  exit 1
fi

# Extract the path from rsync command
# rsync commands look like: rsync --server -vlogDtprze.iLsfxCIvu . /workspace/4/agents/10/
# We need to check the destination path contains our org

# Validate path contains /workspace/{org_id}/
if ! echo "$SSH_ORIGINAL_COMMAND" | grep -qE "/workspace/${ORG_ID}/"; then
  echo "Error: Access denied - path not in organization ${ORG_ID}" >&2
  exit 1
fi

# Prevent path traversal (../)
if echo "$SSH_ORIGINAL_COMMAND" | grep -qE "\.\."; then
  echo "Error: Access denied - path traversal not allowed" >&2
  exit 1
fi

# Only allow rsync commands
if ! echo "$SSH_ORIGINAL_COMMAND" | grep -qE "^rsync "; then
  echo "Error: Only rsync commands are allowed" >&2
  exit 1
fi

# Execute the original rsync command
exec $SSH_ORIGINAL_COMMAND
