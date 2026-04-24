FROM node:20-alpine

RUN npm install -g pnpm

WORKDIR /app

# Copy monorepo files
COPY pnpm-lock.yaml package.json pnpm-workspace.yaml ./
COPY apps/worker/package.json ./apps/worker/
COPY packages/ ./packages/

# Install deps from root (resolves workspace packages)
RUN pnpm install --frozen-lockfile

# Copy source and build
COPY apps/worker/ ./apps/worker/
RUN pnpm --filter @football/worker build

CMD ["node", "apps/worker/dist/index.js"]
