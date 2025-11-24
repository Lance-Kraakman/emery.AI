# Deployment Pipeline Setup Guide

This guide provides step-by-step instructions for configuring the GitHub repository settings to support the new deployment pipeline.

## Overview

The deployment pipeline uses:
- **develop** → DEV environment (AWS account: 463735866328)
- **main** → STAGING environment (AWS account: 772302459598)
- **v\*.\*.\*** tags → PRODUCTION environment (AWS account: 034165313651)

## Prerequisites

Before starting, you need:
1. Staging AWS account (772302459598) - IAM credentials configured in `aws --profile staging`
2. Production AWS account (034165313651) - IAM credentials configured in `aws --profile production`
3. Admin access to the GitHub repository

---

## Step 1: Configure GitHub Environments

GitHub Environments provide deployment protection rules and environment-specific secrets.

### Navigate to Environments

1. Go to your GitHub repository
2. Click **Settings** → **Environments**

### Create Environment: `dev`

1. Click **New environment**
2. Name: `dev`
3. Click **Configure environment**
4. **Protection rules**: Leave unchecked (no restrictions for dev)
5. **Environment secrets**: Add the following secrets

   | Secret Name | Value |
   |------------|-------|
   | `AWS_ACCOUNT_ID` | `463735866328` |
   | `AWS_ACCESS_KEY_ID` | Your dev AWS access key |
   | `AWS_SECRET_ACCESS_KEY` | Your dev AWS secret key |
   | `AWS_ROLE_TO_ASSUME` | (Optional) Leave empty if not using OIDC |

6. Click **Save protection rules**

### Create Environment: `staging`

1. Click **New environment**
2. Name: `staging`
3. Click **Configure environment**
4. **Protection rules**:
   - ☑ **Required reviewers**: Add 1 reviewer
   - ☑ **Deployment branches**: Select "Selected branches"
     - Add rule: `main`
5. **Environment secrets**: Add the following secrets

   | Secret Name | Value |
   |------------|-------|
   | `AWS_ACCOUNT_ID` | `772302459598` |
   | `AWS_ACCESS_KEY_ID` | Your staging AWS access key |
   | `AWS_SECRET_ACCESS_KEY` | Your staging AWS secret key |
   | `AWS_ROLE_TO_ASSUME` | (Optional) Leave empty if not using OIDC |

6. Click **Save protection rules**

### Create Environment: `production`

1. Click **New environment**
2. Name: `production`
3. Click **Configure environment**
4. **Protection rules**:
   - ☑ **Required reviewers**: Add 1-2 reviewers (senior team members)
   - ☑ **Deployment branches**: Select "Selected branches"
     - Add rule: `main`
   - ☑ **Wait timer**: (Optional) Set to 5 minutes for a cooling period
5. **Environment secrets**: Add the following secrets

   | Secret Name | Value |
   |------------|-------|
   | `AWS_ACCOUNT_ID` | `034165313651` |
   | `AWS_ACCESS_KEY_ID` | Your production AWS access key |
   | `AWS_SECRET_ACCESS_KEY` | Your production AWS secret key |
   | `AWS_ROLE_TO_ASSUME` | (Optional) Leave empty if not using OIDC |

6. Click **Save protection rules**

---

## Step 2: Configure Branch Protection Rules

Branch protection prevents accidental direct pushes and enforces code review.

### Navigate to Branch Protection

1. Go to your GitHub repository
2. Click **Settings** → **Branches**
3. Scroll to **Branch protection rules**

### Create Protection Rule for `develop`

1. Click **Add rule**
2. **Branch name pattern**: `develop`
3. Configure the following settings:

   **Protect matching branches:**
   - ☑ Require a pull request before merging
     - Required approvals: **1**
     - ☑ Dismiss stale pull request approvals when new commits are pushed
   - ☑ Require status checks to pass before merging
     - ☑ Require branches to be up to date before merging
     - **Required status checks**: Search and add:
       - `quality` (from CI workflow)
   - ☑ Require conversation resolution before merging
   - ☑ Include administrators (recommended)

4. Click **Create** or **Save changes**

### Create Protection Rule for `main`

