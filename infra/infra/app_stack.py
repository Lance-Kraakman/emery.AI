from aws_cdk import (
    Stack,
    aws_ec2 as ec2,
    aws_ecs as ecs,
    aws_ecs_patterns as ecs_patterns,
    aws_elasticloadbalancingv2 as elbv2,
    aws_logs as logs,
    aws_iam as iam,
    aws_cloudfront as cloudfront,
    aws_cloudfront_origins as origins,
    aws_servicediscovery as servicediscovery,
    custom_resources,
    Aws,
    Duration,
    CfnOutput,
)
from constructs import Construct
from .data_stack import DataStack
import os
import time
import hashlib
import glob


class AppStack(Stack):
    """
    Application Stack - Contains frequently-changing application resources:
    - ECS Cluster and Services (frontend, scheduler, agent-chat, agent-table)
    - Load Balancers (ALB for frontend, NLBs for agents)
    - CloudFront distribution
    - Auto-scaling configurations
    """

    def _get_migration_hash(self) -> str:
        """Generate hash of migration files to force migration trigger on schema changes"""
        migration_path = "../drizzle"
        hash_input = ""
        
        try:
            if os.path.exists(migration_path):
                for file_path in sorted(glob.glob(f"{migration_path}/*.sql")):
                    with open(file_path, 'r') as f:
                        hash_input += f.read()
            
            # Also include the schema file to detect changes
            schema_path = "../lib/db/schema.ts"
            if os.path.exists(schema_path):
                with open(schema_path, 'r') as f:
                    hash_input += f.read()
                    
        except Exception as e:
            print(f"Warning: Could not read migration files for hashing: {e}")
            # Fallback to current timestamp to ensure migrations run
            hash_input = str(time.time())
        
        return hashlib.md5(hash_input.encode()).hexdigest()[:8]

    def _get_frontend_image(self) -> ecs.ContainerImage:
        """Get frontend container image from ECR or build from source"""
        frontend_image_uri = os.environ.get('FRONTEND_IMAGE_URI')
        if frontend_image_uri:
            print(f"Using pre-built frontend image from ECR: {frontend_image_uri}")
            return ecs.ContainerImage.from_registry(frontend_image_uri)
        else:
            print("Building frontend image from source (for local development/bootstrap)")
            return ecs.ContainerImage.from_asset("..")

    def _get_agent_image(self) -> ecs.ContainerImage:
        """Get agent container image from ECR or build from source"""
        agent_image_uri = os.environ.get('AGENT_IMAGE_URI')
        if agent_image_uri:
            print(f"Using pre-built agent image from ECR: {agent_image_uri}")
            return ecs.ContainerImage.from_registry(agent_image_uri)
        else:
            print("Building agent image from source")
            return ecs.ContainerImage.from_asset("../emery-agents")

    def __init__(self, scope: Construct, construct_id: str, data_stack: DataStack, env_name: str, **kwargs) -> None:
        super().__init__(scope, construct_id, **kwargs)

        prefix = env_name.capitalize()

        # Default AWS region - can be overridden by CDK context
        aws_region = 'ap-southeast-2'

        # ========== ECS CLUSTER ==========
        # Create an ECS cluster in the VPC from data stack
        cluster = ecs.Cluster(
            self, f"{prefix}EmeryCluster",
            vpc=data_stack.vpc,
            cluster_name=f"{prefix}EmeryCluster"
        )

        # Define the Docker image for the frontend, scheduler, and migration
        # AIDEV-NOTE: Use ECR image from CI/CD workflow, or build from source locally
        app_image = self._get_frontend_image()

        # AIDEV-NOTE: Migration now handled by init containers in each service
        # No separate migration task needed - migrations run before each service starts


        # Create custom task definition with init container for migrations
        frontend_task_definition = ecs.FargateTaskDefinition(
            self, f"{prefix}FrontendTaskDef",
            cpu=512,
            memory_limit_mib=1024,
            runtime_platform=ecs.RuntimePlatform(
                cpu_architecture=ecs.CpuArchitecture.X86_64,
                operating_system_family=ecs.OperatingSystemFamily.LINUX
            ),
        )

        # Add migration init container (runs first, must complete successfully)
        migration_init_container = frontend_task_definition.add_container(
            f"{prefix}MigrationInitContainer",
            image=app_image,
            command=["migrate"],
            environment={
                "RUN_SEEDS": "true",  # Enable database seeding
                "NODE_ENV": "production",
            },
            secrets={
                "DATABASE_URL": ecs.Secret.from_secrets_manager(data_stack.db_instance.secret),
                **data_stack.app_secrets_map  # Seeds need access to Pipedream, OpenAI, etc.
            },
            logging=ecs.LogDrivers.aws_logs(
                stream_prefix=f"{prefix}-Migration-Init",
            ),
            essential=False  # If this fails, don't start the main container
        )

        # Add main frontend container (starts after init container succeeds)
        frontend_container = frontend_task_definition.add_container(
            f"{prefix}FrontendContainer",
            image=app_image,
            port_mappings=[ecs.PortMapping(container_port=3000)],
            secrets={
                "DATABASE_URL": ecs.Secret.from_secrets_manager(data_stack.db_instance.secret),
                **data_stack.app_secrets_map
            },
            logging=ecs.LogDrivers.aws_logs(
                stream_prefix=f"{prefix}-Frontend",
            ),
            essential=True
        )

        # Init container dependency: main container waits for migration (FIXED SYNTAX)
        frontend_container.add_container_dependencies(
            ecs.ContainerDependency(
                container=migration_init_container,
                condition=ecs.ContainerDependencyCondition.SUCCESS
            )
        )

        # Create the Fargate service using custom task definition
        frontend_service = ecs_patterns.ApplicationLoadBalancedFargateService(
            self, f"{prefix}FrontendService",
            cluster=cluster,
            service_name=f"{prefix}-Frontend",
            task_definition=frontend_task_definition,
            desired_count=1,
            public_load_balancer=True,
            security_groups=[data_stack.db_client_sg],
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

        # AIDEV-NOTE: Configure auto-scaling for frontend service
        # Web application that needs to scale based on user traffic
        frontend_scaling = frontend_service.service.auto_scale_task_count(
            min_capacity=2,  # Run 2 tasks minimum for HA across AZs
            max_capacity=20  # Can scale up to 20 tasks during traffic spikes
        )

        frontend_scaling.scale_on_cpu_utilization(
            "FrontendCpuScaling",
            target_utilization_percent=70,  # Target 70% CPU utilization
            scale_in_cooldown=Duration.seconds(120),  # Standard scale-in cooldown
            scale_out_cooldown=Duration.seconds(60)   # Fast scale-out for user traffic
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

        # AIDEV-NOTE: Bastion and database outputs are in DataStack
        # AIDEV-NOTE: Migration logs available in frontend init container log stream:
        # /aws/ecs/{prefix}-Migration-Init (frontend only - scheduler does not run migrations)

        # AIDEV-NOTE: Scheduler task definition without migration init container
        # Migrations are handled exclusively by the frontend service to prevent race conditions
        scheduler_task_definition = ecs.FargateTaskDefinition(
            self, f"{prefix}SchedulerTaskDef",
            cpu=512,
            memory_limit_mib=1024,
            runtime_platform=ecs.RuntimePlatform(
                cpu_architecture=ecs.CpuArchitecture.X86_64,
                operating_system_family=ecs.OperatingSystemFamily.LINUX
            ),
        )

        scheduler_container = scheduler_task_definition.add_container(
            f"{prefix}SchedulerContainer",
            image=app_image,
            command=["scheduler"],
            secrets={
                "DATABASE_URL": ecs.Secret.from_secrets_manager(data_stack.db_instance.secret),
                **data_stack.app_secrets_map
            },
            logging=ecs.LogDrivers.aws_logs(
                stream_prefix=f"{prefix}-Scheduler",
            ),
            essential=True
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
            security_groups=[data_stack.db_client_sg],
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

        # AIDEV-NOTE: Scheduler service depends on frontend service to ensure migrations complete first
        # Container dependencies only work within same task definition, so we use service-level dependency
        # This ensures frontend (with migration init container) starts and becomes healthy before scheduler
        scheduler_service.node.add_dependency(frontend_service.service)

        # AIDEV-NOTE: Configure auto-scaling for scheduler service
        # Background job processing that can scale based on CPU utilization
        scheduler_scaling = scheduler_service.auto_scale_task_count(
            min_capacity=1,  # Low baseline for cost optimization
            max_capacity=5   # Limited scaling for background tasks
        )

        scheduler_scaling.scale_on_cpu_utilization(
            "SchedulerCpuScaling",
            target_utilization_percent=75,  # Can run hotter since it's background processing
            scale_in_cooldown=Duration.seconds(180),  # Conservative scale-in for batch jobs
            scale_out_cooldown=Duration.seconds(90)   # Slower scale-out OK for background work
        )

        # AIDEV-NOTE: Add WORKER_ADDRESS to scheduler after agent service is created
        # This will be done after agent_service definition below

        # AIDEV-NOTE: Dual-port gRPC architecture to prevent circular dependency deadlocks
        # Chat service (port 50051): AgentWorker + ChatProcessingService
        # Table service (port 50052): TableService only

        # ========== CHAT SERVICE (Port 50051) ==========
        agent_chat_service = ecs_patterns.NetworkLoadBalancedFargateService(
            self, f"{prefix}AgentChatService",
            cluster=cluster,
            service_name=f"{prefix}-Agent-Chat",
            cpu=1024,  # 1 vCPU for AI processing
            memory_limit_mib=2048,  # 2 GB for chat and agent execution
            desired_count=1,  # Start with 1 task, scale up as needed
            task_image_options=ecs_patterns.NetworkLoadBalancedTaskImageOptions(
                image=self._get_agent_image(),
                container_port=50051,
                environment={
                    "GRPC_CHAT_MAX_WORKERS": "20",
                },
                secrets={
                    "DATABASE_URL": ecs.Secret.from_secrets_manager(data_stack.db_instance.secret),
                    **data_stack.app_secrets_map
                }
            ),
            runtime_platform=ecs.RuntimePlatform(
                cpu_architecture=ecs.CpuArchitecture.X86_64,
                operating_system_family=ecs.OperatingSystemFamily.LINUX
            ),
            public_load_balancer=False,
            security_groups=[data_stack.db_client_sg, data_stack.chat_grpc_sg],
            health_check_grace_period=Duration.seconds(300),
            cloud_map_options=ecs.CloudMapOptions(
                name="agent-chat",
                cloud_map_namespace=data_stack.namespace,
                dns_record_type=servicediscovery.DnsRecordType.A,
                dns_ttl=Duration.seconds(60)
            ),
        )

        # Set custom command for chat service container
        cfn_chat_task_def = agent_chat_service.task_definition.node.default_child
        cfn_chat_task_def.add_property_override(
            "ContainerDefinitions.0.Command",
            ["python", "-m", "emery_agents.grpc.server", "--mode=chat", "--port=50051"]
        )

        # Configure TCP health check for chat service
        agent_chat_service.target_group.configure_health_check(
            port="50051",
            protocol=elbv2.Protocol.TCP,
            interval=Duration.seconds(30),
            timeout=Duration.seconds(10),
            healthy_threshold_count=2,
            unhealthy_threshold_count=2,
        )

        # Add ECR permissions for chat service
        agent_chat_service.task_definition.execution_role.add_managed_policy(
            iam.ManagedPolicy.from_aws_managed_policy_name("service-role/AmazonECSTaskExecutionRolePolicy")
        )
        agent_chat_service.task_definition.execution_role.add_to_policy(
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

        # Configure deployment settings for chat service
        cfn_chat_service = agent_chat_service.service.node.default_child
        cfn_chat_service.deployment_configuration = {
            "minimumHealthyPercent": 0,
            "maximumPercent": 100
        }

        # Configure auto-scaling for chat service
        chat_scaling = agent_chat_service.service.auto_scale_task_count(
            min_capacity=1,  # Start with 1 task
            max_capacity=10  # Scale up to 10 for heavy AI workload
        )
        chat_scaling.scale_on_cpu_utilization(
            "ChatCpuScaling",
            target_utilization_percent=70,
            scale_in_cooldown=Duration.seconds(180),
            scale_out_cooldown=Duration.seconds(60)
        )

        # ========== TABLE SERVICE (Port 50052) ==========
        agent_table_service = ecs_patterns.NetworkLoadBalancedFargateService(
            self, f"{prefix}AgentTableService",
            cluster=cluster,
            service_name=f"{prefix}-Agent-Table",
            cpu=1024,  # 1 vCPU for table operations
            memory_limit_mib=2048,  # 2 GB for Delta Lake operations
            desired_count=1,  # Start with 1 task
            task_image_options=ecs_patterns.NetworkLoadBalancedTaskImageOptions(
                image=self._get_agent_image(),
                container_port=50052,
                environment={
                    "GRPC_TABLE_MAX_WORKERS": "15",
                },
                secrets={
                    "DATABASE_URL": ecs.Secret.from_secrets_manager(data_stack.db_instance.secret),
                    **data_stack.app_secrets_map
                }
            ),
            runtime_platform=ecs.RuntimePlatform(
                cpu_architecture=ecs.CpuArchitecture.X86_64,
                operating_system_family=ecs.OperatingSystemFamily.LINUX
            ),
            public_load_balancer=False,
            security_groups=[data_stack.db_client_sg, data_stack.table_grpc_sg],
            health_check_grace_period=Duration.seconds(300),
            cloud_map_options=ecs.CloudMapOptions(
                name="agent-table",
                cloud_map_namespace=data_stack.namespace,
                dns_record_type=servicediscovery.DnsRecordType.A,
                dns_ttl=Duration.seconds(60)
            ),
        )

        # Set custom command for table service container
        cfn_table_task_def = agent_table_service.task_definition.node.default_child
        cfn_table_task_def.add_property_override(
            "ContainerDefinitions.0.Command",
            ["python", "-m", "emery_agents.grpc.server", "--mode=table", "--port=50052"]
        )

        # Configure TCP health check for table service
        agent_table_service.target_group.configure_health_check(
            port="50052",
            protocol=elbv2.Protocol.TCP,
            interval=Duration.seconds(30),
            timeout=Duration.seconds(10),
            healthy_threshold_count=2,
            unhealthy_threshold_count=2,
        )

        # Add ECR permissions for table service
        agent_table_service.task_definition.execution_role.add_managed_policy(
            iam.ManagedPolicy.from_aws_managed_policy_name("service-role/AmazonECSTaskExecutionRolePolicy")
        )
        agent_table_service.task_definition.execution_role.add_to_policy(
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

        # Configure deployment settings for table service
        cfn_table_service = agent_table_service.service.node.default_child
        cfn_table_service.deployment_configuration = {
            "minimumHealthyPercent": 0,
            "maximumPercent": 100
        }

        # Configure auto-scaling for table service
        table_scaling = agent_table_service.service.auto_scale_task_count(
            min_capacity=1,  # Start with 1 task
            max_capacity=5  # Scale up to 5 for table operations
        )
        table_scaling.scale_on_cpu_utilization(
            "TableCpuScaling",
            target_utilization_percent=75,
            scale_in_cooldown=Duration.seconds(180),
            scale_out_cooldown=Duration.seconds(90)
        )

        # Update environment variables to use Cloud Map DNS for dual-port architecture
        # Chat service on port 50051, Table service on port 50052
        if frontend_service.task_definition.default_container:
            frontend_service.task_definition.default_container.add_environment(
                "WORKER_ADDRESS",
                "agent-chat.emery.local:50051"
            )
            frontend_service.task_definition.default_container.add_environment(
                "GRPC_TOOLS_ADDRESS",
                "agent-table.emery.local:50052"
            )

            # Also inject the frontend's own public URL for NextAuth (use CloudFront URL)
            frontend_service.task_definition.default_container.add_environment(
                "NEXTAUTH_URL",
                f"https://{cloudfront_distribution.distribution_domain_name}"
            )



        # Update scheduler environment variables for dual-port architecture
        scheduler_container.add_environment(
            "WORKER_ADDRESS",
            "agent-chat.emery.local:50051"
        )
        scheduler_container.add_environment(
            "GRPC_TOOLS_ADDRESS",
            "agent-table.emery.local:50052"
        )
        # Add AWS S3 configuration to override MinIO defaults
        aws_endpoint_url = f"https://s3.{aws_region}.amazonaws.com"
        scheduler_container.add_environment(
            "AWS_ENDPOINT_URL",
            aws_endpoint_url  # Dynamic AWS S3 endpoint
        )
        scheduler_container.add_environment(
            "AWS_REGION",
            aws_region  # Use dynamic AWS region
        )

        # ========== S3 BUCKET PERMISSIONS ==========
        # Grant all services read/write access to the S3 bucket from data stack
        data_stack.storage_bucket.grant_read_write(frontend_service.task_definition.task_role)
        data_stack.storage_bucket.grant_read_write(agent_chat_service.task_definition.task_role)
        data_stack.storage_bucket.grant_read_write(agent_table_service.task_definition.task_role)
        data_stack.storage_bucket.grant_read_write(scheduler_task_definition.task_role)

        # Inject the bucket name as an environment variable into both services
        if frontend_service.task_definition.default_container:
            frontend_service.task_definition.default_container.add_environment(
                "S3_BUCKET_NAME",
                data_stack.storage_bucket.bucket_name
            )
            # Add AWS S3 configuration to override MinIO defaults
            frontend_aws_endpoint_url = f"https://s3.{aws_region}.amazonaws.com"
            frontend_service.task_definition.default_container.add_environment(
                "AWS_ENDPOINT_URL",
                frontend_aws_endpoint_url  # Dynamic AWS S3 endpoint
            )
            frontend_service.task_definition.default_container.add_environment(
                "AWS_REGION",
                "ap-southeast-2"  # AWS region for deployment
            )
        
        # Add S3 and AWS configuration to chat service
        if agent_chat_service.task_definition.default_container:
            agent_chat_service.task_definition.default_container.add_environment(
                "S3_BUCKET_NAME",
                data_stack.storage_bucket.bucket_name
            )
            agent_aws_endpoint_url = f"https://s3.{aws_region}.amazonaws.com"
            agent_chat_service.task_definition.default_container.add_environment(
                "AWS_ENDPOINT_URL",
                agent_aws_endpoint_url
            )
            agent_chat_service.task_definition.default_container.add_environment(
                "AWS_REGION",
                aws_region
            )
            # Add NextJS base URL for agent callbacks to API routes
            agent_chat_service.task_definition.default_container.add_environment(
                "NEXTJS_BASE_URL",
                f"https://{cloudfront_distribution.distribution_domain_name}"
            )

        # Add S3 and AWS configuration to table service
        if agent_table_service.task_definition.default_container:
            agent_table_service.task_definition.default_container.add_environment(
                "S3_BUCKET_NAME",
                data_stack.storage_bucket.bucket_name
            )
            agent_table_aws_endpoint_url = f"https://s3.{aws_region}.amazonaws.com"
            agent_table_service.task_definition.default_container.add_environment(
                "AWS_ENDPOINT_URL",
                agent_table_aws_endpoint_url
            )
            agent_table_service.task_definition.default_container.add_environment(
                "AWS_REGION",
                aws_region
            )
