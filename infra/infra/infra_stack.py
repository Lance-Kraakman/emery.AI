from aws_cdk import (
    Stack,
    RemovalPolicy,
    aws_ec2 as ec2,
    aws_ecs as ecs,
    aws_ecs_patterns as ecs_patterns,
    aws_elasticloadbalancingv2 as elbv2,
    aws_logs as logs,
    aws_rds as rds,
    aws_s3 as s3,
    aws_secretsmanager as secretsmanager,
    aws_iam as iam,
    aws_cloudfront as cloudfront,
    aws_cloudfront_origins as origins,
    custom_resources,
    Aws,
    Duration,
    CfnOutput,
)
from constructs import Construct
import os

class InfraStack(Stack):

    def _get_agent_image(self) -> ecs.ContainerImage:
        """Get agent container image from ECR or build from source"""
        agent_image_uri = os.environ.get('AGENT_IMAGE_URI')
        if agent_image_uri:
            print(f"Using pre-built agent image from ECR: {agent_image_uri}")
            return ecs.ContainerImage.from_registry(agent_image_uri)
        else:
            print("Building agent image from source")
            return ecs.ContainerImage.from_asset("../emery-agents")

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

        # Create parameter group to allow non-SSL connections and preload extensions
        db_parameter_group = rds.ParameterGroup(
            self, f"{prefix}PostgresParams",
            engine=rds.DatabaseInstanceEngine.postgres(
                version=rds.PostgresEngineVersion.VER_16_3
            ),
            parameters={
                "rds.force_ssl": "0",  # Allow non-SSL connections for development
                "shared_preload_libraries": "vector,uuid-ossp"  # Preload pgvector and uuid-ossp extensions
            }
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
            parameter_group=db_parameter_group,  # Use custom parameter group
            multi_az=False, # For cost-effectiveness in dev/staging. Set to True for production.
            allocated_storage=20, # 20 GB
            max_allocated_storage=100,
            allow_major_version_upgrade=False,
            auto_minor_version_upgrade=True,
            delete_automated_backups=True, # For dev/staging. Set to False for production.
            enable_performance_insights=True, # Enable Performance Insights for database monitoring
            backup_retention=Duration.days(7), # Enable backups for better data management
        )

        # Create a shared security group for DB clients
        db_client_sg = ec2.SecurityGroup(
            self, f"{prefix}DbClientSg",
            vpc=vpc,
            description="Security group for clients connecting to the RDS database"
        )

        # Allow traffic from the shared SG to the database
        db_instance.connections.allow_default_port_from(db_client_sg)

        # Create security group for bastion host
        bastion_sg = ec2.SecurityGroup(
            self, f"{prefix}BastionSecurityGroup",
            vpc=vpc,
            description="Security group for bastion host",
            allow_all_outbound=True
        )
        
        # Allow SSH access from anywhere (for development)
        bastion_sg.add_ingress_rule(
            ec2.Peer.any_ipv4(),
            ec2.Port.tcp(22),
            "Allow SSH access"
        )

        # Create bastion host for secure database access  
        bastion_host = ec2.Instance(
            self, f"{prefix}DatabaseBastion",
            vpc=vpc,
            instance_type=ec2.InstanceType.of(ec2.InstanceClass.T3, ec2.InstanceSize.MICRO),
            machine_image=ec2.MachineImage.latest_amazon_linux2(),
            vpc_subnets=ec2.SubnetSelection(subnet_type=ec2.SubnetType.PUBLIC),
            security_group=bastion_sg,
            key_name="dev-bastion-machine",  # Use your specific key pair
            user_data=ec2.UserData.for_linux()
        )
        
        # Add user data to install PostgreSQL 14 client for SCRAM authentication support
        bastion_host.user_data.add_commands(
            "# Enable PostgreSQL 14 from Amazon Linux Extras",
            "amazon-linux-extras enable postgresql14",
            "yum clean metadata",
            "# Install PostgreSQL 14 client",
            "yum install -y postgresql",
            "# Install AWS CLI v2 for secrets management",
            "yum install -y awscli",
            "# Verify PostgreSQL 14 installation",
            "psql --version > /home/ec2-user/psql-version.txt"
        )
        
        # Allow bastion to connect to database
        db_instance.connections.allow_default_port_from(bastion_host, "Allow bastion host access")

        # Create security group for agent gRPC service
        agent_grpc_sg = ec2.SecurityGroup(
            self, f"{prefix}AgentGrpcSg",
            vpc=vpc,
            description="Security group for agent gRPC service"
        )

        # Allow inbound traffic on port 50051 for gRPC service
        agent_grpc_sg.add_ingress_rule(
            peer=ec2.Peer.any_ipv4(),
            connection=ec2.Port.tcp(50051),
            description="Allow gRPC traffic on port 50051"
        )

        # Define the Docker image for the frontend, scheduler, and migration
        # AIDEV-NOTE: Use ECR image as expected by CI/CD workflow
        frontend_image_uri = os.environ.get('FRONTEND_IMAGE_URI')
        app_image = ecs.ContainerImage.from_registry(frontend_image_uri)
        print(f"Using pre-built frontend image from ECR: {frontend_image_uri}")

        # Create migration task definition with proper network configuration
        migration_task_definition = ecs.FargateTaskDefinition(
            self, f"{prefix}MigrationTaskDef",
            cpu=256,
            memory_limit_mib=512,
        )

        # Add migration container
        migration_container = migration_task_definition.add_container(
            f"{prefix}MigrationContainer",
            image=app_image,
            command=["migrate"],
            secrets={
                "DATABASE_URL": ecs.Secret.from_secrets_manager(db_instance.secret),
            },
            logging=ecs.LogDrivers.aws_logs(
                stream_prefix=f"{prefix}-Migration",
                log_group=logs.LogGroup(
                    self, f"{prefix}MigrationLogGroup",
                    removal_policy=RemovalPolicy.RETAIN  # Keep logs for troubleshooting
                )
            ),
            essential=True
        )

        # AIDEV-NOTE: Use same network configuration as frontend service
        # Frontend uses ApplicationLoadBalancedFargateService which automatically:
        # - Places tasks in private subnets with egress
        # - Uses the provided security groups for database access
        migration_network_config = {
            "awsvpcConfiguration": {
                "subnets": [subnet.subnet_id for subnet in vpc.private_subnets],
                "securityGroups": [db_client_sg.security_group_id],
                "assignPublicIp": "DISABLED"
            }
        }

        # AIDEV-NOTE: Add ECR permissions to migration task execution role for pulling images
        migration_task_definition.execution_role.add_managed_policy(
            iam.ManagedPolicy.from_aws_managed_policy_name("service-role/AmazonECSTaskExecutionRolePolicy")
        )
        # Add specific ECR permissions
        migration_task_definition.execution_role.add_to_policy(
            iam.PolicyStatement(
                effect=iam.Effect.ALLOW,
                actions=[
                    "ecr:GetAuthorizationToken",
                    "ecr:BatchCheckLayerAvailability", 
                    "ecr:GetDownloadUrlForLayer",
                    "ecr:BatchGetImage"
                ],
                resources=["*"]
            )
        )

        # Custom resource to run one-shot migration tasks
        migration_trigger = custom_resources.AwsCustomResource(
            self, f"{prefix}MigrationTrigger",
            on_create=custom_resources.AwsSdkCall(
                service="ECS",
                action="runTask",
                parameters={
                    "cluster": cluster.cluster_arn,
                    "taskDefinition": migration_task_definition.task_definition_arn,
                    "launchType": "FARGATE",
                    "networkConfiguration": migration_network_config
                },
                physical_resource_id=custom_resources.PhysicalResourceId.of(f"{prefix}MigrationTrigger-v3-{Aws.STACK_ID}")
            ),
            on_update=custom_resources.AwsSdkCall(
                service="ECS",
                action="runTask",
                parameters={
                    "cluster": cluster.cluster_arn,
                    "taskDefinition": migration_task_definition.task_definition_arn,
                    "launchType": "FARGATE",
                    "networkConfiguration": migration_network_config
                },
                physical_resource_id=custom_resources.PhysicalResourceId.of(f"{prefix}MigrationTrigger-v3-{Aws.STACK_ID}")
            ),
            policy=custom_resources.AwsCustomResourcePolicy.from_statements([
                iam.PolicyStatement(
                    actions=["ecs:RunTask"],
                    resources=[migration_task_definition.task_definition_arn],
                ),
                iam.PolicyStatement(
                    actions=["iam:PassRole"],
                    resources=[
                        migration_task_definition.task_role.role_arn,
                        migration_task_definition.execution_role.role_arn
                    ],
                )
            ]),
        )

        migration_trigger.node.add_dependency(db_instance)
        migration_trigger.node.add_dependency(migration_task_definition)

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
            path="/api/health",
            timeout=Duration.seconds(10),
            healthy_threshold_count=2,
            unhealthy_threshold_count=3,
            interval=Duration.seconds(30),
        )
        
        # AIDEV-NOTE: Configure deployment settings for frontend service stability
        cfn_frontend_service = frontend_service.service.node.default_child
        cfn_frontend_service.deployment_configuration = {
            "minimumHealthyPercent": 50,
            "maximumPercent": 200
        }
        
        # AIDEV-NOTE: Add ECR permissions to task execution role for pulling images
        frontend_service.task_definition.execution_role.add_managed_policy(
            iam.ManagedPolicy.from_aws_managed_policy_name("service-role/AmazonECSTaskExecutionRolePolicy")
        )
        # Add specific ECR permissions
        frontend_service.task_definition.execution_role.add_to_policy(
            iam.PolicyStatement(
                effect=iam.Effect.ALLOW,
                actions=[
                    "ecr:GetAuthorizationToken",
                    "ecr:BatchCheckLayerAvailability", 
                    "ecr:GetDownloadUrlForLayer",
                    "ecr:BatchGetImage"
                ],
                resources=["*"]
            )
        )

        # Create CloudFront distribution for static URL routing
        cloudfront_distribution = cloudfront.Distribution(
            self, f"{prefix}CloudFrontDistribution",
            default_behavior=cloudfront.BehaviorOptions(
                origin=origins.LoadBalancerV2Origin(
                    frontend_service.load_balancer,
                    protocol_policy=cloudfront.OriginProtocolPolicy.HTTP_ONLY
                ),
                viewer_protocol_policy=cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
                allowed_methods=cloudfront.AllowedMethods.ALLOW_ALL,
                cache_policy=cloudfront.CachePolicy.CACHING_DISABLED,  # Disable caching for dynamic content
                compress=True,
                origin_request_policy=cloudfront.OriginRequestPolicy.ALL_VIEWER
            ),
            comment=f"CloudFront distribution for {prefix} Emery application",
            enabled=True,
            price_class=cloudfront.PriceClass.PRICE_CLASS_100  # Use only North America and Europe for cost savings
        )

        # Output the CloudFront URL for easy access
        CfnOutput(
            self, f"{prefix}CloudFrontURL",
            value=f"https://{cloudfront_distribution.distribution_domain_name}",
            description="Static CloudFront URL for the application (never changes)"
        )

        # Also output the direct ALB URL for comparison
        CfnOutput(
            self, f"{prefix}DirectALBURL", 
            value=f"http://{frontend_service.load_balancer.load_balancer_dns_name}",
            description="Direct Application Load Balancer URL"
        )

        # Output bastion host information for SSH tunnel
        CfnOutput(
            self, f"{prefix}BastionHostIP",
            value=bastion_host.instance_public_ip,
            description="Bastion host public IP for SSH tunnel to database"
        )

        # Output database connection details
        CfnOutput(
            self, f"{prefix}DatabaseEndpoint",
            value=db_instance.instance_endpoint.hostname,
            description="Database endpoint for SSH tunnel connection"
        )

        # Output migration log group for troubleshooting
        CfnOutput(
            self, f"{prefix}MigrationLogGroupOutput",
            value=f"/aws/ecs/{prefix}-Migration",
            description="CloudWatch log group for migration task troubleshooting"
        )

        # Output migration task definition ARN for manual re-runs
        CfnOutput(
            self, f"{prefix}MigrationTaskDefinitionArn",
            value=migration_task_definition.task_definition_arn,
            description="Migration task definition ARN for manual execution"
        )

        # Create a new Task Definition for the scheduler
        scheduler_task_definition = ecs.FargateTaskDefinition(
            self, f"{prefix}SchedulerTaskDef",
            cpu=512,
            memory_limit_mib=1024,
        )

        scheduler_container = scheduler_task_definition.add_container(
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
        
        # AIDEV-NOTE: ECS health checks should be configured in container definition, not added afterwards
        # For scheduler, we rely on ECS service health monitoring instead of custom health checks

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
        
        # AIDEV-NOTE: Add ECR permissions to scheduler task execution role for pulling images
        scheduler_task_definition.execution_role.add_managed_policy(
            iam.ManagedPolicy.from_aws_managed_policy_name("service-role/AmazonECSTaskExecutionRolePolicy")
        )
        # Add specific ECR permissions
        scheduler_task_definition.execution_role.add_to_policy(
            iam.PolicyStatement(
                effect=iam.Effect.ALLOW,
                actions=[
                    "ecr:GetAuthorizationToken",
                    "ecr:BatchCheckLayerAvailability", 
                    "ecr:GetDownloadUrlForLayer",
                    "ecr:BatchGetImage"
                ],
                resources=["*"]
            )
        )

        # AIDEV-NOTE: Configure deployment settings for scheduler service stability
        cfn_scheduler_service = scheduler_service.node.default_child
        cfn_scheduler_service.deployment_configuration = {
            "minimumHealthyPercent": 50,
            "maximumPercent": 200
        }

        # Add dependencies to ensure services start in the correct order
        frontend_service.service.node.add_dependency(migration_trigger)
        scheduler_service.node.add_dependency(migration_trigger)

        # Create the Fargate service for the Python gRPC backend
        agent_service = ecs_patterns.NetworkLoadBalancedFargateService(
            self, f"{prefix}AgentService",
            cluster=cluster,
            service_name=f"{prefix}-Agent",
            cpu=512,  # AIDEV-NOTE: Increased CPU for better startup performance
            memory_limit_mib=1024,  # AIDEV-NOTE: Increased memory for smolagents dependencies
            desired_count=1,
            task_image_options=ecs_patterns.NetworkLoadBalancedTaskImageOptions(
                image=self._get_agent_image(),
                container_port=50051,
                secrets={
                    **app_secrets_map
                }
            ),
            public_load_balancer=True,
            security_groups=[db_client_sg, agent_grpc_sg],
            # AIDEV-NOTE: Critical fix for ECS service stability
            # Increased grace period to allow for gRPC service startup and target registration
            health_check_grace_period=Duration.seconds(300),  # 5 minutes
        )

        # Add dependency for the agent service
        agent_service.service.node.add_dependency(migration_trigger)

        # AIDEV-NOTE: Add ECR permissions to agent task execution role for pulling images
        agent_image_uri = os.environ.get('AGENT_IMAGE_URI')
        agent_service.task_definition.execution_role.add_managed_policy(
            iam.ManagedPolicy.from_aws_managed_policy_name("service-role/AmazonECSTaskExecutionRolePolicy")
        )
        # Add specific ECR permissions
        agent_service.task_definition.execution_role.add_to_policy(
            iam.PolicyStatement(
                effect=iam.Effect.ALLOW,
                actions=[
                    "ecr:GetAuthorizationToken",
                    "ecr:BatchCheckLayerAvailability", 
                    "ecr:GetDownloadUrlForLayer",
                    "ecr:BatchGetImage"
                ],
                resources=["*"]
            )
        )

        # AIDEV-NOTE: No health checks for gRPC service - relies on ECS task health only
        # The gRPC agent is internal-only, accessed by frontend via internal network
        # TCP health checks on gRPC can be unreliable during model loading
        
        # AIDEV-NOTE: Configure deployment settings for agent service stability
        cfn_agent_service = agent_service.service.node.default_child
        cfn_agent_service.deployment_configuration = {
            "minimumHealthyPercent": 0,   # Allow stopping old tasks before starting new ones
            "maximumPercent": 100        # Prevent resource contention during deployment
        }
        
        # AIDEV-NOTE: ECS health checks should be configured in container definition, not added afterwards
        # For agent gRPC service, we rely on ECS service health monitoring

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
