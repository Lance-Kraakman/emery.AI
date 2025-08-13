# 1. Install dependencies
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN npm i -g pnpm && pnpm fetch

# 2. Build the application
FROM node:20-alpine AS builder
WORKDIR /app
COPY . .
RUN npm i -g pnpm && pnpm install --frozen-lockfile --offline
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
