from aws_cdk import (
    Stack,
    RemovalPolicy,
    aws_ec2 as ec2,
    aws_ecs as ecs,
    aws_ecs_patterns as ecs_patterns,
    aws_logs as logs,
    aws_rds as rds,
    aws_s3 as s3,
    aws_secretsmanager as secretsmanager,
    aws_lambda as lambda_,
    aws_iam as iam,
    custom_resources,
    Aws,
    Duration,
)
from constructs import Construct
import os

class InfraStack(Stack):

    def __init__(self, scope: Construct, construct_id: str, env_name: str, **kwargs) -> None:
        super().__init__(scope, construct_id, **kwargs)

        prefix = env_name.capitalize()

        # Create a new VPC for our application
        # This will create public and private subnets across 2 Availability Zones by default
        vpc = ec2.Vpc(
            self, f"{prefix}EmeryVpc",
            max_azs=2,
            nat_gateways=1,
        )

        # Create an ECS cluster to host our services
        cluster = ecs.Cluster(
            self, f"{prefix}EmeryCluster",
            vpc=vpc,
            cluster_name=f"{prefix}EmeryCluster"
        )

        # Create a PostgreSQL database instance in RDS
        # This will be placed in the private subnets of our VPC
        db_instance = rds.DatabaseInstance(
            self, f"{prefix}PostgresDB",
            engine=rds.DatabaseInstanceEngine.postgres(
                version=rds.PostgresEngineVersion.VER_16_3
            ),
            instance_type=ec2.InstanceType.of(
                ec2.InstanceClass.BURSTABLE4_GRAVITON, ec2.InstanceSize.MICRO
            ),
            vpc=vpc,
            vpc_subnets=ec2.SubnetSelection(
                subnet_type=ec2.SubnetType.PRIVATE_WITH_EGRESS
            ),
            database_name=f"emery_{env_name}",
            # The secret will be automatically created and stored in AWS Secrets Manager
            credentials=rds.Credentials.from_generated_secret(f"db_master_user_{env_name}"),
            multi_az=False, # For cost-effectiveness in dev/staging. Set to True for production.
            allocated_storage=20, # 20 GB
            max_allocated_storage=100,
            allow_major_version_upgrade=False,
            auto_minor_version_upgrade=True,
            delete_automated_backups=True, # For dev/staging. Set to False for production.
        )

        # Create a shared security group for DB clients
        db_client_sg = ec2.SecurityGroup(
            self, f"{prefix}DbClientSg",
            vpc=vpc,
            description="Security group for clients connecting to the RDS database"
        )

        # Allow traffic from the shared SG to the database
        db_instance.connections.allow_default_port_from(db_client_sg)

        # Create a dedicated security group for the migration Lambda
        migration_lambda_sg = ec2.SecurityGroup(
            self, f"{prefix}MigrationLambdaSg",
            vpc=vpc,
            description="Security group for the database migration Lambda"
        )

        # Allow the Lambda to connect to the database
        db_instance.connections.allow_default_port_from(migration_lambda_sg)

        # Lambda function for running migrations
        migration_lambda = lambda_.DockerImageFunction(
            self, f"{prefix}MigrationRunnerLambda",
            code=lambda_.DockerImageCode.from_image_asset(os.path.join(os.path.dirname(__file__), "..", "lambda", "migration-runner")),
            vpc=vpc,
            vpc_subnets=ec2.SubnetSelection(subnet_type=ec2.SubnetType.PRIVATE_WITH_EGRESS),
            security_groups=[migration_lambda_sg],
            environment={
                "DB_SECRET_ARN": db_instance.secret.secret_arn
            },
            timeout=Duration.minutes(5),
            log_group=logs.LogGroup(
                self, f"{prefix}MigrationRunnerLogGroup",
                removal_policy=RemovalPolicy.DESTROY
            )
        )

        # Grant the Lambda function access to the database secret
        db_instance.secret.grant_read(migration_lambda)

        # Custom resource to trigger the migration Lambda
        migration_trigger = custom_resources.AwsCustomResource(
            self, f"{prefix}MigrationTrigger",
            on_create=custom_resources.AwsSdkCall(
                service="Lambda",
                action="invoke",
                parameters={
                    "FunctionName": migration_lambda.function_name,
                    "InvocationType": "RequestResponse",
                },
                physical_resource_id=custom_resources.PhysicalResourceId.of(f"{prefix}MigrationTrigger-{Aws.STACK_ID}")
            ),
            on_update=custom_resources.AwsSdkCall(
                service="Lambda",
                action="invoke",
                parameters={
                    "FunctionName": migration_lambda.function_name,
                    "InvocationType": "RequestResponse",
                },
                physical_resource_id=custom_resources.PhysicalResourceId.of(f"{prefix}MigrationTrigger-{Aws.STACK_ID}")
            ),
            policy=custom_resources.AwsCustomResourcePolicy.from_statements([
                iam.PolicyStatement(
                    actions=["lambda:InvokeFunction"],
                    resources=[migration_lambda.function_arn],
                )
            ]),
        )

        migration_trigger.node.add_dependency(db_instance)
        migration_trigger.node.add_dependency(migration_lambda)

        # Look up the application secrets from AWS Secrets Manager
        app_secrets_object = secretsmanager.Secret.from_secret_name_v2(
            self, "AppSecretsObject",
            secret_name=f"emery-app-secrets/{env_name}"
        )

        # Define the secrets mapping for the ECS task definition
        app_secrets_map = {
            "NEXTAUTH_SECRET": ecs.Secret.from_secrets_manager(app_secrets_object, "NEXTAUTH_SECRET"),
            "GITHUB_CLIENT_ID": ecs.Secret.from_secrets_manager(app_secrets_object, "GITHUB_CLIENT_ID"),
            "GITHUB_CLIENT_SECRET": ecs.Secret.from_secrets_manager(app_secrets_object, "GITHUB_CLIENT_SECRET"),
            "PIPEDREAM_PROJECT_ID": ecs.Secret.from_secrets_manager(app_secrets_object, "PIPEDREAM_PROJECT_ID"),
            "PIPEDREAM_CLIENT_ID": ecs.Secret.from_secrets_manager(app_secrets_object, "PIPEDREAM_CLIENT_ID"),
            "PIPEDREAM_CLIENT_SECRET": ecs.Secret.from_secrets_manager(app_secrets_object, "PIPEDREAM_CLIENT_SECRET"),
            "PIPEDREAM_API_KEY": ecs.Secret.from_secrets_manager(app_secrets_object, "PIPEDREAM_API_KEY"),
            "OPENAI_API_KEY": ecs.Secret.from_secrets_manager(app_secrets_object, "OPENAI_API_KEY"),
            "HF_TOKEN": ecs.Secret.from_secrets_manager(app_secrets_object, "HF_TOKEN"),
            "RESEND_API_KEY": ecs.Secret.from_secrets_manager(app_secrets_object, "RESEND_API_KEY"),
        }

        # Define the Docker image for the frontend and scheduler
        app_image = ecs.ContainerImage.from_asset(
            "../", # Points to the Dockerfile in the root
            exclude=[".venv", "node_modules", "cdk.out", ".git", "infra"]
        )

        # Create the Fargate service for the Next.js frontend
        frontend_service = ecs_patterns.ApplicationLoadBalancedFargateService(
            self, f"{prefix}FrontendService",
            cluster=cluster,
            service_name=f"{prefix}-Frontend",
            cpu=512,
            memory_limit_mib=1024,
            desired_count=1, # Start with one instance
            task_image_options=ecs_patterns.ApplicationLoadBalancedTaskImageOptions(
                image=app_image,
                container_port=3000,
                secrets={
                    "DATABASE_URL": ecs.Secret.from_secrets_manager(db_instance.secret),
                    **app_secrets_map
                }
            ),
            public_load_balancer=True,
            security_groups=[db_client_sg],
        )

        # Configure the health check for the frontend service
        frontend_service.target_group.configure_health_check(
            path="/",
            timeout=Duration.seconds(30),
            healthy_threshold_count=2,
            unhealthy_threshold_count=5,
            interval=Duration.seconds(60),
        )

        # Create a new Task Definition for the scheduler
        scheduler_task_definition = ecs.FargateTaskDefinition(
            self, f"{prefix}SchedulerTaskDef",
            cpu=512,
            memory_limit_mib=1024,
        )

        scheduler_task_definition.add_container(
            f"{prefix}SchedulerContainer",
            image=app_image,
            command=["scheduler"],
            secrets={
                "DATABASE_URL": ecs.Secret.from_secrets_manager(db_instance.secret),
                **app_secrets_map
            },
            logging=ecs.LogDrivers.aws_logs(
                stream_prefix=f"{prefix}-Scheduler",
            )
        )

        # Create the Fargate service for the scheduler
        scheduler_service = ecs.FargateService(
            self, f"{prefix}SchedulerService",
            cluster=cluster,
            service_name=f"{prefix}-Scheduler",
            task_definition=scheduler_task_definition,
            desired_count=1,
            vpc_subnets=ec2.SubnetSelection(
                subnet_type=ec2.SubnetType.PRIVATE_WITH_EGRESS
            ),
            security_groups=[db_client_sg],
        )

        # Add dependencies to ensure services start in the correct order
        frontend_service.service.node.add_dependency(migration_trigger)
        scheduler_service.node.add_dependency(migration_trigger)

        # Create the Fargate service for the Python gRPC backend
        agent_service = ecs_patterns.NetworkLoadBalancedFargateService(
            self, f"{prefix}AgentService",
            cluster=cluster,
            service_name=f"{prefix}-Agent",
            cpu=256,
            memory_limit_mib=512,
            desired_count=1,
            task_image_options=ecs_patterns.NetworkLoadBalancedTaskImageOptions(
                image=ecs.ContainerImage.from_asset("../emery-agents"), # Points to the Dockerfile in emery-agents
                container_port=50051,
                secrets={
                    **app_secrets_map
                }
            ),
            public_load_balancer=True,
            security_groups=[db_client_sg],
        )

        # Add dependency for the agent service
        agent_service.service.node.add_dependency(migration_trigger)

        # Pass the public DNS of the agent service's NLB to the frontend service
        if frontend_service.task_definition.default_container:
            frontend_service.task_definition.default_container.add_environment(
                "GRPC_AGENT_URL",
                f"http://{agent_service.load_balancer.load_balancer_dns_name}"
            )
            # Also inject the frontend's own public URL for NextAuth
            frontend_service.task_definition.default_container.add_environment(
                "NEXTAUTH_URL",
                f"http://{frontend_service.load_balancer.load_balancer_dns_name}"
            )

        # Create an S3 bucket for file storage
        storage_bucket = s3.Bucket(
            self, f"{prefix}StorageBucket",
            bucket_name=f"{prefix.lower()}-emery-storage-{self.account}",
            block_public_access=s3.BlockPublicAccess.BLOCK_ALL,
            encryption=s3.BucketEncryption.S3_MANAGED,
            enforce_ssl=True,
            versioned=True, # Good practice for production
        )

        # Grant both services read/write access to the bucket
        storage_bucket.grant_read_write(frontend_service.task_definition.task_role)
        storage_bucket.grant_read_write(agent_service.task_definition.task_role)

        # Inject the bucket name as an environment variable into both services
        if frontend_service.task_definition.default_container:
            frontend_service.task_definition.default_container.add_environment(
                "S3_BUCKET_NAME",
                storage_bucket.bucket_name
            )
        
        if agent_service.task_definition.default_container:
            agent_service.task_definition.default_container.add_environment(
                "S3_BUCKET_NAME",
                storage_bucket.bucket_name
            )
