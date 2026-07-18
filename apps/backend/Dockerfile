# syntax=docker/dockerfile:1

FROM node:24.11.0-bookworm-slim AS base
WORKDIR /app
ENV npm_config_update_notifier=false

FROM base AS deps
COPY package.json package-lock.json ./
COPY apps/backend/package.json apps/backend/package.json
COPY apps/storefront/package.json apps/storefront/package.json
RUN npm ci --workspace @eshop/backend --include=dev

FROM deps AS build
COPY tsconfig.json ./
WORKDIR /app/apps/backend
COPY apps/backend/ ./
RUN NODE_OPTIONS=--max-old-space-size=1280 npm run build

FROM base AS runner
ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=9000
WORKDIR /app

COPY --from=build --chown=node:node /app/package.json /app/package-lock.json /app/tsconfig.json ./
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/apps/backend ./apps/backend

WORKDIR /app/apps/backend
USER node
EXPOSE 9000
CMD ["npm", "run", "start"]
