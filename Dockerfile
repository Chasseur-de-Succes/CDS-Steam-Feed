FROM node:20.5-bookworm-slim

WORKDIR /app

COPY package.json .

RUN npm install

COPY models ./models
COPY repositories ./repositories
COPY util ./util
COPY knexfile.js .
COPY index.js .

CMD ["node", "index.js"]
