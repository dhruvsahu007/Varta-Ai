#!/bin/bash

# Development setup script
echo "🚀 Starting Varta AI Development Environment"

# Function to kill background processes on exit
cleanup() {
    echo "🔄 Cleaning up processes..."
    kill $BACKEND_PID $FRONTEND_PID 2>/dev/null
    exit
}

# Set trap to cleanup on script exit
trap cleanup EXIT INT TERM

# Start backend server
echo "🔧 Starting backend server on port 5000..."
npm run dev:backend &
BACKEND_PID=$!

# Wait for backend to start
sleep 3

# Start frontend server
echo "🎨 Starting frontend server on port 3000..."
npm run dev:frontend &
FRONTEND_PID=$!

echo "✅ Development environment ready!"
echo "📱 Frontend: http://localhost:3000"
echo "🔧 Backend API: http://localhost:5000"
echo "🔌 WebSocket: ws://localhost:5000/ws"
echo ""
echo "Press Ctrl+C to stop all servers"

# Wait for background processes
wait
