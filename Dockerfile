FROM node:24-bookworm-slim

ENV NEXT_TELEMETRY_DISABLED=1
WORKDIR /app

ARG DATABASE_URL=file:/tmp/rpmanager-build.db
ARG NEXT_PUBLIC_DISCORD_INVITE_URL

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates openssl \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN node scripts/prepare-postgres-schema.mjs \
  && DATABASE_URL="postgresql://rpmanager:build-only@localhost:5432/rpmanager?schema=public" npx prisma generate --schema prisma/schema.postgresql.prisma \
  && npm run build \
  && mkdir -p /app/data \
  && chown -R node:node /app

ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV PORT=3000

USER node
EXPOSE 3000

CMD ["npm", "run", "start"]
