#!/bin/bash

# Script to check migration status and manually re-run if needed
# Usage: ./scripts/check-migration.sh [environment]

ENVIRONMENT=${1:-dev}
STACK_NAME="${ENVIRONMENT^}InfraStack"  # Convert to title case (dev -> Dev)

echo "🔍 Checking migration status for $ENVIRONMENT environment..."

# Get stack outputs
echo "📋 Getting stack outputs..."
CLUSTER_ARN=$(aws cloudformation describe-stacks --stack-name $STACK_NAME \
  --query 'Stacks[0].Outputs[?OutputKey==`'${ENVIRONMENT^}'EmeryCluster`].OutputValue' \
  --output text 2>/dev/null)

MIGRATION_TASK_DEF=$(aws cloudformation describe-stacks --stack-name $STACK_NAME \
  --query 'Stacks[0].Outputs[?OutputKey==`'${ENVIRONMENT^}'MigrationTaskDefinitionArn`].OutputValue' \
  --output text 2>/dev/null)

LOG_GROUP=$(aws cloudformation describe-stacks --stack-name $STACK_NAME \
  --query 'Stacks[0].Outputs[?OutputKey==`'${ENVIRONMENT^}'MigrationLogGroup`].OutputValue' \
  --output text 2>/dev/null)

if [ -z "$CLUSTER_ARN" ] || [ -z "$MIGRATION_TASK_DEF" ]; then
  echo "❌ Could not find stack outputs. Is the stack deployed?"
  echo "   Stack name: $STACK_NAME"
  exit 1
fi

echo "✅ Found stack resources:"
echo "   Cluster: $CLUSTER_ARN"
echo "   Migration Task: $MIGRATION_TASK_DEF"
echo "   Log Group: $LOG_GROUP"

# Check for recent migration tasks
echo ""
echo "🔍 Checking recent migration tasks..."
RECENT_TASKS=$(aws ecs list-tasks --cluster $CLUSTER_ARN \
  --family "${ENVIRONMENT^}MigrationTaskDef" \
  --max-items 5 --query 'taskArns[]' --output text)

if [ -z "$RECENT_TASKS" ]; then
  echo "⚠️  No migration tasks found. Migration may not have run."
else
  echo "📝 Recent migration tasks:"
  for task in $RECENT_TASKS; do
    TASK_ARN=$(basename $task)
    TASK_STATUS=$(aws ecs describe-tasks --cluster $CLUSTER_ARN --tasks $task \
      --query 'tasks[0].lastStatus' --output text)
    CREATED_AT=$(aws ecs describe-tasks --cluster $CLUSTER_ARN --tasks $task \
      --query 'tasks[0].createdAt' --output text)
    echo "   📋 $TASK_ARN - Status: $TASK_STATUS - Created: $CREATED_AT"
  done
fi

# Check migration logs
echo ""
echo "📋 Checking migration logs..."
if [ -n "$LOG_GROUP" ]; then
  LOG_STREAMS=$(aws logs describe-log-streams --log-group-name "$LOG_GROUP" \
    --order-by LastEventTime --descending --max-items 3 \
    --query 'logStreams[].logStreamName' --output text 2>/dev/null)
  
  if [ -n "$LOG_STREAMS" ]; then
    echo "📋 Recent log streams:"
    for stream in $LOG_STREAMS; do
      echo "   📝 $stream"
      echo "      Latest logs:"
      aws logs get-log-events --log-group-name "$LOG_GROUP" --log-stream-name "$stream" \
        --limit 10 --query 'events[].message' --output text 2>/dev/null | sed 's/^/         /'
      echo ""
    done
  else
    echo "⚠️  No log streams found in $LOG_GROUP"
  fi
else
  echo "❌ Log group not found in stack outputs"
fi

# Function to manually run migration
run_migration() {
  echo ""
  echo "🚀 Running migration task manually..."
  
  # Get VPC subnets for the task
  VPC_ID=$(aws cloudformation describe-stack-resources --stack-name $STACK_NAME \
    --logical-resource-id "${ENVIRONMENT^}EmeryVpc" \
    --query 'StackResources[0].PhysicalResourceId' --output text)
  
  PRIVATE_SUBNETS=$(aws ec2 describe-subnets --filters "Name=vpc-id,Values=$VPC_ID" "Name=tag:Name,Values=*Private*" \
    --query 'Subnets[].SubnetId' --output text | tr '\t' ',')
  
  DB_CLIENT_SG=$(aws cloudformation describe-stack-resources --stack-name $STACK_NAME \
    --logical-resource-id "${ENVIRONMENT^}DbClientSg" \
    --query 'StackResources[0].PhysicalResourceId' --output text)
  
  if [ -z "$PRIVATE_SUBNETS" ] || [ -z "$DB_CLIENT_SG" ]; then
    echo "❌ Could not find VPC resources for migration task"
    exit 1
  fi
  
  echo "📋 Using subnets: $PRIVATE_SUBNETS"
  echo "📋 Using security group: $DB_CLIENT_SG"
  
  TASK_ARN=$(aws ecs run-task \
    --cluster $CLUSTER_ARN \
    --task-definition $MIGRATION_TASK_DEF \
    --launch-type FARGATE \
    --network-configuration "awsvpcConfiguration={subnets=[$PRIVATE_SUBNETS],securityGroups=[$DB_CLIENT_SG],assignPublicIp=DISABLED}" \
    --query 'tasks[0].taskArn' --output text)
  
  if [ $? -eq 0 ]; then
    echo "✅ Migration task started: $TASK_ARN"
    echo "📋 Monitor progress with:"
    echo "   aws ecs describe-tasks --cluster $CLUSTER_ARN --tasks $TASK_ARN"
    echo "📋 View logs with:"
    echo "   aws logs tail $LOG_GROUP --follow"
  else
    echo "❌ Failed to start migration task"
    exit 1
  fi
}

# Ask if user wants to run migration
echo ""
read -p "🤔 Do you want to manually run the migration task? (y/N): " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Yy]$ ]]; then
  run_migration
else
  echo "👋 Migration not run. Use the commands above to monitor existing tasks."
fi

echo ""
echo "🔧 Useful commands:"
echo "   # View all tasks in cluster:"
echo "   aws ecs list-tasks --cluster $CLUSTER_ARN"
echo ""
echo "   # Describe specific task:"
echo "   aws ecs describe-tasks --cluster $CLUSTER_ARN --tasks <task-arn>"
echo ""
echo "   # View migration logs:"
echo "   aws logs tail $LOG_GROUP --follow"
echo ""
echo "   # Manually run migration:"
echo "   ./scripts/check-migration.sh $ENVIRONMENT"