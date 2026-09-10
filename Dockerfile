# Build the Vite client and TypeScript API together so production uses one origin.
FROM node:20-bookworm-slim AS client-build
WORKDIR /app/client
COPY client/package*.json ./
RUN npm ci
COPY client/ ./
RUN npm run build

FROM node:20-bookworm-slim AS server-build
WORKDIR /app/server
COPY server/package*.json ./
RUN npm ci
COPY server/ ./
RUN npm run build

FROM node:20-bookworm-slim AS production
ENV NODE_ENV=production
WORKDIR /app/server
COPY --from=server-build /app/server/package*.json ./
COPY --from=server-build /app/server/node_modules ./node_modules
COPY --from=server-build /app/server/dist ./dist
COPY --from=server-build /app/server/scripts ./scripts
COPY --from=client-build /app/client/dist /app/client/dist
EXPOSE 3001
CMD ["sh", "-c", "node scripts/bootstrap-production.mjs && node --experimental-specifier-resolution=node dist/index.js"]
