FROM node:20-slim

RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# Copy workspace config
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./

# Copy package.json files for all workspace packages
COPY packages/sdk/package.json packages/sdk/
COPY packages/backend/package.json packages/backend/

# Install dependencies
RUN pnpm install --frozen-lockfile --filter @stealth-card/sdk --filter @stealth-card/backend

# Copy source code
COPY packages/sdk/ packages/sdk/
COPY packages/backend/ packages/backend/

# Copy ZK circuit files (needed for proof generation)
COPY packages/contracts/build/circuits/withdraw_final.zkey packages/contracts/build/circuits/
COPY packages/contracts/build/circuits/withdraw_js/withdraw.wasm packages/contracts/build/circuits/withdraw_js/

# Build SDK
RUN pnpm --filter @stealth-card/sdk build

EXPOSE 3001

CMD ["node", "--import", "tsx", "packages/backend/src/index.ts"]
