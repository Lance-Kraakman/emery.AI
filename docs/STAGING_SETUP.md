# Staging Environment Setup Guide

## Overview
This guide configures a staging environment that deploys when you push to the `staging` branch.

## Prerequisites
- AWS Account (can use same account as dev with different environment name)
- GitHub repository with admin access
- AWS CLI configured

## Step 1: AWS Secrets Manager Setup

Run the automated setup script:
```bash
./scripts/setup-staging-secrets.sh
```

Then update the secrets with real values:
```bash
# Update all secrets at once
aws secretsmanager update-secret \
  --secret-id "emery-app-secrets/staging" \
  --secret-string '{
    "NEXTAUTH_SECRET": "your-actual-staging-nextauth-secret",
    "GITHUB_CLIENT_ID": "your-staging-github-oauth-app-client-id",
    "GITHUB_CLIENT_SECRET": "your-staging-github-oauth-app-client-secret",
    "PIPEDREAM_PROJECT_ID": "your-staging-pipedream-project-id",
    "PIPEDREAM_CLIENT_ID": "your-staging-pipedream-client-id",
    "PIPEDREAM_CLIENT_SECRET": "your-staging-pipedream-client-secret",
    "PIPEDREAM_API_KEY": "your-staging-pipedream-api-key",
    "OPENAI_API_KEY": "your-openai-api-key",
    "HF_TOKEN": "your-huggingface-token",
    "RESEND_API_KEY": "your-resend-api-key"
  }'
```

## Step 2: GitHub Environment Setup

### Create GitHub Environment
1. Go to your GitHub repository
2. Navigate to **Settings** → **Environments**
3. Click **New environment**
4. Name: `staging`
5. **Optional**: Add protection rules (require reviewers for staging deploys)

### Configure Environment Secrets
Add these secrets to the `staging` environment:

| Secret Name | Description | Value |
|-------------|-------------|-------|
| `AWS_ACCESS_KEY_ID` | AWS access key for staging deployments | Your AWS access key |
| `AWS_SECRET_ACCESS_KEY` | AWS secret key for staging deployments | Your AWS secret key |
| `AWS_ACCOUNT_ID` | AWS account ID for staging | `473004513440` (or separate staging account) |

### Configure Environment Variables  
Add these variables to the `staging` environment:

| Variable Name | Value |
|---------------|-------|
| `AWS_REGION` | `ap-southeast-2` |

## Step 3: Create Staging Branch

```bash
# Create and push staging branch
git checkout develop
git checkout -b staging
git push -u origin staging
```

## Step 4: ECR Repository Setup (Optional)

If using separate ECR repositories for staging:

```bash
# Create staging ECR repositories
aws ecr create-repository --repository-name emery-frontend-staging --region ap-southeast-2
aws ecr create-repository --repository-name emery-agent-staging --region ap-southeast-2
```

## Step 5: First Staging Deployment

```bash
# Trigger staging deployment
git checkout staging
git merge develop  # Merge latest changes
git push origin staging  # This triggers deployment
```

## Deployment Flow

### Environment Mapping
- **`develop` branch** → `dev` environment
- **`staging` branch** → `staging` environment  
- **`main` branch** → `production` environment

### Resource Naming
Resources are automatically prefixed by environment:
- **Dev**: `DevEmeryCluster`, `dev-emery-frontend`, etc.
- **Staging**: `StagingEmeryCluster`, `staging-emery-frontend`, etc.
- **Production**: `ProductionEmeryCluster`, `production-emery-frontend`, etc.

### Database Isolation
Each environment gets its own:
- RDS PostgreSQL instance (`emery_dev`, `emery_staging`, `emery_production`)
- VPC and security groups
- Load balancers and ECS clusters
- S3 buckets (`dev-emery-storage-*`, `staging-emery-storage-*`)

## Monitoring Staging Deployment

### GitHub Actions
Monitor deployment progress in:
- **GitHub** → **Actions** → **Deploy CDK Application**

### AWS CloudFormation
Check stack deployment:
```bash
# Monitor stack events
aws cloudformation describe-stack-events --stack-name Emery-Infra-Staging

# Check stack status
aws cloudformation describe-stacks --stack-name Emery-Infra-Staging --query 'Stacks[0].StackStatus'
```

