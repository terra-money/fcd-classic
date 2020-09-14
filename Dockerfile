FROM node:12 as builder

WORKDIR /app

COPY package*.json ./

RUN npm ci

COPY . .

RUN npm run apidoc

FROM node:12-alpine

WORKDIR /app

RUN apk add --no-cache git tzdata

COPY --from=builder /app/package.json /app/package-lock.json /app/

RUN npm ci --only=production \
    && apk del git

COPY --from=builder /app/tsconfig.json /app/
COPY --from=builder /app/src/ /app/src/
COPY --from=builder /app/static/ /app/static/
COPY entrypoint.sh /app/entrypoint.sh

ENTRYPOINT [ "/app/entrypoint.sh" ]
CMD [ "--help" ]
