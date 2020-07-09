FROM node:12 as builder

WORKDIR /app

COPY package.json ./
COPY yarn.lock ./

RUN yarn

COPY . .

RUN yarn run apidoc \
    && yarn run mergeswagger -o swagger.json

FROM node:12-alpine

WORKDIR /app

COPY --from=builder /app/package.json /app/yarn.lock /app/

RUN yarn --prod

COPY --from=builder /app/tsconfig.json /app/
COPY --from=builder /app/static /app/static
COPY --from=builder /app/src/ /app/src/

ENTRYPOINT [ "yarn", "run" ]
CMD [ "--help" ]
