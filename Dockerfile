FROM node:12 as build

# Create app directory
COPY . /app/workflow-proxy

# Start app
WORKDIR /app/workflow-proxy
RUN yarn install --frozen-lockfile && yarn cache clean
RUN yarn test
RUN yarn run transpile


FROM node:12-alpine3.15

WORKDIR /app/workflow-proxy

COPY --from=build /app/workflow-proxy/lib /app/workflow-proxy/lib
COPY --from=build /app/workflow-proxy/package.json /app/workflow-proxy/package.json
COPY --from=build /app/workflow-proxy/node_modules /app/workflow-proxy/node_modules
COPY --from=build /app/workflow-proxy/openapi /app/workflow-proxy/openapi

USER node
CMD yarn start

