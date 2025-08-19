#!/bin/bash
# Minimal migration runner - checks status and runs migration task
# Usage: ./scripts/check-migration.sh [environment]

ENVIRONMENT=${1:-dev}
ENV_PREFIX="$(echo ${ENVIRONMENT:0:1} | tr '[:lower:]' '[:upper:]')$(echo ${ENVIRONMENT:1})"
STACK_NAME="Emery-Infra-$ENV_PREFIX"

# Read config from CDK
ACCOUNT_ID=$(grep -o '"aws_account_id": "[^"]*"' infra/cdk.json | cut -d'"' -f4)
REGION=$(grep -o '"region": "[^"]*"' infra/cdk.json | cut -d'"' -f4)

echo "Migration runner for $ENVIRONMENT environment"

# Get cluster
CLUSTER_ARN="arn:aws:ecs:$REGION:$ACCOUNT_ID:cluster/${ENV_PREFIX}EmeryCluster"

# Check migration task definition (CDK uses longer names)
MIGRATION_TASK_DEF=$(aws ecs list-task-definitions --query 'taskDefinitionArns[]' --output text | tr '\t' '\n' | grep -i migration | tail -1)

if [ "$MIGRATION_TASK_DEF" = "None" ] || [ -z "$MIGRATION_TASK_DEF" ]; then
  echo "❌ No migration task definition found. Deploy the stack first."
  exit 1
fi

echo "✅ Found migration task: $(basename $MIGRATION_TASK_DEF)"

# Check recent runs  
TASK_FAMILY=$(echo $MIGRATION_TASK_DEF | cut -d'/' -f2 | cut -d':' -f1)
RECENT_TASKS=$(aws ecs list-tasks --cluster $CLUSTER_ARN \
  --family "$TASK_FAMILY" --query 'taskArns[]' --output text 2>/dev/null)

if [ -n "$RECENT_TASKS" ]; then
  echo "📋 Recent migration runs:"
  for task in $RECENT_TASKS; do
    STATUS=$(aws ecs describe-tasks --cluster $CLUSTER_ARN --tasks $task \
      --query 'tasks[0].lastStatus' --output text)
    echo "   $(basename $task): $STATUS"
  done
else
  echo "⚠️  No migration runs found"
fi

# Run migration
read -p "Run migration now? (y/N): " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  exit 0
fi

# Get VPC resources (same as CDK uses)
VPC_ID=$(aws cloudformation describe-stack-resources --stack-name $STACK_NAME \
  --logical-resource-id "${ENV_PREFIX}EmeryVpc" --query 'StackResources[0].PhysicalResourceId' --output text)

PRIVATE_SUBNETS=$(aws ec2 describe-subnets --filters "Name=vpc-id,Values=$VPC_ID" "Name=tag:Name,Values=*Private*" \
  --query 'Subnets[].SubnetId' --output text | tr '\t' ',')

DB_CLIENT_SG=$(aws cloudformation describe-stack-resources --stack-name $STACK_NAME \
  --logical-resource-id "${ENV_PREFIX}DbClientSg" --query 'StackResources[0].PhysicalResourceId' --output text)

# Run one-shot migration task
echo "🚀 Starting migration..."
TASK_ARN=$(aws ecs run-task \
  --cluster $CLUSTER_ARN \
  --task-definition $MIGRATION_TASK_DEF \
  --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={subnets=[$PRIVATE_SUBNETS],securityGroups=[$DB_CLIENT_SG],assignPublicIp=DISABLED}" \
  --query 'tasks[0].taskArn' --output text)

if [ $? -eq 0 ]; then
  # Find the actual log group name
  LOG_GROUP=$(aws logs describe-log-groups --query 'logGroups[?contains(logGroupName, `Migration`)].logGroupName' --output text | grep -v lambda | head -1)
  
  echo "✅ Migration task started: $(basename $TASK_ARN)"
  echo "Monitor: aws ecs describe-tasks --cluster $CLUSTER_ARN --tasks $TASK_ARN"
  if [ -n "$LOG_GROUP" ]; then
    echo "Logs: aws logs tail $LOG_GROUP --follow"
  else
    echo "Logs: Check CloudWatch for migration logs"
  fi
else
  echo "❌ Failed to start migration"
  exit 1
fi