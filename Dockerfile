# 1. Build the application - using Debian for native module compatibility
FROM node:22-bookworm-slim AS builder
WORKDIR /app

# Copy package files first for better caching
COPY package.json pnpm-lock.yaml ./
# Install build dependencies for native modules (DuckDB, Sharp, etc.)
RUN apt-get update && apt-get install -y \
    git \
    python3 \
    make \
    g++ \
    libvips-dev \
    && rm -rf /var/lib/apt/lists/*
RUN git config --global url."https://github.com/".insteadOf "git@github.com:"
RUN npm i -g pnpm
RUN pnpm install @duckdb/node-api

# AIDEV-NOTE: Install dependencies with frozen lockfile for cache efficiency
RUN pnpm install --frozen-lockfile

# AIDEV-NOTE: Temporarily remove LlamaIndex packages to fix build issues
RUN pnpm remove @llamaindex/chat-ui @llamaindex/readers @llamaindex/core @llamaindex/env @llamaindex/cloud llamaindex || true

# Copy source code after dependencies are installed
COPY . .

# AIDEV-NOTE: Set minimal build environment variables for Next.js build
# The real values will be injected at runtime from AWS Secrets Manager.
ENV DATABASE_URL="postgresql://build:build@localhost:5432/build"
ENV NEXTAUTH_SECRET="build-dummy-secret"
ENV HF_TOKEN="build-dummy-token"
ENV NEXTAUTH_URL="http://localhost:3000"
ENV GITHUB_CLIENT_ID="build-dummy-client-id"
ENV GITHUB_CLIENT_SECRET="build-dummy-client-secret"
ENV RESEND_API_KEY="build-dummy-resend-key"

# Set NODE_ENV to development for build to enable non-minified errors and dev features
ENV NODE_ENV=development
RUN pnpm run build

# AIDEV-NOTE: Skip bundled scheduler, use tsx directly to avoid bundling issues

# 2. Production image - using Debian for native module compatibility
FROM node:22-bookworm-slim AS runner
WORKDIR /app

RUN apt-get update && apt-get install -y \
    curl \
    libvips42 \
    && rm -rf /var/lib/apt/lists/* \
    && npm i -g pnpm

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# AIDEV-NOTE: Use regular Next.js build with node_modules (faster build time)
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/public ./public

# AIDEV-NOTE: Copy source files needed for tsx execution
COPY --from=builder /app/scripts ./scripts
COPY --from=builder /app/lib ./lib
COPY --from=builder /app/app ./app
COPY --from=builder /app/ddd ./ddd
COPY --from=builder /app/tsconfig.json ./tsconfig.json

# AIDEV-NOTE: Copy proto files needed by scheduler at runtime
COPY --from=builder /app/proto ./proto

# AIDEV-NOTE: Copy database migration files
COPY --from=builder /app/drizzle.config.ts ./drizzle.config.ts
COPY --from=builder /app/drizzle ./drizzle

# Copy the entrypoint script
COPY entrypoint.sh .

EXPOSE 3000
ENTRYPOINT ["./entrypoint.sh"]
