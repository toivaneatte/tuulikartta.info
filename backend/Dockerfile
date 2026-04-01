FROM node:20-alpine

WORKDIR /app

# Set production environment early
ENV NODE_ENV=production

# Copy package files
COPY package.json package-lock.json* ./

# Install dependencies (including devDependencies for nodemon)
RUN npm ci --omit=dev

# Copy the entire backend application
COPY . .

# Expose the port your app runs on (adjust if needed)
EXPOSE 3000

# Use non-root user for security
USER node

# Run the development server with nodemon
CMD ["npm", "run", "start"]
