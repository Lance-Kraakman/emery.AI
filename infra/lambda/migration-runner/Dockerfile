FROM node:20-alpine

RUN npm install -g pnpm

WORKDIR /var/task

# Install Node.js dependencies
COPY package.json .
RUN pnpm install

# Copy the handler code
COPY index.mjs .

# Set the command to run the Lambda function
CMD [ "index.handler" ]
