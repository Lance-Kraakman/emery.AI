from aws_cdk import (
    Stack,
    aws_ec2 as ec2,
    aws_ecs as ecs,
    aws_ecs_patterns as ecs_patterns,
    aws_rds as rds,
    aws_s3 as s3,
)
from constructs import Construct

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

        # Create the Fargate service for the Next.js frontend
        frontend_service = ecs_patterns.ApplicationLoadBalancedFargateService(
            self, f"{prefix}FrontendService",
            cluster=cluster,
            service_name=f"{prefix}-Frontend",
            cpu=512,
            memory_limit_mib=1024,
            desired_count=1, # Start with one instance
            task_image_options=ecs_patterns.ApplicationLoadBalancedTaskImageOptions(
                image=ecs.ContainerImage.from_asset(
                    "../", # Points to the Dockerfile in the root
                    exclude=[".venv", "node_modules", "cdk.out", ".git", "infra"]
                ),
                container_port=3000,
                secrets={
                    "DATABASE_URL": ecs.Secret.from_secrets_manager(
                        db_instance.secret, "postgres_connection_string"
                    )
                }
            ),
            public_load_balancer=True,
        )

        # Allow the frontend service to connect to the database
        db_instance.connections.allow_default_port_from(frontend_service.service)

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
                    "DATABASE_URL": ecs.Secret.from_secrets_manager(
                        db_instance.secret, "postgres_connection_string"
                    )
                }
            ),
            public_load_balancer=True,
        )

        # Allow the agent service to connect to the database
        db_instance.connections.allow_default_port_from(agent_service.service)

        # Pass the public DNS of the agent service's NLB to the frontend service
        if frontend_service.task_definition.default_container:
            frontend_service.task_definition.default_container.add_environment(
                "GRPC_AGENT_URL",
                f"http://{agent_service.load_balancer.load_balancer_dns_name}"
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