1. Click **Add rule**
2. **Branch name pattern**: `main`
3. Configure the following settings:

   **Protect matching branches:**
   - ☑ Require a pull request before merging
     - Required approvals: **2**
     - ☑ Dismiss stale pull request approvals when new commits are pushed
     - ☑ Require review from Code Owners (if you have a CODEOWNERS file)
   - ☑ Require status checks to pass before merging
     - ☑ Require branches to be up to date before merging
     - **Required status checks**: Search and add:
       - `quality` (from CI workflow)
       - `build-frontend` (from Build & Deploy workflow)
       - `build-agent` (from Build & Deploy workflow)
   - ☑ Require conversation resolution before merging
   - ☑ Restrict who can push to matching branches
     - Add: Repository administrators and maintainers
   - ☑ Include administrators (recommended)

4. Click **Create** or **Save changes**

---

## Step 3: Configure Tag Protection Rules

Tag protection prevents unauthorized creation of production release tags.

### Navigate to Tag Protection

1. Go to your GitHub repository
2. Click **Settings** → **Tags**
3. Click **Rulesets** → **New ruleset**

### Create Ruleset: Production Release Tags

1. **Ruleset Name**: `Production Release Tags`
2. **Enforcement status**: Active
3. **Bypass list**: (Optional) Add repository admins if they need to bypass
4. **Target tags**:
   - Tag naming pattern: `v*.*.*`
   - Examples: `v1.0.0`, `v2.3.1`, `v0.1.0-beta`

5. **Rules**:
   - ☑ **Restrict creations**
     - Only the following actors can create matching refs:
       - Repository administrators
       - Maintain role
   - ☑ **Restrict updates**
     - Prevent tag updates (tags should be immutable)
   - ☑ **Restrict deletions**
     - Prevent accidental tag deletion

6. Click **Create** or **Save**

---

## Step 4: AWS Account Setup

For staging and production AWS accounts, you need to set up the infrastructure.

### Bootstrap CDK (Required for each new AWS account)

```bash
# Configure AWS CLI profile for staging
aws configure --profile staging
# Enter staging AWS credentials when prompted

# Bootstrap CDK in staging account
cdk bootstrap aws://772302459598/ap-southeast-2 --profile staging

# Repeat for production
aws configure --profile production
cdk bootstrap aws://034165313651/ap-southeast-2 --profile production
```

### Create EC2 Key Pairs (for bastion hosts)

```bash
# Staging bastion key pair
aws ec2 create-key-pair \
  --key-name staging-bastion-machine \
  --query 'KeyMaterial' \
  --output text \
  --profile staging \
  > ~/.ssh/staging-bastion-machine.pem
chmod 400 ~/.ssh/staging-bastion-machine.pem

# Production bastion key pair
aws ec2 create-key-pair \
  --key-name production-bastion-machine \
  --query 'KeyMaterial' \
  --output text \
  --profile production \
  > ~/.ssh/production-bastion-machine.pem
chmod 400 ~/.ssh/production-bastion-machine.pem
```

### Create Secrets Manager Secrets

Create application secrets in each AWS account:

**Staging:**
```bash
aws secretsmanager create-secret \
  --name emery-app-secrets/staging \
  --description "Application secrets for Emery staging environment" \
  --secret-string file://staging-secrets.json \
  --region ap-southeast-2 \
  --profile staging
```

**Production:**
```bash
aws secretsmanager create-secret \
  --name emery-app-secrets/production \
  --description "Application secrets for Emery production environment" \
  --secret-string file://production-secrets.json \
  --region ap-southeast-2 \
  --profile production
```

**Secret JSON format:**
```json
{
  "NEXTAUTH_SECRET": "your-nextauth-secret",
  "GITHUB_CLIENT_ID": "your-github-client-id",
  "GITHUB_CLIENT_SECRET": "your-github-client-secret",
  "PIPEDREAM_PROJECT_ID": "your-pipedream-project-id",
  "PIPEDREAM_CLIENT_ID": "your-pipedream-client-id",
  "PIPEDREAM_CLIENT_SECRET": "your-pipedream-client-secret",
  "PIPEDREAM_API_KEY": "your-pipedream-api-key",
  "OPENAI_API_KEY": "your-openai-api-key",
  "HF_TOKEN": "your-huggingface-token",
  "RESEND_API_KEY": "your-resend-api-key",
  "AWS_ACCESS_KEY_ID": "your-s3-access-key",
  "AWS_SECRET_ACCESS_KEY": "your-s3-secret-key"
}
```

