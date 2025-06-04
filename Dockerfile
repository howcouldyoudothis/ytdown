FROM node:18-slim
  RUN apt-get update && apt-get install -y yt-dlp && rm -rf /var/lib/apt/lists/*
  WORKDIR /app
  COPY package*.json ./
  RUN npm i --omit=dev
  COPY . .
  EXPOSE 3000
  CMD ["npm","start"]
