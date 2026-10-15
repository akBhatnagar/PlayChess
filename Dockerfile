FROM node:22.23.3-bookworm-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@10.33.4 --activate

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY apps/web/package.json apps/web/package.json
COPY apps/api/package.json apps/api/package.json
COPY packages/chess-core/package.json packages/chess-core/package.json
COPY packages/theme-config/package.json packages/theme-config/package.json
COPY packages/validation/package.json packages/validation/package.json
COPY prisma prisma

RUN pnpm install --frozen-lockfile

COPY . .

RUN pnpm exec prisma generate \
  && pnpm --filter @playchess/web build \
  && pnpm --filter @playchess/api build

ENV NODE_ENV=production
EXPOSE 4318

CMD ["node", "apps/api/dist/server.js"]
