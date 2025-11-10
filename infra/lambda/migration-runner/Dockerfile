FROM public.ecr.aws/lambda/nodejs:20

RUN npm install -g pnpm

WORKDIR ${LAMBDA_TASK_ROOT}

# Copy project files
COPY drizzle.config.ts ./
COPY lib/ ./lib/
COPY drizzle/ ./drizzle/

# Copy unified metadata for tool seeding
COPY src/lib/data/unified_metadata.json ./src/lib/data/unified_metadata.json

# Copy Lambda files
COPY package.json ./
RUN pnpm install

COPY index.mjs ./

CMD [ "index.handler" ]