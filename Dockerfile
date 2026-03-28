FROM node:20-alpine

WORKDIR /app

# Build tools needed for native modules (argon2, pg)
RUN apk add --no-cache python3 make g++

# Install pnpm
RUN npm install -g pnpm

# Copy package files and prisma schema first (better layer caching)
COPY package.json pnpm-lock.yaml ./
COPY prisma ./prisma/

# Install dependencies and generate Prisma client
RUN pnpm install --frozen-lockfile

# Copy source code (.dockerignore excludes node_modules and dist)
COPY . .

# Compile TypeScript to dist/
RUN pnpm run build

EXPOSE 3000

CMD ["node", "dist/main"]
