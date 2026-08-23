FROM node:20-alpine
WORKDIR /app
COPY package.json ./
COPY server.js index.html style.css app.js ./
COPY data ./data
ENV NODE_ENV=production
EXPOSE 3000
CMD ["node", "server.js"]
