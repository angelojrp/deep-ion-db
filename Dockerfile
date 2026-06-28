# Imagem do backend web (épico #53). Roda o servidor Fastify que reaproveita os drivers.
FROM node:20-bookworm-slim

WORKDIR /app

# Toolchain para módulos nativos (better-sqlite3); o binário do Electron é dispensável aqui.
ENV ELECTRON_SKIP_BINARY_DOWNLOAD=1
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ ca-certificates curl \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

COPY tsconfig.json tsconfig.node.json tsconfig.web.json ./
COPY scripts ./scripts
COPY src ./src
COPY server ./server
COPY web ./web

# Builda o frontend web (gera web/public/app.js) — reaproveita a UI do desktop.
RUN npm run web:build

ENV PORT=4000
EXPOSE 4000

HEALTHCHECK --interval=10s --timeout=3s --retries=5 \
  CMD curl -fsS http://127.0.0.1:4000/health || exit 1

CMD ["npm", "run", "server:start"]
