FROM node:22-alpine

ENV NODE_ENV=production
WORKDIR /app

# scripts/ và public/ phải có sẵn trước khi cài, vì postinstall sinh icon PWA.
COPY package*.json ./
COPY scripts ./scripts
COPY public ./public
RUN npm ci --omit=dev

COPY server ./server

EXPOSE 3000
CMD ["node", "server/index.js"]
