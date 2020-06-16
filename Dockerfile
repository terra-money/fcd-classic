FROM node:12

WORKDIR /app

COPY package.json ./
COPY yarn.lock ./

RUN yarn

COPY . .

RUN yarn run apidoc \
    && yarn run mergeswagger -- -o swagger.json

ENTRYPOINT [ "yarn", "run" ]
CMD [ "--help" ]
