# Emery Infrastructure (AWS CDK)

This CDK project manages the infrastructure for the Emery application across development, staging, and production environments.

## Architecture Overview

The infrastructure deploys:
- **Frontend Service**: Next.js application on ECS Fargate with Application Load Balancer
- **Scheduler Service**: Background task scheduler on ECS Fargate
- **Agent Service**: Python gRPC worker on ECS Fargate with Network Load Balancer
- **Database**: PostgreSQL 16.3 on RDS (t4g.micro with Graviton)
- **Storage**: S3 bucket for file storage
- **Networking**: VPC with public/private subnets, NAT gateway
- **Bastion Host**: EC2 instance for secure database access
- **CloudFront**: CDN for static URL routing

## AWS Account Configuration

**Multi-Account Strategy for Environment Isolation:**
- **Development**: Account `463735866328` (Sydney, ap-southeast-2)
- **Staging**: Account `772302459598` (Sydney, ap-southeast-2)
- **Production**: Account `034165313651` (Sydney, ap-southeast-2)

These values are configured per-environment using GitHub Environment secrets.

## Prerequisites

### Local Development Tools
```bash
# Install AWS CDK CLI
npm install -g aws-cdk

# Install Python 3.12+
python3 --version  # Should be 3.12 or higher

# Configure AWS credentials
aws configure
```

### GitHub Actions Secrets

Update the following secrets in your GitHub repository settings for the new AWS account:

| Secret Name | Description | Example Value |
|------------|-------------|---------------|
| `AWS_ACCOUNT_ID` | AWS Account ID | `463735866328` |
| `AWS_ACCESS_KEY_ID` | IAM user access key | `AKIA...` |
| `AWS_SECRET_ACCESS_KEY` | IAM user secret key | `secret...` |
| `AWS_ROLE_TO_ASSUME` | (Optional) IAM role ARN for OIDC | `arn:aws:iam::463735866328:role/...` |

## First-Time Setup for New AWS Account

### Step 1: Bootstrap CDK

Bootstrap the AWS account for CDK deployments:

```bash
cd infra

# Bootstrap for the configured region
cdk bootstrap aws://463735866328/ap-southeast-2
```

### Step 2: Create EC2 Key Pairs

Create SSH key pairs for bastion hosts in each environment:

```bash
# Using AWS CLI
aws ec2 create-key-pair \
  --key-name dev-bastion-machine \
  --query 'KeyMaterial' \
  --output text > ~/.ssh/dev-bastion-machine.pem

aws ec2 create-key-pair \
  --key-name staging-bastion-machine \
  --query 'KeyMaterial' \
  --output text > ~/.ssh/staging-bastion-machine.pem

aws ec2 create-key-pair \
  --key-name production-bastion-machine \
  --query 'KeyMaterial' \
  --output text > ~/.ssh/production-bastion-machine.pem

# Set proper permissions
chmod 400 ~/.ssh/*-bastion-machine.pem
```

Or create them manually in the AWS Console:
1. Go to EC2 → Key Pairs
2. Create key pairs named: `dev-bastion-machine`, `staging-bastion-machine`, `production-bastion-machine`
3. Download and save the `.pem` files securely

### Step 3: Create AWS Secrets Manager Secrets

Create secrets for each environment containing all required application secrets:

```bash
# Create secret for dev environment
aws secretsmanager create-secret \
  --name emery-app-secrets/dev \
  --description "Application secrets for Emery dev environment" \
  --secret-string '{
    "NEXTAUTH_SECRET": "your-nextauth-secret-dev",
    "GITHUB_CLIENT_ID": "your-github-client-id",
    "GITHUB_CLIENT_SECRET": "your-github-client-secret",
    "PIPEDREAM_PROJECT_ID": "your-pipedream-project-id",
    "PIPEDREAM_CLIENT_ID": "your-pipedream-client-id",
    "PIPEDREAM_CLIENT_SECRET": "your-pipedream-client-secret",
    "PIPEDREAM_API_KEY": "your-pipedream-api-key",
    "OPENAI_API_KEY": "your-openai-api-key",
    "HF_TOKEN": "your-huggingface-token",
    "RESEND_API_KEY": "your-resend-api-key"
  }'

# Repeat for staging and production
aws secretsmanager create-secret \
  --name emery-app-secrets/staging \
  --description "Application secrets for Emery staging environment" \
  --secret-string '{...}'

aws secretsmanager create-secret \
  --name emery-app-secrets/production \
  --description "Application secrets for Emery production environment" \
  --secret-string '{...}'
```

