#!/usr/bin/env python3
import os

import aws_cdk as cdk

from infra.infra_stack import InfraStack


app = cdk.App()

# Get the environment name from the CDK context.
# This is passed in from the command line with `-c env=...`
env_name = app.node.try_get_context("env")

if not env_name:
    # If no environment is specified, we can default to 'dev' for local development
    # or raise an error if we want to be strict in CI/CD.
    # For this workflow, we'll rely on the CI to always pass the context.
    # You can uncomment the line below to raise an error.
    # raise ValueError("Environment context variable 'env' is required. e.g., cdk deploy -c env=development")
    print("No 'env' context variable passed, using default 'dev' for local synthesis.")
    env_name = "development"


# Map the logical environment name to the correct AWS account ID from the context
account_map = {
    "development": app.node.try_get_context("dev_account"),
    "staging": app.node.try_get_context("staging_account"),
    "production": app.node.try_get_context("prod_account"),
}

aws_account = account_map.get(env_name)
aws_region = app.node.try_get_context("region")

if not aws_account or not aws_region:
    raise ValueError(f"Could not find account or region in cdk.json context for environment '{env_name}'")


# Define the CDK Environment object
cdk_env = cdk.Environment(account=aws_account, region=aws_region)

# Create a unique stack name based on the environment
stack_name = f"Emery-Infra-{env_name.capitalize()}"

InfraStack(app, stack_name, env=cdk_env)

app.synth()
