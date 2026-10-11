FROM node:20-alpine AS builder

WORKDIR /app

RUN npm install -g pnpm@10.26.1

COPY apps/gateway/package.json ./
COPY apps/gateway/tsconfig.json ./

RUN pnpm install --ignore-scripts

COPY apps/gateway/prisma ./prisma
RUN npx prisma generate

COPY apps/gateway/src ./src
RUN ./node_modules/.bin/tsc

FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

RUN npm install -g pnpm@10.26.1

COPY apps/gateway/package.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma

EXPOSE 3000

CMD ["node", "dist/index.js"]
