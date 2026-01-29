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

# Build TypeScript to JavaScript
RUN npm run build

# Stage 2: Production stage
FROM node:20-alpine

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001

WORKDIR /app

# Copy package files
COPY package*.json ./
ENV MONGO_URI=***REDACTED-SECRET*** \
    PORT=8080 \
    TWILIO_ACCOUNT_SID=***REDACTED-SECRET*** \
    TWILIO_AUTH_TOKEN=***REDACTED-SECRET*** \
    TWILIO_PHONE_NUMBER=+15705325932 \
    JWT_SECRET=***REDACTED-SECRET*** \
    CRYPTO_PASSWORD=***REDACTED-SECRET*** \
    GOOGLE_CLIENT_ID=22298582409-vbg0k3nd79rkdgu0qbt1umg9625hudl7.apps.googleusercontent.com \
    LOG_LEVEL=info \
    LOG_PRETTY_PRINT=true \
    LOG_FILE_PATH=./logs \
    NODE_ENV=development \
    SERVICE_NAME=core-server \
    SERVICE_VERSION=1.0.0 \
    ENABLE_PII_REDACTION=true \
    LOG_TO_FILE=true \
    RAZORPAY_API_KEY=***REDACTED-SECRET*** \
    RAZORPAY_SECRET_KEY=***REDACTED-SECRET*** \
    REDIS_HOST=redis-server \
    REDIS_PORT=6379 \
    REDIS_PASSWORD=

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
EXPOSE 8080

# Set environment to production
ENV NODE_ENV=production

# Run the app from build directory
CMD ["node", "build/index.js"]