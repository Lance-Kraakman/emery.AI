#!/bin/bash
# Apply ECR lifecycle policies to emery repositories
# Run this after repos are created or when policies need updating

set -e

REGION="${AWS_REGION:-ap-southeast-2}"

LIFECYCLE_POLICY='{
  "rules": [
    {
      "rulePriority": 1,
      "description": "Delete untagged images after 1 day",
      "selection": {
        "tagStatus": "untagged",
        "countType": "sinceImagePushed",
        "countUnit": "days",
        "countNumber": 1
      },
      "action": {
        "type": "expire"
      }
    },
    {
      "rulePriority": 2,
      "description": "Keep only last 10 develop/pr/tag images",
      "selection": {
        "tagStatus": "tagged",
        "tagPrefixList": ["develop-", "pr-", "tag-"],
        "countType": "imageCountMoreThan",
        "countNumber": 10
      },
      "action": {
        "type": "expire"
      }
    }
  ]
}'

for REPO in "emery/frontend" "emery/agent"; do
  echo "Applying lifecycle policy to $REPO..."
  aws ecr put-lifecycle-policy \
    --repository-name "$REPO" \
    --lifecycle-policy-text "$LIFECYCLE_POLICY" \
    --region "$REGION"
  echo "Done: $REPO"
done

echo "All lifecycle policies applied successfully."
