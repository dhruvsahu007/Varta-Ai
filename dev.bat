@echo off
echo 🚀 Starting Varta AI Development Environment

REM Start backend server in background
echo 🔧 Starting backend server on port 5000...
start "Backend" cmd /k "npm run dev:backend"

REM Wait for backend to start
timeout /t 3 /nobreak >nul

REM Start frontend server in background  
echo 🎨 Starting frontend server on port 3000...
start "Frontend" cmd /k "npm run dev:frontend"

echo ✅ Development environment ready!
echo 📱 Frontend: http://localhost:3000
echo 🔧 Backend API: http://localhost:5000
echo 🔌 WebSocket: ws://localhost:5000/ws
echo.
echo Close both terminal windows to stop servers
pause
