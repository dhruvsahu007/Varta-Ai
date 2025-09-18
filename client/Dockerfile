# Multi-stage build for Varta-AI frontend production deployment

# Stage 1: Builder stage - Build the React application
FROM node:20-alpine AS builder

# Set working directory
WORKDIR /app

# Copy package files for dependency installation
COPY package*.json ./
COPY tsconfig.json ./
COPY vite.config.ts ./
COPY tailwind.config.ts ./
COPY postcss.config.js ./
COPY components.json ./

# Copy source code directories
COPY client/ ./client/
COPY shared/ ./shared/

# Install all dependencies (including devDependencies for build)
RUN npm ci

# Build the frontend application
RUN npm run build:frontend

# Stage 2: Production stage - Serve with Nginx
FROM nginx:stable-alpine

# Copy built application from builder stage
COPY --from=builder /app/dist/public /usr/share/nginx/html

# Copy nginx configuration (optional, uses default if not provided)
# COPY nginx.conf /etc/nginx/nginx.conf

# Expose port 80
EXPOSE 80

# Health check - verify nginx is serving content
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost/ || exit 1

# Start nginx
CMD ["nginx", "-g", "daemon off;"]