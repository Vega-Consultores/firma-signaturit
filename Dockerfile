# 1) base image  
FROM node:18-slim

# 2) install Chromium & deps for Puppeteer  
RUN apt-get update && apt-get install -y \
    chromium \
    fonts-liberation \
    libx11-6 libx11-xcb1 libxcb1 libxcomposite1 libxdamage1 \
    libxrandr2 xdg-utils libnss3 libatk-bridge2.0-0 libatspi2.0-0 \
    libgtk-3-0 libdrm2 libgbm1 libasound2 \
  && rm -rf /var/lib/apt/lists/*

# 3) tell Puppeteer to use that Chrome  
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

# 4) copy & install our code  
WORKDIR /usr/src/app
COPY package*.json ./
RUN npm install
COPY . .

# 5) open port & launch the server  
EXPOSE 3000
CMD ["node", "server.js"]
