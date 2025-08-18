FROM public.ecr.aws/lambda/nodejs:20

# Install required tools
RUN dnf install -y git && dnf clean all
RUN npm install -g pnpm

WORKDIR ${LAMBDA_TASK_ROOT}

# Copy migration-specific files
COPY drizzle.config.ts ./
COPY lib/db ./lib/db/

# Create migrations directory if it doesn't exist
RUN mkdir -p lib/db/migrations

# Copy Lambda-specific package.json and install minimal dependencies
COPY infra/lambda/migration-runner/package.json ./
RUN pnpm install

# Copy Lambda handler
COPY infra/lambda/migration-runner/index.mjs ./

# Set the Lambda runtime handler
CMD [ "index.handler" ]
