@echo off
echo 🚀 Deploying Varta AI to Production

REM Check if .env file exists
if not exist .env (
    echo ❌ .env file not found. Please create it from .env.example
    pause
    exit /b 1
)

REM Build the application
echo 🔨 Building application...
npm run build

REM Build Docker images
echo 🐳 Building Docker images...
npm run docker:build

REM Deploy with Docker Compose
echo 🚀 Deploying with Docker Compose...
npm run docker:up

echo ✅ Deployment complete!
echo 📱 Frontend: http://localhost:3000
echo 🔧 Backend API: http://localhost:5000
echo.
echo Monitor logs with: npm run docker:logs
echo Stop deployment with: npm run docker:down
pause
