FROM node:lts as builder

WORKDIR /app

COPY . .
RUN npm ci

FROM node:lts-alpine

RUN apk add --no-cache tzdata

WORKDIR /app

COPY --from=builder /app/entrypoint.sh /app/package.json /app/package-lock.json /app/tsconfig.json ./
COPY --from=builder /app/node_modules/ ./node_modules/
COPY --from=builder /app/apidoc-template/ ./apidoc-template/
COPY --from=builder /app/src/ ./src/

ENTRYPOINT [ "./entrypoint.sh" ]
CMD [ "--help" ]
