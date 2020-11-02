FROM node:12

EXPOSE 80
EXPOSE 8088

# Create app directory
WORKDIR /app

COPY . /app/workflow-proxy

# Start app
WORKDIR /app/workflow-proxy
RUN yarn install --frozen-lockfile && yarn cache clean
RUN yarn run transpile
CMD yarn start
