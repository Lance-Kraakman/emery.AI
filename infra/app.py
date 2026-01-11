#!/usr/bin/env python3
import os

import aws_cdk as cdk

from infra.data_stack import DataStack
from infra.app_stack import AppStack
from infra.waf_stack import WAFStack


app = cdk.App()

# Get the environment name from the CDK context.
# This is passed in from the command line with `-c env=...`
env_name = app.node.try_get_context("env")

if not env_name:
    # Default to 'dev' for local use if no context is provided
    print("No 'env' context variable passed, using default 'dev' for local synthesis.")
    env_name = "dev"

# Get the single AWS account and region from the context
aws_account = app.node.try_get_context("aws_account_id")
aws_region = app.node.try_get_context("region")

if not aws_account or not aws_region:
    raise ValueError("Could not find 'aws_account_id' or 'region' in cdk.json context.")

# Define the CDK Environment object. All deployments will go to this account.
cdk_env = cdk.Environment(account=aws_account, region=aws_region)

# Create stack names based on the environment
data_stack_name = f"Emery-Data-{env_name.capitalize()}"
app_stack_name = f"Emery-App-{env_name.capitalize()}"

# Create the data stack first (VPC, database, S3, secrets)
data_stack = DataStack(
    app,
    data_stack_name,
    env_name=env_name,
    env=cdk_env
)

# Create WAF stack in us-east-1 (required for CloudFront)
waf_stack_name = f"Emery-WAF-{env_name.capitalize()}"
waf_env = cdk.Environment(account=aws_account, region="us-east-1")

waf_stack = WAFStack(
    app,
    waf_stack_name,
    env_name=env_name,
    env=waf_env,
    # Note: cross_region_references disabled due to Lambda permission issues
    # WAF ARN is passed via context from workflow instead
)

# Get WAF ARN from context (passed from workflow after WAF stack deploys)
# Falls back to None if not provided (for WAF-only deploys)
waf_acl_arn = app.node.try_get_context("waf_acl_arn")

# Create the app stack with reference to data stack (ECS services, load balancers, CloudFront)
app_stack = AppStack(
    app,
    app_stack_name,
    data_stack=data_stack,
    env_name=env_name,
    waf_acl_arn=waf_acl_arn,
    env=cdk_env,
)
app_stack.add_dependency(data_stack)

app.synth()
