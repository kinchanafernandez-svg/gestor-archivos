FROM node:20-alpine

WORKDIR /app

COPY package.json ./
COPY services/file-service/package.json ./services/file-service/
COPY shared/types/package.json ./shared/types/
COPY shared/utils/package.json ./shared/utils/

RUN npm install --workspaces

COPY . .

RUN npm run build --workspace=@distributed/types
RUN npm run build --workspace=@distributed/utils
RUN npm run build --workspace=@distributed/file-service

WORKDIR /app/services/file-service

# Create storage directory
RUN mkdir -p /data/files

EXPOSE 50052

CMD ["npm", "start"]
