FROM node:20-alpine

WORKDIR /app

COPY shared/ ./shared/

COPY gm-app/package*.json ./gm-app/
COPY gm-app/tsconfig*.json ./gm-app/
COPY gm-app/vite.config.ts ./gm-app/
COPY gm-app/index.html ./gm-app/
COPY gm-app/src/ ./gm-app/src/
COPY gm-app/public/ ./gm-app/public/

WORKDIR /app/gm-app
RUN npm install

CMD ["npx", "vite", "--host", "0.0.0.0", "--port", "7777"]
