# Multi-stage build for Varta-AI backend production deployment

# Stage 1: Builder stage - Build the application
FROM node:20-alpine AS builder

# Set working directory
WORKDIR /app

# Copy package files for dependency installation
COPY package*.json ./
COPY tsconfig.json ./
COPY drizzle.config.ts ./

# Copy all root-level config files needed for build
COPY vite.config.ts ./
COPY postcss.config.js ./
COPY tailwind.config.ts ./
COPY components.json ./

# Copy source code directories
COPY server/ ./server/
COPY shared/ ./shared/
COPY migrations/ ./migrations/

# Install all dependencies (including devDependencies for build)
RUN npm ci

# Build the backend application
RUN npm run build:backend

# Stage 2: Runtime stage - Create production image
FROM node:20-alpine AS runtime

# Install curl for healthcheck
RUN apk add --no-cache curl

# Create app user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S varta -u 1001

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install only production dependencies
RUN npm ci --only=production && npm cache clean --force

# Copy built application from builder stage
COPY --from=builder /app/dist ./dist/

# Copy necessary runtime files
COPY --from=builder /app/shared ./shared/
COPY --from=builder /app/migrations ./migrations/

# Change ownership to app user
RUN chown -R varta:nodejs /app
USER varta

# Expose port 3000
EXPOSE 3000

# Health check - calls the /api/health endpoint
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/api/health || exit 1

# Set production environment
ENV NODE_ENV=production
ENV PORT=3000

# Start the application
CMD ["node", "dist/index.js"]