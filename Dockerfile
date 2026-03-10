FROM node:22-alpine AS build
WORKDIR /app

COPY package*.json ./
COPY apps/backend/package.json apps/backend/package.json
COPY apps/frontend/package.json apps/frontend/package.json
COPY packages/shared/package.json packages/shared/package.json

RUN npm install

COPY . .

RUN npm run build --workspace @remote-docker/shared \
  && npm run build --workspace @remote-docker/backend \
  && npm run build --workspace @remote-docker/frontend \
  && npx prisma generate --schema apps/backend/prisma/schema.prisma

FROM node:22-alpine AS runtime
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=4000

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package*.json ./
COPY --from=build /app/apps/backend/package.json ./apps/backend/package.json
COPY --from=build /app/apps/backend/dist ./apps/backend/dist
COPY --from=build /app/apps/backend/prisma ./apps/backend/prisma
COPY --from=build /app/apps/frontend/dist ./apps/frontend/dist
COPY --from=build /app/packages/shared/package.json ./packages/shared/package.json
COPY --from=build /app/packages/shared/dist ./packages/shared/dist
COPY entrypoint.sh /entrypoint.sh

RUN chmod +x /entrypoint.sh

EXPOSE 4000
ENTRYPOINT ["/entrypoint.sh"]
