FROM node:20-alpine

RUN apk add --no-cache openssl

WORKDIR /app

COPY shared/ ./shared/

COPY server/package*.json ./server/
COPY server/prisma/ ./server/prisma/
COPY server/tsconfig.json ./server/
COPY server/src/ ./server/src/

WORKDIR /app/server
RUN npm install
RUN npx prisma generate

CMD ["sh", "-c", "npx prisma db push --accept-data-loss && npx tsx watch src/index.ts"]
