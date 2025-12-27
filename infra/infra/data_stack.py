from aws_cdk import (
    Stack,
    RemovalPolicy,
    aws_ec2 as ec2,
    aws_ecs as ecs,
    aws_rds as rds,
    aws_s3 as s3,
    aws_secretsmanager as secretsmanager,
    aws_servicediscovery as servicediscovery,
    Duration,
    CfnOutput,
)
from constructs import Construct


class DataStack(Stack):
    """
    Data Stack - Contains stateful/persistent infrastructure:
    - VPC with public/private subnets
    - RDS PostgreSQL database
    - S3 bucket for file storage
    - Secrets Manager references
    - CloudMap private DNS namespace
    - Security groups
    """

    def __init__(self, scope: Construct, construct_id: str, env_name: str, **kwargs) -> None:
        super().__init__(scope, construct_id, **kwargs)

        prefix = env_name.capitalize()

        # Default AWS region - can be overridden by CDK context
        aws_region = 'ap-southeast-2'

        # ========== VPC ==========
        # Create a new VPC for our application
        # This will create public and private subnets across 2 Availability Zones by default
        self.vpc = ec2.Vpc(
            self, f"{prefix}EmeryVpc",
            max_azs=2,
            nat_gateways=1,
        )

        # ========== VPC ENDPOINTS ==========
        # S3 Gateway Endpoint - FREE, routes S3 traffic through VPC instead of NAT
        self.vpc.add_gateway_endpoint(
            f"{prefix}S3Endpoint",
            service=ec2.GatewayVpcEndpointAwsService.S3,
        )

        # ECR Endpoints - ~$7/month but saves $50+ in NAT data transfer for image pulls
        self.vpc.add_interface_endpoint(
            f"{prefix}EcrApiEndpoint",
            service=ec2.InterfaceVpcEndpointAwsService.ECR,
        )
        self.vpc.add_interface_endpoint(
            f"{prefix}EcrDkrEndpoint",
            service=ec2.InterfaceVpcEndpointAwsService.ECR_DOCKER,
        )

        # ========== DATABASE ==========
        # Create parameter group to allow non-SSL connections and preload extensions
        db_parameter_group = rds.ParameterGroup(
            self, f"{prefix}PostgresParams",
            engine=rds.DatabaseInstanceEngine.postgres(
                version=rds.PostgresEngineVersion.VER_16_9
            ),
            parameters={
                "rds.force_ssl": "0"  # Allow non-SSL connections for development
            }
        )

        # Create a PostgreSQL database instance in RDS
        # This will be placed in the private subnets of our VPC
        self.db_instance = rds.DatabaseInstance(
            self, f"{prefix}PostgresDB",
            engine=rds.DatabaseInstanceEngine.postgres(
                version=rds.PostgresEngineVersion.VER_16_9
            ),
            instance_type=ec2.InstanceType.of(
                ec2.InstanceClass.BURSTABLE4_GRAVITON, ec2.InstanceSize.MICRO
            ),
            vpc=self.vpc,
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
            removal_policy=RemovalPolicy.RETAIN,  # Protect database from accidental deletion
        )

        # ========== SECURITY GROUPS ==========
        # Create a shared security group for DB clients
        self.db_client_sg = ec2.SecurityGroup(
            self, f"{prefix}DbClientSg",
            vpc=self.vpc,
            description="Security group for clients connecting to the RDS database"
        )

        # Allow traffic from the shared SG to the database
        self.db_instance.connections.allow_default_port_from(self.db_client_sg)

        # Create security group for bastion host
        bastion_sg = ec2.SecurityGroup(
            self, f"{prefix}BastionSecurityGroup",
            vpc=self.vpc,
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
            vpc=self.vpc,
            instance_type=ec2.InstanceType.of(ec2.InstanceClass.T3, ec2.InstanceSize.MICRO),
            machine_image=ec2.MachineImage.latest_amazon_linux2(),
            vpc_subnets=ec2.SubnetSelection(subnet_type=ec2.SubnetType.PUBLIC),
            security_group=bastion_sg,
            key_pair=ec2.KeyPair.from_key_pair_name(
                self, f"{prefix}BastionKeyPair",
                f"{env_name}-bastion-machine"  # Environment-specific key pair
            ),
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
        self.db_instance.connections.allow_default_port_from(bastion_host, "Allow bastion host access")

        # AIDEV-NOTE: Create security groups for dual-port gRPC architecture
        # Chat service on port 50051, Table service on port 50052

        # Create security group for chat gRPC service (port 50051)
        self.chat_grpc_sg = ec2.SecurityGroup(
            self, f"{prefix}ChatGrpcSg",
            vpc=self.vpc,
            description="Security group for chat gRPC service (port 50051)"
        )
        self.chat_grpc_sg.add_ingress_rule(
            peer=ec2.Peer.any_ipv4(),
            connection=ec2.Port.tcp(50051),
            description="Allow gRPC traffic on port 50051"
        )

        # Create security group for table gRPC service (port 50052)
        self.table_grpc_sg = ec2.SecurityGroup(
            self, f"{prefix}TableGrpcSg",
            vpc=self.vpc,
            description="Security group for table gRPC service (port 50052)"
        )
        self.table_grpc_sg.add_ingress_rule(
            peer=ec2.Peer.any_ipv4(),
            connection=ec2.Port.tcp(50052),
            description="Allow gRPC traffic on port 50052"
        )

        # ========== SECRETS MANAGER ==========
        # Look up the application secrets from AWS Secrets Manager
        self.app_secrets_object = secretsmanager.Secret.from_secret_name_v2(
            self, "AppSecretsObject",
            secret_name=f"emery-app-secrets/{env_name}"
        )

        # Define the secrets mapping for the ECS task definition
        self.app_secrets_map = {
            "NEXTAUTH_SECRET": ecs.Secret.from_secrets_manager(self.app_secrets_object, "NEXTAUTH_SECRET"),
            "GITHUB_CLIENT_ID": ecs.Secret.from_secrets_manager(self.app_secrets_object, "GITHUB_CLIENT_ID"),
            "GITHUB_CLIENT_SECRET": ecs.Secret.from_secrets_manager(self.app_secrets_object, "GITHUB_CLIENT_SECRET"),
            "PIPEDREAM_PROJECT_ID": ecs.Secret.from_secrets_manager(self.app_secrets_object, "PIPEDREAM_PROJECT_ID"),
            "PIPEDREAM_CLIENT_ID": ecs.Secret.from_secrets_manager(self.app_secrets_object, "PIPEDREAM_CLIENT_ID"),
            "PIPEDREAM_CLIENT_SECRET": ecs.Secret.from_secrets_manager(self.app_secrets_object, "PIPEDREAM_CLIENT_SECRET"),
            "PIPEDREAM_API_KEY": ecs.Secret.from_secrets_manager(self.app_secrets_object, "PIPEDREAM_API_KEY"),
            "OPENAI_API_KEY": ecs.Secret.from_secrets_manager(self.app_secrets_object, "OPENAI_API_KEY"),
            "HF_TOKEN": ecs.Secret.from_secrets_manager(self.app_secrets_object, "HF_TOKEN"),
            "GEMINI_API_KEY": ecs.Secret.from_secrets_manager(self.app_secrets_object, "GEMINI_API_KEY"),
            "RESEND_API_KEY": ecs.Secret.from_secrets_manager(self.app_secrets_object, "RESEND_API_KEY"),
            # AWS S3 credentials for cloud deployment
            "AWS_ACCESS_KEY_ID": ecs.Secret.from_secrets_manager(self.app_secrets_object, "AWS_ACCESS_KEY_ID"),
            "AWS_SECRET_ACCESS_KEY": ecs.Secret.from_secrets_manager(self.app_secrets_object, "AWS_SECRET_ACCESS_KEY"),
            # Stripe billing configuration
            "STRIPE_SECRET_KEY": ecs.Secret.from_secrets_manager(self.app_secrets_object, "STRIPE_SECRET_KEY"),
            "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY": ecs.Secret.from_secrets_manager(self.app_secrets_object, "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY"),
            "STRIPE_PRO_PRODUCT_ID": ecs.Secret.from_secrets_manager(self.app_secrets_object, "STRIPE_PRO_PRODUCT_ID"),
            "STRIPE_PRO_PRICE_ID_MONTHLY": ecs.Secret.from_secrets_manager(self.app_secrets_object, "STRIPE_PRO_PRICE_ID_MONTHLY"),
            "STRIPE_PRO_PRICE_ID_YEARLY": ecs.Secret.from_secrets_manager(self.app_secrets_object, "STRIPE_PRO_PRICE_ID_YEARLY"),
            "STRIPE_MAX_PRODUCT_ID": ecs.Secret.from_secrets_manager(self.app_secrets_object, "STRIPE_MAX_PRODUCT_ID"),
            "STRIPE_MAX_PRICE_ID_MONTHLY": ecs.Secret.from_secrets_manager(self.app_secrets_object, "STRIPE_MAX_PRICE_ID_MONTHLY"),
            "STRIPE_MAX_PRICE_ID_YEARLY": ecs.Secret.from_secrets_manager(self.app_secrets_object, "STRIPE_MAX_PRICE_ID_YEARLY"),
            "STRIPE_ENTERPRISE_PRODUCT_ID": ecs.Secret.from_secrets_manager(self.app_secrets_object, "STRIPE_ENTERPRISE_PRODUCT_ID"),
        }

        # ========== CLOUD MAP ==========
        # Create Cloud Map namespace for service discovery
        self.namespace = servicediscovery.PrivateDnsNamespace(
            self, f"{prefix}ServiceNamespace",
            vpc=self.vpc,
            name="emery.local",
            description="Internal service discovery for Emery application"
        )

        # ========== S3 BUCKET ==========
        # Create an S3 bucket for file storage
        self.storage_bucket = s3.Bucket(
            self, f"{prefix}StorageBucket",
            bucket_name=f"{prefix.lower()}-emery-storage-{self.account}",
            block_public_access=s3.BlockPublicAccess.BLOCK_ALL,
            encryption=s3.BucketEncryption.S3_MANAGED,
            enforce_ssl=True,
            versioned=True, # Good practice for production
            removal_policy=RemovalPolicy.RETAIN,  # Protect bucket from accidental deletion
        )

        # ========== OUTPUTS ==========
        CfnOutput(self, "VpcId", value=self.vpc.vpc_id, description="VPC ID")
        CfnOutput(self, "DatabaseEndpoint", value=self.db_instance.db_instance_endpoint_address, description="Database endpoint")
        CfnOutput(self, "BucketName", value=self.storage_bucket.bucket_name, description="S3 bucket name")
        CfnOutput(self, "BastionPublicIp", value=bastion_host.instance_public_ip, description="Bastion host public IP")
