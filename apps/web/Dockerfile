FROM node:22.21.1-alpine AS build
WORKDIR /workspace
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/contracts/package.json packages/contracts/package.json
RUN --mount=type=cache,target=/root/.npm npm ci --workspace=@asf/web --include-workspace-root
COPY apps/web apps/web
COPY packages/contracts packages/contracts
ARG VITE_API_BASE_URL=http://localhost:3000
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
RUN npm run build --workspace=@asf/web

FROM nginx:1.29.2-alpine
COPY infrastructure/docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /workspace/apps/web/dist /usr/share/nginx/html
USER nginx
EXPOSE 8080

