FROM node:22-bookworm-slim

RUN apt-get update && \
    apt-get install -y --no-install-recommends stockfish && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json ./
RUN npm install --omit=dev
RUN ln -s /usr/games/stockfish /usr/local/bin/stockfish

COPY server.js ./

EXPOSE 3000

CMD ["npm", "start"]
