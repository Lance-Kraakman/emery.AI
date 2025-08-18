FROM public.ecr.aws/lambda/nodejs:20

# Install required tools
RUN dnf install -y git && dnf clean all
RUN npm install -g pnpm

WORKDIR ${LAMBDA_TASK_ROOT}

# Copy migration files from project root (CDK builds from project root now)
COPY drizzle.config.ts ./
COPY lib/db ./lib/db/
COPY drizzle ./drizzle/

# Copy Lambda-specific files
COPY infra/lambda/migration-runner/package.json ./
RUN pnpm install

COPY infra/lambda/migration-runner/index.mjs ./

# Set the Lambda runtime handler
CMD [ "index.handler" ]
