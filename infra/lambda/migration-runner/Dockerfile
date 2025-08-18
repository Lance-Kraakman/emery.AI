FROM public.ecr.aws/lambda/nodejs:20

# Install pnpm
RUN npm install -g pnpm

# Copy package.json and install dependencies
COPY package.json ${LAMBDA_TASK_ROOT}/
WORKDIR ${LAMBDA_TASK_ROOT}
RUN pnpm install

# Copy the Lambda handler
COPY index.mjs ${LAMBDA_TASK_ROOT}/

# Set the Lambda runtime handler
CMD [ "index.handler" ]
