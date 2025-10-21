FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package.json ./
COPY services/user-service/package.json ./services/user-service/
COPY shared/types/package.json ./shared/types/
COPY shared/utils/package.json ./shared/utils/

# Install dependencies
RUN npm install --workspaces

# Copy source code
COPY . .

# Build shared libraries
RUN npm run build --workspace=@distributed/types
RUN npm run build --workspace=@distributed/utils

# Build service
RUN npm run build --workspace=@distributed/user-service

WORKDIR /app/services/user-service

EXPOSE 50051

CMD ["npm", "start"]