**Required Secrets:**
- `NEXTAUTH_SECRET`: Random string for NextAuth.js (generate with `openssl rand -base64 32`)
- `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET`: GitHub OAuth app credentials
- `PIPEDREAM_PROJECT_ID` / `PIPEDREAM_CLIENT_ID` / `PIPEDREAM_CLIENT_SECRET` / `PIPEDREAM_API_KEY`: Pipedream integration
- `OPENAI_API_KEY`: OpenAI API key
- `HF_TOKEN`: HuggingFace API token
- `RESEND_API_KEY`: Resend email service API key

### Step 4: Create ECR Repositories

ECR repositories are automatically created by the GitHub Actions workflow, but you can create them manually:

```bash
aws ecr create-repository --repository-name emery/frontend --image-scanning-configuration scanOnPush=true
aws ecr create-repository --repository-name emery/agent --image-scanning-configuration scanOnPush=true
```

## Environment Setup

This project supports three environments with complete AWS account isolation:

| Environment | Trigger | AWS Account | Stack Name | Purpose |
|------------|---------|-------------|------------|---------|
| Development | Push to `develop` | 463735866328 | `Emery-Infra-Dev` | Development testing |
| Staging | Push to `main` | 772302459598 | `Emery-Infra-Staging` | Pre-production validation |
| Production | Tag `v*.*.*` on `main` | 034165313651 | `Emery-Infra-Production` | Live production |

**Branch Protection:**
- `develop`: Requires 1 PR approval + status checks
- `main`: Requires 2 PR approvals + status checks + restricted push access
- **Production tags** (`v*.*.*`): Only maintainers can create

## Local Development

### Setup Python Environment

```bash
cd infra

# Create virtual environment
python3 -m venv .venv

# Activate virtual environment
source .venv/bin/activate  # macOS/Linux
# or
.venv\Scripts\activate.bat  # Windows

# Install dependencies
pip install -r requirements.txt
```

### Synthesize CloudFormation Template

```bash
# Synthesize for dev environment
cdk synth -c env=dev -c aws_account_id=463735866328 -c region=ap-southeast-2

# Synthesize for staging
cdk synth -c env=staging -c aws_account_id=463735866328 -c region=ap-southeast-2

# Synthesize for production
cdk synth -c env=production -c aws_account_id=463735866328 -c region=ap-southeast-2
```

### Deploy Manually

```bash
# Deploy to dev (requires Docker images in ECR)
export FRONTEND_IMAGE_URI=463735866328.dkr.ecr.ap-southeast-2.amazonaws.com/emery/frontend:develop
export AGENT_IMAGE_URI=463735866328.dkr.ecr.ap-southeast-2.amazonaws.com/emery/agent:develop

cdk deploy --require-approval never --all \
  -c env=dev \
  -c aws_account_id=463735866328 \
  -c region=ap-southeast-2
```

## CI/CD Deployment

Deployments are fully automated via GitHub Actions with environment-based isolation.

### Workflow Triggers

- **CI Quality Checks** (`.github/workflows/ci.yml`): Runs on push to `develop` and PRs to `develop`/`main`
  - Linting
  - Type checking

- **Build & Deploy** (`.github/workflows/docker-build-test.yml`): Runs on:
  - Push to `develop` → Auto-deploy to dev
  - Push to `main` → Auto-deploy to staging
  - Push tag `v*.*.*` → Deploy to production (requires approval)
  - PRs to `develop`/`main` → Build and test only

### Deployment Flow

**1. Feature Development:**
```
feature/my-feature
  └─ PR to develop (requires 1 approval)
    └─ Merge → Auto-deploy to DEV
```

**2. Staging Release:**
```
develop
  └─ PR to main (requires 2 approvals)
    └─ Merge → Auto-deploy to STAGING
```

**3. Production Release:**
```
main (when stable in staging)
  └─ Create tag v1.2.3
    └─ Push tag → Auto-deploy to PRODUCTION (requires approval)
```

### Branch → Environment Mapping

```
develop      → dev environment (account: 463735866328)
main         → staging environment (account: 772302459598)
v*.*.*       → production environment (account: 034165313651)
```

### Creating a Production Release

After validating changes in staging:

