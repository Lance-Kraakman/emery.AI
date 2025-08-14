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
# The real values will be injected at runtime.
ARG DATABASE_URL="postgresql://dummy:dummy@dummy:5432/dummy"
ARG HF_TOKEN="dummy"
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

EXPOSE 3000
CMD ["node", "server.js"]
