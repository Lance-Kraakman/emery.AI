FROM public.ecr.aws/lambda/nodejs:20

# Install pnpm
RUN npm install -g pnpm

WORKDIR ${LAMBDA_TASK_ROOT}

# Copy main project files needed for migration (from root of repo)
COPY ../../../package.json ../../../pnpm-lock.yaml ./
COPY ../../../drizzle.config.ts ./
COPY ../../../lib/db ./lib/db/

# Install all dependencies (including drizzle-kit)  
RUN pnpm install --frozen-lockfile

# Copy Lambda-specific files (from current directory)
COPY package.json ./lambda-package.json
COPY index.mjs ./

# Set the Lambda runtime handler
CMD [ "index.handler" ]
