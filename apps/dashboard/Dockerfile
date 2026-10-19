FROM node:20-alpine AS builder

WORKDIR /app

RUN npm install -g pnpm@10.26.1

COPY apps/dashboard/package.json ./
RUN pnpm install --ignore-scripts

COPY apps/dashboard ./
RUN pnpm run build

FROM nginx:1.27-alpine

COPY --from=builder /app/dist /usr/share/nginx/html
COPY apps/dashboard/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
