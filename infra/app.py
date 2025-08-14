#!/usr/bin/env python3
import os

import aws_cdk as cdk

from infra.infra_stack import InfraStack


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

# Create a unique stack name based on the environment
stack_name = f"Emery-Infra-{env_name.capitalize()}"

# Pass the environment name to the stack for resource prefixing
InfraStack(app, stack_name, env_name=env_name, env=cdk_env)

app.synth()
