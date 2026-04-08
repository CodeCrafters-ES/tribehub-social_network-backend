# ─────────────────────────────────────────────
# Stage 1 — builder
# Installs all deps (including devDeps), compiles
# TypeScript and generates the Prisma Client.
# ─────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Build tools required by native modules (argon2, pg)
RUN apk add --no-cache python3 make g++

# Enable corepack and activate the pinned pnpm version
RUN corepack enable && corepack prepare pnpm@9.15.9 --activate

# Copy manifest files first for better layer caching
COPY package.json pnpm-lock.yaml ./

# Copy Prisma schema before install so the postinstall
# hook (prisma generate) can find the schema
COPY prisma ./prisma/

# Install all dependencies (dev + prod) and run prisma generate
# via the postinstall hook
RUN pnpm install --frozen-lockfile

# Copy the rest of the source code
COPY . .

# Compile TypeScript → dist/
RUN pnpm run build

# ─────────────────────────────────────────────
# Stage 2 — runner
# Production image: no devDeps, no tsc.
# Only compiled output + production node_modules + Prisma CLI (copied from builder).
# ─────────────────────────────────────────────
FROM node:20-alpine AS runner

WORKDIR /app

# Build tools required by native modules (argon2, pg)
RUN apk add --no-cache python3 make g++

# Enable corepack and activate the pinned pnpm version
RUN corepack enable && corepack prepare pnpm@9.15.9 --activate

ENV NODE_ENV=production

# Copy manifest files from builder
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/pnpm-lock.yaml ./pnpm-lock.yaml

# Install production dependencies only.
# The postinstall hook calls `prisma generate` but prisma is a
# devDependency, so it will not be present here — the generated
# client is copied from the builder stage instead.
RUN pnpm install --frozen-lockfile --prod --ignore-scripts

# Copy compiled output from builder
COPY --from=builder /app/dist ./dist

# Copy Prisma schema + generated client from builder.
# The schema is needed by `prisma migrate deploy` at startup.
# The generated client is needed because prisma (devDep) is not
# installed in this stage and therefore did not re-generate it.
# Note: Prisma 7 with driver adapters generates the client entirely
# into node_modules/@prisma/client — node_modules/.prisma is not created.
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/@prisma/client ./node_modules/@prisma/client

# Copy the Prisma CLI from the builder so `prisma migrate deploy` in the
# CMD does not rely on npx downloading it from npm at runtime.
# prisma is a devDependency and is therefore absent from the prod install.
COPY --from=builder /app/node_modules/prisma ./node_modules/prisma
COPY --from=builder /app/node_modules/.bin/prisma ./node_modules/.bin/prisma

# Run as non-root user for security
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
RUN chown -R appuser:appgroup /app
USER appuser

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- http://localhost:3000/api/v1/health || exit 1

EXPOSE 3000

CMD ["sh", "-c", "node_modules/.bin/prisma migrate deploy && node --max-old-space-size=450 dist/src/main"]