```bash
# Ensure main is stable and ready
git checkout main
git pull origin main

# Create annotated tag with semantic version
git tag -a v1.2.3 -m "Release v1.2.3: Description of changes"

# Push tag to trigger production deployment
git push origin v1.2.3

# Monitor deployment in GitHub Actions
# Deployment requires approval from designated reviewer
```

**Semantic Versioning:**
- `v1.0.0` → Major release (breaking changes)
- `v1.1.0` → Minor release (new features, backward compatible)
- `v1.0.1` → Patch release (bug fixes)

## Production Deployment Process

### Pre-Release Checklist
- [ ] All features tested in staging environment
- [ ] Database migrations tested and verified
- [ ] Performance testing completed
- [ ] Security review completed (if applicable)
- [ ] Rollback plan documented

### Release Steps

1. **Prepare Release Notes**
   - Document all changes since last release
   - Note any breaking changes or migration requirements
   - Include rollback instructions if needed

2. **Create Release Tag**
   ```bash
   git checkout main
   git pull origin main
   git tag -a v1.2.3 -m "Release v1.2.3

   Features:
   - Feature 1 description
   - Feature 2 description

   Bug Fixes:
   - Fix 1 description

   Breaking Changes:
   - None"

   git push origin v1.2.3
   ```

3. **Monitor Deployment**
   - Watch GitHub Actions workflow progress
   - Approve deployment when prompted
   - Monitor CloudWatch logs for errors
   - Verify health checks passing

4. **Post-Deployment Validation**
   - Test critical user flows
   - Verify database migrations applied
   - Check service health endpoints
   - Monitor error rates in CloudWatch

### Rollback Procedure

If issues are discovered post-deployment:

**Option 1: Rollback via Previous Tag** (fastest)
```bash
# Identify last stable version
git tag -l

# Create new tag pointing to previous stable release
git checkout v1.2.2
git tag -a v1.2.4 -m "Rollback to v1.2.2 due to issue in v1.2.3"
git push origin v1.2.4
```

**Option 2: Hotfix Release** (for critical bugs)
```bash
# Create hotfix branch from last stable tag
git checkout v1.2.2
git checkout -b hotfix/critical-bug

# Apply fix
git commit -m "fix: critical bug causing X"

# Merge to main
git checkout main
git merge hotfix/critical-bug

# Create patch release
git tag -a v1.2.4 -m "Hotfix: critical bug"
git push origin v1.2.4
```

## Deprecated Staging Branch

The `staging` branch is **deprecated** and will be removed. Do not create new PRs targeting this branch.

**Old Flow** (deprecated):
```
develop → staging → main
```

**New Flow** (current):
```
develop → main (staging env) → v*.*.* tag (production env)
```

**Migration:** All work should target `develop` for development changes, which gets promoted to `main` for staging validation.

**Cleanup:** The staging branch can be manually deleted once all teams have migrated to the new flow:
```bash
# After confirming no active work on staging branch
git push origin --delete staging
git branch -d staging
```

## Migration and Seeding Strategy

**Important**: Database migrations and seeding are handled **exclusively by the frontend service** to prevent race conditions.

### Migrations

- Frontend service has an init container that runs migrations before the main container starts
- Scheduler service does NOT run migrations (removed to prevent conflicts)
- Only **uuid-ossp** extension is created (pgvector removed - not needed for current architecture)
- Migration logs available at: `/aws/ecs/{Prefix}-Migration-Init`

### Database Seeding

**Automatic Seeding**: Fresh databases are automatically seeded with essential data.

Seeding is **idempotent** and runs automatically when `RUN_SEEDS=true` (enabled by default in CDK):

**Seed Order:**
1. **RBAC** - Permissions and system roles (Owner, Admin, Team Lead, Member, Viewer, System Service)
2. **System Users** - System scheduler user for automated tasks
3. **System Role Assignments** - Assigns system user to System Service role
4. **App Types** - Integration apps (Slack, GitHub, Gmail, Shopify, etc.)
5. **Tools** - Available tools from Pipedream and built-in Emery tools

**Seed Characteristics:**
- **Idempotent**: Can run multiple times without duplicates using `.onConflictDoNothing()` or upsert patterns
- **Run once per database**: Seeds only need to run on fresh deployments, not every deployment
- **Automatic**: Triggered by migration init container with `RUN_SEEDS=true`

**Disable Seeding** (if needed for special cases):
```bash
# In CDK stack - set RUN_SEEDS to "false" in migration init container environment
```

