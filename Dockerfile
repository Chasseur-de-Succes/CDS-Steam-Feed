FROM node:20.5-bookworm-slim

WORKDIR /app

COPY package.json .

RUN npm install

COPY models ./models
COPY util ./util
COPY index.js .

CMD ["node", "index.js"]
