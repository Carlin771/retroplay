# ---- Build ----
FROM node:22-bookworm-slim AS build
WORKDIR /app
# Ferramentas para compilar módulos nativos (better-sqlite3) caso não haja binário pronto.
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ ca-certificates \
  && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npx prisma generate && npm run build

# ---- Runtime ----
FROM node:22-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates \
  && rm -rf /var/lib/apt/lists/*
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/.next ./.next
COPY --from=build /app/public ./public
COPY --from=build /app/src ./src
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/scripts ./scripts
COPY --from=build /app/package.json /app/package-lock.json ./
COPY --from=build /app/next.config.ts /app/prisma.config.ts /app/tsconfig.json ./
EXPOSE 3000
# Aplica o schema no banco e sobe o servidor.
CMD ["sh", "-c", "npx prisma db push && npm run start"]
