# 1. Install dependencies
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN apk add --no-cache git && npm i -g pnpm && pnpm fetch

# 2. Build the application
FROM node:20-alpine AS builder
WORKDIR /app
COPY . .
RUN apk add --no-cache git && \
    git config --global url."https://github.com/".insteadOf "git@github.com:" && \
    npm i -g pnpm && \
    pnpm install

# AIDEV-NOTE: Set minimal build environment variables for Next.js build
# The real values will be injected at runtime from AWS Secrets Manager.
ENV DATABASE_URL="postgresql://build:build@localhost:5432/build"
ENV NEXTAUTH_SECRET="build-dummy-secret"
RUN pnpm run build

# 3. Production image
FROM node:20-alpine AS runner
WORKDIR /app

RUN npm i -g pnpm

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
