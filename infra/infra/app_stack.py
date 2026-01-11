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

        # ========== ECR REPOSITORIES WITH LIFECYCLE POLICIES ==========
        # Shared lifecycle rules for all repositories
        ecr_lifecycle_rules = [
            ecr.LifecycleRule(
                description="Delete untagged images after 1 day",
                tag_status=ecr.TagStatus.UNTAGGED,
                max_image_age=Duration.days(1),
            ),
            ecr.LifecycleRule(
                description="Keep only last 10 tagged images",
                tag_status=ecr.TagStatus.TAGGED,
                tag_prefix_list=["develop-", "pr-", "tag-"],
                max_image_count=10,
            ),
        ]

        # Frontend container repository
        self.frontend_repo = ecr.Repository(
            self, "FrontendRepo",
            repository_name="emery/frontend",
            image_scan_on_push=True,
            lifecycle_rules=ecr_lifecycle_rules,
            removal_policy=RemovalPolicy.RETAIN,  # Don't delete repo on stack deletion
        )

        # Agent container repository
        self.agent_repo = ecr.Repository(
            self, "AgentRepo",
            repository_name="emery/agent",
            image_scan_on_push=True,
            lifecycle_rules=ecr_lifecycle_rules,
            removal_policy=RemovalPolicy.RETAIN,
        )

        # ========== CUSTOM DOMAIN CONFIGURATION ==========
        # Domain and certificate configuration per environment
        domain_config = {
            "production": {
                "domain": "braintable.app",
                "certificate_arn": "arn:aws:acm:us-east-1:034165313651:certificate/c95eb22e-f4d8-4874-b381-f7a2cdaecc1a"
            },
            "staging": {
                "domain": "staging.braintable.app",
                "certificate_arn": "arn:aws:acm:us-east-1:772302459598:certificate/3cb8f028-6cfc-404f-bd9c-315ee0f77a1d"
            },
            "dev": {
                "domain": "dev.braintable.app",
                "certificate_arn": "arn:aws:acm:us-east-1:463735866328:certificate/2d76beac-68ca-4e75-8cb2-29c4e61b195c"
            },
        }

        custom_domain = domain_config.get(env_name, {}).get("domain")
        certificate_arn = domain_config.get(env_name, {}).get("certificate_arn")

        # ========== ENVIRONMENT-SPECIFIC RESOURCE SIZING ==========
        # Configure resources based on environment needs
        sizing_config = {
            "production": {
                "frontend_min_capacity": 2,   # HA for paying users
                "chat_cpu": 512,              # 0.5 vCPU - LLM calls are I/O bound
                "chat_memory": 1024,          # 1 GB sufficient for chat
            },
            "staging": {
                "frontend_min_capacity": 1,
                "chat_cpu": 512,
                "chat_memory": 1024,
            },
            "dev": {
                "frontend_min_capacity": 1,   # Single task for dev
                "chat_cpu": 512,
                "chat_memory": 1024,
            }
        }
        sizing = sizing_config.get(env_name, sizing_config["dev"])

        # Import the ACM certificate (created in us-east-1 for CloudFront)
        certificate = None
        if certificate_arn:
            certificate = acm.Certificate.from_certificate_arn(
                self, f"{prefix}Certificate",
                certificate_arn=certificate_arn
            )

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
            environment={
                "REDIS_URL": data_stack.redis_endpoint,  # ElastiCache for caching
            },
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
            timeout=Duration.seconds(10),
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
            max_capacity=20  # Can scale up to 20 tasks during traffic spikes
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
                    timeout=Duration.seconds(10),
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
        alb_origin = origins.LoadBalancerV2Origin(
            frontend_service.load_balancer,
            protocol_policy=cloudfront.OriginProtocolPolicy.HTTP_ONLY
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
            price_class=cloudfront.PriceClass.PRICE_CLASS_ALL  # All edge locations including APAC (Sydney)
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
            cpu=sizing["chat_cpu"],  # Environment-specific - LLM calls are I/O bound
            memory_limit_mib=sizing["chat_memory"],  # Environment-specific
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
            health_check_grace_period=Duration.seconds(600),  # Increased from 300s to allow for large image download
            cloud_map_options=ecs.CloudMapOptions(
                name="agent-chat",
                cloud_map_namespace=data_stack.namespace,
                dns_record_type=servicediscovery.DnsRecordType.A,
                dns_ttl=Duration.seconds(60)
            ),
        )

        # Grant database access to chat service
        agent_chat_service.service.connections.allow_to(
            data_stack.db_instance,
            ec2.Port.tcp(5432),
            "Allow agent chat service to access database"
        )

        # Allow NLB health checks and traffic on gRPC port - VPC CIDR only
        # SECURITY: Restrict to VPC internal traffic only (fixes 0.0.0.0/0 exposure)
        agent_chat_service.service.connections.allow_from(
            ec2.Peer.ipv4(data_stack.vpc.vpc_cidr_block),
            ec2.Port.tcp(50051),
            "Allow internal gRPC traffic from VPC only"
        )

        # Set custom command for chat service container
        cfn_chat_task_def = agent_chat_service.task_definition.node.default_child
        cfn_chat_task_def.add_property_override(
            "ContainerDefinitions.0.Command",
            ["python", "-m", "emery_agents.grpc.server", "--mode=chat", "--port=50051"]
        )

        # Configure TCP health check for chat service
        agent_chat_service.target_group.configure_health_check(
            protocol=elbv2.Protocol.TCP,
            port="50051",  # Port as string (CDK requirement)
            interval=Duration.seconds(30),
            timeout=Duration.seconds(10),
            healthy_threshold_count=3,  # Increased from 2 for more lenient checks
            unhealthy_threshold_count=3,  # Increased from 2 to avoid premature task kills
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
            "minimumHealthyPercent": 100,  # Keep existing task running during deployment
            "maximumPercent": 200  # Allow new task to start before old one stops
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
            health_check_grace_period=Duration.seconds(600),  # Increased from 300s to allow for large image download
            cloud_map_options=ecs.CloudMapOptions(
                name="agent-table",
                cloud_map_namespace=data_stack.namespace,
                dns_record_type=servicediscovery.DnsRecordType.A,
                dns_ttl=Duration.seconds(60)
            ),
        )

        # Grant database access to table service
        agent_table_service.service.connections.allow_to(
            data_stack.db_instance,
            ec2.Port.tcp(5432),
            "Allow agent table service to access database"
        )

        # Allow NLB health checks and traffic on gRPC port - VPC CIDR only
        # SECURITY: Restrict to VPC internal traffic only (fixes 0.0.0.0/0 exposure)
        agent_table_service.service.connections.allow_from(
            ec2.Peer.ipv4(data_stack.vpc.vpc_cidr_block),
            ec2.Port.tcp(50052),
            "Allow internal gRPC traffic from VPC only"
        )

        # Set custom command for table service container
        cfn_table_task_def = agent_table_service.task_definition.node.default_child
        cfn_table_task_def.add_property_override(
            "ContainerDefinitions.0.Command",
            ["python", "-m", "emery_agents.grpc.server", "--mode=table", "--port=50052"]
        )

        # Configure TCP health check for table service
        agent_table_service.target_group.configure_health_check(
            protocol=elbv2.Protocol.TCP,
            port="50052",  # Port as string (CDK requirement)
            interval=Duration.seconds(30),
            timeout=Duration.seconds(10),
            healthy_threshold_count=3,  # Increased from 2 for more lenient checks
            unhealthy_threshold_count=3,  # Increased from 2 to avoid premature task kills
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
            "minimumHealthyPercent": 100,  # Keep existing task running during deployment
            "maximumPercent": 200  # Allow new task to start before old one stops
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

            # Also inject the frontend's own public URL for NextAuth (use custom domain if available)
            nextauth_url = f"https://{custom_domain}" if custom_domain else f"https://{cloudfront_distribution.distribution_domain_name}"
            frontend_service.task_definition.default_container.add_environment(
                "NEXTAUTH_URL",
                nextauth_url
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
            # Add NextJS base URL for agent callbacks to API routes (use custom domain if available)
            nextjs_base_url = f"https://{custom_domain}" if custom_domain else f"https://{cloudfront_distribution.distribution_domain_name}"
            agent_chat_service.task_definition.default_container.add_environment(
                "NEXTJS_BASE_URL",
                nextjs_base_url
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
