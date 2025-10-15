#!/bin/bash

# Simple script to add withAuthContext imports to remaining action files

files=(
  "app/actions/invitations.ts"
  "app/actions/rows.ts"
  "app/actions/databases.ts"
  "app/actions/tables.ts" 
  "app/actions/fields.ts"
  "app/actions/permissions.ts"
)

for file in "${files[@]}"; do
  echo "Processing $file..."
  
  # Check if import already exists
  if grep -q "withAuthContext" "$file"; then
    echo "  ✓ Already has import"
  else
    # Add import after user-organizations import
    if grep -q "user-organizations" "$file"; then
      sed -i '' '/user-organizations/a\
import { withAuthContext } from '\''@/lib/auth/with-context'\'';
' "$file"
      echo "  ✓ Added import"
    else
      echo "  ⚠️  Could not find insertion point"
    fi
  fi
done

echo "✅ Import additions complete!"