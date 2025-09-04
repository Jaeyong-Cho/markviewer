#!/bin/bash

# MarkViewer External Access Server Launcher
# Starts servers with external access enabled

echo "🚀 Starting MarkViewer with External Access..."
echo "📡 Detecting network configuration..."

# Function to get local IP addresses
get_local_ips() {
    echo "🔍 Available network interfaces:"
    if command -v ifconfig &> /dev/null; then
        ifconfig | grep -E "inet [0-9]" | grep -v "127.0.0.1" | awk '{print "   " $2}'
    elif command -v ip &> /dev/null; then
        ip addr show | grep -E "inet [0-9]" | grep -v "127.0.0.1" | awk '{print "   " $2}' | cut -d'/' -f1
    else
        echo "   Cannot detect IP addresses automatically"
        echo "   Please check your network settings manually"
    fi
    echo ""
}

# Display network information
get_local_ips

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

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Start backend server
echo "🔧 Starting backend server (port 3001)..."
cd "$PROJECT_ROOT/backend"
node server.js &
BACKEND_PID=$!

# Wait a moment for backend to start
sleep 2

# Start frontend server
echo "🌐 Starting frontend server (port 8080)..."
cd "$PROJECT_ROOT"
python3 scripts/dev-server.py 8080 frontend &
FRONTEND_PID=$!

# Wait a moment for frontend to start
sleep 2

echo ""
echo "✅ Servers started successfully!"
echo ""
echo "📱 Access your application:"
echo "   Local:     http://localhost:8080"
echo "   External:  http://<your-ip>:8080"
echo ""
echo "🔧 API Endpoint:"
echo "   Local:     http://localhost:3001/api"
echo "   External:  http://<your-ip>:3001/api"
echo ""
echo "🔥 Tips for external access:"
echo "   1. Replace <your-ip> with one of the IP addresses shown above"
echo "   2. Make sure your firewall allows connections on ports 3001 and 8080"
echo "   3. On macOS, you may need to allow incoming connections in System Preferences"
echo ""
echo "🛑 Press Ctrl+C to stop both servers"
echo ""

# Wait for processes
wait $BACKEND_PID $FRONTEND_PID
