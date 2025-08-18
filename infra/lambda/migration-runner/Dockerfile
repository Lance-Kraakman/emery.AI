FROM public.ecr.aws/lambda/nodejs:20

# Install required tools
RUN dnf install -y git && dnf clean all
RUN npm install -g pnpm

WORKDIR ${LAMBDA_TASK_ROOT}

# Copy migration-specific files (copied to Lambda directory)
COPY drizzle.config.ts ./
COPY lib/db ./lib/db/
COPY drizzle ./drizzle/

# Create migrations directory if it doesn't exist (fallback)
RUN mkdir -p lib/db/migrations

# Copy Lambda-specific package.json and install minimal dependencies
COPY package.json ./
RUN pnpm install

# Copy Lambda handler
COPY index.mjs ./

# Set the Lambda runtime handler
CMD [ "index.handler" ]
