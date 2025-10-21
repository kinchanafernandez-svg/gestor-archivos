FROM node:20-alpine

WORKDIR /app

COPY package.json ./
COPY services/auditor-service/package.json ./services/auditor-service/
COPY shared/types/package.json ./shared/types/
COPY shared/utils/package.json ./shared/utils/

RUN npm install --workspaces

COPY . .

RUN npm run build --workspace=@distributed/types
RUN npm run build --workspace=@distributed/utils
RUN npm run build --workspace=@distributed/auditor-service

WORKDIR /app/services/auditor-service

EXPOSE 50053

CMD ["npm", "start"]
