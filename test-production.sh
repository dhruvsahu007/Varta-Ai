#!/bin/bash

echo "🧪 Testing Production Build"

# Test if environment variables are set
if [ -z "$DATABASE_URL" ] || [ -z "$OPENAI_API_KEY" ]; then
    echo "⚠️  Warning: DATABASE_URL or OPENAI_API_KEY not set"
fi

# Build the application
echo "🔨 Building application..."
npm run build:frontend
npm run build:backend

# Check if build files exist
if [ ! -d "dist/public" ]; then
    echo "❌ Frontend build failed - dist/public not found"
    exit 1
fi

if [ ! -f "dist/index.js" ]; then
    echo "❌ Backend build failed - dist/index.js not found"
    exit 1
fi

echo "✅ Build successful!"

# Test backend health endpoint
echo "🏥 Testing backend health..."
npm run start &
BACKEND_PID=$!

sleep 5

HEALTH_CHECK=$(curl -s http://localhost:5000/api/health || echo "failed")
if [[ $HEALTH_CHECK == *"healthy"* ]]; then
    echo "✅ Backend health check passed"
else
    echo "❌ Backend health check failed"
fi

# Cleanup
kill $BACKEND_PID 2>/dev/null

echo "🎉 Production test complete!"
