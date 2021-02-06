FROM node:lts as builder

WORKDIR /app

COPY *.tgz ./
COPY package*.json ./

RUN npm ci

COPY . .

FROM node:lts-alpine

WORKDIR /app

COPY --from=builder /app/package.json /app/package-lock.json ./
COPY --from=builder /app/node_modules ./
COPY --from=builder /app/tsconfig.json ./
COPY --from=builder /app/src/ ./src
COPY entrypoint.sh ./entrypoint.sh

ENTRYPOINT [ "/app/entrypoint.sh" ]
CMD [ "--help" ]
