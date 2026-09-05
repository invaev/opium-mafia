FROM node:20-alpine

WORKDIR /app

COPY shared/ ./shared/

COPY client-app/package*.json ./client-app/
COPY client-app/tsconfig*.json ./client-app/
COPY client-app/vite.config.ts ./client-app/
COPY client-app/postcss.config.js ./client-app/
COPY client-app/tailwind.config.js ./client-app/
COPY client-app/index.html ./client-app/
COPY client-app/src/ ./client-app/src/
COPY client-app/public/ ./client-app/public/

WORKDIR /app/client-app
RUN npm install

CMD ["npx", "vite", "--host", "0.0.0.0", "--port", "3000"]
