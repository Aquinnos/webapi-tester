# Kontekst budowania musi obejmować całe repozytorium (monorepo pnpm):
#   docker build -f apps/proxy/Dockerfile -t webapi-tester-agent .

FROM node:20-alpine AS build
RUN npm install -g pnpm@9.12.1
WORKDIR /app

COPY pnpm-workspace.yaml package.json pnpm-lock.yaml tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/package.json
COPY apps/proxy/package.json apps/proxy/package.json
RUN pnpm install --frozen-lockfile --filter @webapi-tester/proxy...

COPY packages/shared packages/shared
COPY apps/proxy apps/proxy
RUN pnpm --filter @webapi-tester/proxy build
RUN pnpm --filter @webapi-tester/proxy deploy --prod /out

FROM node:20-alpine AS runtime
ENV NODE_ENV=production
ENV PROXY_BIND_HOST=0.0.0.0
ENV PROXY_KEY_FILE=/app/data/agent-key
WORKDIR /app

COPY --from=build /out ./
RUN mkdir -p /app/data && chown -R node:node /app
USER node

EXPOSE 3002
CMD ["node", "dist/index.js"]
