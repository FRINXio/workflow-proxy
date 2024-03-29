FROM node:19 as build

# Create app directory
COPY . /app/workflow-proxy

# Start app
WORKDIR /app/workflow-proxy
RUN yarn install --frozen-lockfile && yarn cache clean
RUN yarn test
RUN yarn run transpile


FROM node:19-alpine

ARG git_commit=unspecified
LABEL git_commit="${git_commit}"
LABEL org.opencontainers.image.source="https://github.com/FRINXio/workflow-proxy"

RUN apk update && apk upgrade && rm -rf /var/cache/apt/*
WORKDIR /app/workflow-proxy

COPY --from=build /app/workflow-proxy/lib /app/workflow-proxy/lib
COPY --from=build /app/workflow-proxy/package.json /app/workflow-proxy/package.json
COPY --from=build /app/workflow-proxy/node_modules /app/workflow-proxy/node_modules

USER node
CMD yarn start