### Application Health
Once deployed, check staging application:
```bash
# Get staging CloudFront URL
aws cloudformation describe-stacks \
  --stack-name Emery-Infra-Staging \
  --query 'Stacks[0].Outputs[?OutputKey==`StagingCloudFrontURL`].OutputValue' \
  --output text
```

## Staging vs Dev Differences

### Infrastructure Sizing
Staging typically uses same sizing as dev for cost efficiency:
- **t4g.micro** RDS instances
- **512 CPU / 1024 MB** ECS tasks
- **Single AZ** deployment

### For Production-Like Staging
If you need production-like staging, modify `infra_stack.py`:

```python
# In infra_stack.py, add staging-specific sizing
if env_name == "staging":
    # Production-like sizing for staging
    db_instance_type = ec2.InstanceType.of(ec2.InstanceClass.T3, ec2.InstanceSize.SMALL)
    ecs_cpu = 1024
    ecs_memory = 2048
    desired_count = 2
```

## Troubleshooting

### Common Issues

#### 1. Missing Secrets
**Error**: `Secret emery-app-secrets/staging not found`
**Solution**: Run `./scripts/setup-staging-secrets.sh` and update with real values

#### 2. GitHub Environment Not Found
**Error**: `Environment staging not found`
**Solution**: Create the `staging` environment in GitHub repository settings

#### 3. AWS Permissions
**Error**: `AccessDenied` during deployment  
**Solution**: Ensure AWS credentials have necessary CDK/CloudFormation permissions

#### 4. ECR Image Not Found
**Error**: `Image not found` during ECS deployment
**Solution**: Build and push images to ECR before deployment, or use existing dev images initially

### Logs and Debugging

#### Migration Logs
```bash
# Check staging migration logs
aws logs tail "/aws/ecs/Staging-Migration-Init" --follow --region ap-southeast-2
```

#### ECS Service Logs
```bash
# Check staging frontend logs
aws logs tail "/aws/ecs/Staging-Frontend" --follow --region ap-southeast-2

# Check staging scheduler logs  
aws logs tail "/aws/ecs/Staging-Scheduler" --follow --region ap-southeast-2
```

## Cost Optimization

### Shared Resources (Dev + Staging in same account)
- Use same NAT Gateway for both environments
- Share bastion host between dev and staging
- Use lifecycle policies on S3 buckets

### Automatic Shutdown (Optional)
For cost savings, you can implement automatic shutdown of staging resources:

```bash
# Stop staging services overnight (optional)
aws ecs update-service --cluster StagingEmeryCluster --service Staging-Frontend --desired-count 0
aws ecs update-service --cluster StagingEmeryCluster --service Staging-Scheduler --desired-count 0
aws ecs update-service --cluster StagingEmeryCluster --service Staging-Agent --desired-count 0

# Start them in the morning
aws ecs update-service --cluster StagingEmeryCluster --service Staging-Frontend --desired-count 1
aws ecs update-service --cluster StagingEmeryCluster --service Staging-Scheduler --desired-count 1  
aws ecs update-service --cluster StagingEmeryCluster --service Staging-Agent --desired-count 1
```

## Security Considerations

### Same Account Deployment
- **Network Isolation**: Different VPCs or subnets for dev/staging
- **IAM Separation**: Use different IAM roles with appropriate permissions
- **Database Isolation**: Separate RDS instances prevent data mixing

### Cross-Account (More Secure)
For higher security, deploy staging to a separate AWS account:
1. Create new AWS account for staging
2. Update GitHub secrets with staging account credentials
3. Bootstrap CDK in staging account: `cdk bootstrap --profile staging`

## Next Steps

1. **Test Migration**: Push to staging branch and verify deployment
2. **Database Setup**: Connect to staging database and verify schema
3. **Application Testing**: Test full application functionality in staging
4. **Monitoring Setup**: Configure CloudWatch alarms and dashboards
5. **Production Setup**: Repeat similar process for production environment

This staging environment provides a production-like testing environment while maintaining cost efficiency and security isolation.