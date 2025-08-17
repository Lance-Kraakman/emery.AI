# 1. Build the application
FROM node:20-alpine AS builder
WORKDIR /app

# Copy package files first for better caching
COPY package.json pnpm-lock.yaml ./
RUN apk add --no-cache git
RUN git config --global url."https://github.com/".insteadOf "git@github.com:"
RUN npm i -g pnpm
RUN pnpm install --frozen-lockfile

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

# 2. Production image
FROM node:20-alpine AS runner
WORKDIR /app

RUN npm i -g pnpm && apk add --no-cache curl

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# AIDEV-NOTE: Use normal Next.js build (not standalone) with full dependencies
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/pnpm-lock.yaml ./pnpm-lock.yaml
COPY --from=builder /app/tsconfig.json ./tsconfig.json
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/scripts ./scripts
COPY --from=builder /app/lib ./lib
COPY --from=builder /app/proto ./proto

# Copy the entrypoint script
COPY entrypoint.sh .

EXPOSE 3000
ENTRYPOINT ["./entrypoint.sh"]
