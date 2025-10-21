FROM node:20-alpine

WORKDIR /app

COPY package.json ./
COPY services/loadbalancer-service/package.json ./services/loadbalancer-service/
COPY shared/types/package.json ./shared/types/
COPY shared/utils/package.json ./shared/utils/

RUN npm install --workspaces

COPY . .

RUN npm run build --workspace=@distributed/types
RUN npm run build --workspace=@distributed/utils
RUN npm run build --workspace=@distributed/loadbalancer-service

WORKDIR /app/services/loadbalancer-service

EXPOSE 50056

CMD ["npm", "start"]
