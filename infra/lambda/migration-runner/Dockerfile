FROM public.ecr.aws/lambda/nodejs:20

# Install required tools
RUN dnf install -y git && dnf clean all
RUN npm install -g pnpm

WORKDIR ${LAMBDA_TASK_ROOT}

# Copy migration files (copied to build directory by prepare script)
COPY drizzle.config.ts ./
COPY lib/ ./lib/
COPY drizzle/ ./drizzle/

# Copy Lambda-specific files
COPY package.json ./
RUN pnpm install

COPY index.mjs ./

# Set the Lambda runtime handler
CMD [ "index.handler" ]
