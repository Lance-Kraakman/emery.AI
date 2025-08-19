# Database Access Setup Guide

This guide explains how to connect to your RDS PostgreSQL database through a secure SSH tunnel using DBeaver.

## Architecture Overview

- **RDS Database**: PostgreSQL 16 in private subnets (secure)
- **Bastion Host**: EC2 instance in public subnet with PostgreSQL 14 client
- **SSH Tunnel**: DBeaver connects through bastion to reach database
- **Authentication**: SSH key for bastion, database credentials from AWS Secrets Manager

## Prerequisites

1. **SSH Key Pair**: `dev-bastion-machine.pem` file on your local machine
2. **DBeaver**: Database client installed locally
3. **AWS CLI**: For retrieving database credentials

## Step 1: Get Connection Details

Get the connection details from your CloudFormation stack outputs:

```bash
# Get bastion host IP
aws cloudformation describe-stacks --stack-name DevInfraStack \
  --query 'Stacks[0].Outputs[?OutputKey==`DevBastionHostIP`].OutputValue' \
  --output text

# Get database endpoint  
aws cloudformation describe-stacks --stack-name DevInfraStack \
  --query 'Stacks[0].Outputs[?OutputKey==`DevDatabaseEndpoint`].OutputValue' \
  --output text
```

## Step 2: Test SSH Connection to Bastion

```bash
# Test SSH connection to bastion host
ssh -i /path/to/dev-bastion-machine.pem ec2-user@<bastion-public-ip>

# Verify PostgreSQL 14 is installed (should show version 14.x)
psql --version

# Test database connectivity from bastion
psql -h <database-endpoint> -U db_master_user_dev -d emery_dev
```

## Step 3: Get Database Password

From your local machine or bastion host:

```bash
# Get database password from AWS Secrets Manager
aws secretsmanager get-secret-value \
  --secret-id <secret-name-from-stack> \
  --query SecretString --output text
```

The secret name format is usually: `emery-infra-dev-devpostgresdbXXXXXXXX-XXXXXXXXXX`

## Step 4: Configure DBeaver Connection

### Create New Connection
1. Open DBeaver
2. Click **Database** → **New Database Connection**
3. Select **PostgreSQL** (NOT DB2 or any other driver)
4. Click **Next**

### Main Tab Settings
- **Server Host**: `<database-endpoint>` (e.g., `emery-infra-dev-devpostgresdbdd6b3dce-4bnzmljfa5j6.cbm48y04ajgi.ap-southeast-2.rds.amazonaws.com`)
- **Port**: `5432`
- **Database**: `emery_dev`
- **Username**: `db_master_user_dev`  
- **Password**: `<password-from-secrets-manager>`

### SSH Tab Settings
- ✅ **Use SSH tunnel**
- **Host**: `<bastion-public-ip>`
- **Port**: `22`
- **User name**: `ec2-user`
- **Authentication method**: **Public Key**
- **Private key**: `/path/to/dev-bastion-machine.pem`
- **Keep-alive interval**: `30` seconds

### Driver Properties Tab (Optional)
If you encounter SSL issues, add:
- Property: `sslmode`
- Value: `disable`

## Step 5: Test Connection

1. **Test SSH Tunnel**: Click **Test tunnel** in SSH tab (should succeed)
2. **Test Database Connection**: Click **Test Connection** (should succeed)
3. **Save Connection**: Click **Finish** to save the connection

## Step 6: Verify Database Access

Once connected, you can explore the database:

```sql
-- List all tables
\dt

-- List all schemas  
\dn

-- Show tables in all schemas
\dt *.*

-- Check if migrations ran (should show your application tables)
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public';
```

## Troubleshooting

### SSH Connection Issues
- Verify SSH key permissions: `chmod 400 dev-bastion-machine.pem`
- Check security group allows SSH from your IP
- Verify bastion host is running

### Database Connection Issues
- Verify database endpoint is correct
- Check password from Secrets Manager
- Ensure using PostgreSQL driver (not DB2)
- Try disabling SSL in driver properties

### PostgreSQL Version Issues  
The bastion host should automatically have PostgreSQL 14 installed via CDK user data. If manual installation is needed:

```bash
# SSH to bastion host
ssh -i dev-bastion-machine.pem ec2-user@<bastion-ip>

# Enable PostgreSQL 14 (required first step)
sudo amazon-linux-extras enable postgresql14
sudo yum clean metadata

# Install PostgreSQL 14 client
sudo yum install -y postgresql

# Verify installation
psql --version  # Should show PostgreSQL 14.x
```

### Migration Issues
If no tables exist in the database, the migration task may have failed. Check ECS task logs:

```bash
# List ECS tasks
aws ecs list-tasks --cluster DevEmeryCluster

# Get task logs
aws logs filter-log-events --log-group-name /ecs/DevMigration
```

## Security Notes

- Database is in private subnets (not accessible from internet)
- Bastion host provides secure tunnel access only
- SSH key authentication required for bastion access
- Database credentials stored in AWS Secrets Manager
- All traffic encrypted in transit

## Connection Summary

```
Your Computer → SSH Tunnel → Bastion Host → Database
               (port 22)    (PostgreSQL 14) (port 5432)
```

This setup provides secure, encrypted access to your private RDS database while maintaining production security best practices.