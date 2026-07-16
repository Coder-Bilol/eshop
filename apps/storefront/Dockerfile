# syntax=docker/dockerfile:1

FROM node:24.11.0-bookworm-slim AS base
WORKDIR /app
ENV npm_config_update_notifier=false

FROM base AS deps
COPY package.json package-lock.json ./
COPY apps/backend/package.json apps/backend/package.json
COPY apps/storefront/package.json apps/storefront/package.json
RUN npm ci --workspaces --include=dev

FROM deps AS build
COPY apps/storefront apps/storefront
WORKDIR /app

ARG NEXT_PUBLIC_MEDUSA_BACKEND_URL=http://localhost:9000
ARG NEXT_PUBLIC_STOREFRONT_URL=http://localhost:3000
ARG NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY=pk_build_placeholder
ARG NEXT_PUBLIC_MEDUSA_SALES_CHANNEL_ID=sc_build_placeholder
ENV NEXT_PUBLIC_MEDUSA_BACKEND_URL=${NEXT_PUBLIC_MEDUSA_BACKEND_URL}
ENV NEXT_PUBLIC_STOREFRONT_URL=${NEXT_PUBLIC_STOREFRONT_URL}
ENV NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY=${NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY}
ENV NEXT_PUBLIC_MEDUSA_SALES_CHANNEL_ID=${NEXT_PUBLIC_MEDUSA_SALES_CHANNEL_ID}

RUN npm --workspace apps/storefront run build
RUN rm -f apps/storefront/.next/standalone/apps/storefront/.env

FROM base AS runner
ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV PORT=3000
WORKDIR /app

COPY --from=build --chown=node:node /app/apps/storefront/.next/standalone ./
COPY --from=build --chown=node:node /app/apps/storefront/.next/static ./apps/storefront/.next/static
COPY --from=build --chown=node:node /app/apps/storefront/public ./apps/storefront/public

WORKDIR /app/apps/storefront
USER node
EXPOSE 3000
CMD ["node", "server.js"]
