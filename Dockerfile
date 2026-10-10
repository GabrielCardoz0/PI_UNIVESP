FROM node:20-slim

# Prisma precisa do OpenSSL; tini repassa sinais (SIGTERM) corretamente
RUN apt-get update -y \
 && apt-get install -y --no-install-recommends openssl ca-certificates tini \
 && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production \
    PORT=3000 \
    DATABASE_URL=file:/data/prod.db

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY prisma ./prisma
RUN npx prisma generate

COPY server.js app.js ./
COPY src ./src
COPY public ./public

# Banco SQLite fica em volume (/data) para sobreviver a redeploys
RUN mkdir -p /data && chown -R node:node /data /app
USER node
VOLUME ["/data"]
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s \
  CMD node -e "fetch('http://localhost:'+process.env.PORT+'/login.html').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

ENTRYPOINT ["/usr/bin/tini", "--"]
# Cria/atualiza as tabelas no volume e sobe a API
CMD ["sh", "-c", "npx prisma db push --skip-generate && node server.js"]
