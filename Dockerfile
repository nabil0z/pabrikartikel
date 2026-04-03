# ============================================
# Stage 1: Install Dependencies
# ============================================
FROM node:22-alpine AS deps
WORKDIR /app

COPY package.json package-lock.json* ./
COPY prisma ./prisma/
COPY prisma.config.ts ./

RUN npm ci

# ============================================
# Stage 2: Build Application
# ============================================
FROM node:22-alpine AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Generate Prisma Client
RUN npx prisma generate

# Build Next.js (standalone output)
RUN npm run build

# ============================================
# Stage 3: Production Runner
# ============================================
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Create non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy standalone build output
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

# Copy Prisma schema + generated client for runtime
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma.config.ts ./prisma.config.ts
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder /app/node_modules/prisma ./node_modules/prisma
COPY --from=builder /app/node_modules/better-sqlite3 ./node_modules/better-sqlite3
COPY --from=builder /app/node_modules/@prisma/adapter-better-sqlite3 ./node_modules/@prisma/adapter-better-sqlite3
COPY --from=builder /app/node_modules/google-trends-api ./node_modules/google-trends-api

# Ensure data directory is writable
RUN mkdir -p /app/data && chown nextjs:nodejs /app/data

# Auto-migrate database on startup then start server
RUN printf '#!/bin/sh\nnpx prisma db push --skip-generate\nexec node server.js\n' > /app/start.sh && chmod +x /app/start.sh

USER nextjs

# Port configurable via env, default 7171
EXPOSE 7171
ENV PORT=7171
ENV HOSTNAME="0.0.0.0"

CMD ["/app/start.sh"]
