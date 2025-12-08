# Stage 1: Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install ALL dependencies (including devDependencies for building)
RUN npm ci --legacy-peer-deps

# Copy TypeScript config and source code
COPY tsconfig.json ./
COPY VivaMamaServiceAccountKey.json ./
COPY src ./src
COPY .env ./

# Build TypeScript to JavaScript
RUN npm run build

# Stage 2: Production stage
FROM node:20-alpine

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install only production dependencies
# RUN npm ci --legacy-peer-deps --only=production && npm cache clean --force
RUN npm config set ignore-scripts true \
    && npm ci --legacy-peer-deps --only=production \
    && npm cache clean --force

# Copy built JavaScript files from builder stage
COPY --from=builder --chown=nodejs:nodejs /app/build ./build

# Copy Firebase service account key
COPY --chown=nodejs:nodejs VivaMamaServiceAccountKey.json ./

# Switch to non-root user
USER nodejs

# Expose port (adjust if your app uses different port)
EXPOSE 4000

# Set environment to production
ENV NODE_ENV=production

# Run the app from build directory
CMD ["node", "build/index.js"]