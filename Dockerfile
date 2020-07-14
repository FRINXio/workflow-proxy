FROM node:12

EXPOSE 80

# Create app directory
WORKDIR /app

COPY workflow-proxy/ /app/workflow-proxy

# "keycloak-client" is a local module dependency of workflow-proxy
COPY keycloak-client /app/keycloak-client


# Start app
WORKDIR /app/workflow-proxy
RUN yarn install
RUN yarn run transpile
CMD yarn start
