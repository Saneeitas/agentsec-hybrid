FROM node:22.21.1-alpine AS build
WORKDIR /workspace
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/contracts/package.json packages/contracts/package.json
RUN --mount=type=cache,target=/root/.npm npm ci --workspace=@asf/api --include-workspace-root
COPY apps/api apps/api
COPY packages/contracts packages/contracts
RUN npm run build --workspace=@asf/api

FROM node:22.21.1-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /workspace
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/contracts/package.json packages/contracts/package.json
RUN --mount=type=cache,target=/root/.npm npm ci --omit=dev --workspace=@asf/api --include-workspace-root
COPY --from=build /workspace/apps/api/dist apps/api/dist
COPY --from=build /workspace/apps/api/drizzle apps/api/drizzle
USER node
WORKDIR /workspace/apps/api
EXPOSE 3000
CMD ["node", "dist/server.js"]

