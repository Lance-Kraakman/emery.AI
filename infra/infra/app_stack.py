from aws_cdk import (
    Stack,
    aws_ec2 as ec2,
    aws_ecs as ecs,
    aws_ecs_patterns as ecs_patterns,
    aws_elasticloadbalancingv2 as elbv2,
    aws_codedeploy as codedeploy,
    aws_logs as logs,
    aws_iam as iam,
    aws_ecr as ecr,
    aws_cloudfront as cloudfront,
    aws_cloudfront_origins as origins,
    aws_servicediscovery as servicediscovery,
    aws_certificatemanager as acm,
    aws_efs as efs,
    custom_resources,
    Aws,
    Duration,
    CfnOutput,
    RemovalPolicy,
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
    - ECS Cluster and Services (frontend, scheduler, agents [merged chat+table])
    - Load Balancers (ALB for frontend only - agents use Cloud Map service discovery)
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

    def __init__(
        self,
        scope: Construct,
        construct_id: str,
        data_stack: DataStack,
        env_name: str,
        waf_acl_arn: str = None,
        **kwargs
    ) -> None:
        super().__init__(scope, construct_id, **kwargs)

        prefix = env_name.capitalize()
        self.waf_acl_arn = waf_acl_arn

        # Default AWS region - can be overridden by CDK context
        aws_region = 'ap-southeast-2'

        # ========== ECR REPOSITORIES ==========
        # Import existing ECR repositories (created outside CDK or orphaned from previous deployments)
        # Lifecycle rules are managed separately via AWS CLI (see infra/scripts/apply-ecr-lifecycle.sh)
        self.frontend_repo = ecr.Repository.from_repository_name(
            self, "FrontendRepo",
            repository_name="emery/frontend"
        )

        self.agent_repo = ecr.Repository.from_repository_name(
            self, "AgentRepo",
            repository_name="emery/agent"
        )

        # ========== CUSTOM DOMAIN CONFIGURATION ==========
        # Domain and certificate configuration per environment
        domain_config = {
            "production": {
                "domain": "enhancd.ai",
                "certificate_arn": "arn:aws:acm:us-east-1:034165313651:certificate/c95eb22e-f4d8-4874-b381-f7a2cdaecc1a"
            },
            "staging": {
                "domain": "staging.enhancd.ai",
                "certificate_arn": "arn:aws:acm:us-east-1:772302459598:certificate/3cb8f028-6cfc-404f-bd9c-315ee0f77a1d"
            },
            "dev": {
                "domain": "dev.enhancd.ai",
                "certificate_arn": "arn:aws:acm:us-east-1:463735866328:certificate/80e6353a-04d0-43c7-a246-c8a3aab67077"
            },
        }

        custom_domain = domain_config.get(env_name, {}).get("domain")
        certificate_arn = domain_config.get(env_name, {}).get("certificate_arn")

        # ========== ENVIRONMENT-SPECIFIC RESOURCE SIZING ==========
        sizing_config = {
            "production": {
                "frontend_min_capacity": 2,   # HA for paying users
            },
            "staging": {
                "frontend_min_capacity": 1,
            },
            "dev": {
                "frontend_min_capacity": 1,   # Single task for dev
            }
        }
        sizing = sizing_config.get(env_name, sizing_config["dev"])

        # COST-OPT: CloudWatch log retention - 60 days prod, 30 days dev/staging
        # Previously infinite (AWS default), now bounded to reduce storage costs
        log_retention = logs.RetentionDays.TWO_MONTHS if env_name == "production" else logs.RetentionDays.ONE_MONTH

        # Import the ACM certificate (created in us-east-1 for CloudFront)
        certificate = None
        if certificate_arn:
            certificate = acm.Certificate.from_certificate_arn(
                self, f"{prefix}Certificate",
                certificate_arn=certificate_arn
            )

        # ========== ECS CLUSTER ==========
        # Create an ECS cluster in the VPC from data stack
        # COST-OPT: enable_fargate_capacity_providers allows Fargate Spot for scheduler
        cluster = ecs.Cluster(
            self, f"{prefix}EmeryCluster",
            vpc=data_stack.vpc,
            cluster_name=f"{prefix}EmeryCluster",
            enable_fargate_capacity_providers=True,
        )

        # Define the Docker image for the frontend, scheduler, and migration
        # AIDEV-NOTE: Use ECR image from CI/CD workflow, or build from source locally
        app_image = self._get_frontend_image()

        # AIDEV-NOTE: Migration now handled by init containers in each service
        # No separate migration task needed - migrations run before each service starts

        # ========== SHARED FILESYSTEM (EFS) FOR WORKSPACES ==========
        # Provides persistent workspace storage shared between agent and frontend services.
        # Eliminates S3 transfer costs and enables instant workspace access.
        #
        # Lifecycle policies for cost optimization:
        # - Files unused for 7 days → move to Infrequent Access ($0.025/GB vs $0.30/GB = 92% savings)
        # - On first access → auto-promote back to Standard (transparent to applications)
        # - Note: IA has 128KB minimum read charge, optimal for files >128KB
        # - Note: 7 days is the most aggressive option available in CDK (3 days not supported)
        workspace_fs = efs.FileSystem(
            self, f"{prefix}WorkspaceFS",
            vpc=data_stack.vpc,
            removal_policy=RemovalPolicy.RETAIN,  # Keep data on stack deletion
            performance_mode=efs.PerformanceMode.GENERAL_PURPOSE,
            throughput_mode=efs.ThroughputMode.BURSTING,
            lifecycle_policy=efs.LifecyclePolicy.AFTER_7_DAYS,  # Move inactive files to IA tier
            out_of_infrequent_access_policy=efs.OutOfInfrequentAccessPolicy.AFTER_1_ACCESS,  # Auto-restore on use
            encrypted=True,
        )

        # Create access point for workspaces directory
        workspace_access_point = workspace_fs.add_access_point(
            f"{prefix}WorkspaceAccessPoint",
            path="/workspaces",
            create_acl=efs.Acl(
                owner_gid="1000",
                owner_uid="1000",
                permissions="755",
            ),
            posix_user=efs.PosixUser(
                gid="1000",
                uid="1000",
            ),
        )

        CfnOutput(
            self, f"{prefix}WorkspaceFSId",
            value=workspace_fs.file_system_id,
            description="EFS filesystem ID for workspace storage"
        )

        # Create custom task definition with init container for migrations
        # COST-OPT: ARM64 (Graviton) ~20% cheaper per vCPU-hour than x86
        frontend_task_definition = ecs.FargateTaskDefinition(
            self, f"{prefix}FrontendTaskDef",
            cpu=512,
            memory_limit_mib=1024,
            runtime_platform=ecs.RuntimePlatform(
                cpu_architecture=ecs.CpuArchitecture.ARM64,
                operating_system_family=ecs.OperatingSystemFamily.LINUX
            ),
        )

        # Add EFS volume for workspace storage
        frontend_task_definition.add_volume(
            name="workspace-storage",
            efs_volume_configuration=ecs.EfsVolumeConfiguration(
                file_system_id=workspace_fs.file_system_id,
                transit_encryption="ENABLED",
                authorization_config=ecs.AuthorizationConfig(
                    access_point_id=workspace_access_point.access_point_id,
                    iam="ENABLED",
                ),
            ),
        )

        # Add migration init container (runs first, must complete successfully)
        migration_init_container = frontend_task_definition.add_container(
            f"{prefix}MigrationInitContainer",
            image=app_image,
            command=["migrate"],
            environment={
                "NODE_ENV": "production",
            },
            secrets={
                "DATABASE_URL": ecs.Secret.from_secrets_manager(data_stack.db_instance.secret),
                **data_stack.app_secrets_map  # Seeds need access to Pipedream, OpenAI, etc.
            },
            logging=ecs.LogDrivers.aws_logs(
                stream_prefix=f"{prefix}-Migration-Init",
                log_retention=log_retention,
            ),
            essential=False  # Must be False: migration exits after success, essential=True would kill the whole task
        )

        # Add main frontend container (starts after init container succeeds)
        frontend_container = frontend_task_definition.add_container(
            f"{prefix}FrontendContainer",
            image=app_image,
            port_mappings=[ecs.PortMapping(container_port=3000)],
            environment={
                "REDIS_URL": data_stack.redis_endpoint,  # ElastiCache for caching
                "WORKSPACE_STORAGE_PATH": "/mnt/storage/workspaces",  # EFS mount for workspaces
            },
            secrets={
                "DATABASE_URL": ecs.Secret.from_secrets_manager(data_stack.db_instance.secret),
                **data_stack.app_secrets_map
            },
            logging=ecs.LogDrivers.aws_logs(
                stream_prefix=f"{prefix}-Frontend",
                log_retention=log_retention,
            ),
            essential=True
        )

        # Mount EFS workspace storage in frontend container
        frontend_container.add_mount_points(
            ecs.MountPoint(
                container_path="/mnt/storage/workspaces",
                source_volume="workspace-storage",
                read_only=False,
            )
        )

        # Init container dependency: main container waits for migration (FIXED SYNTAX)
        frontend_container.add_container_dependencies(
            ecs.ContainerDependency(
                container=migration_init_container,
                condition=ecs.ContainerDependencyCondition.SUCCESS
            )
        )

        # Create the Fargate service using custom task definition
        # Production uses CODE_DEPLOY for blue/green, dev/staging use rolling deployments
        is_production = env_name == "production"

        frontend_service = ecs_patterns.ApplicationLoadBalancedFargateService(
            self, f"{prefix}FrontendService",
            cluster=cluster,
            service_name=f"{prefix}-Frontend",
            task_definition=frontend_task_definition,
            desired_count=1,
            public_load_balancer=True,
            deployment_controller=ecs.DeploymentController(
                type=ecs.DeploymentControllerType.CODE_DEPLOY
            ) if is_production else None,
        )

        # Increase ALB idle timeout from default 60s to 300s (5 minutes)
        # Required for long-running chat/agent operations
        frontend_service.load_balancer.set_attribute(
            'idle_timeout.timeout_seconds', '300'
        )

        # Grant database access to frontend service
        frontend_service.service.connections.allow_to(
            data_stack.db_instance,
            ec2.Port.tcp(5432),
            "Allow frontend service to access database"
        )

        # Grant Redis access to frontend service
        # Use allow_to instead of add_ingress_rule to avoid cross-stack cyclic dependency
        frontend_service.service.connections.allow_to(
            ec2.Connections(security_groups=[data_stack.redis_sg]),
            ec2.Port.tcp(6379),
            "Allow frontend service to access ElastiCache Redis"
        )

        # Configure the health check for the frontend service (Blue target group)
        frontend_service.target_group.configure_health_check(
            path="/api/health",
            timeout=Duration.seconds(5),  # Reduced from 10s for faster failure detection
            healthy_threshold_count=2,
            unhealthy_threshold_count=3,
            interval=Duration.seconds(30),
        )

        # AIDEV-NOTE: Production uses blue/green (CodeDeploy), dev/staging use rolling deployments
        if not is_production:
            # Dev/Staging: Configure deployment settings for rolling updates
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
            min_capacity=sizing["frontend_min_capacity"],  # Environment-specific
            max_capacity=10  # Can scale up to 10 tasks during traffic spikes
        )

        frontend_scaling.scale_on_cpu_utilization(
            "FrontendCpuScaling",
            target_utilization_percent=70,  # Target 70% CPU utilization
            scale_in_cooldown=Duration.seconds(120),  # Standard scale-in cooldown
            scale_out_cooldown=Duration.seconds(60)   # Fast scale-out for user traffic
        )

        # ========== BLUE/GREEN DEPLOYMENT WITH CODEDEPLOY (Production Only) ==========
        if is_production:
            # CodeDeploy manages traffic shifting between blue (current) and green (new) target groups

            # Create Green target group for blue/green deployments
            green_target_group = elbv2.ApplicationTargetGroup(
                self, f"{prefix}FrontendGreenTG",
                vpc=data_stack.vpc,
                port=3000,
                protocol=elbv2.ApplicationProtocol.HTTP,
                target_type=elbv2.TargetType.IP,
                health_check=elbv2.HealthCheck(
                    path="/api/health",
                    timeout=Duration.seconds(5),  # Reduced from 10s for faster failure detection
                    healthy_threshold_count=2,
                    unhealthy_threshold_count=3,
                    interval=Duration.seconds(30),
                ),
            )

            # Create test listener for green environment (port 3001)
            # Allows testing new deployment before switching traffic
            test_listener = frontend_service.load_balancer.add_listener(
                f"{prefix}FrontendTestListener",
                port=3001,
                protocol=elbv2.ApplicationProtocol.HTTP,
                default_target_groups=[green_target_group],
            )

            codedeploy_app = codedeploy.EcsApplication(
                self, f"{prefix}FrontendCodeDeployApp",
                application_name=f"{prefix}-Frontend-BlueGreen",
            )

            deployment_group = codedeploy.EcsDeploymentGroup(
                self, f"{prefix}FrontendDeploymentGroup",
                application=codedeploy_app,
                deployment_group_name=f"{prefix}-Frontend-DeploymentGroup",
                service=frontend_service.service,
                blue_green_deployment_config=codedeploy.EcsBlueGreenDeploymentConfig(
                    blue_target_group=frontend_service.target_group,
                    green_target_group=green_target_group,
                    listener=frontend_service.listener,
                    test_listener=test_listener,
                    deployment_approval_wait_time=Duration.hours(1),  # Manual approval timeout
                ),
                deployment_config=codedeploy.EcsDeploymentConfig.ALL_AT_ONCE,
                auto_rollback=codedeploy.AutoRollbackConfig(
                    failed_deployment=True,
                    stopped_deployment=True,
                ),
            )

            # Output CodeDeploy info for easy access
            CfnOutput(
                self, f"{prefix}CodeDeployApp",
                value=codedeploy_app.application_name,
                description="CodeDeploy application name for blue/green deployments"
            )
            CfnOutput(
                self, f"{prefix}CodeDeployGroup",
                value=deployment_group.deployment_group_name,
                description="CodeDeploy deployment group name"
            )
            CfnOutput(
                self, f"{prefix}TestListenerURL",
                value=f"http://{frontend_service.load_balancer.load_balancer_dns_name}:3001",
                description="Test listener URL for green environment (use to test before approving deployment)"
            )

        # Create the ALB origin once for reuse
        # AIDEV-NOTE: Default CloudFront origin timeout is 30s, max without quota increase is 60s
        # To get 180s, you need to request a quota increase from AWS Support
        alb_origin = origins.LoadBalancerV2Origin(
            frontend_service.load_balancer,
            protocol_policy=cloudfront.OriginProtocolPolicy.HTTP_ONLY,
            read_timeout=Duration.seconds(60),  # 60s max without AWS quota increase
            keepalive_timeout=Duration.seconds(60),
        )

        # Create CloudFront distribution for static URL routing
        cloudfront_distribution = cloudfront.Distribution(
            self, f"{prefix}CloudFrontDistribution",
            default_behavior=cloudfront.BehaviorOptions(
                origin=alb_origin,
                viewer_protocol_policy=cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
                allowed_methods=cloudfront.AllowedMethods.ALLOW_ALL,
                cache_policy=cloudfront.CachePolicy.CACHING_DISABLED,  # Disable caching for dynamic content
                compress=True,
                origin_request_policy=cloudfront.OriginRequestPolicy.ALL_VIEWER
            ),
            # AIDEV-NOTE: Cache static assets at edge - Next.js static files are immutable (hashed filenames)
            additional_behaviors={
                "/_next/static/*": cloudfront.BehaviorOptions(
                    origin=alb_origin,
                    viewer_protocol_policy=cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
                    cache_policy=cloudfront.CachePolicy.CACHING_OPTIMIZED,
                    compress=True,
                ),
                "/favicon.ico": cloudfront.BehaviorOptions(
                    origin=alb_origin,
                    viewer_protocol_policy=cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
                    cache_policy=cloudfront.CachePolicy.CACHING_OPTIMIZED,
                    compress=True,
                ),
            },
            # Custom domain configuration
            domain_names=[custom_domain] if custom_domain else None,
            certificate=certificate,
            # WAF protection - rate limiting and managed security rules
            web_acl_id=self.waf_acl_arn,
            comment=f"CloudFront distribution for {prefix} Emery application",
            enabled=True,
            price_class=cloudfront.PriceClass.PRICE_CLASS_ALL  # Keep ALL for APAC (NZ/AU) edge coverage
        )

        # Output the CloudFront URL for easy access
        CfnOutput(
            self, f"{prefix}CloudFrontURL",
            value=f"https://{cloudfront_distribution.distribution_domain_name}",
            description="Static CloudFront URL for the application (never changes)"
        )

        # Output custom domain URL if configured
        if custom_domain:
            CfnOutput(
                self, f"{prefix}CustomDomainURL",
                value=f"https://{custom_domain}",
                description="Custom domain URL for the application"
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
        # COST-OPT: ARM64 (Graviton) ~20% cheaper per vCPU-hour than x86
        scheduler_task_definition = ecs.FargateTaskDefinition(
            self, f"{prefix}SchedulerTaskDef",
            cpu=512,
            memory_limit_mib=1024,
            runtime_platform=ecs.RuntimePlatform(
                cpu_architecture=ecs.CpuArchitecture.ARM64,
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
                log_retention=log_retention,
            ),
            essential=True
        )

        # AIDEV-NOTE: ECS health checks should be configured in container definition, not added afterwards
        # For scheduler, we rely on ECS service health monitoring instead of custom health checks

        # Create the Fargate service for the scheduler
        # COST-OPT: Fargate Spot saves ~70% on compute for non-critical background work.
        # Scheduler uses PostgreSQL LISTEN/NOTIFY which auto-reconnects on Spot interruption.
        # If Spot capacity is unavailable, tasks fall back to regular Fargate.
        scheduler_service = ecs.FargateService(
            self, f"{prefix}SchedulerService",
            cluster=cluster,
            service_name=f"{prefix}-Scheduler",
            task_definition=scheduler_task_definition,
            desired_count=1,
            vpc_subnets=ec2.SubnetSelection(
                subnet_type=ec2.SubnetType.PRIVATE_WITH_EGRESS
            ),
            capacity_provider_strategies=[
                ecs.CapacityProviderStrategy(
                    capacity_provider="FARGATE_SPOT",
                    weight=1,  # Prefer Spot
                ),
                ecs.CapacityProviderStrategy(
                    capacity_provider="FARGATE",
                    weight=0,  # Fallback only when Spot unavailable
                    base=0,
                ),
            ],
        )

        # Grant database access to scheduler service
        scheduler_service.connections.allow_to(
            data_stack.db_instance,
            ec2.Port.tcp(5432),
            "Allow scheduler service to access database"
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

        # ========== MERGED AGENT SERVICE (Chat port 50051 + Table port 50052) ==========
        # COST-OPT: Single ECS task with two containers replaces two NetworkLoadBalancedFargateServices.
        # Saves 2 NLBs (~$32-40/month). Preserves process isolation to prevent circular dependency
        # deadlocks between chat and table services via separate containers.
        # Uses Cloud Map service discovery (agent.emery.local) instead of NLB for internal routing.

        agent_image = self._get_agent_image()

        # COST-OPT: ARM64 (Graviton) ~20% cheaper per vCPU-hour than x86
        agent_task_definition = ecs.FargateTaskDefinition(
            self, f"{prefix}AgentTaskDef",
            cpu=1024,       # 1 vCPU shared across both containers
            memory_limit_mib=2048,  # 2 GB shared across both containers
            runtime_platform=ecs.RuntimePlatform(
                cpu_architecture=ecs.CpuArchitecture.ARM64,
                operating_system_family=ecs.OperatingSystemFamily.LINUX
            ),
        )

        # Add EFS volume for workspace storage (shared with frontend)
        agent_task_definition.add_volume(
            name="workspace-storage",
            efs_volume_configuration=ecs.EfsVolumeConfiguration(
                file_system_id=workspace_fs.file_system_id,
                transit_encryption="ENABLED",
                authorization_config=ecs.AuthorizationConfig(
                    access_point_id=workspace_access_point.access_point_id,
                    iam="ENABLED",
                ),
            ),
        )

        # Chat container (port 50051): AgentWorker + ChatProcessingService
        # SYS_PTRACE capability required for gVisor sandbox (ptrace platform)
        chat_container = agent_task_definition.add_container(
            f"{prefix}AgentChatContainer",
            image=agent_image,
            command=["python", "-m", "emery_agents.grpc.server", "--mode=chat", "--port=50051"],
            port_mappings=[ecs.PortMapping(container_port=50051)],
            environment={
                "GRPC_CHAT_MAX_WORKERS": "40",  # Increased from 20 for better concurrency
                "WORKSPACE_STORAGE_PATH": "/mnt/storage/workspaces",  # EFS mount for workspaces
            },
            secrets={
                "DATABASE_URL": ecs.Secret.from_secrets_manager(data_stack.db_instance.secret),
                **data_stack.app_secrets_map
            },
            logging=ecs.LogDrivers.aws_logs(
                stream_prefix=f"{prefix}-Agent-Chat",
                log_retention=log_retention,
            ),
            essential=True,  # Task restarts if chat container fails
            linux_parameters=ecs.LinuxParameters(
                self, f"{prefix}AgentChatLinuxParams",
                add_capabilities=[ecs.Capability.SYS_PTRACE],  # Required for gVisor sandbox
            ),
        )

        # Mount EFS workspace storage in chat container
        chat_container.add_mount_points(
            ecs.MountPoint(
                container_path="/mnt/storage/workspaces",
                source_volume="workspace-storage",
                read_only=False,
            )
        )

        # Table container (port 50052): TableService only
        table_container = agent_task_definition.add_container(
            f"{prefix}AgentTableContainer",
            image=agent_image,
            command=["python", "-m", "emery_agents.grpc.server", "--mode=table", "--port=50052"],
            port_mappings=[ecs.PortMapping(container_port=50052)],
            environment={
                "GRPC_TABLE_MAX_WORKERS": "30",  # Increased from 15 for better concurrency
            },
            secrets={
                "DATABASE_URL": ecs.Secret.from_secrets_manager(data_stack.db_instance.secret),
                **data_stack.app_secrets_map
            },
            logging=ecs.LogDrivers.aws_logs(
                stream_prefix=f"{prefix}-Agent-Table",
                log_retention=log_retention,
            ),
            essential=True,  # Task restarts if table container fails
        )

        # Create FargateService with Cloud Map discovery (no NLB needed)
        # COST-OPT: Mixed Fargate Spot strategy - 75% Spot for cost savings, 25% regular for reliability.
        # Base=1 ensures at least one task always runs on regular Fargate to handle requests
        # during Spot interruptions. Spot saves ~70% on compute costs.
        agent_service = ecs.FargateService(
            self, f"{prefix}AgentService",
            cluster=cluster,
            service_name=f"{prefix}-Agent",
            task_definition=agent_task_definition,
            desired_count=2,  # Increased from 1 for better availability
            vpc_subnets=ec2.SubnetSelection(
                subnet_type=ec2.SubnetType.PRIVATE_WITH_EGRESS
            ),
            cloud_map_options=ecs.CloudMapOptions(
                name="agent",  # Registers as agent.emery.local
                cloud_map_namespace=data_stack.namespace,
                dns_record_type=servicediscovery.DnsRecordType.A,
                dns_ttl=Duration.seconds(60)
            ),
            capacity_provider_strategies=[
                ecs.CapacityProviderStrategy(
                    capacity_provider="FARGATE_SPOT",
                    weight=3,  # 75% of scaled tasks use Spot
                ),
                ecs.CapacityProviderStrategy(
                    capacity_provider="FARGATE",
                    weight=1,  # 25% use regular Fargate
                    base=1,    # Always keep 1 task on regular Fargate for reliability
                ),
            ],
        )

        # Grant database access to merged agent service
        agent_service.connections.allow_to(
            data_stack.db_instance,
            ec2.Port.tcp(5432),
            "Allow merged agent service to access database"
        )

        # Allow inbound gRPC traffic from VPC CIDR on both ports
        # SECURITY: Restrict to VPC internal traffic only
        agent_service.connections.allow_from(
            ec2.Peer.ipv4(data_stack.vpc.vpc_cidr_block),
            ec2.Port.tcp(50051),
            "Allow internal gRPC chat traffic from VPC only"
        )
        agent_service.connections.allow_from(
            ec2.Peer.ipv4(data_stack.vpc.vpc_cidr_block),
            ec2.Port.tcp(50052),
            "Allow internal gRPC table traffic from VPC only"
        )

        # Grant Redis access for table container's write buffer
        agent_service.connections.allow_to(
            ec2.Connections(security_groups=[data_stack.redis_sg]),
            ec2.Port.tcp(6379),
            "Allow agent service to access ElastiCache Redis"
        )

        # Grant EFS access for workspace storage
        workspace_fs.connections.allow_default_port_from(agent_service)
        workspace_fs.connections.allow_default_port_from(frontend_service.service)

        # Add ECR permissions for agent service
        agent_task_definition.execution_role.add_managed_policy(
            iam.ManagedPolicy.from_aws_managed_policy_name("service-role/AmazonECSTaskExecutionRolePolicy")
        )
        agent_task_definition.execution_role.add_to_policy(
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

        # Configure deployment settings for agent service
        cfn_agent_service = agent_service.node.default_child
        cfn_agent_service.deployment_configuration = {
            "minimumHealthyPercent": 100,  # Keep existing task running during deployment
            "maximumPercent": 200  # Allow new task to start before old one stops
        }

        # Configure auto-scaling for merged agent service
        agent_scaling = agent_service.auto_scale_task_count(
            min_capacity=1,  # Start with 1 task
            max_capacity=10  # Scale up to 10 for heavy AI + table workload
        )
        agent_scaling.scale_on_cpu_utilization(
            "AgentCpuScaling",
            target_utilization_percent=70,
            scale_in_cooldown=Duration.seconds(180),
            scale_out_cooldown=Duration.seconds(60)
        )

        # ========== SERVICE ADDRESS CONFIGURATION ==========
        # Cloud Map DNS: agent.emery.local resolves to merged agent task IPs
        # Chat on port 50051, Table on port 50052 (same host, different ports)

        if frontend_service.task_definition.default_container:
            frontend_service.task_definition.default_container.add_environment(
                "WORKER_ADDRESS",
                "agent.emery.local:50051"  # Merged agent service
            )
            frontend_service.task_definition.default_container.add_environment(
                "GRPC_TOOLS_ADDRESS",
                "agent.emery.local:50052"  # Same task, different port
            )

            # Also inject the frontend's own public URL for NextAuth (use custom domain if available)
            nextauth_url = f"https://{custom_domain}" if custom_domain else f"https://{cloudfront_distribution.distribution_domain_name}"
            frontend_service.task_definition.default_container.add_environment(
                "NEXTAUTH_URL",
                nextauth_url
            )

        # Update scheduler environment variables for merged agent service
        scheduler_container.add_environment(
            "WORKER_ADDRESS",
            "agent.emery.local:50051"
        )
        scheduler_container.add_environment(
            "GRPC_TOOLS_ADDRESS",
            "agent.emery.local:50052"
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
        data_stack.storage_bucket.grant_read_write(agent_task_definition.task_role)  # Single grant for merged agent
        data_stack.storage_bucket.grant_read_write(scheduler_task_definition.task_role)

        # Inject the bucket name as an environment variable into services
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

        # Add S3, AWS, and callback config to chat container
        chat_container.add_environment("S3_BUCKET_NAME", data_stack.storage_bucket.bucket_name)
        chat_container.add_environment("AWS_ENDPOINT_URL", f"https://s3.{aws_region}.amazonaws.com")
        chat_container.add_environment("AWS_REGION", aws_region)
        # Use internal ALB URL to bypass CloudFront/WAF (faster, avoids rate limits)
        internal_nextjs_url = f"http://{frontend_service.load_balancer.load_balancer_dns_name}"
        chat_container.add_environment("NEXTJS_BASE_URL", internal_nextjs_url)

        # Add S3, AWS, and Redis config to table container
        # NOTE: REDIS_URL was previously missing from table service, causing the write buffer
        # to silently degrade to direct writes. Now enabled for proper buffered writes.
        table_container.add_environment("S3_BUCKET_NAME", data_stack.storage_bucket.bucket_name)
        table_container.add_environment("AWS_ENDPOINT_URL", f"https://s3.{aws_region}.amazonaws.com")
        table_container.add_environment("AWS_REGION", aws_region)
        table_container.add_environment("REDIS_URL", data_stack.redis_endpoint)

        # Add S3 and AWS configuration to scheduler service
        scheduler_container.add_environment(
            "S3_BUCKET_NAME",
            data_stack.storage_bucket.bucket_name
        )
        scheduler_container.add_environment(
            "AWS_ENDPOINT_URL",
            f"https://s3.{aws_region}.amazonaws.com"
        )
        scheduler_container.add_environment(
            "AWS_REGION",
            aws_region
        )