---

## Step 5: Test the Pipeline

### Test 1: Dev Deployment

1. Create a test feature branch:
   ```bash
   git checkout develop
   git checkout -b test/pipeline-validation
   echo "# Pipeline Test" >> PIPELINE_TEST.md
   git add PIPELINE_TEST.md
   git commit -m "test: validate dev deployment"
   git push origin test/pipeline-validation
   ```

2. Create PR to `develop` in GitHub UI
3. Verify CI checks pass
4. Merge PR
5. Verify deployment to dev environment in GitHub Actions

### Test 2: Staging Deployment

1. Create PR from `develop` to `main`
2. Verify it requires 2 approvals
3. Get approvals and merge
4. Verify deployment to staging AWS account
5. Check CloudWatch logs, ECS services, RDS in staging account

### Test 3: Production Deployment

1. Ensure `main` branch is stable in staging
2. Create production release tag:
   ```bash
   git checkout main
   git pull origin main
   git tag -a v0.1.0 -m "Initial production release"
   git push origin v0.1.0
   ```

3. Verify workflow triggers in GitHub Actions
4. Approve production deployment when prompted
5. Verify deployment to production AWS account
6. Validate all services in production

---

## Step 6: Clean Up Deprecated Staging Branch

After the new pipeline is validated and all teams have migrated:

```bash
# Delete remote staging branch
git push origin --delete staging

# Delete local staging branch
git branch -d staging
```

---

## Validation Checklist

After setup, verify:

- [ ] GitHub environments created (dev, staging, production)
- [ ] Environment secrets configured for all three environments
- [ ] Branch protection rules active for `develop` and `main`
- [ ] Tag protection ruleset active for `v*.*.*`
- [ ] CDK bootstrapped in staging and production AWS accounts
- [ ] EC2 key pairs created for bastion hosts
- [ ] Secrets Manager secrets created in all AWS accounts
- [ ] ECR repositories created (automatically via workflow or manually)
- [ ] Test deployment to dev successful
- [ ] Test deployment to staging successful
- [ ] Test deployment to production successful

---

## Troubleshooting

### Environment secrets not available

**Issue**: Workflow fails with "Secret not found"

**Solution**: Verify environment name matches exactly (`dev`, `staging`, `production`) and secrets are added to the correct environment, not repository secrets.

### Branch protection preventing merge

**Issue**: Cannot merge PR even with approvals

**Solution**: Ensure all required status checks have passed. Check which checks are required in branch protection settings.

### Tag protection preventing tag creation

**Issue**: Cannot create release tag

**Solution**: Verify you have the required role (repository admin or maintain role). Check tag protection ruleset settings.

### Deployment to wrong AWS account

**Issue**: Deployment targeting wrong environment

**Solution**: Verify GitHub environment secrets are correct. Check workflow logs for which account ID is being used.

---

## Security Best Practices

1. **Use OIDC instead of long-lived credentials** (recommended)
   - Configure AWS OIDC provider
   - Use `AWS_ROLE_TO_ASSUME` instead of access keys
   - Reduces risk of credential leakage

2. **Rotate AWS credentials regularly**
   - Update environment secrets with new credentials
   - Delete old IAM access keys

3. **Limit AWS IAM permissions**
   - Use least-privilege access
   - Create dedicated deployment IAM users/roles
   - Restrict to specific ECR repos, ECS clusters, etc.

4. **Enable audit logging**
   - Monitor GitHub Actions logs
   - Enable AWS CloudTrail
   - Set up alerts for unusual activity

5. **Review required approvers regularly**
   - Ensure production approvers are current team members
   - Remove access for former team members

---

## Support

For issues or questions:
1. Check GitHub Actions workflow logs
2. Verify AWS account credentials and permissions
3. Review branch/tag protection rules in repository settings
4. Consult AWS CDK documentation: https://docs.aws.amazon.com/cdk/
5. Review GitHub Environments documentation: https://docs.github.com/en/actions/deployment/targeting-different-environments