**Verify Seeding:**
```sql
-- Check permissions and roles
SELECT COUNT(*) FROM permissions;
SELECT COUNT(*) FROM roles WHERE is_system = true;

-- Check app types and tools
SELECT COUNT(*) FROM app_types;
SELECT COUNT(*) FROM tools;
```

### Architecture Notes

**pgvector Extension Removed:**
- RAG (Retrieval-Augmented Generation) uses **Parquet/Delta Lake storage**, not PostgreSQL
- Vector embeddings stored in Python-managed data lake, not database
- Only **uuid-ossp** extension needed for UUID generation

## Connecting to Database

### Via Bastion Host

1. Get bastion host IP and database endpoint from CDK outputs:
```bash
aws cloudformation describe-stacks \
  --stack-name Emery-Infra-Dev \
  --query 'Stacks[0].Outputs'
```

2. Create SSH tunnel:
```bash
ssh -i ~/.ssh/dev-bastion-machine.pem \
  -L 5432:your-db-endpoint.rds.amazonaws.com:5432 \
  ec2-user@bastion-ip \
  -N
```

3. Connect to database via localhost:
```bash
psql -h localhost -p 5432 -U db_master_user_dev -d emery_dev
```

### Get Database Password

```bash
# Get the secret ARN from CDK outputs
DB_SECRET_ARN=$(aws cloudformation describe-stacks \
  --stack-name Emery-Infra-Dev \
  --query 'Stacks[0].Outputs[?OutputKey==`DatabaseSecretArn`].OutputValue' \
  --output text)

# Retrieve password
aws secretsmanager get-secret-value \
  --secret-id $DB_SECRET_ARN \
  --query 'SecretString' \
  --output text | jq -r '.password'
```

## Useful CDK Commands

```bash
# List all stacks
cdk ls

# Show differences between deployed and local
cdk diff -c env=dev -c aws_account_id=463735866328 -c region=ap-southeast-2

# Deploy specific environment
cdk deploy Emery-Infra-Dev --require-approval never

# Destroy environment (⚠️ CAUTION)
cdk destroy Emery-Infra-Dev
```

## Cost Optimization

### Development Environment
- Single NAT Gateway (not multi-AZ)
- t4g.micro RDS instance
- Multi-AZ disabled for RDS
- Auto-scaling disabled for dev
- Consider stopping non-essential services overnight

### Production Environment
- Consider enabling Multi-AZ for RDS
- Increase RDS instance size as needed
- Enable auto-scaling for ECS services
- Use Reserved Instances for predictable workloads

## Troubleshooting

### Deployment Failures

**Issue**: CDK deployment fails with "Secret not found"
**Solution**: Ensure secrets exist in AWS Secrets Manager for the target environment

**Issue**: Key pair not found
**Solution**: Create EC2 key pairs as described in Step 2

**Issue**: Docker image not found in ECR
**Solution**: Ensure GitHub Actions workflow has run successfully and pushed images

### Service Health Issues

**Issue**: ECS tasks failing to start
**Solution**: Check CloudWatch Logs at `/aws/ecs/{Service-Name}`

**Issue**: Frontend can't connect to database
**Solution**: Verify security group rules allow traffic from frontend to RDS

**Issue**: Agent gRPC service unhealthy
**Solution**: Check that health check grace period (300s) has elapsed for model loading

## Architecture Decisions

### Why Single Migration Source?
Running migrations from multiple services simultaneously can cause race conditions, table locks, and unpredictable behavior. Frontend service exclusively handles migrations.

### Why Idempotent Seeds?
Idempotent seeds allow safe re-deployment and recovery scenarios. Using `.onConflictDoNothing()` and upsert patterns ensures seeds can run multiple times without duplicates, making deployments predictable and safe.

### Why No pgvector?
RAG (Retrieval-Augmented Generation) architecture uses Parquet/Delta Lake storage managed by Python agents, not PostgreSQL. Vector embeddings are stored in the data lake for better scalability and performance with large embedding datasets.

### Why CloudFront?
Provides a static URL that doesn't change when ALB is recreated, improving reliability for external integrations.

### Why Bastion Host?
RDS is in private subnets for security. Bastion provides secure SSH tunnel access for database management.

## Support

For issues or questions:
1. Check CloudWatch Logs for service errors
2. Review CDK diff output before deploying
3. Consult AWS CDK documentation: https://docs.aws.amazon.com/cdk/
