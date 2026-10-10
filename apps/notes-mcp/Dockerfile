FROM node:20-alpine AS builder

WORKDIR /app

RUN npm install -g pnpm@10.26.1

COPY apps/notes-mcp/package.json ./
COPY apps/notes-mcp/tsconfig.json ./

RUN pnpm install --ignore-scripts

COPY apps/notes-mcp/src ./src

RUN pnpm run build

FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

USER node

COPY --chown=node:node apps/notes-mcp/package.json ./
COPY --chown=node:node --from=builder /app/node_modules ./node_modules
COPY --chown=node:node --from=builder /app/dist ./dist

EXPOSE 3000

CMD ["node", "dist/index.js"]
