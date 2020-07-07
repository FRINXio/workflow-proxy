FROM node:12

EXPOSE 80

# Create app directory
WORKDIR /app

# Copy package dependencies
COPY package.json workflows-proxy/

# Copy app source
WORKDIR /app/workflows-proxy
COPY . .

# Start app
CMD yarn
CMD yarn run transpile
CMD yarn start
