FROM node:20-alpine

WORKDIR /app

COPY package.json ./
COPY services/security-service/package.json ./services/security-service/
COPY shared/types/package.json ./shared/types/
COPY shared/utils/package.json ./shared/utils/

RUN npm install --workspaces

COPY . .

RUN npm run build --workspace=@distributed/types
RUN npm run build --workspace=@distributed/utils
RUN npm run build --workspace=@distributed/security-service

WORKDIR /app/services/security-service

EXPOSE 50055

CMD ["npm", "start"]
