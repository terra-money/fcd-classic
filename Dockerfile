FROM node:12

WORKDIR /app

COPY package.json ./
COPY yarn.lock ./

RUN yarn

COPY . .

ENTRYPOINT [ "yarn", "run" ]
CMD [ "--help" ]
