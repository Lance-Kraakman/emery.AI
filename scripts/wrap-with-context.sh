#!/bin/bash

# Script to automatically wrap server actions with withAuthContext

# List of action files to process
ACTION_FILES=(
  "app/actions/rows.ts"
  "app/actions/team-permissions.ts" 
  "app/actions/invitations.ts"
  "app/actions/tables.ts"
  "app/actions/permissions.ts"
  "app/actions/connections.ts"
  "app/actions/user-organizations.ts"
  "app/actions/fields.ts"
  "app/actions/files.ts"
  "app/actions/databases.ts"
)

for file in "${ACTION_FILES[@]}"; do
  echo "Processing $file..."
  
  # Add import if not already present
  if ! grep -q "withAuthContext" "$file"; then
    # Add import after existing imports
    sed -i '' '/from.*user-organizations/a\
import { withAuthContext } from '\''@/lib/auth/with-context'\'';
' "$file"
  fi
  
  echo "✓ Updated imports for $file"
done

echo "Done! Please manually wrap functions as needed."