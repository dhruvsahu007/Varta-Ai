#!/bin/bash

echo "🚀 Deploying Varta AI to Production"

# Check if .env file exists
if [ ! -f .env ]; then
    echo "❌ .env file not found. Please create it from .env.example"
    exit 1
fi

# Build the application
echo "🔨 Building application..."
npm run build

# Build Docker images
echo "🐳 Building Docker images..."
npm run docker:build

# Deploy with Docker Compose
echo "🚀 Deploying with Docker Compose..."
npm run docker:up

echo "✅ Deployment complete!"
echo "📱 Frontend: http://localhost:3000"
echo "🔧 Backend API: http://localhost:5000"
echo ""
echo "Monitor logs with: npm run docker:logs"
echo "Stop deployment with: npm run docker:down"
