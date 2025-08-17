# 1. Build the application
FROM node:20-alpine AS builder
WORKDIR /app

# Copy package files first for better caching
COPY package.json pnpm-lock.yaml ./
RUN apk add --no-cache git
RUN git config --global url."https://github.com/".insteadOf "git@github.com:"
RUN npm i -g pnpm

# AIDEV-NOTE: Use Docker cache mount for pnpm store to significantly speed up installs
RUN --mount=type=cache,target=/root/.local/share/pnpm \
    pnpm install --frozen-lockfile

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
RUN pnpm run build

# AIDEV-NOTE: Build bundled scheduler (single 1.3MB file, no dependencies)
RUN pnpm scheduler:build

# 2. Production image
FROM node:20-alpine AS runner
WORKDIR /app

RUN npm i -g pnpm && apk add --no-cache curl

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# AIDEV-NOTE: Use Next.js standalone build for web app + bundled scheduler
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

# AIDEV-NOTE: Copy bundled scheduler (single file, no dependencies needed)
COPY --from=builder /app/dist/scheduler.js ./scheduler.js

# Copy the entrypoint script
COPY entrypoint.sh .

EXPOSE 3000
ENTRYPOINT ["./entrypoint.sh"]
