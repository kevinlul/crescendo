FROM node:13-buster-slim
WORKDIR /crescendo
ENV NODE_ENV production
ENV DEBUG crescendo*
ENV CRESCENDO_PORT 3001
ENV CONFIG_PATH config.json
ENV LOG_DIR ./log
COPY package*.json ./
RUN npm ci
COPY . .
CMD ["node", "index.js"]
