FROM node:13-buster-slim
COPY package*.json ./
RUN npm ci
COPY . .
EXPOSE 3001
CMD ["node", "index.js"]
