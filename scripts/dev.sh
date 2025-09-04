#!/bin/bash

# MarkViewer Development Server Launcher
# Starts both backend and frontend servers with proper configuration

echo "🚀 Starting MarkViewer Development Environment..."

# Function to kill processes on exit
cleanup() {
    echo "🛑 Shutting down servers..."
    pkill -f "node.*server.js" 2>/dev/null
    pkill -f "python3.*dev-server.py" 2>/dev/null
    exit 0
}

# Set up signal handlers
trap cleanup SIGINT SIGTERM

# Check if ports are available
check_port() {
    local port=$1
    if lsof -ti:$port >/dev/null 2>&1; then
        echo "⚠️  Port $port is already in use. Attempting to free it..."
        lsof -ti:$port | xargs kill -9 2>/dev/null
        sleep 1
    fi
}

# Check and free ports
check_port 3001
check_port 8080

echo "📡 Starting backend server on port 3001..."
cd backend && npm run dev &
BACKEND_PID=$!

# Wait a moment for backend to start
sleep 2

echo "🌐 Starting frontend server on port 8080..."
cd frontend && npm run serve &
FRONTEND_PID=$!

# Wait a moment for frontend to start
sleep 2

echo ""
echo "✅ Development servers are running:"
echo "   📱 Frontend: http://localhost:8080"
echo "   🔧 Backend:  http://localhost:3001"
echo ""
echo "Press Ctrl+C to stop all servers"

# Wait for processes to finish
wait $BACKEND_PID $FRONTEND_PID
