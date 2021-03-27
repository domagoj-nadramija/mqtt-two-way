FROM node:15

# Set default environment variables
ARG PROTOCOL
ARG APP_FILE
# Create app directory
WORKDIR /opt/app

# Install app dependencies
COPY package*.json ./
RUN npm install

# Copy everything for the protocol
COPY ${PROTOCOL} ./${PROTOCOL}
COPY common.js ./
