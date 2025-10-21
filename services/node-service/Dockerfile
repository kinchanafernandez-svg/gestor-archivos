FROM node:20-alpine

WORKDIR /app

COPY package.json ./
COPY services/node-service/package.json ./services/node-service/
COPY shared/types/package.json ./shared/types/
COPY shared/utils/package.json ./shared/utils/

RUN npm install --workspaces

COPY . .

RUN npm run build --workspace=@distributed/types
RUN npm run build --workspace=@distributed/utils
RUN npm run build --workspace=@distributed/node-service

WORKDIR /app/services/node-service

EXPOSE 50054

CMD ["npm", "start"]
