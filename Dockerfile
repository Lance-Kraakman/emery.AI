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
    pnpm install --frozen-lockfile

# Set dummy secrets during build to allow Next.js to build.
# The real values will be injected at runtime from AWS Secrets Manager.
ARG DATABASE_URL="postgresql://dummy:dummy@dummy:5432/dummy"
ARG NEXTAUTH_SECRET="dummy"
ARG GITHUB_CLIENT_ID="dummy"
ARG GITHUB_CLIENT_SECRET="dummy"
ARG PIPEDREAM_PROJECT_ID="dummy"
ARG PIPEDREAM_CLIENT_ID="dummy"
ARG PIPEDREAM_CLIENT_SECRET="dummy"
ARG PIPEDREAM_API_KEY="dummy"
ARG OPENAI_API_KEY="dummy"
ARG HF_TOKEN="dummy"
ARG RESEND_API_KEY="dummy"
RUN pnpm run build

# 3. Production image
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED 1

# Copy the standalone output
COPY --from=builder /app/.next/standalone ./
# Copy static assets
COPY --from=builder /app/.next/static ./.next/static
# Copy public assets
COPY --from=builder /app/public ./public

# Copy the entrypoint script
COPY entrypoint.sh .

EXPOSE 3000
ENTRYPOINT ["./entrypoint.sh"]
