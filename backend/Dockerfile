FROM node:20-bookworm-slim

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm ci --no-audit --no-fund

COPY . .

RUN mkdir -p /app/data /app/uploads \
  && chown -R node:node /app

USER node

EXPOSE 4000

CMD ["npm", "run", "dev"]
