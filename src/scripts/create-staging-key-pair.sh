#!/bin/bash

# Create staging SSH key pair in AWS EC2
# This script creates environment-specific key pairs for bastion hosts

set -e

ENV_NAME=${1:-staging}
AWS_REGION=${2:-ap-southeast-2}

echo "🔑 Creating SSH key pair for ${ENV_NAME} environment..."

# Check if AWS CLI is configured
if ! aws sts get-caller-identity > /dev/null 2>&1; then
    echo "❌ AWS CLI not configured. Please run 'aws configure' first."
    exit 1
fi

# Check if key pair already exists
if aws ec2 describe-key-pairs --key-names "${ENV_NAME}-bastion-machine" --region ${AWS_REGION} > /dev/null 2>&1; then
    echo "⚠️  Key pair '${ENV_NAME}-bastion-machine' already exists in region ${AWS_REGION}"
    echo "✅ You can use the existing key pair for staging deployment"
else
    # Create new key pair
    echo "📝 Creating new key pair: ${ENV_NAME}-bastion-machine"
    
    aws ec2 create-key-pair \
        --key-name "${ENV_NAME}-bastion-machine" \
        --key-type rsa \
        --key-format pem \
        --region ${AWS_REGION} \
        --query 'KeyMaterial' \
        --output text > "${ENV_NAME}-bastion-machine.pem"
    
    # Set proper permissions
    chmod 400 "${ENV_NAME}-bastion-machine.pem"
    
    echo "✅ Created key pair: ${ENV_NAME}-bastion-machine"
    echo "📁 Private key saved to: ${ENV_NAME}-bastion-machine.pem"
    echo ""
    echo "🔒 Keep this private key file safe! You'll need it to SSH to the bastion host."
    echo ""
    echo "📋 To connect to the bastion host after deployment:"
    echo "   ssh -i ${ENV_NAME}-bastion-machine.pem ec2-user@<bastion-public-ip>"
fi

echo ""
echo "🎯 SSH key setup complete for ${ENV_NAME} environment!"