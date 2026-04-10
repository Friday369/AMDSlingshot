FROM node:18-alpine

WORKDIR /app

# After antigravity_config.js moves package.json to the root, we will be building from the root context
COPY package*.json ./
RUN npm install --production

# Copy the rest of the application
# Assuming we will move server.js to root or run from root
COPY nutriflow ./nutriflow

EXPOSE 5000
CMD ["node", "nutriflow/server.js"]
